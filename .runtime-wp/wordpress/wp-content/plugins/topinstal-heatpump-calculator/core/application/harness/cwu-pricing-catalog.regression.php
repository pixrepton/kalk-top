<?php

declare(strict_types=1);

require_once __DIR__ . '/harness-lib.php';

topinstal_harness_bootstrap();

function topinstal_load_json_file(string $path): array
{
    if (!is_file($path)) {
        throw new RuntimeException('Missing JSON file: ' . $path);
    }

    $raw = file_get_contents($path);
    if ($raw === false) {
        throw new RuntimeException('Cannot read JSON file: ' . $path);
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Invalid JSON payload: ' . $path);
    }

    return $decoded;
}

function topinstal_assert_true($condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, '[FAIL] ' . $message . PHP_EOL);
        exit(1);
    }
}

function topinstal_find_pricing_item(array $pricing, string $sku): ?array
{
    $items = isset($pricing['items']) && is_array($pricing['items']) ? $pricing['items'] : array();
    foreach ($items as $item) {
        if (!is_array($item)) {
            continue;
        }
        $current_sku = isset($item['sku']) ? strtoupper(trim((string) $item['sku'])) : '';
        if ($current_sku === strtoupper($sku)) {
            return $item;
        }
    }
    return null;
}

$root = dirname(__DIR__, 3);
$equipment_catalog = topinstal_load_json_file($root . '/core/infrastructure/master-data/equipment-catalog.json');
$engineering_policy = topinstal_load_json_file($root . '/core/infrastructure/master-data/engineering-policy.json');

$price_book = isset($equipment_catalog['pricing_sections']) && is_array($equipment_catalog['pricing_sections'])
    ? $equipment_catalog['pricing_sections']
    : array();
$price_book['pricing_policy'] = isset($equipment_catalog['pricing_policy']) && is_array($equipment_catalog['pricing_policy'])
    ? $equipment_catalog['pricing_policy']
    : array();
$price_book['currency'] = isset($equipment_catalog['currency']) ? $equipment_catalog['currency'] : 'PLN';
$price_book['vat_rate'] = isset($equipment_catalog['vat_rate']) ? $equipment_catalog['vat_rate'] : 0.08;

$rules = array(
    'cwuRules' => isset($engineering_policy['cwuRules']) && is_array($engineering_policy['cwuRules'])
        ? $engineering_policy['cwuRules']
        : array(),
    'hotWaterPowerPolicy' => isset($engineering_policy['hot_water_power']) && is_array($engineering_policy['hot_water_power'])
        ? $engineering_policy['hot_water_power']
        : array(),
);

$selection = array(
    'model' => 'KIT-WC07K3E5',
    'pumpModel' => 'KIT-WC07K3E5',
    'type' => 'split',
    'phase' => 1,
    'power' => 7,
    'capacity_kW' => 7,
);

$pricing_engine = new TopInstal_PricingEngine();
$cwu_engine = new TopInstal_CwuEngine();

$available_capacities = isset($rules['cwuRules']['availableCapacities']) && is_array($rules['cwuRules']['availableCapacities'])
    ? $rules['cwuRules']['availableCapacities']
    : array(150, 200, 250, 300, 400, 500);
$materials = array('emalia', 'inox');

foreach ($materials as $material) {
    foreach ($available_capacities as $capacity) {
        $capacity = (int) $capacity;
        $input = array(
            'selection' => $selection,
            'preferences' => array(
                'pumpOptionId' => 'KIT-WC07K3E5',
                'dhwOptionId' => 'cwu-' . $material . '-' . $capacity,
                'dhw' => array(
                    'enabled' => true,
                    'persons' => 4,
                    'usageProfile' => 'shower_bath',
                ),
            ),
            'building' => array(
                'include_hot_water' => true,
                'hot_water_persons' => 4,
                'hot_water_usage' => 'shower_bath',
            ),
            'cwu' => array(
                'enabled' => true,
                'resolvedCapacityL' => $capacity,
                'resolvedMaterial' => $material,
                'pricingHint' => array(
                    'capacityL' => $capacity,
                    'material' => $material,
                ),
            ),
        );

        $pricing = $pricing_engine->price($input, $price_book);
        $cwu_item = topinstal_find_pricing_item($pricing, 'CWU');

        topinstal_assert_true(
            is_array($cwu_item) && isset($cwu_item['unitPriceNet']) && (float) $cwu_item['unitPriceNet'] > 0.0,
            'Missing exact CWU price for ' . $material . ' ' . $capacity . ' l.'
        );
    }
}

$engine_scenarios = array(
    '1-person-shower' => array(
        'persons' => 1,
        'usage' => 'shower',
        'expected_capacity' => 150,
    ),
    '4-person-shower-bath' => array(
        'persons' => 4,
        'usage' => 'shower_bath',
        'expected_capacity' => 250,
    ),
    '6-person-bath' => array(
        'persons' => 6,
        'usage' => 'bath',
        'expected_capacity' => 400,
    ),
);

foreach ($engine_scenarios as $scenario_name => $scenario) {
    $compute_input = array(
        'selection' => $selection,
        'preferences' => array(
            'pumpOptionId' => 'KIT-WC07K3E5',
            'dhw' => array(
                'enabled' => true,
                'persons' => $scenario['persons'],
                'usageProfile' => $scenario['usage'],
            ),
        ),
        'building' => array(
            'include_hot_water' => true,
            'hot_water_persons' => $scenario['persons'],
            'hot_water_usage' => $scenario['usage'],
        ),
    );

    $cwu_result = $cwu_engine->compute($compute_input, $rules, $price_book);
    topinstal_assert_true(
        (int) ($cwu_result['recommendedCapacityL'] ?? 0) === (int) $scenario['expected_capacity'],
        $scenario_name . ': expected recommended capacity ' . $scenario['expected_capacity'] . ' l.'
    );

    $pricing = $pricing_engine->price(
        array(
            'selection' => $selection,
            'preferences' => $compute_input['preferences'],
            'building' => $compute_input['building'],
            'cwu' => $cwu_result,
        ),
        $price_book
    );

    $cwu_item = topinstal_find_pricing_item($pricing, 'CWU');
    topinstal_assert_true(
        is_array($cwu_item) && isset($cwu_item['name']) && strpos((string) $cwu_item['name'], (string) $scenario['expected_capacity']) !== false,
        $scenario_name . ': PricingEngine did not resolve priced CWU item for recommended capacity.'
    );
}

echo '[PASS] CWU pricing catalog covers all selectable capacities and engine-driven recommendations.' . PHP_EOL;
