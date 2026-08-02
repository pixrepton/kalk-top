<?php

declare(strict_types=1);

if (!defined('ABSPATH')) {
    define('ABSPATH', __DIR__ . '/');
}

require_once dirname(__DIR__, 3) . '/wp-adapter/services/PlaceholderBuilderService.php';

function topinstal_assert($condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, '[FAIL] ' . $message . PHP_EOL);
        exit(1);
    }
}

$service = new TopInstal_PlaceholderBuilder_Service();
$placeholders = $service->build(
    array(
        'installationType' => 'heat_pump',
        'kitModel' => 'KIT-WC05K3E5',
        'powerKw' => 5,
        'tankEnabled' => true,
        'tankCapacity' => '250',
        'tankManufacturer' => 'Galmet SG(S)',
        'tankLabel' => 'Galmet SG(S) 250L',
        'customPriceGross' => 38016,
    ),
    array(
        'indoor_unit' => 'WH-SDC0309K3E5',
        'outdoor_unit' => 'WH-UDZ05KE5',
    )
);

topinstal_assert(($placeholders['TANK'] ?? '') === 'Galmet SG(S)', 'Expected tank manufacturer placeholder.');
topinstal_assert(($placeholders['CWU'] ?? '') === '250L', 'Expected CWU placeholder without duplicated manufacturer.');
topinstal_assert(($placeholders['PRC'] ?? '') === '38 016', 'Expected gross price placeholder.');

echo '[PASS] placeholder builder uses machine-room CWU label without duplicating manufacturer.' . PHP_EOL;
