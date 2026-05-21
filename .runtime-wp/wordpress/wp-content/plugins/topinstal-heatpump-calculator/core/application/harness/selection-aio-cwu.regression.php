<?php

require_once __DIR__ . '/harness-lib.php';

topinstal_harness_bootstrap();

if (!defined('ABSPATH')) {
    define('ABSPATH', dirname(__DIR__, 3) . DIRECTORY_SEPARATOR);
}

require_once dirname(__DIR__, 3) . '/wp-adapter/repositories/MasterDataRepositoryWp.php';
require_once dirname(__DIR__, 3) . '/wp-adapter/repositories/SelectionRulesRepositoryWp.php';
require_once dirname(__DIR__, 3) . '/wp-adapter/repositories/BufferRulesRepositoryWp.php';
require_once dirname(__DIR__, 3) . '/wp-adapter/repositories/PriceBookRepositoryWp.php';

function topinstal_selection_aio_assert($condition, $message)
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$master_repo = new TopInstal_MasterDataRepository_Wp();
$selection_rules_repo = new TopInstal_SelectionRulesRepository_Wp($master_repo);
$buffer_rules_repo = new TopInstal_BufferRulesRepository_Wp($master_repo);
$price_book_repo = new TopInstal_PriceBookRepository_Wp($master_repo);

$selection_rules = $selection_rules_repo->get_rules();
$buffer_rules = $buffer_rules_repo->get_rules();
$price_book = $price_book_repo->get_price_book();

$selection_engine = new TopInstal_SelectionEngine();
$cwu_engine = new TopInstal_CwuEngine();

$building = array(
    'heated_area' => 180,
    'total_area' => 180,
    'heating_type' => 'underfloor',
    'installation_type' => 'underfloor',
    'construction_year' => 2015,
    'include_hot_water' => true,
    'location_id' => 'PL_STREFA_III',
);
$preferences = array(
    'heating' => array(
        'emitterType' => 'underfloor',
        'indoorTemperatureC' => 21,
    ),
    'options' => array(
        'pumpOptionId' => 'hp',
    ),
);

$standard_cwu = $cwu_engine->compute(
    array(
        'building' => array_merge($building, array(
            'hot_water_persons' => 2,
            'hot_water_usage' => 'shower',
        )),
        'preferences' => array_merge($preferences, array(
            'dhw' => array(
                'enabled' => true,
                'persons' => 2,
                'usageProfile' => 'shower',
            ),
        )),
        'selection' => array(),
        'context' => array(),
    ),
    $buffer_rules,
    $price_book
);
$standard_selection = $selection_engine->select(
    12.0,
    $building,
    $preferences,
    $selection_rules,
    $standard_cwu
);
topinstal_selection_aio_assert(
    ($standard_selection['pumpSelection']['hp']['model'] ?? null) === 'KIT-WC12K9E8',
    'Standard CWU demand should keep the 12 kW split recommendation.'
);
topinstal_selection_aio_assert(
    ($standard_selection['pumpSelection']['aio']['model'] ?? null) === 'KIT-ADC12K9E8',
    'Standard CWU demand should allow the 185 l all-in-one for 12 kW.'
);
topinstal_selection_aio_assert(
    (int) ($standard_selection['pumpSelection']['aio']['cwu_tank'] ?? 0) === 185,
    'Standard CWU demand should expose the 185 l integrated tank on the AIO variant.'
);

$large_cwu = $cwu_engine->compute(
    array(
        'building' => array_merge($building, array(
            'hot_water_persons' => 4,
            'hot_water_usage' => 'shower_bath',
        )),
        'preferences' => array_merge($preferences, array(
            'dhw' => array(
                'enabled' => true,
                'persons' => 4,
                'usageProfile' => 'shower_bath',
            ),
        )),
        'selection' => array(),
        'context' => array(),
    ),
    $buffer_rules,
    $price_book
);
topinstal_selection_aio_assert(
    (int) ($large_cwu['recommendedCapacityL'] ?? 0) === 250,
    '4 osoby + shower_bath should recommend 250 l CWU.'
);
$large_selection = $selection_engine->select(
    12.0,
    $building,
    $preferences,
    $selection_rules,
    $large_cwu
);
topinstal_selection_aio_assert(
    ($large_selection['pumpSelection']['hp']['model'] ?? null) === 'KIT-WC12K9E8',
    'Large CWU demand should still keep the split recommendation for 12 kW.'
);
topinstal_selection_aio_assert(
    ($large_selection['pumpSelection']['aio']['model'] ?? null) === 'KIT-ADC12K9E83',
    'Large CWU demand should switch the 12 kW AIO alternative to the 260 l model.'
);
topinstal_selection_aio_assert(
    (int) ($large_selection['pumpSelection']['aio']['cwu_tank'] ?? 0) === 260,
    'Large CWU demand should expose the 260 l integrated tank on the AIO variant.'
);

$large_cwu_low_power_selection = $selection_engine->select(
    6.8,
    $building,
    $preferences,
    $selection_rules,
    $large_cwu
);
topinstal_selection_aio_assert(
    ($large_cwu_low_power_selection['pumpSelection']['hp']['model'] ?? null) === 'KIT-WC07K3E5',
    'Large CWU demand with a lower-power split should keep the lower-power split recommendation instead of forcing a larger AIO family.'
);
topinstal_selection_aio_assert(
    ($large_cwu_low_power_selection['pumpSelection']['aio'] ?? null) === null,
    'Large CWU demand must not force a 260 l all-in-one when the selected split family has no Panasonic large-CWU AIO pair.'
);
topinstal_selection_aio_assert(
    count($large_cwu_low_power_selection['pumpSelection']['all_options'] ?? array()) === 2,
    'Large CWU demand with a lower-power split should leave only split candidates in all_options.'
);

$very_large_cwu = $cwu_engine->compute(
    array(
        'building' => array_merge($building, array(
            'hot_water_persons' => 6,
            'hot_water_usage' => 'bath',
        )),
        'preferences' => array_merge($preferences, array(
            'dhw' => array(
                'enabled' => true,
                'persons' => 6,
                'usageProfile' => 'bath',
            ),
        )),
        'selection' => array(),
        'context' => array(),
    ),
    $buffer_rules,
    $price_book
);
topinstal_selection_aio_assert(
    (int) ($very_large_cwu['recommendedCapacityL'] ?? 0) === 400,
    '6 osób + bath should recommend 400 l CWU.'
);
$very_large_selection = $selection_engine->select(
    12.0,
    $building,
    $preferences,
    $selection_rules,
    $very_large_cwu
);
topinstal_selection_aio_assert(
    ($very_large_selection['pumpSelection']['aio'] ?? null) === null,
    '400 l CWU demand should hide all-in-one alternatives completely.'
);

echo "selection-aio-cwu-regression: OK\n";
