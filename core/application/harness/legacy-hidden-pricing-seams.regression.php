<?php

declare(strict_types=1);

require_once __DIR__ . '/harness-lib.php';

topinstal_harness_bootstrap();

function topinstal_hidden_pricing_assert(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, '[FAIL] ' . $message . PHP_EOL);
        exit(1);
    }
}

function topinstal_hidden_pricing_collect_skus(array $offer): array
{
    $items = isset($offer['pricing']['items']) && is_array($offer['pricing']['items'])
        ? $offer['pricing']['items']
        : array();
    $skus = array();
    foreach ($items as $item) {
        if (!is_array($item) || !isset($item['sku'])) {
            continue;
        }
        $skus[] = strtoupper(trim((string) $item['sku']));
    }
    return $skus;
}

function topinstal_hidden_pricing_total_gross(array $offer): float
{
    return isset($offer['pricing']['totals']['gross'])
        ? (float) $offer['pricing']['totals']['gross']
        : 0.0;
}

$use_case = topinstal_harness_create_use_case();

$base_request = array(
    'traceId' => 'hidden-pricing-seams-regression',
    'building' => array(
        'heated_area' => 140,
        'heating_type' => 'underfloor',
        'source_type' => 'air_to_water_hp',
        'include_hot_water' => true,
    ),
    'preferences' => array(
        'heating' => array(
            'emitterType' => 'underfloor',
            'sourceType' => 'air_to_water_hp',
        ),
        'dhw' => array(
            'enabled' => true,
            'persons' => 4,
            'usageProfile' => 'shower_bath',
        ),
        'options' => array(
            'pumpOptionId' => 'KIT-WC07K3E5',
            'dhwOptionId' => 'cwu-emalia-200',
            'bufferOptionId' => 'buffer-100-sprzeglo',
            'circulationOptionId' => 'cyrkulacja-tak',
            'pressureReducerOptionId' => 'reduktor-tak',
            'waterTreatmentOptionId' => 'woda-filtr',
            'foundationOptionId' => 'posadowienie-eko',
            'serviceOptionId' => 'service-cloud',
        ),
    ),
);

$request_with_hidden_families = $base_request;
$request_with_hidden_families['preferences']['options']['magneticFilterOptionId'] = 'magnetic_filter_premium';
$request_with_hidden_families['preferences']['options']['hydroSafetyOptionId'] = 'hydro_safety_extended';
$request_with_hidden_families['preferences']['options']['flushingOptionId'] = 'flushing_premium';
$request_with_hidden_families['preferences']['options']['electricalOptionId'] = 'electrical_standard';
$request_with_hidden_families['preferences']['options']['drainageOptionId'] = 'skropliny-z-grzalka';

$baseline_offer = $use_case->execute($base_request);
$hidden_offer = $use_case->execute($request_with_hidden_families);

$baseline_gross = topinstal_hidden_pricing_total_gross($baseline_offer);
$hidden_gross = topinstal_hidden_pricing_total_gross($hidden_offer);

topinstal_hidden_pricing_assert(
    abs($baseline_gross - $hidden_gross) < 0.001,
    'Hidden legacy option ids changed OfferDTO gross total.'
);

$hidden_skus = topinstal_hidden_pricing_collect_skus($hidden_offer);
foreach (array(
    'ACCESSORY_MAGNETIC_FILTER',
    'ACCESSORY_HYDRO_SAFETY',
    'ACCESSORY_FLUSHING',
    'ACCESSORY_ELECTRICAL',
) as $forbidden_sku) {
    topinstal_hidden_pricing_assert(
        !in_array($forbidden_sku, $hidden_skus, true),
        'Forbidden legacy SKU still present in OfferDTO pricing: ' . $forbidden_sku
    );
}

echo '[PASS] Hidden legacy pricing families no longer affect OfferDTO pricing totals or line items.' . PHP_EOL;
