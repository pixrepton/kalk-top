<?php

require_once __DIR__ . '/harness-lib.php';

if (!defined('ABSPATH')) {
    define('ABSPATH', dirname(__DIR__, 3) . '/');
}
require_once dirname(__DIR__, 3) . '/wp-adapter/repositories/BufferRulesRepositoryWp.php';

/**
 * @param bool $condition
 * @param string $message
 * @return void
 */
function topinstal_cwu_assert($condition, $message)
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
function topinstal_cwu_compare_number($expected, $actual, $message, $tolerance = 0.001)
{
    if ($expected === null || $actual === null) {
        topinstal_cwu_assert($expected === $actual, $message . ' (null mismatch)');
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
function topinstal_cwu_normalize_text($value)
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
 * @param array<string,mixed> $scenario
 * @return array<string,mixed>
 */
function topinstal_build_php_cwu_input($scenario)
{
    $meta = isset($scenario['meta']) && is_array($scenario['meta']) ? $scenario['meta'] : array();
    $selected_pump = isset($scenario['selectedPump']) && is_array($scenario['selectedPump']) ? $scenario['selectedPump'] : array();

    return array(
        'building' => array(
            'include_hot_water' => isset($meta['include_hot_water']) ? $meta['include_hot_water'] : false,
            'hot_water_persons' => isset($meta['hot_water_persons']) ? $meta['hot_water_persons'] : null,
            'hot_water_usage' => isset($meta['hot_water_usage']) ? $meta['hot_water_usage'] : null,
            'hot_water_material' => isset($meta['hot_water_material']) ? $meta['hot_water_material'] : null,
        ),
        'preferences' => array(
            'dhw' => array(
                'enabled' => isset($meta['include_hot_water']) ? $meta['include_hot_water'] : false,
                'persons' => isset($meta['hot_water_persons']) ? $meta['hot_water_persons'] : null,
                'usageProfile' => isset($meta['hot_water_usage']) ? $meta['hot_water_usage'] : null,
                'material' => isset($meta['hot_water_material']) ? $meta['hot_water_material'] : null,
            ),
            'pumpOptionId' => isset($selected_pump['optionId']) ? $selected_pump['optionId'] : null,
            'dhwOptionId' => isset($scenario['dhwOptionId']) ? $scenario['dhwOptionId'] : null,
        ),
        'selection' => array(
            'type' => isset($selected_pump['type']) ? $selected_pump['type'] : 'split',
            'pumpModel' => isset($selected_pump['model']) ? $selected_pump['model'] : null,
            'cwu_tank' => isset($selected_pump['cwu_tank']) ? $selected_pump['cwu_tank'] : null,
        ),
        'context' => array(),
    );
}

/**
 * @param array<int,array<string,mixed>> $scenarios
 * @return array<string,mixed>
 */
function topinstal_run_js_cwu_reference($scenarios)
{
    $runner = __DIR__ . '/js-cwu-reference-runner.js';
    $command = 'node "' . str_replace('"', '""', $runner) . '"';
    $descriptors = array(
        0 => array('pipe', 'r'),
        1 => array('pipe', 'w'),
        2 => array('pipe', 'w'),
    );

    $process = proc_open($command, $descriptors, $pipes, dirname(__DIR__, 3));
    if (!is_resource($process)) {
        throw new RuntimeException('Unable to start JS CWU reference runner.');
    }

    $payload = json_encode(array('scenarios' => $scenarios));
    fwrite($pipes[0], is_string($payload) ? $payload : '');
    fclose($pipes[0]);

    $stdout = stream_get_contents($pipes[1]);
    fclose($pipes[1]);

    $stderr = stream_get_contents($pipes[2]);
    fclose($pipes[2]);

    $exit_code = proc_close($process);
    if ($exit_code !== 0) {
        throw new RuntimeException('JS CWU reference runner failed: ' . trim((string) $stderr));
    }

    $decoded = json_decode((string) $stdout, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Invalid JSON from JS CWU reference runner.');
    }

    return $decoded;
}

topinstal_harness_bootstrap();

$rules_repository_source_version = 'cwu-regression-buffer-rules-' . uniqid('', true);
$rules_repository = new TopInstal_BufferRulesRepository_Wp(new class($rules_repository_source_version) {
    private $source_version;

    public function __construct($source_version)
    {
        $this->source_version = $source_version;
    }

    public function get_engineering_policy()
    {
        return array(
            'source_version' => $this->source_version,
            'buffer' => array(
                'cwuRules' => array(
                    'availableCapacities' => array(150, 250, 400),
                ),
            ),
            'cwuRules' => array(
                'availableCapacities' => array(999),
            ),
        );
    }
});
$repo_rules = $rules_repository->get_rules();
topinstal_cwu_assert(
    isset($repo_rules['cwuRules']['availableCapacities']) && $repo_rules['cwuRules']['availableCapacities'] === array(150, 250, 400),
    'BufferRulesRepository must prefer buffer.cwuRules over legacy top-level cwuRules.'
);

$engineering_policy_raw = file_get_contents(dirname(__DIR__, 3) . '/core/infrastructure/master-data/engineering-policy.json');
if ($engineering_policy_raw === false) {
    throw new RuntimeException('Unable to read engineering-policy.json for CWU regression.');
}
$engineering_policy_raw = preg_replace('/^\xEF\xBB\xBF/', '', (string) $engineering_policy_raw);
$engineering_policy = json_decode((string) $engineering_policy_raw, true);
if (!is_array($engineering_policy)) {
    throw new RuntimeException('Invalid engineering-policy.json for CWU regression.');
}

$buffer_policy = isset($engineering_policy['buffer']) && is_array($engineering_policy['buffer'])
    ? $engineering_policy['buffer']
    : array();
$rules = array(
    'cwuRules' => isset($buffer_policy['cwuRules']) && is_array($buffer_policy['cwuRules'])
        ? $buffer_policy['cwuRules']
        : (isset($engineering_policy['cwuRules']) && is_array($engineering_policy['cwuRules'])
            ? $engineering_policy['cwuRules']
            : array()),
);
topinstal_cwu_assert(
    isset($buffer_policy['cwuRules']) && is_array($buffer_policy['cwuRules']) && !empty($buffer_policy['cwuRules']),
    'CWU regression expects canonical buffer.cwuRules in engineering-policy.json.'
);
topinstal_cwu_assert(
    $rules['cwuRules'] === $buffer_policy['cwuRules'],
    'CWU regression must use buffer.cwuRules as canonical source.'
);
$price_book = array(
    'pricing_policy' => array(
        'cwu' => array(
            'capacity_by_persons' => array('le_2' => 150, 'le_4' => 200, 'gt_4' => 300),
            'default_material' => 'emalia',
        ),
    ),
);

$scenarios = array(
    array(
        'name' => 'no-dhw',
        'meta' => array(
            'include_hot_water' => false,
            'hot_water_persons' => 0,
            'hot_water_usage' => 'shower_bath',
        ),
        'selectedPump' => array(
            'type' => 'split',
            'model' => 'KIT-WC05K3E5',
            'optionId' => 'split-5',
        ),
    ),
    array(
        'name' => 'standard-3-persons',
        'meta' => array(
            'include_hot_water' => true,
            'hot_water_persons' => 3,
            'hot_water_usage' => 'shower_bath',
        ),
        'selectedPump' => array(
            'type' => 'split',
            'model' => 'KIT-WC05K3E5',
            'optionId' => 'split-5',
        ),
    ),
    array(
        'name' => 'bath-2-persons',
        'meta' => array(
            'include_hot_water' => true,
            'hot_water_persons' => 2,
            'hot_water_usage' => 'bath',
        ),
        'selectedPump' => array(
            'type' => 'split',
            'model' => 'KIT-WC07K3E5',
            'optionId' => 'split-7',
        ),
    ),
    array(
        'name' => 'invalid-large-persons',
        'meta' => array(
            'include_hot_water' => true,
            'hot_water_persons' => 99,
            'hot_water_usage' => 'shower_bath',
        ),
        'selectedPump' => array(
            'type' => 'split',
            'model' => 'KIT-WC09K3E5',
            'optionId' => 'split-9',
        ),
    ),
    array(
        'name' => 'aio-skip',
        'meta' => array(
            'include_hot_water' => true,
            'hot_water_persons' => 4,
            'hot_water_usage' => 'shower_bath',
        ),
        'selectedPump' => array(
            'type' => 'aio',
            'model' => 'KIT-ADC09K3E5',
            'optionId' => 'aio-9',
            'cwu_tank' => 185,
        ),
    ),
);

$reference = topinstal_run_js_cwu_reference($scenarios);
$reference_results = array();
foreach ($reference['results'] as $row) {
    $reference_results[$row['name']] = isset($row['result']) && is_array($row['result']) ? $row['result'] : array();
}

$engine = new TopInstal_CwuEngine();
foreach ($scenarios as $scenario) {
    $name = $scenario['name'];
    $php = $engine->compute(topinstal_build_php_cwu_input($scenario), $rules, $price_book);
    $js = isset($reference_results[$name]) ? $reference_results[$name] : array();

    topinstal_cwu_assert((bool) ($php['enabled'] ?? false) === (bool) ($js['enabled'] ?? false), $name . ': enabled drift.');
    topinstal_cwu_assert((bool) ($php['required'] ?? false) === (bool) ($js['required'] ?? false), $name . ': required drift.');
    topinstal_cwu_assert((bool) ($php['skip'] ?? false) === (bool) ($js['skip'] ?? false), $name . ': skip drift.');
    topinstal_cwu_compare_number(
        isset($js['recommendedCapacity']) ? $js['recommendedCapacity'] : null,
        isset($php['recommendedCapacityL']) ? $php['recommendedCapacityL'] : null,
        $name . ': recommended capacity drift.',
        0.01
    );
    topinstal_cwu_assert(
        topinstal_cwu_normalize_text(isset($php['skipReason']) ? $php['skipReason'] : null)
            === topinstal_cwu_normalize_text(isset($js['skipReason']) ? $js['skipReason'] : null),
        $name . ': skipReason drift.'
    );

    if ($name === 'standard-3-persons') {
        topinstal_cwu_compare_number(0.51, $php['hotWaterPower_kW'], $name . ': hotWaterPower drift.', 0.001);
        topinstal_cwu_compare_number(250, $php['resolvedCapacityL'], $name . ': resolvedCapacity drift.', 0.01);
    }
    if ($name === 'bath-2-persons') {
        topinstal_cwu_compare_number(0.35, $php['hotWaterPower_kW'], $name . ': hotWaterPower drift.', 0.001);
        topinstal_cwu_compare_number(250, $php['recommendedCapacityL'], $name . ': recommendedCapacity expected 250.', 0.01);
    }
    if ($name === 'invalid-large-persons') {
        topinstal_cwu_compare_number(1.5, $php['hotWaterPower_kW'], $name . ': hotWaterPower clamp drift.', 0.001);
        topinstal_cwu_assert(in_array('CWU_CAPACITY_FALLBACK_DEFAULT', array_column($php['assumptions'], 'code'), true), $name . ': expected capacity fallback assumption.');
    }
if ($name === 'aio-skip') {
        topinstal_cwu_assert((bool) ($php['demandEnabled'] ?? false) === true, $name . ': demandEnabled should stay true.');
        topinstal_cwu_assert((bool) ($php['isAio'] ?? false) === true, $name . ': isAio should be true.');
        topinstal_cwu_compare_number(0.68, $php['hotWaterPower_kW'], $name . ': hotWaterPower drift for AIO.', 0.001);
    }
}

$missing_usage_result = $engine->compute(array(
    'building' => array(
        'include_hot_water' => true,
        'hot_water_persons' => 3,
        'hot_water_usage' => '',
    ),
    'preferences' => array(
        'dhw' => array(
            'enabled' => true,
            'persons' => 3,
            'usageProfile' => '',
        ),
    ),
), $rules, $price_book);
topinstal_cwu_assert(($missing_usage_result['usageProfile'] ?? null) === 'shower_bath', 'missing usage profile should default to shower_bath.');
topinstal_cwu_assert(($missing_usage_result['usageProfileLabel'] ?? null) === 'prysznic + okazjonalna wanna', 'missing usage profile should expose human label.');
topinstal_cwu_assert(in_array('CWU_USAGE_PROFILE_DEFAULTED', $missing_usage_result['reasonCodes'], true), 'missing usage profile should mark defaulted reason.');

$alias_usage_result = $engine->compute(array(
    'building' => array(
        'include_hot_water' => true,
        'hot_water_persons' => 3,
        'hot_water_usage' => 'comfort',
    ),
    'preferences' => array(
        'dhw' => array(
            'enabled' => true,
            'persons' => 3,
            'usageProfile' => 'comfort',
        ),
    ),
), $rules, $price_book);
topinstal_cwu_assert(($alias_usage_result['usageProfile'] ?? null) === 'bath', 'comfort alias should map to bath.');
topinstal_cwu_assert(($alias_usage_result['usageProfileLabel'] ?? null) === 'czeste korzystanie z wanny', 'comfort alias should expose human label.');
topinstal_cwu_assert(!in_array('CWU_USAGE_PROFILE_INVALID', $alias_usage_result['reasonCodes'], true), 'alias usage profile should not be marked invalid.');

$invalid_usage_result = $engine->compute(array(
    'building' => array(
        'include_hot_water' => true,
        'hot_water_persons' => 4,
        'hot_water_usage' => 'jacuzzi-party-mode',
    ),
    'preferences' => array(
        'dhw' => array(
            'enabled' => true,
            'persons' => 4,
            'usageProfile' => 'jacuzzi-party-mode',
        ),
    ),
), $rules, $price_book);
topinstal_cwu_assert(($invalid_usage_result['usageProfile'] ?? null) === 'shower_bath', 'invalid usage profile should fall back to shower_bath.');
topinstal_cwu_assert(($invalid_usage_result['usageProfileLabel'] ?? null) === 'prysznic + okazjonalna wanna', 'invalid usage profile should expose fallback label.');
topinstal_cwu_assert(in_array('CWU_USAGE_PROFILE_INVALID', $invalid_usage_result['reasonCodes'], true), 'invalid usage profile should set explicit reason code.');
topinstal_cwu_assert(in_array('CWU_USAGE_PROFILE_INVALID', array_column($invalid_usage_result['warnings'], 'code'), true), 'invalid usage profile should emit warning.');
topinstal_cwu_assert(in_array('CWU_USAGE_PROFILE_INVALID', array_column($invalid_usage_result['assumptions'], 'code'), true), 'invalid usage profile should emit assumption.');
topinstal_cwu_assert(strpos((string) $invalid_usage_result['explanation']['long'], 'shower_bath') === false, 'explanation should avoid raw usage profile tokens.');
topinstal_cwu_assert(strpos((string) $invalid_usage_result['explanation']['long'], 'prysznic + okazjonalna wanna') !== false, 'explanation should use human-readable usage label.');

$policy_rules = $rules;
$policy_rules['hotWaterPowerPolicy'] = array(
    'defaults' => array(
        'persons' => 3,
        'min_power_kw' => 0.8,
        'per_person_kw' => 0.35,
        'max_power_kw' => 1.5,
    ),
    'usage_factor' => array(
        'shower' => 0.8,
        'shower_bath' => 1.0,
        'bath' => 1.2,
        'default' => 1.0,
    ),
);
$policy_result = $engine->compute(
    topinstal_build_php_cwu_input($scenarios[1]),
    $policy_rules,
    $price_book
);
topinstal_cwu_compare_number(1.05, $policy_result['hotWaterPower_kW'], 'policy-backed hotWaterPower drift.', 0.001);

$use_case = topinstal_harness_create_use_case();
$offer = $use_case->execute(array(
    'schemaVersion' => '1.0',
    'traceId' => 'cwu-engine-regression',
    'building' => array(
        'heated_area' => 120,
        'include_hot_water' => true,
        'hot_water_persons' => 4,
        'hot_water_usage' => 'shower_bath',
        'heating_type' => 'underfloor',
        'location_id' => 'PL_STREFA_III',
    ),
    'preferences' => array(
        'heating' => array(
            'emitterType' => 'underfloor',
        ),
        'dhw' => array(
            'enabled' => true,
            'persons' => 4,
            'usageProfile' => 'shower_bath',
        ),
    ),
    'context' => array(
        'caller' => 'cwu-regression',
    ),
));

topinstal_harness_assert_offer_shape($offer, 'cwu-engine-regression');
topinstal_cwu_assert(isset($offer['engineering']['cwu']) && is_array($offer['engineering']['cwu']), 'OfferDTO missing engineering.cwu.');
topinstal_cwu_assert(array_key_exists('hotWaterPower_kW', $offer['engineering']['cwu']), 'engineering.cwu.hotWaterPower_kW missing.');
topinstal_cwu_assert(array_key_exists('recommendedCapacityL', $offer['engineering']['cwu']), 'engineering.cwu.recommendedCapacityL missing.');
topinstal_cwu_assert(array_key_exists('pricingHint', $offer['engineering']['cwu']), 'engineering.cwu.pricingHint missing.');
topinstal_cwu_compare_number(
    isset($offer['engineering']['ozc']['hotWaterPower_kW']) ? $offer['engineering']['ozc']['hotWaterPower_kW'] : null,
    isset($offer['engineering']['cwu']['hotWaterPower_kW']) ? $offer['engineering']['cwu']['hotWaterPower_kW'] : null,
    'OfferDTO OZC vs CWU hotWaterPower mismatch.',
    0.001
);

echo "CWU engine regression PASS\n";
