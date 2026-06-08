<?php

require_once __DIR__ . '/harness-lib.php';

$fixture_name = 'two-storey-wroclaw-110m2.json';
$request = topinstal_harness_load_fixture($fixture_name);
$use_case = topinstal_harness_create_use_case();
$offer = $use_case->execute($request);

topinstal_harness_assert_offer_shape($offer, $fixture_name);

$design_kw = null;
if (
    isset($offer['engineering']['ozc']['designHeatLoss_kW']) &&
    is_numeric($offer['engineering']['ozc']['designHeatLoss_kW'])
) {
    $design_kw = (float) $offer['engineering']['ozc']['designHeatLoss_kW'];
}

if ($design_kw === null || $design_kw <= 0 || $design_kw > 500) {
    throw new RuntimeException(
        $fixture_name . ': designHeatLoss_kW must be in (0, 500], got ' . var_export($design_kw, true)
    );
}

$selection = isset($offer['engineering']['selection']) && is_array($offer['engineering']['selection'])
    ? $offer['engineering']['selection']
    : array();
$pump_model = isset($selection['pumpModel']) ? trim((string) $selection['pumpModel']) : '';
$pump_selection = isset($selection['pumpSelection']) && is_array($selection['pumpSelection'])
    ? $selection['pumpSelection']
    : array();
if ($pump_model === '' && isset($pump_selection['hp']['model'])) {
    $pump_model = trim((string) $pump_selection['hp']['model']);
}
if ($pump_model === '' && isset($pump_selection['aio']['model'])) {
    $pump_model = trim((string) $pump_selection['aio']['model']);
}

if ($pump_model === '' && $pump_selection === array()) {
    $warnings = isset($offer['warnings']) && is_array($offer['warnings']) ? $offer['warnings'] : array();
    $selection_warning = false;
    foreach ($warnings as $warning) {
        $code = is_array($warning) && isset($warning['code']) ? (string) $warning['code'] : (string) $warning;
        if (stripos($code, 'SELECTION') !== false) {
            $selection_warning = true;
            break;
        }
    }
    if (!$selection_warning) {
        throw new RuntimeException(
            $fixture_name . ': engineering.selection must expose pumpModel or pumpSelection.'
        );
    }
    $pump_model = '(selection-warning)';
}

$gross = isset($offer['pricing']['totals']['gross']) ? (float) $offer['pricing']['totals']['gross'] : 0.0;
if ($gross <= 0) {
    throw new RuntimeException($fixture_name . ': pricing.totals.gross must be > 0.');
}

echo '[PASS] production-shape ' . $fixture_name . ' designHeatLoss_kW=' . $design_kw . ' pump=' . $pump_model . PHP_EOL;
exit(0);
