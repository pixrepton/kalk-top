<?php

require_once __DIR__ . '/harness-lib.php';

/**
 * @param bool $condition
 * @param string $message
 * @return void
 */
function topinstal_ozc_heating_costs_assert($condition, $message)
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

/**
 * @param float|int|null $expected
 * @param float|int|null $actual
 * @param string $message
 * @param float $tolerance
 * @return void
 */
function topinstal_ozc_heating_costs_compare_number($expected, $actual, $message, $tolerance = 0.001)
{
    if ($expected === null || $actual === null) {
        topinstal_ozc_heating_costs_assert($expected === $actual, $message . ' (null mismatch)');
        return;
    }

    $left = (float) $expected;
    $right = (float) $actual;
    if (abs($left - $right) > $tolerance) {
        throw new RuntimeException($message . ' expected=' . $left . ' actual=' . $right);
    }
}

/**
 * @param string|null $value
 * @return string
 */
function topinstal_ozc_heating_costs_normalize_text($value)
{
    $value = is_string($value) ? $value : '';
    $value = strtr($value, array(
        'ą' => 'a', 'Ą' => 'A',
        'ć' => 'c', 'Ć' => 'C',
        'ę' => 'e', 'Ę' => 'E',
        'ł' => 'l', 'Ł' => 'L',
        'ń' => 'n', 'Ń' => 'N',
        'ó' => 'o', 'Ó' => 'O',
        'ś' => 's', 'Ś' => 'S',
        'ź' => 'z', 'Ź' => 'Z',
        'ż' => 'z', 'Ż' => 'Z',
    ));
    $value = strtolower($value);
    $value = preg_replace('/[^a-z0-9]+/', ' ', $value);
    $value = preg_replace('/\s+/', ' ', (string) $value);
    return trim((string) $value);
}

/**
 * @param array<string,mixed> $building
 * @param array<string,mixed> $preferences
 * @return array<string,mixed>
 */
function topinstal_build_direct_ozc_payload($building, $preferences)
{
    $payload = is_array($building) ? $building : array();
    $preferences = is_array($preferences) ? $preferences : array();

    if (!isset($payload['heating_type']) || $payload['heating_type'] === '') {
        $payload['heating_type'] = isset($preferences['heating']['emitterType']) ? $preferences['heating']['emitterType'] : null;
    }
    if (!isset($payload['ventilation_type']) || $payload['ventilation_type'] === '') {
        $payload['ventilation_type'] = isset($preferences['heating']['ventilationType']) ? $preferences['heating']['ventilationType'] : null;
    }
    if (!isset($payload['indoor_temperature']) || $payload['indoor_temperature'] === '') {
        $payload['indoor_temperature'] = isset($preferences['heating']['indoorTemperatureC']) ? $preferences['heating']['indoorTemperatureC'] : null;
    }
    if (!array_key_exists('include_hot_water', $payload)) {
        $payload['include_hot_water'] = !empty($preferences['dhw']['enabled']);
    }
    if (!isset($payload['hot_water_persons']) || $payload['hot_water_persons'] === '') {
        $payload['hot_water_persons'] = isset($preferences['dhw']['persons']) ? $preferences['dhw']['persons'] : null;
    }
    if (!isset($payload['hot_water_usage']) || $payload['hot_water_usage'] === '') {
        $payload['hot_water_usage'] = isset($preferences['dhw']['usageProfile']) ? $preferences['dhw']['usageProfile'] : null;
    }
    if (!isset($payload['location_id']) || trim((string) $payload['location_id']) === '') {
        $payload['location_id'] = 'PL_STREFA_III';
    }
    if (!isset($payload['floor_area']) || !is_numeric($payload['floor_area']) || (float) $payload['floor_area'] <= 0.0) {
        if (isset($payload['heated_area']) && is_numeric($payload['heated_area']) && (float) $payload['heated_area'] > 0.0) {
            $payload['floor_area'] = (float) $payload['heated_area'];
        } elseif (isset($payload['total_area']) && is_numeric($payload['total_area']) && (float) $payload['total_area'] > 0.0) {
            $payload['floor_area'] = (float) $payload['total_area'];
        } elseif (
            isset($payload['building_length'], $payload['building_width']) &&
            is_numeric($payload['building_length']) &&
            is_numeric($payload['building_width']) &&
            (float) $payload['building_length'] > 0.0 &&
            (float) $payload['building_width'] > 0.0
        ) {
            $payload['floor_area'] = (float) $payload['building_length'] * (float) $payload['building_width'];
        } else {
            $payload['floor_area'] = 100.0;
        }
    }

    return $payload;
}

/**
 * @param array<string,mixed> $full
 * @param string $scenario
 * @return void
 */
function topinstal_assert_heating_costs_php_contract($full, $scenario)
{
    $rows = isset($full['extended']['heating_costs']) && is_array($full['extended']['heating_costs'])
        ? array_values($full['extended']['heating_costs'])
        : array();
    topinstal_ozc_heating_costs_assert(count($rows) >= 5, $scenario . ': heating_costs rows missing.');

    $heatPump = null;
    foreach ($rows as $row) {
        if (is_array($row) && isset($row['key']) && $row['key'] === 'heat_pump') {
            $heatPump = $row;
            break;
        }
    }
    topinstal_ozc_heating_costs_assert(is_array($heatPump), $scenario . ': heat_pump row missing.');
    topinstal_ozc_heating_costs_assert(
        isset($heatPump['annual_cost_total_pln']) && (float) $heatPump['annual_cost_total_pln'] > 0,
        $scenario . ': heat_pump annual cost must be positive.'
    );

    $assumptions = isset($full['extended']['heating_costs_assumptions']) && is_array($full['extended']['heating_costs_assumptions'])
        ? $full['extended']['heating_costs_assumptions']
        : array();
    topinstal_ozc_heating_costs_assert(isset($assumptions['scopUsed']), $scenario . ': heating_costs_assumptions.scopUsed missing.');
    topinstal_ozc_heating_costs_assert(
        isset($assumptions['annualKWhTotal']) && (float) $assumptions['annualKWhTotal'] > 0,
        $scenario . ': annualKWhTotal must be positive.'
    );
}

topinstal_harness_bootstrap();

$base_request = topinstal_harness_load_fixture('baseline-floor-heating.json');
$base_request['traceId'] = 'ozc-heating-costs-regression';

$scenarios = array(
    'baseline-no-cwu' => array(
        'mode' => 'php-contract',
        'factory' => function ($request) {
        $request['preferences']['dhw']['enabled'] = false;
        unset($request['building']['include_hot_water'], $request['building']['hot_water_persons'], $request['building']['hot_water_usage']);
        return $request;
        },
    ),
    'with-cwu' => array(
        'mode' => 'php-contract',
        'factory' => function ($request) {
        $request['preferences']['dhw']['enabled'] = true;
        $request['preferences']['dhw']['persons'] = 4;
        $request['preferences']['dhw']['usageProfile'] = 'shower_bath';
        return $request;
        },
    ),
    'custom-fuels-and-efficiencies' => array(
        'mode' => 'php-custom',
        'factory' => function ($request) {
        $request['preferences']['dhw']['enabled'] = true;
        $request['preferences']['dhw']['persons'] = 5;
        $request['preferences']['dhw']['usageProfile'] = 'bath';
        $request['building']['electricityPLNperKWh'] = 1.43;
        $request['building']['gasPLNperKWh'] = 0.41;
        $request['building']['pelletPLNperTon'] = 2600;
        $request['building']['pelletKWhPerTon'] = 5100;
        $request['building']['woodPLNperMp'] = 420;
        $request['building']['woodKWhPerMp'] = 1900;
        $request['building']['coalPLNperTon'] = 1700;
        $request['building']['coalKWhPerTon'] = 7200;
        $request['building']['scopUsed'] = 4.6;
        $request['building']['gasEfficiency'] = 0.92;
        $request['building']['pelletEfficiency'] = 0.88;
        $request['building']['coalEfficiency'] = 0.81;
        $request['building']['woodEfficiency'] = 0.82;
        $request['building']['electricEfficiency'] = 0.99;
        return $request;
        },
    ),
    'invalid-custom-values-fallback' => array(
        'mode' => 'php-contract',
        'factory' => function ($request) {
        $request['preferences']['dhw']['enabled'] = true;
        $request['preferences']['dhw']['persons'] = 3;
        $request['preferences']['dhw']['usageProfile'] = 'shower';
        $request['building']['electricityPLNperKWh'] = '';
        $request['building']['gasPLNperKWh'] = null;
        $request['building']['pelletPLNperTon'] = '';
        $request['building']['woodPLNperMp'] = '';
        $request['building']['coalPLNperTon'] = '';
        $request['building']['scopUsed'] = '';
        $request['building']['gasEfficiency'] = '';
        $request['building']['pelletEfficiency'] = null;
        $request['building']['coalEfficiency'] = '';
        $request['building']['woodEfficiency'] = '';
        $request['building']['electricEfficiency'] = '';
        return $request;
        },
    ),
);

$full_engine = new TopInstal_OzcEngine_Full();
foreach ($scenarios as $name => $scenario) {
    $factory = $scenario['factory'];
    $request = $factory($base_request);
    $full = $full_engine->computeDesignHeatLoss($request['building'], $request['preferences']);
    if ($scenario['mode'] === 'php-contract') {
        topinstal_assert_heating_costs_php_contract($full, $name);
        if ($name === 'with-cwu') {
            $assumptions = isset($full['extended']['heating_costs_assumptions']) && is_array($full['extended']['heating_costs_assumptions'])
                ? $full['extended']['heating_costs_assumptions']
                : array();
            topinstal_ozc_heating_costs_assert(
                isset($assumptions['annualKWhCWU']) && (float) $assumptions['annualKWhCWU'] > 0,
                $name . ': CWU energy must be > 0 when enabled.'
            );
        }
        if ($name === 'baseline-no-cwu') {
            $assumptions = isset($full['extended']['heating_costs_assumptions']) && is_array($full['extended']['heating_costs_assumptions'])
                ? $full['extended']['heating_costs_assumptions']
                : array();
            topinstal_ozc_heating_costs_compare_number(
                0,
                isset($assumptions['annualKWhCWU']) ? (float) $assumptions['annualKWhCWU'] : 0,
                $name . ': CWU energy must be 0 when disabled.',
                0.001
            );
        }
        if ($name === 'invalid-custom-values-fallback') {
            $assumptions = isset($full['extended']['heating_costs_assumptions']) && is_array($full['extended']['heating_costs_assumptions'])
                ? $full['extended']['heating_costs_assumptions']
                : array();
            topinstal_ozc_heating_costs_compare_number(4.0, $assumptions['scopUsed'] ?? null, $name . ': invalid SCOP must fall back to 4.0.', 0.0001);
            topinstal_ozc_heating_costs_compare_number(1.1, $assumptions['electricityPLNperKWh'] ?? null, $name . ': invalid tariff must fall back to default.', 0.0001);
        }
        echo '[PASS] ' . $name . ' heating_costs php contract' . PHP_EOL;
        continue;
    }

    $assumptions = isset($full['extended']['heating_costs_assumptions']) && is_array($full['extended']['heating_costs_assumptions'])
        ? $full['extended']['heating_costs_assumptions']
        : array();
    topinstal_ozc_heating_costs_compare_number(1.43, $assumptions['electricityPLNperKWh'] ?? null, $name . ': custom electricity price not applied.', 0.0001);
    topinstal_ozc_heating_costs_compare_number(0.41, $assumptions['gasPLNperKWh'] ?? null, $name . ': custom gas price not applied.', 0.0001);
    topinstal_ozc_heating_costs_compare_number(4.6, $assumptions['scopUsed'] ?? null, $name . ': custom SCOP not applied.', 0.0001);
    topinstal_ozc_heating_costs_compare_number(0.92, $assumptions['efficienciesUsed']['gas'] ?? null, $name . ': custom gas efficiency not applied.', 0.0001);
    topinstal_ozc_heating_costs_compare_number(0.99, $assumptions['efficienciesUsed']['electricResistance'] ?? null, $name . ': custom electric efficiency not applied.', 0.0001);
    echo '[PASS] ' . $name . ' custom heating_costs overrides' . PHP_EOL;
}

$use_case = topinstal_harness_create_use_case();
$offer = $use_case->execute($scenarios['with-cwu']['factory']($base_request));
$extended = isset($offer['engineering']['ozc']['extended']) && is_array($offer['engineering']['ozc']['extended'])
    ? $offer['engineering']['ozc']['extended']
    : array();

topinstal_ozc_heating_costs_assert(
    isset($extended['heating_costs_assumptions']) && is_array($extended['heating_costs_assumptions']),
    'OfferDTO engineering.ozc.extended must expose heating_costs_assumptions.'
);
echo '[PASS] OfferDTO preserves heating_costs_assumptions' . PHP_EOL;

echo PHP_EOL . 'OZC heating_costs regression OK.' . PHP_EOL;
