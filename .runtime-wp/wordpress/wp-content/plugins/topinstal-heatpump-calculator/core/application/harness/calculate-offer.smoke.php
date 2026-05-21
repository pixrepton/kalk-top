<?php


require_once __DIR__ . '/harness-lib.php';

$fixtures = array(
    'baseline-floor-heating.json',
    'radiators-legacy-house.json',
    'external-ozc-input.json',
    'high-demand-bivalent.json',
);

$use_case = topinstal_harness_create_use_case();
$passed = 0;

foreach ($fixtures as $fixture_name) {
    $request = topinstal_harness_load_fixture($fixture_name);
    $offer = $use_case->execute($request);
    topinstal_harness_assert_offer_shape($offer, $fixture_name);

    if ($fixture_name === 'baseline-floor-heating.json') {
        $hot_water = isset($offer['engineering']['ozc']['hotWaterPower_kW'])
            ? (float) $offer['engineering']['ozc']['hotWaterPower_kW']
            : 0.0;
        if (abs($hot_water - 0.68) > 0.02) {
            throw new RuntimeException('baseline-floor-heating.json: expected OZC-aligned hotWaterPower_kW ~= 0.68, got ' . $hot_water);
        }
    }

    if ($fixture_name === 'external-ozc-input.json') {
        $selection = isset($offer['engineering']['selection']) && is_array($offer['engineering']['selection'])
            ? $offer['engineering']['selection']
            : array();
        $items = isset($offer['pricing']['items']) && is_array($offer['pricing']['items'])
            ? $offer['pricing']['items']
            : array();
        $pump_item_name = null;
        foreach ($items as $item) {
            if (is_array($item) && isset($item['sku']) && $item['sku'] === 'PUMP') {
                $pump_item_name = isset($item['name']) ? (string) $item['name'] : null;
                break;
            }
        }
        if (!isset($selection['type']) || $selection['type'] !== 'all-in-one') {
            throw new RuntimeException('external-ozc-input.json: expected all-in-one selection type.');
        }
        if (!isset($selection['pumpModel']) || !is_string($selection['pumpModel']) || trim($selection['pumpModel']) === '') {
            throw new RuntimeException('external-ozc-input.json: expected selected pump model.');
        }
        if (!is_string($pump_item_name) || strpos($pump_item_name, (string) $selection['pumpModel']) === false) {
            throw new RuntimeException('external-ozc-input.json: expected pricing item name to match selected pump model.');
        }
    }

    if ($fixture_name === 'high-demand-bivalent.json') {
        $buffer_liters = isset($offer['engineering']['buffer']['liters'])
            ? (int) $offer['engineering']['buffer']['liters']
            : 0;
        if ($buffer_liters < 1000) {
            throw new RuntimeException('high-demand-bivalent.json: expected bivalent alias normalization to produce 1000 l buffer.');
        }
    }

    $passed++;
    echo '[PASS] ' . $fixture_name . PHP_EOL;
}

echo PHP_EOL . 'Smoke contract OK (' . $passed . '/' . count($fixtures) . ').' . PHP_EOL;
