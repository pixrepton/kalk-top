<?php

require __DIR__ . '/harness-lib.php';

topinstal_harness_bootstrap();

/**
 * @param bool $condition
 * @param string $message
 * @return void
 */
function topinstal_climate_assert($condition, $message) {
    if ($condition) {
        echo '[PASS] ' . $message . PHP_EOL;
        return;
    }

    fwrite(STDERR, '[FAIL] ' . $message . PHP_EOL);
    exit(1);
}

$engine = new TopInstal_OzcEngine_Full();
$engine_ref = new ReflectionClass('TopInstal_OzcEngine');
$resolve_zone = $engine_ref->getMethod('resolveClimateZoneKey');
$resolve_zone->setAccessible(true);
$resolve_climate = $engine_ref->getMethod('resolveClimate');
$resolve_climate->setAccessible(true);

$base_building = array(
    'building_type' => 'single_house',
    'construction_year' => 2011,
    'construction_type' => 'traditional',
    'heated_area' => 140,
    'total_area' => 140,
    'floor_area' => 140,
    'building_floors' => 1,
    'building_roof' => 'oblique',
    'floor_height' => 2.6,
    'wall_size' => 24,
    'number_doors' => 1,
    'number_windows' => 10,
    'number_huge_windows' => 0,
    'doors_type' => 'new_wooden',
    'windows_type' => 'new_double_glass',
    'ventilation_type' => 'natural',
    'heating_type' => 'mixed',
    'source_type' => 'air-water',
    'include_hot_water' => 'yes',
    'hot_water_persons' => 5,
    'hot_water_usage' => 'shower_bath',
    'primary_wall_material' => 101,
    'external_wall_isolation' => array('material' => 88, 'size' => 25),
    'top_isolation' => array('material' => 68, 'size' => 30),
    'bottom_isolation' => array('material' => 88, 'size' => 20),
    'indoor_temperature' => 22,
);

$preferences = array(
    'hasBuffer' => true,
    'heating' => array(
        'emitterType' => 'mixed',
        'indoorTemperatureC' => 22,
    ),
    'dhw' => array(
        'enabled' => true,
        'persons' => 5,
        'usageProfile' => 'shower_bath',
    ),
    'options' => array(
        'pumpOptionId' => 'split',
    ),
);

$expected = array(
    'PL_STREFA_I' => array('zoneKey' => 'PL_I', 'theta_e' => -16.0),
    'PL_STREFA_II' => array('zoneKey' => 'PL_II', 'theta_e' => -18.0),
    'PL_STREFA_III' => array('zoneKey' => 'PL_III', 'theta_e' => -20.0),
    'PL_STREFA_IV' => array('zoneKey' => 'PL_IV', 'theta_e' => -22.0),
    'PL_STREFA_V' => array('zoneKey' => 'PL_V', 'theta_e' => -24.0),
    'PL_ZAKOPANE' => array('zoneKey' => 'PL_V', 'theta_e' => -24.0),
);

$matrix = array();

foreach ($expected as $location_id => $spec) {
    $building = $base_building;
    $building['location_id'] = $location_id;

    $assumptions = array();
    $warnings = array();
    $zone_key = $resolve_zone->invoke($engine, $location_id);
    $climate = $resolve_climate->invokeArgs($engine, array($building, &$assumptions, &$warnings));
    $result = $engine->computeDesignHeatLoss($building, $preferences);

    topinstal_climate_assert(
        $zone_key === $spec['zoneKey'],
        $location_id . ' resolves to ' . $spec['zoneKey']
    );
    topinstal_climate_assert(
        isset($climate['theta_e']) && (float) $climate['theta_e'] === $spec['theta_e'],
        $location_id . ' uses theta_e=' . $spec['theta_e']
    );

    $matrix[] = array(
        'location_id' => $location_id,
        'zoneKey' => $zone_key,
        'theta_e' => isset($climate['theta_e']) ? (float) $climate['theta_e'] : null,
        'designHeatLoss_kW' => isset($result['designHeatLoss_kW']) ? round((float) $result['designHeatLoss_kW'], 2) : null,
    );
}

echo PHP_EOL . 'Climate matrix:' . PHP_EOL;
foreach ($matrix as $row) {
    echo sprintf(
        '%s -> %s -> %s -> %s kW',
        $row['location_id'],
        $row['zoneKey'],
        number_format((float) $row['theta_e'], 1, '.', ''),
        number_format((float) $row['designHeatLoss_kW'], 2, '.', '')
    ) . PHP_EOL;
}

topinstal_climate_assert(
    $matrix[3]['zoneKey'] === 'PL_IV',
    'PL_STREFA_IV no longer collides with PL_I'
);

echo PHP_EOL . 'Climate zone routing regression OK.' . PHP_EOL;
