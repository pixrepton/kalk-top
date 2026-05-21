<?php
/**
 * Test konwertera PDF i logiki generatora (Top-Instal).
 * Uruchom: php test-converter-and-generator.php
 */
$baseDir = __DIR__;
$converterUrl = trim((string) getenv('TOP_INSTAL_PDF_CONVERTER_URL'));
$converterToken = trim((string) getenv('TOP_INSTAL_PDF_CONVERTER_TOKEN'));
$healthUrl = $converterUrl !== '' ? preg_replace('#/convert/?$#', '/health', $converterUrl) : '';

echo "=== Test konwertera PDF i generatora ===\n\n";

// --- 1. Konfiguracja PDF w pluginie ---
echo "1. Konfiguracja PDF w pluginie\n";
if (file_exists($baseDir . '/top-instal-generator.php')) {
    $php = file_get_contents($baseDir . '/top-instal-generator.php');
    $hasUrlConstant = (strpos($php, 'TOP_INSTAL_PDF_CONVERTER_URL_DEFAULT') !== false);
    $hasTokenConstant = (strpos($php, 'TOP_INSTAL_PDF_CONVERTER_TOKEN_DEFAULT') !== false);
    echo "   URL constant present: " . ($hasUrlConstant ? "OK" : "BRAK") . "\n";
    echo "   Token constant present: " . ($hasTokenConstant ? "OK" : "BRAK") . "\n";
} else {
    echo "   BRAK pliku top-instal-generator.php\n";
}

// --- 2. Healthcheck konwertera ---
echo "\n2. Healthcheck konwertera\n";
if ($healthUrl === '') {
    echo "   Pominiêto (ustaw TOP_INSTAL_PDF_CONVERTER_URL)\n";
} else {
    $ch = curl_init($healthUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 3);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    if ($err) {
        echo "   B³¹d: $err\n";
    } else {
        echo "   HTTP: $httpCode\n";
        echo "   Status: " . ($httpCode === 200 ? "OK" : "B³¹d") . "\n";
    }
}

// --- 3. Minimalny DOCX ---
echo "\n3. Tworzenie testowego DOCX\n";
$testDocx = $baseDir . '/test_minimal.docx';
if (!file_exists($testDocx)) {
    if (file_exists($baseDir . '/create_minimal_docx.php')) {
        passthru('php ' . escapeshellarg($baseDir . '/create_minimal_docx.php'), $ret);
        if ($ret !== 0) {
            echo "   Nie uda³o siê utworzyæ test_minimal.docx\n";
        }
    }
}
if (file_exists($testDocx)) {
    echo "   Plik: " . basename($testDocx) . " (" . filesize($testDocx) . " B)\n";
} else {
    echo "   Brak test_minimal.docx – pomijam test konwersji\n";
}

// --- 4. Konwersja DOCX -> PDF ---
echo "\n4. Konwersja DOCX -> PDF (POST /convert z tokenem)\n";
if (!file_exists($testDocx)) {
    echo "   Pominiêto (brak DOCX)\n";
} elseif ($converterUrl === '' || $converterToken === '') {
    echo "   Pominiêto (ustaw TOP_INSTAL_PDF_CONVERTER_URL i TOP_INSTAL_PDF_CONVERTER_TOKEN)\n";
} else {
    $ch = curl_init($converterUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 60);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'X-Converter-Token: ' . $converterToken
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, [
        'files' => new CURLFile($testDocx, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'test.docx')
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);

    if ($err) {
        echo "   B³¹d cURL: $err\n";
    } else {
        echo "   HTTP: $httpCode\n";
        $len = is_string($response) ? strlen($response) : 0;
        echo "   Rozmiar odpowiedzi: $len B\n";
        $isPdf = ($len > 4 && substr($response, 0, 4) === '%PDF');
        echo "   Czy PDF: " . ($isPdf ? "TAK" : "NIE") . "\n";
        if ($isPdf) {
            $outPdf = $baseDir . '/test_converter_output.pdf';
            file_put_contents($outPdf, $response);
            echo "   Zapisano: " . basename($outPdf) . "\n";
        }
    }
}

// --- 5. Generator: sk³adnia PHP i JSON ---
echo "\n5. Generator – walidacja\n";
$phpLint = shell_exec('php -l ' . escapeshellarg($baseDir . '/top-instal-generator.php') . ' 2>&1');
echo "   PHP: " . (strpos((string) $phpLint, 'No syntax errors') !== false ? "OK" : trim((string) $phpLint)) . "\n";
if (file_exists($baseDir . '/validate-json.php')) {
    ob_start();
    passthru('php ' . escapeshellarg($baseDir . '/validate-json.php') . ' 2>&1', $ret);
    $jsonOut = ob_get_clean();
    echo "   JSON (kits, prices-fallback): " . ($ret === 0 ? "OK" : "B³¹d") . "\n";
}

echo "\n=== Koniec testów ===\n";
