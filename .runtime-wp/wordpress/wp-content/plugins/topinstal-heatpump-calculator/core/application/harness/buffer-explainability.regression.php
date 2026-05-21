<?php

require_once __DIR__ . '/harness-lib.php';

/**
 * @param bool $condition
 * @param string $message
 * @return void
 */
function topinstal_buffer_regression_assert($condition, $message)
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

/**
 * @param string|null $value
 * @return string
 */
function topinstal_buffer_normalize_text($value)
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
 * @param float|int|null $expected
 * @param float|int|null $actual
 * @param string $message
 * @param float $tolerance
 * @return void
 */
function topinstal_buffer_compare_number($expected, $actual, $message, $tolerance = 0.001)
{
    if ($expected === null || $actual === null) {
        topinstal_buffer_regression_assert($expected === $actual, $message . ' (null mismatch)');
        return;
    }

    $left = (float) $expected;
    $right = (float) $actual;
    if (abs($left - $right) > $tolerance) {
        throw new RuntimeException($message . ' expected=' . $left . ' actual=' . $right);
    }
}

/**
 * @param array<string,mixed> $scenario
 * @param array<string,mixed> $buffer_rules
 * @return array<string,mixed>
 */
function topinstal_build_php_buffer_input($scenario, $buffer_rules)
{
    $meta = isset($scenario['meta']) && is_array($scenario['meta']) ? $scenario['meta'] : array();
    $selected_pump = isset($scenario['selectedPump']) && is_array($scenario['selectedPump']) ? $scenario['selectedPump'] : array();
    $hydraulics_inputs = isset($scenario['hydraulicsInputs']) && is_array($scenario['hydraulicsInputs']) ? $scenario['hydraulicsInputs'] : array();

    $building = array(
        'heating_type' => isset($meta['heating_type']) ? $meta['heating_type'] : 'radiators',
        'heated_area' => isset($meta['heated_area']) ? $meta['heated_area'] : null,
        'total_area' => isset($meta['total_area']) ? $meta['total_area'] : null,
        'bivalent_enabled' => isset($hydraulics_inputs['bivalent_enabled']) ? $hydraulics_inputs['bivalent_enabled'] : false,
        'secondary_source_type' => isset($hydraulics_inputs['bivalent_source_type']) ? $hydraulics_inputs['bivalent_source_type'] : null,
        'secondary_power_kw' => isset($hydraulics_inputs['bivalent_source_power_kw']) ? $hydraulics_inputs['bivalent_source_power_kw'] : null,
    );
    $preferences = array(
        'heating' => array(
            'emitterType' => isset($meta['heating_type']) ? $meta['heating_type'] : 'radiators',
        ),
        'hasBuffer' => true,
    );
    $selection = array(
        'capacity_kW' => isset($selected_pump['power_kw']) ? $selected_pump['power_kw'] : null,
        'phase' => isset($selected_pump['phase']) ? $selected_pump['phase'] : null,
        'pumpModel' => isset($selected_pump['model']) ? $selected_pump['model'] : null,
        'pumpSelection' => array(
            'hp' => array(
                'model' => isset($selected_pump['model']) ? $selected_pump['model'] : null,
                'power' => isset($selected_pump['power_kw']) ? $selected_pump['power_kw'] : null,
                'phase' => isset($selected_pump['phase']) ? $selected_pump['phase'] : null,
            ),
        ),
    );

    return array(
        'input' => array(
            'designHeatLoss_kW' => isset($meta['max_heating_power']) ? $meta['max_heating_power'] : (isset($meta['recommended_power_kw']) ? $meta['recommended_power_kw'] : 0),
            'building' => $building,
            'preferences' => $preferences,
            'selection' => $selection,
            'ozc' => array(
                'heatedArea_m2' => isset($meta['heated_area']) ? $meta['heated_area'] : null,
            ),
            'context' => array(
                'configurator' => array(
                    'selectedPump' => $selected_pump,
                    'hydraulics_inputs' => $hydraulics_inputs,
                    'meta' => $meta,
                ),
            ),
        ),
        'rules' => $buffer_rules,
    );
}

/**
 * @param array<string,mixed> $php_result
 * @param array<string,mixed> $scenario
 * @return void
 */
function topinstal_assert_buffer_scenario($php_result, $scenario)
{
    $name = isset($scenario['name']) ? (string) $scenario['name'] : 'scenario';
    topinstal_buffer_regression_assert(
        (string) ($php_result['setupType'] ?? 'NONE') === (string) ($scenario['expectedSetupType'] ?? 'NONE'),
        $name . ': unexpected setupType.'
    );
    topinstal_buffer_regression_assert(
        array_key_exists('explanation', $php_result) && is_array($php_result['explanation']),
        $name . ': missing explanation.'
    );
    topinstal_buffer_regression_assert(
        trim((string) ($php_result['explanation']['short'] ?? '')) !== '',
        $name . ': missing explanation.short.'
    );
    topinstal_buffer_regression_assert(
        trim((string) ($php_result['explanation']['long'] ?? '')) !== '',
        $name . ': missing explanation.long.'
    );

    $recommendation = isset($php_result['recommendation']) && is_array($php_result['recommendation'])
        ? $php_result['recommendation']
        : array();
    topinstal_buffer_regression_assert(
        (string) ($recommendation['severity'] ?? '') === (string) ($php_result['severity'] ?? ''),
        $name . ': nested recommendation severity missing.'
    );
}

topinstal_harness_bootstrap();

$engineering_policy_path = dirname(__DIR__, 3) . '/core/infrastructure/master-data/engineering-policy.json';
$engineering_policy_raw = file_get_contents($engineering_policy_path);
if ($engineering_policy_raw === false) {
    throw new RuntimeException('Unable to read engineering-policy.json');
}
$engineering_policy_raw = ltrim($engineering_policy_raw, "\xEF\xBB\xBF");
$engineering_policy = json_decode($engineering_policy_raw, true);
if (!is_array($engineering_policy) || !isset($engineering_policy['buffer']) || !is_array($engineering_policy['buffer'])) {
    throw new RuntimeException('engineering-policy.json missing buffer rules');
}
$buffer_rules = $engineering_policy['buffer'];

$scenarios = array(
    array(
        'name' => 'none-sufficient',
        'meta' => array(
            'heating_type' => 'underfloor',
            'recommended_power_kw' => 7,
            'max_heating_power' => 7,
            'heated_area' => 120,
            'total_area' => 120,
            'generation' => 'K',
        ),
        'selectedPump' => array(
            'optionId' => 'hp',
            'model' => 'KIT-WC07K3E5',
            'type' => 'split',
            'power_kw' => 7,
            'phase' => 1,
            'series' => 'K',
        ),
        'hydraulicsInputs' => array(),
        'expectedSetupType' => 'NONE',
    ),
    array(
        'name' => 'series-deficit',
        'meta' => array(
            'heating_type' => 'radiators',
            'recommended_power_kw' => 7,
            'max_heating_power' => 7,
            'heated_area' => 60,
            'total_area' => 60,
            'generation' => 'K',
        ),
        'selectedPump' => array(
            'optionId' => 'hp',
            'model' => 'KIT-WC07K3E5',
            'type' => 'split',
            'power_kw' => 7,
            'phase' => 1,
            'series' => 'K',
        ),
        'hydraulicsInputs' => array(
            'radiators_is_ht' => true,
        ),
        'expectedSetupType' => 'SERIES_BYPASS',
    ),
    array(
        'name' => 'parallel-mixed',
        'meta' => array(
            'heating_type' => 'mixed',
            'recommended_power_kw' => 9,
            'max_heating_power' => 9,
            'heated_area' => 120,
            'total_area' => 120,
            'generation' => 'K',
        ),
        'selectedPump' => array(
            'optionId' => 'hp',
            'model' => 'KIT-WC09K3E5',
            'type' => 'split',
            'power_kw' => 9,
            'phase' => 1,
            'series' => 'K',
        ),
        'hydraulicsInputs' => array(
            'radiators_is_ht' => false,
            'has_underfloor_actuators' => false,
        ),
        'expectedSetupType' => 'PARALLEL_CLUTCH',
    ),
    array(
        'name' => 'manufacturer-3ph-k',
        'meta' => array(
            'heating_type' => 'underfloor',
            'recommended_power_kw' => 12,
            'max_heating_power' => 12,
            'heated_area' => 180,
            'total_area' => 180,
            'generation' => 'K',
        ),
        'selectedPump' => array(
            'optionId' => 'hp',
            'model' => 'KIT-WC12K9E8',
            'type' => 'split',
            'power_kw' => 12,
            'phase' => 3,
            'series' => 'K',
        ),
        'hydraulicsInputs' => array(),
        'expectedSetupType' => 'PARALLEL_CLUTCH',
    ),
    array(
        'name' => 'bivalent-solid-fuel',
        'meta' => array(
            'heating_type' => 'underfloor',
            'recommended_power_kw' => 9,
            'max_heating_power' => 9,
            'heated_area' => 130,
            'total_area' => 130,
            'generation' => 'K',
        ),
        'selectedPump' => array(
            'optionId' => 'hp',
            'model' => 'KIT-WC09K3E5',
            'type' => 'split',
            'power_kw' => 9,
            'phase' => 1,
            'series' => 'K',
        ),
        'hydraulicsInputs' => array(
            'bivalent_enabled' => true,
            'bivalent_source_type' => 'solid_fuel',
            'bivalent_source_power_kw' => 15,
        ),
        'expectedSetupType' => 'PARALLEL_CLUTCH',
    ),
    array(
        'name' => 'bivalent-fireplace',
        'meta' => array(
            'heating_type' => 'underfloor',
            'recommended_power_kw' => 9,
            'max_heating_power' => 9,
            'heated_area' => 130,
            'total_area' => 130,
            'generation' => 'K',
        ),
        'selectedPump' => array(
            'optionId' => 'hp',
            'model' => 'KIT-WC09K3E5',
            'type' => 'split',
            'power_kw' => 9,
            'phase' => 1,
            'series' => 'K',
        ),
        'hydraulicsInputs' => array(
            'bivalent_enabled' => true,
            'bivalent_source_type' => 'fireplace_water_jacket',
            'bivalent_source_power_kw' => 12,
        ),
        'expectedSetupType' => 'PARALLEL_CLUTCH',
    ),
);

$buffer_engine = new TopInstal_BufferEngine();
foreach ($scenarios as $scenario) {
    $name = isset($scenario['name']) ? (string) $scenario['name'] : 'scenario';
    $php_input = topinstal_build_php_buffer_input($scenario, $buffer_rules);
    $php_result = $buffer_engine->computeBuffer($php_input['input'], $php_input['rules']);
    topinstal_assert_buffer_scenario($php_result, $scenario);
    echo '[PASS] ' . $name . ' buffer explainability (PHP)' . PHP_EOL;
}

$use_case = topinstal_harness_create_use_case();
$offer = $use_case->execute(topinstal_harness_load_fixture('baseline-floor-heating.json'));
$engineering_buffer = isset($offer['engineering']['buffer']) && is_array($offer['engineering']['buffer'])
    ? $offer['engineering']['buffer']
    : array();

foreach (array('severity', 'dominantReason', 'explanation', 'inputs_used') as $field) {
    topinstal_buffer_regression_assert(
        array_key_exists($field, $engineering_buffer),
        'OfferDTO engineering.buffer missing field: ' . $field
    );
}
echo '[PASS] OfferDTO preserves buffer explainability fields' . PHP_EOL;

echo PHP_EOL . 'Buffer explainability regression OK.' . PHP_EOL;
