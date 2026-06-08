<?php

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "CLI only.\n");
    exit(1);
}

$repoRoot = dirname(__DIR__, 2);
$candidates = array(
    dirname($repoRoot) . DIRECTORY_SEPARATOR . 'wp-bridges'
        . DIRECTORY_SEPARATOR . 'harness'
        . DIRECTORY_SEPARATOR . 'offer-documents-generator-client.regression.php',
);

$target = null;
foreach ($candidates as $path) {
    if (is_file($path)) {
        $target = $path;
        break;
    }
}

if ($target === null) {
    echo '[SKIP] offer-documents-generator-client: gmail-agent harness not found (optional tier).' . PHP_EOL;
    exit(0);
}

require_once $target;
