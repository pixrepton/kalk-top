<?php

require_once __DIR__ . '/harness-lib.php';

/**
 * @param bool $condition
 * @param string $message
 * @return void
 */
function topinstal_ozc_regression_assert($condition, $message)
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

/**
 * @param array<int,array<string,mixed>> $losses
 * @return float
 */
function topinstal_ozc_sum_energy_losses($losses)
{
    $sum = 0.0;
    foreach ($losses as $item) {
        if (is_array($item) && isset($item['percent']) && is_numeric($item['percent'])) {
            $sum += (float) $item['percent'];
        }
    }

    return $sum;
}

topinstal_harness_bootstrap();

$request = topinstal_harness_load_fixture('baseline-floor-heating.json');
$request['traceId'] = 'ozc-full-audit-regression';
$request['building']['floor_area'] = 135;
$request['building']['building_floors'] = 1;
$request['building']['floor_height'] = 2.6;
$request['building']['ventilation_type'] = 'natural';
$request['building']['construction_type'] = 'traditional';
$request['building']['primary_wall_material'] = 57;
$request['building']['wall_size'] = 24;
$request['building']['external_wall_isolation'] = array('material' => 68, 'size' => 15);
$request['building']['top_isolation'] = array('material' => 68, 'size' => 25);
$request['building']['bottom_isolation'] = array('material' => 68, 'size' => 12);
$request['building']['windows_type'] = 'new_double_glass';
$request['building']['number_windows'] = 8;
$request['building']['number_doors'] = 2;
$request['building']['doors_type'] = 'new_pvc';
$request['building']['building_roof'] = 'oblique';

$building = $request['building'];
unset($building['indoor_temperature']);

$preferencesSparse = $request['preferences'];
$preferencesSparse['heating']['indoorTemperatureC'] = null;

$preferencesControl = $request['preferences'];
$preferencesControl['heating']['indoorTemperatureC'] = 21;

$engine = new TopInstal_OzcEngine_Full();
$sparseResult = $engine->computeDesignHeatLoss($building, $preferencesSparse);
$controlResult = $engine->computeDesignHeatLoss($building, $preferencesControl);

topinstal_ozc_regression_assert(
    abs((float) $sparseResult['designHeatLoss_kW'] - (float) $controlResult['designHeatLoss_kW']) < 0.01,
    'Sparse indoor_temperature should match explicit 21C result.'
);
echo '[PASS] Full OZC sparse indoor_temperature matches explicit 21C design load' . PHP_EOL;

$atticBaseBuilding = $building;
$atticBaseBuilding['building_roof'] = 'steep';
$atticBaseBuilding['building_floors'] = 1;
$atticBaseBuilding['building_heated_floors'] = array(1);
$atticSteepWithoutPoddasze = $engine->computeDesignHeatLoss($atticBaseBuilding, $preferencesControl);
$atticBaseBuilding['building_heated_floors'] = array(1, 2);
$atticSteepWithPoddasze = $engine->computeDesignHeatLoss($atticBaseBuilding, $preferencesControl);

$atticAssumptionNeedle = 'Poddasze (dach skosny z poddaszem)';
$atticAssumptionMatches = static function ($item) use ($atticAssumptionNeedle) {
    if (is_string($item)) {
        return strpos($item, $atticAssumptionNeedle) !== false;
    }
    if (!is_array($item)) {
        return false;
    }
    if (isset($item['message']) && is_string($item['message']) && strpos($item['message'], $atticAssumptionNeedle) !== false) {
        return true;
    }
    if (
        isset($item['params']['message']) &&
        is_string($item['params']['message']) &&
        strpos($item['params']['message'], $atticAssumptionNeedle) !== false
    ) {
        return true;
    }
    return false;
};
$atticAssumptionsWithout = isset($atticSteepWithoutPoddasze['assumptions']) && is_array($atticSteepWithoutPoddasze['assumptions'])
    ? $atticSteepWithoutPoddasze['assumptions']
    : array();
$hasAtticAssumptionWithout = false;
foreach ($atticAssumptionsWithout as $atticAssumptionItem) {
    if ($atticAssumptionMatches($atticAssumptionItem)) {
        $hasAtticAssumptionWithout = true;
        break;
    }
}
topinstal_ozc_regression_assert(
    !$hasAtticAssumptionWithout,
    'Steep without poddasze must not apply attic volume correction.'
);
$atticAssumptionsWith = isset($atticSteepWithPoddasze['assumptions']) && is_array($atticSteepWithPoddasze['assumptions'])
    ? $atticSteepWithPoddasze['assumptions']
    : array();
$hasAtticAssumptionWith = false;
foreach ($atticAssumptionsWith as $atticAssumptionItem) {
    if ($atticAssumptionMatches($atticAssumptionItem)) {
        $hasAtticAssumptionWith = true;
        break;
    }
}
topinstal_ozc_regression_assert(
    $hasAtticAssumptionWith,
    'Steep with explicit poddasze must apply attic volume correction.'
);
$heatedWithout = isset($atticSteepWithoutPoddasze['heatedArea_m2'])
    ? (float) $atticSteepWithoutPoddasze['heatedArea_m2']
    : null;
$heatedWith = isset($atticSteepWithPoddasze['heatedArea_m2'])
    ? (float) $atticSteepWithPoddasze['heatedArea_m2']
    : null;
topinstal_ozc_regression_assert(
    is_numeric($heatedWithout) && is_numeric($heatedWith) && $heatedWith > $heatedWithout,
    'Steep attic heated area must grow only when poddasze is explicitly heated.'
);
echo '[PASS] Full OZC steep attic correction requires explicit poddasze floor' . PHP_EOL;

topinstal_ozc_regression_assert(
    isset($sparseResult['metrics']['avg_heating_power']) && is_numeric($sparseResult['metrics']['avg_heating_power']) && (float) $sparseResult['metrics']['avg_heating_power'] >= 0.0,
    'Full OZC avg_heating_power must be non-negative.'
);
echo '[PASS] Full OZC rejects negative avg_heating_power output' . PHP_EOL;

topinstal_ozc_regression_assert(
    isset($sparseResult['audit']['methods']['annual_energy']['canonical']) && $sparseResult['audit']['methods']['annual_energy']['canonical'] === false,
    'Full OZC audit must mark annual_energy as non-canonical estimate.'
);
echo '[PASS] Full OZC audit marks annual_energy as estimate' . PHP_EOL;

topinstal_ozc_regression_assert(
    isset($sparseResult['audit']['defaults_used']) &&
    array_values(array_filter(
        $sparseResult['audit']['defaults_used'],
        static function ($item) {
            return is_array($item) && isset($item['code']) && $item['code'] === 'DEFAULT_INDOOR_TEMPERATURE_ASSUMED';
        }
    )) !== array(),
    'Full OZC audit must include DEFAULT_INDOOR_TEMPERATURE_ASSUMED.'
);
echo '[PASS] Full OZC audit carries DEFAULT_INDOOR_TEMPERATURE_ASSUMED' . PHP_EOL;

topinstal_ozc_regression_assert(
    isset($sparseResult['raw']) && is_array($sparseResult['raw']),
    'Full OZC bridge must expose raw result alongside audit.'
);
echo '[PASS] Full OZC bridge exposes raw result' . PHP_EOL;

$energyLossSum = topinstal_ozc_sum_energy_losses(
    isset($sparseResult['extended']['energy_losses']) && is_array($sparseResult['extended']['energy_losses'])
        ? $sparseResult['extended']['energy_losses']
        : array()
);
topinstal_ozc_regression_assert(
    abs($energyLossSum - 100.0) <= 0.25,
    'Full OZC energy_losses must sum to 100 (+/- 0.25), got ' . $energyLossSum
);
echo '[PASS] Full OZC energy_losses preserve 100% balance' . PHP_EOL;

$useCase = topinstal_harness_create_use_case();
$offer = $useCase->execute($request);
$ozc = isset($offer['engineering']['ozc']) && is_array($offer['engineering']['ozc']) ? $offer['engineering']['ozc'] : array();

topinstal_ozc_regression_assert(
    isset($ozc['audit']) && is_array($ozc['audit']),
    'OfferDTO engineering.ozc must expose audit.'
);
topinstal_ozc_regression_assert(
    isset($ozc['audit']['methods']['annual_energy']['canonical']) && $ozc['audit']['methods']['annual_energy']['canonical'] === false,
    'OfferDTO engineering.ozc.audit must preserve annual_energy estimate metadata.'
);
echo '[PASS] OfferDTO preserves OZC audit metadata' . PHP_EOL;

$locationBuilding = $request['building'];
unset($locationBuilding['location_id']);

$parityLocationEngine = new TopInstal_OzcEngine();
$parityLocationResult = $parityLocationEngine->computeDesignHeatLoss($locationBuilding, $request['preferences']);
$fullLocationResult = $engine->computeDesignHeatLoss($locationBuilding, $request['preferences']);

$parityLocationAssumptions = isset($parityLocationResult['assumptions']) && is_array($parityLocationResult['assumptions'])
    ? $parityLocationResult['assumptions']
    : array();
$fullLocationAuditDefaults = isset($fullLocationResult['audit']['defaults_used']) && is_array($fullLocationResult['audit']['defaults_used'])
    ? $fullLocationResult['audit']['defaults_used']
    : array();

$parityUsesZoneDefault = array_values(array_filter(
    $parityLocationAssumptions,
    static function ($item) {
        return is_array($item)
            && isset($item['code'])
            && $item['code'] === 'DEFAULT_LOCATION_ASSUMED'
            && isset($item['params']['defaultLocationId'])
            && $item['params']['defaultLocationId'] === 'PL_STREFA_III';
    }
)) !== array();

$fullUsesZoneDefault = array_values(array_filter(
    $fullLocationAuditDefaults,
    static function ($item) {
        return is_array($item)
            && isset($item['code'])
            && $item['code'] === 'DEFAULT_LOCATION_ASSUMED'
            && isset($item['params']['defaultLocationId'])
            && $item['params']['defaultLocationId'] === 'PL_STREFA_III';
    }
)) !== array();

topinstal_ozc_regression_assert(
    $parityUsesZoneDefault,
    'Parity OZC must default missing location_id to PL_STREFA_III.'
);
topinstal_ozc_regression_assert(
    $fullUsesZoneDefault,
    'Full OZC must default missing location_id to PL_STREFA_III.'
);
echo '[PASS] Parity and Full OZC share the same default location contract' . PHP_EOL;

echo PHP_EOL . 'OZC full audit regression OK.' . PHP_EOL;
