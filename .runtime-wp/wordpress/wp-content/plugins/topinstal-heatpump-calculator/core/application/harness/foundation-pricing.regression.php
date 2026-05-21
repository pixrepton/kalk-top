<?php

declare(strict_types=1);

require_once __DIR__ . '/harness-lib.php';

topinstal_harness_bootstrap();

function topinstal_foundation_assert(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, '[FAIL] ' . $message . PHP_EOL);
        exit(1);
    }
}

function topinstal_foundation_load_json(string $path): array
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

function topinstal_foundation_find_item(array $pricing, string $sku): ?array
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
$equipment_catalog = topinstal_foundation_load_json($root . '/core/infrastructure/master-data/equipment-catalog.json');
$price_book = isset($equipment_catalog['pricing_sections']) && is_array($equipment_catalog['pricing_sections'])
    ? $equipment_catalog['pricing_sections']
    : array();
$price_book['pricing_policy'] = isset($equipment_catalog['pricing_policy']) && is_array($equipment_catalog['pricing_policy'])
    ? $equipment_catalog['pricing_policy']
    : array();
$price_book['currency'] = isset($equipment_catalog['currency']) ? $equipment_catalog['currency'] : 'PLN';
$price_book['vat_rate'] = isset($equipment_catalog['vat_rate']) ? $equipment_catalog['vat_rate'] : 0.08;

$selection = array(
    'model' => 'KIT-WC07K3E5',
    'pumpModel' => 'KIT-WC07K3E5',
    'type' => 'split',
    'phase' => 1,
    'power' => 7,
    'capacity_kW' => 7,
);

$pricing_engine = new TopInstal_PricingEngine();
$expected_foundation_prices = array(
    'posadowienie-grunt' => array(
        'sku' => null,
        'net' => 0.0,
    ),
    'posadowienie-sciana' => array(
        'sku' => 'ACCESSORY_FOUNDATION_WALL',
        'net' => isset($price_book['foundation']['fundament-nasz']) ? (float) $price_book['foundation']['fundament-nasz'] : 0.0,
    ),
    'posadowienie-eko' => array(
        'sku' => 'ACCESSORY_FOUNDATION_ECO',
        'net' => isset($price_book['foundation']['stojak']) ? (float) $price_book['foundation']['stojak'] : 0.0,
    ),
);

foreach ($expected_foundation_prices as $option_id => $expected) {
    $pricing = $pricing_engine->price(
        array(
            'selection' => $selection,
            'preferences' => array(
                'options' => array(
                    'pumpOptionId' => 'KIT-WC07K3E5',
                    'foundationOptionId' => $option_id,
                ),
            ),
        ),
        $price_book
    );

    if ($expected['sku'] === null) {
        topinstal_foundation_assert(
            topinstal_foundation_find_item($pricing, 'ACCESSORY_FOUNDATION_GROUND') === null
            && topinstal_foundation_find_item($pricing, 'ACCESSORY_FOUNDATION_ECO') === null
            && topinstal_foundation_find_item($pricing, 'ACCESSORY_FOUNDATION_WALL') === null,
            $option_id . ': ground/customer foundation should not add a paid foundation line item.'
        );
        continue;
    }

    $item = topinstal_foundation_find_item($pricing, (string) $expected['sku']);
    topinstal_foundation_assert(
        is_array($item),
        $option_id . ': missing expected pricing item ' . $expected['sku'] . '.'
    );
    topinstal_foundation_assert(
        isset($item['unitPriceNet']) && abs((float) $item['unitPriceNet'] - (float) $expected['net']) < 0.001,
        $option_id . ': unexpected net foundation price.'
    );
}

echo '[PASS] Foundation pricing matches the intended option-id mapping (ground/client foundation, wall mount, stand).' . PHP_EOL;
