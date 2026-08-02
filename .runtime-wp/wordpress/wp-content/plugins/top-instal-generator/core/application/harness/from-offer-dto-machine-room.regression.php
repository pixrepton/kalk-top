<?php

declare(strict_types=1);

if (!defined('ABSPATH')) {
    define('ABSPATH', __DIR__ . '/');
}

require_once dirname(__DIR__, 2) . '/contracts/DocumentReasonCodes.php';
require_once dirname(__DIR__) . '/OfferDocumentException.php';
require_once dirname(__DIR__) . '/OfferDocumentInputMapper.php';

function topinstal_assert($condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, '[FAIL] ' . $message . PHP_EOL);
        exit(1);
    }
}

$warnings = array();
$request = array(
    'schemaVersion' => '1.0',
    'traceId' => 'machine-room-regression-001',
    'mode' => 'from-offer-dto',
    'documentType' => 'offer_document',
    'outputFormat' => 'pdf',
    'offerDto' => array(
        'engineering' => array(
            'selection' => array(
                'pumpModel' => 'KIT-WC03K3E5',
                'capacity_kW' => 3,
            ),
            'buffer' => array(
                'liters' => 0,
                'setupType' => 'NONE',
            ),
        ),
        'pricing' => array(
            'totals' => array(
                'gross' => 99999,
            ),
        ),
    ),
    'context' => array(
        'machineRoomSnapshot' => array(
            'total_brutto_pln' => 29052,
            'selected_components' => array(
                'pump' => array(
                    'label' => 'Panasonic Aquarea 3kW',
                    'model' => 'KIT-WC03K3E5',
                    'power_kw' => 3,
                ),
                'cwu' => array(
                    'label' => 'Galmet SG(S) 250L',
                    'name' => 'Galmet SG(S)',
                    'optionId' => 'cwu-emalia-250',
                    'capacity_l' => 250,
                ),
                'buffer' => array(
                    'label' => 'Bufor nie wymagany',
                    'optionId' => 'buffer-0',
                ),
            ),
        ),
    ),
);

$mapped = TopInstal_OfferDocument_InputMapper::map_from_offer_dto($request, $warnings);

topinstal_assert(($mapped['tankCapacity'] ?? '') === '250', 'Expected tankCapacity from machineRoomSnapshot.');
topinstal_assert(($mapped['tankManufacturer'] ?? '') === 'Galmet SG(S)', 'Expected tankManufacturer from machineRoomSnapshot.');
topinstal_assert(($mapped['tankLabel'] ?? '') === 'Galmet SG(S) 250L', 'Expected tankLabel from machineRoomSnapshot.');
topinstal_assert(($mapped['bufferEnabled'] ?? true) === false, 'Expected bufferEnabled=false for "Bufor nie wymagany".');
topinstal_assert(($mapped['bufferLabel'] ?? '') === 'Bufor nie wymagany', 'Expected bufferLabel from machineRoomSnapshot.');
topinstal_assert((int) ($mapped['customPriceGross'] ?? 0) === 29052, 'Expected customPriceGross from machineRoomSnapshot total.');

echo '[PASS] machineRoomSnapshot overrides lossy from-offer-dto heuristics.' . PHP_EOL;
