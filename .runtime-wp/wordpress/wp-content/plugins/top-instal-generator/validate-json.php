<?php
/**
 * Skrypt walidacji plików JSON w pluginie Top-Instal Generator
 * Uruchom: php validate-json.php
 */

$errors = [];
$warnings = [];

// Sprawdź kits.json
$kits_file = __DIR__ . '/kits.json';
if (file_exists($kits_file)) {
    $kits_json = file_get_contents($kits_file);
    $kits_data = json_decode($kits_json, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        $errors[] = "kits.json: " . json_last_error_msg();
    } else {
        echo "✅ kits.json: OK\n";
        // Sprawdź strukturę
        $required_sections = ['1fazowe', '3fazowe', 'all_in_one_185', 'all_in_one_260'];
        foreach ($required_sections as $section) {
            if (!isset($kits_data[$section])) {
                $warnings[] = "kits.json: brakuje sekcji '$section'";
            }
        }
    }
} else {
    $errors[] = "kits.json: plik nie istnieje";
}

// Sprawdź prices-fallback.json
$fallback_file = __DIR__ . '/prices-fallback.json';
if (file_exists($fallback_file)) {
    $fallback_json = file_get_contents($fallback_file);
    $fallback_data = json_decode($fallback_json, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        $errors[] = "prices-fallback.json: " . json_last_error_msg();
    } else {
        echo "✅ prices-fallback.json: OK\n";
        // Sprawdź wymagane pola
        $required_fields = ['cwu', 'buffer', 'foundation', 'installation_net', 'hydraulic_components_aio', 'hydraulic_components_split', 'vat_rate'];
        foreach ($required_fields as $field) {
            if (!isset($fallback_data[$field])) {
                $warnings[] = "prices-fallback.json: brakuje pola '$field'";
            }
        }
    }
} else {
    $errors[] = "prices-fallback.json: plik nie istnieje";
}

// Sprawdź main/konfigurator/prices.json (jeśli istnieje)
$main_prices_file = __DIR__ . '/../main/konfigurator/prices.json';
if (file_exists($main_prices_file)) {
    $main_prices_json = file_get_contents($main_prices_file);
    $main_prices_data = json_decode($main_prices_json, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        $warnings[] = "main/konfigurator/prices.json: " . json_last_error_msg() . " (plugin użyje fallback)";
    } else {
        echo "✅ main/konfigurator/prices.json: OK\n";
    }
} else {
    echo "ℹ️  main/konfigurator/prices.json: nie istnieje (plugin użyje fallback)\n";
}

// Podsumowanie
if (!empty($errors)) {
    echo "\n❌ BŁĘDY:\n";
    foreach ($errors as $error) {
        echo "  - $error\n";
    }
    exit(1);
}

if (!empty($warnings)) {
    echo "\n⚠️  OSTRZEŻENIA:\n";
    foreach ($warnings as $warning) {
        echo "  - $warning\n";
    }
}

echo "\n✅ Wszystkie pliki JSON są poprawne!\n";
exit(0);
