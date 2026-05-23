<?php

/**
 * Backend offer must expose engineering.selection.pumpSelection for configurator step 1.
 * No browser — same CalculateOfferUseCase path as REST calculate-offer.
 */

require_once __DIR__ . '/harness-lib.php';

// Harness in-memory pricebook may return SELECTION_NO_EXACT_MATCH for baseline/radiators.
// external-ozc-input exercises the offer_dto.pumpSelection shape the configurator reads.
$fixtures = array(
    'external-ozc-input.json',
);

$use_case = topinstal_harness_create_use_case();

foreach ($fixtures as $fixture_name) {
    $request = topinstal_harness_load_fixture($fixture_name);
    $offer = $use_case->execute($request);

    $selection = isset($offer['engineering']['selection']) && is_array($offer['engineering']['selection'])
        ? $offer['engineering']['selection']
        : null;
    if ($selection === null) {
        throw new RuntimeException($fixture_name . ': missing engineering.selection');
    }

    $pump_selection = isset($selection['pumpSelection']) && is_array($selection['pumpSelection'])
        ? $selection['pumpSelection']
        : null;
    if ($pump_selection === null) {
        throw new RuntimeException($fixture_name . ': missing engineering.selection.pumpSelection');
    }

    $hp = isset($pump_selection['hp']) && is_array($pump_selection['hp'])
        ? $pump_selection['hp']
        : null;
    $aio = isset($pump_selection['aio']) && is_array($pump_selection['aio'])
        ? $pump_selection['aio']
        : null;
    $hp_model = is_array($hp) && isset($hp['model']) ? trim((string) $hp['model']) : '';
    $aio_model = is_array($aio) && isset($aio['model']) ? trim((string) $aio['model']) : '';

    if ($hp_model === '' && $aio_model === '') {
        throw new RuntimeException($fixture_name . ': pumpSelection must include hp.model and/or aio.model');
    }

    $all_options = isset($pump_selection['all_options']) && is_array($pump_selection['all_options'])
        ? $pump_selection['all_options']
        : array();
    if (count($all_options) < 1) {
        throw new RuntimeException($fixture_name . ': pumpSelection.all_options must be non-empty');
    }

    echo '[PASS] configurator-pump-offer: ' . $fixture_name
        . ' hp=' . ($hp_model !== '' ? $hp_model : '-')
        . ' aio=' . ($aio_model !== '' ? $aio_model : '-')
        . ' options=' . count($all_options)
        . PHP_EOL;
}

echo '[PASS] configurator-pump-offer regression complete' . PHP_EOL;
