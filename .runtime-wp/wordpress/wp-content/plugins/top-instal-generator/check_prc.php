<?php
/**
 * Skrypt do sprawdzenia placeholderów w szablonie DOCX
 */

$template = 'szablon-1f-split.docx';

echo "🔍 SPRAWDZANIE PLACEHOLDERÓW W SZABLONIE: $template\n";
echo "==========================================\n\n";

if (!file_exists($template)) {
    echo "❌ Plik $template nie istnieje!\n";
    exit;
}

$zip = new ZipArchive();
if ($zip->open($template) !== TRUE) {
    echo "❌ Nie można otworzyć pliku DOCX\n";
    exit;
}

$document = $zip->getFromName('word/document.xml');
if ($document === FALSE) {
    echo "❌ Nie można odczytać document.xml\n";
    $zip->close();
    exit;
}

$zip->close();

echo "📄 Zawartość document.xml (pierwsze 2000 znaków):\n";
echo "================================================\n";
echo substr($document, 0, 2000) . "\n\n";

echo "🔍 SZUKANIE PLACEHOLDERÓW:\n";
echo "========================\n";

$placeholders = ['MOC', 'KIT', 'INDOOR', 'OUTDOOR', 'CWU', 'TANK', 'BFR', 'PRC'];

foreach ($placeholders as $placeholder) {
    echo "\n📋 Sprawdzam placeholder: $placeholder\n";
    
    // Sprawdź różne formaty
    $patterns = [
        "{{$placeholder}}" => "Pełny placeholder z nawiasami",
        "<w:t[^>]*>{{$placeholder}}</w:t>" => "W tagu w:t z nawiasami",
        "<w:t[^>]*>$placeholder</w:t>" => "W tagu w:t bez nawiasów",
        "{{$placeholder[0]}</w:t>.*?<w:t[^>]*>$placeholder[1]</w:t>.*?<w:t[^>]*>$placeholder[2]</w:t>" => "Rozdzielony przez XML tags",
    ];
    
    $found = false;
    foreach ($patterns as $pattern => $description) {
        if (preg_match("/$pattern/", $document)) {
            echo "  ✅ ZNALEZIONO: $description\n";
            $found = true;
            
            // Pokaż kontekst
            preg_match("/$pattern/", $document, $matches);
            $pos = strpos($document, $matches[0]);
            $context = substr($document, max(0, $pos - 100), 200);
            echo "  📍 Kontekst: " . htmlspecialchars($context) . "\n";
        }
    }
    
    if (!$found) {
        echo "  ❌ NIE ZNALEZIONO w żadnym formacie\n";
        
        // Sprawdź czy w ogóle istnieje w dokumencie
        if (strpos($document, $placeholder) !== false) {
            echo "  ⚠️ Ale tekst '$placeholder' istnieje w dokumencie!\n";
            $pos = strpos($document, $placeholder);
            $context = substr($document, max(0, $pos - 100), 200);
            echo "  📍 Kontekst: " . htmlspecialchars($context) . "\n";
        }
    }
}

echo "\n🔍 SZUKANIE WSZYSTKICH NAWIASÓW KLAMROWYCH:\n";
echo "==========================================\n";

preg_match_all('/\{\{[^}]+\}\}/', $document, $matches);
if (!empty($matches[0])) {
    echo "Znalezione placeholdery z nawiasami:\n";
    foreach ($matches[0] as $match) {
        echo "  - $match\n";
    }
} else {
    echo "❌ Nie znaleziono żadnych placeholderów z nawiasami klamrowymi!\n";
}

echo "\n🔍 SZUKANIE WSZYSTKICH TAGÓW w:t Z TEKSTEM:\n";
echo "==========================================\n";

preg_match_all('/<w:t[^>]*>([^<]+)<\/w:t>/', $document, $matches);
if (!empty($matches[1])) {
    echo "Znalezione teksty w tagach w:t:\n";
    foreach ($matches[1] as $text) {
        if (strlen(trim($text)) > 0) {
            echo "  - '" . htmlspecialchars($text) . "'\n";
        }
    }
} else {
    echo "❌ Nie znaleziono żadnych tekstów w tagach w:t!\n";
}

echo "\n✅ Sprawdzanie zakończone!\n";
?>
