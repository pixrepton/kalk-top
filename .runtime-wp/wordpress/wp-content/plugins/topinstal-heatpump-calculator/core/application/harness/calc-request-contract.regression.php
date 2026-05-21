<?php

require_once __DIR__ . '/harness-lib.php';
require_once dirname(__DIR__, 3) . '/wp-adapter/rest/RequestValidator.php';

/**
 * @param bool $condition
 * @param string $message
 * @return void
 */
function topinstal_contract_assert($condition, $message)
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

/**
 * @param TopInstal_CalculateOffer_UseCase $use_case
 * @param string $building_type
 * @return array<string,mixed>
 */
function topinstal_contract_offer_for_building_type($use_case, $building_type)
{
    $request = topinstal_harness_load_fixture('baseline-floor-heating.json');
    $request['traceId'] = 'building-type-alias-regression';
    $request['building']['building_type'] = $building_type;

    return topinstal_harness_normalize_offer_for_stability($use_case->execute($request));
}

$dimensions_only_request = array(
    'schemaVersion' => '1.0',
    'traceId' => 'contract-dimensions-only',
    'lead' => array(),
    'building' => array(
        'building_length' => 10,
        'building_width' => 12,
        'construction_year' => 2018,
        'include_hot_water' => false,
    ),
    'preferences' => array(
        'heating' => array(),
        'dhw' => array(
            'enabled' => false,
        ),
    ),
);

$dimension_errors = TopInstal_CalcRequest_Validator::validate($dimensions_only_request);
topinstal_contract_assert(
    empty($dimension_errors),
    'dimensions-only CalcRequestDTO should pass RequestValidator, got: ' . json_encode($dimension_errors)
);
echo '[PASS] RequestValidator accepts geometry from building_length + building_width' . PHP_EOL;

$invalid_geometry_request = $dimensions_only_request;
unset($invalid_geometry_request['building']['building_width']);
$invalid_geometry_errors = TopInstal_CalcRequest_Validator::validate($invalid_geometry_request);
$geometry_error_fields = array_map(
    static function ($error) {
        return is_array($error) && isset($error['field']) ? (string) $error['field'] : '';
    },
    $invalid_geometry_errors
);
topinstal_contract_assert(
    in_array('building.geometry', $geometry_error_fields, true),
    'missing geometry should report building.geometry, got: ' . json_encode($invalid_geometry_errors)
);
echo '[PASS] RequestValidator still rejects incomplete geometry' . PHP_EOL;

$use_case = topinstal_harness_create_use_case();

$single_house_offer = topinstal_contract_offer_for_building_type($use_case, 'single_house');
$single_family_offer = topinstal_contract_offer_for_building_type($use_case, 'single_family');
topinstal_contract_assert(
    $single_house_offer == $single_family_offer,
    'single_family alias should normalize to single_house and produce identical offer output.'
);
echo '[PASS] building_type alias single_family normalizes to single_house' . PHP_EOL;

$double_house_offer = topinstal_contract_offer_for_building_type($use_case, 'double_house');
$semi_detached_offer = topinstal_contract_offer_for_building_type($use_case, 'semi_detached');
topinstal_contract_assert(
    $double_house_offer == $semi_detached_offer,
    'semi_detached alias should normalize to double_house and produce identical offer output.'
);
echo '[PASS] building_type alias semi_detached normalizes to double_house' . PHP_EOL;

echo PHP_EOL . 'CalcRequest contract regression OK.' . PHP_EOL;
