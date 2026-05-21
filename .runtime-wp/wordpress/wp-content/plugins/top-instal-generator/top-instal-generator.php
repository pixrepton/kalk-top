<?php
/**
 * Plugin Name: Top-Instal Generator
 * Plugin URI: https://topinstal.com.pl
 * Description: Generator ofert dla instalacji HVAC z interfejsem Windows 95
 * Version: 1.0.0
 * Author: Top-Instal
 * License: GPL v2 or later
 * Text Domain: top-instal-generator
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('TOP_INSTAL_PLUGIN_URL', plugin_dir_url(__FILE__));
define('TOP_INSTAL_PLUGIN_PATH', plugin_dir_path(__FILE__));
define('TOP_INSTAL_PLUGIN_VERSION', '1.0.0');
// Domyślna konfiguracja konwertera PDF (Gotenberg)
define('TOP_INSTAL_PDF_CONVERTER_URL_DEFAULT', '');
define('TOP_INSTAL_PDF_CONVERTER_TOKEN_DEFAULT', '');

// Include Composer autoload
if (file_exists(TOP_INSTAL_PLUGIN_PATH . 'vendor/autoload.php')) {
    require_once TOP_INSTAL_PLUGIN_PATH . 'vendor/autoload.php';
} else {
    add_action('admin_notices', function() {
        echo '<div class="notice notice-error"><p>Top-Instal Generator: Composer dependencies missing. Please upload vendor folder.</p></div>';
    });
}

// Modular architecture bootstrap (contracts -> application -> wp-adapter).
$topinstal_generator_bootstrap_files = array(
    TOP_INSTAL_PLUGIN_PATH . 'wp-adapter/bootstrap/trace.php',
    TOP_INSTAL_PLUGIN_PATH . 'wp-adapter/logging/LoggerWp.php',
    TOP_INSTAL_PLUGIN_PATH . 'core/contracts/DocumentReasonCodes.php',
    TOP_INSTAL_PLUGIN_PATH . 'core/application/OfferDocumentException.php',
    TOP_INSTAL_PLUGIN_PATH . 'core/application/OfferDocumentInputMapper.php',
    TOP_INSTAL_PLUGIN_PATH . 'wp-adapter/services/GeneratorConfigWp.php',
    TOP_INSTAL_PLUGIN_PATH . 'wp-adapter/services/KitsRepositoryWp.php',
    TOP_INSTAL_PLUGIN_PATH . 'wp-adapter/services/TemplateSelectorService.php',
    TOP_INSTAL_PLUGIN_PATH . 'wp-adapter/services/PlaceholderBuilderService.php',
    TOP_INSTAL_PLUGIN_PATH . 'wp-adapter/services/DocxTemplateRendererService.php',
    TOP_INSTAL_PLUGIN_PATH . 'wp-adapter/services/PdfConverterClientWp.php',
    TOP_INSTAL_PLUGIN_PATH . 'wp-adapter/services/OfferFileStorageWp.php',
    TOP_INSTAL_PLUGIN_PATH . 'core/application/GenerateOfferDocumentUseCase.php',
    TOP_INSTAL_PLUGIN_PATH . 'wp-adapter/rest/RestErrors.php',
    TOP_INSTAL_PLUGIN_PATH . 'wp-adapter/rest/OfferDocumentRequestValidator.php',
    TOP_INSTAL_PLUGIN_PATH . 'wp-adapter/rest/GenerateOfferDocumentController.php',
    TOP_INSTAL_PLUGIN_PATH . 'wp-adapter/bootstrap/routes.php',
    TOP_INSTAL_PLUGIN_PATH . 'wp-adapter/ajax/KitsAjaxController.php',
    TOP_INSTAL_PLUGIN_PATH . 'wp-adapter/ajax/GenerateOfferDocumentAjaxController.php',
);
foreach ($topinstal_generator_bootstrap_files as $topinstal_generator_bootstrap_file) {
    if (is_file($topinstal_generator_bootstrap_file)) {
        require_once $topinstal_generator_bootstrap_file;
    }
}

if (function_exists('topinstal_generator_register_routes')) {
    add_action('rest_api_init', 'topinstal_generator_register_routes');
}

// Enqueue scripts and styles
function top_instal_enqueue_scripts() {
    wp_enqueue_style('top-instal-generator', TOP_INSTAL_PLUGIN_URL . 'generator.css', array(), TOP_INSTAL_PLUGIN_VERSION);
    wp_enqueue_script('top-instal-generator', TOP_INSTAL_PLUGIN_URL . 'generator.js', array('jquery'), TOP_INSTAL_PLUGIN_VERSION, true);
    wp_enqueue_script(
        'topinstal-documents-api',
        TOP_INSTAL_PLUGIN_URL . 'frontend/api/topinstalDocumentsApi.js',
        array(),
        TOP_INSTAL_PLUGIN_VERSION,
        true
    );

    $prices = array(
        'cwu' => array('emalia' => array(), 'inox' => array(), 'none' => 0),
        'buffer' => array(),
        'installation_net' => 11000,
        'hydraulic_components_aio' => 2700,
        'hydraulic_components_split' => 3700,
        'foundation' => array('fundament-nasz' => 300),
        'vat_rate' => 0.08
    );
    $prices_file = realpath(TOP_INSTAL_PLUGIN_PATH . '../main/konfigurator/prices.json');
    if (!$prices_file || !is_readable($prices_file)) {
        $prices_file = TOP_INSTAL_PLUGIN_PATH . 'prices-fallback.json';
    }
    if ($prices_file && is_readable($prices_file)) {
        $decoded = json_decode(file_get_contents($prices_file), true);
        if (is_array($decoded)) {
            if (!empty($decoded['cwu'])) $prices['cwu'] = $decoded['cwu'];
            if (!empty($decoded['buffer'])) $prices['buffer'] = $decoded['buffer'];
            if (isset($decoded['installation_net'])) $prices['installation_net'] = (int) $decoded['installation_net'];
            if (isset($decoded['hydraulic_components_aio'])) $prices['hydraulic_components_aio'] = (int) $decoded['hydraulic_components_aio'];
            if (isset($decoded['hydraulic_components_split'])) $prices['hydraulic_components_split'] = (int) $decoded['hydraulic_components_split'];
            if (!empty($decoded['foundation'])) $prices['foundation'] = $decoded['foundation'];
            if (isset($decoded['vat_rate'])) $prices['vat_rate'] = (float) $decoded['vat_rate'];
        }
    }

    wp_localize_script('top-instal-generator', 'topInstal', array(
        'ajaxurl' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('top_instal_nonce'),
        'prices' => $prices,
        'offerDocumentsEndpoint' => function_exists('rest_url')
            ? (string) rest_url('topinstal/v1/offer-documents/generate')
            : (string) (get_site_url() . '/wp-json/topinstal/v1/offer-documents/generate'),
    ));

    wp_localize_script('topinstal-documents-api', 'topInstalApiConfig', array(
        'nonce' => wp_create_nonce('top_instal_nonce'),
        'offerDocumentsEndpoint' => function_exists('rest_url')
            ? (string) rest_url('topinstal/v1/offer-documents/generate')
            : (string) (get_site_url() . '/wp-json/topinstal/v1/offer-documents/generate'),
    ));
}
add_action('wp_enqueue_scripts', 'top_instal_enqueue_scripts');

// Register shortcode
function top_instal_quote_form_shortcode() {
    ob_start();
    ?>
    <div class="top-instal-wp-container">
        <div class="win95-window" id="mainWindow">
            <div class="win95-title-bar">
                <div class="win95-title-text">🏠 Generator Ofert HVAC - Top-Instal v1.0</div>
                <div class="win95-window-controls">
                    <button class="win95-btn-minimize">_</button>
                    <button class="win95-btn-maximize">□</button>
                    <button class="win95-btn-close">×</button>
                </div>
            </div>

            <div class="win95-content">
                <div class="win95-form">
                    <form id="generatorForm" class="win95-form">
                        <!-- Wybór typu instalacji -->
<div class="win95-group group-installation">
    <label class="win95-label">🏠 Typ instalacji:</label>
    <div class="win95-button-group">
        <label class="win95-label">
            <input type="radio" name="installation_type" value="heat_pump" checked>
            <span>Pompa ciepła</span>
        </label>
        <label class="win95-label">
            <input type="radio" name="installation_type" value="floor_heating" disabled>
            <span>Podłogówka (niedostępne)</span>
        </label>
    </div>
</div>

<div class="win95-separator"></div>

<!-- Moc pompy ciepła -->
<div class="win95-group group-power">
    <label class="win95-label">⚡ Moc pompy ciepła:</label>
    <div class="win95-button-group">
        <label class="win95-label"><input type="radio" name="power_kw" value="3"> 3 kW</label>
        <label class="win95-label"><input type="radio" name="power_kw" value="5"> 5 kW</label>
        <label class="win95-label"><input type="radio" name="power_kw" value="7" checked> 7 kW</label>
        <label class="win95-label"><input type="radio" name="power_kw" value="9"> 9 kW</label>
        <label class="win95-label"><input type="radio" name="power_kw" value="12"> 12 kW</label>
        <label class="win95-label"><input type="radio" name="power_kw" value="16"> 16 kW</label>
    </div>
</div>


                        <!-- Zbiornik CWU: checkbox + select -->
                        <div id="tank-config-wrapper">
                        <div class="win95-group">
                            <label class="win95-label" for="has_cwu">💧 Zbiornik CWU:</label>
                            <div class="win95-button-group">
                                <label class="win95-label">
                                    <input type="checkbox" id="has_cwu" name="has_cwu" checked>
                                </label>
                                <select id="tank_capacity" name="tank_capacity" class="win95-select" required>
                                    <option value="150">150 litrów</option>
                                    <option value="200">200 litrów</option>
                                    <option value="250">250 litrów</option>
                                    <option value="300">300 litrów</option>
                                    <option value="400">400 litrów</option>
                                    <option value="185-aio">ALL-IN-ONE 185L</option>
                                    <option value="260-aio">ALL-IN-ONE 260L</option>
                                </select>
                            </div>
                        </div>

                        <div class="win95-group inline-field" id="tankManufacturerGroup">
                        <label for="tank-manufacturer-select" class="win95-label">Producent zbiornika:</label>
                        <select id="tank-manufacturer-select" name="tank_manufacturer" class="win95-select">
                            <option value=" ">Nie wpisuj</option>
                            <option value="THERMATEC">Thermatec</option>
                            <option value="VIQTIS">Viqtis</option>
                            <option value="ECLIS Puretherm">Eclis</option>
                            <option value="Trinnity" selected>Trinnity</option>
                            <option value="Galmet">Galmet</option>
                        </select>
                    </div>
                        <div id="tank-config-error" class="win95-inline-error" style="display: none;" role="alert">
                            <span class="win95-inline-error-icon" aria-hidden="true">&#9888;</span>
                            <span class="win95-inline-error-text">Brak ceny dla takiej konfiguracji zbiornika</span>
                        </div>
                        </div>

                        <!-- Bufor: checkbox + select -->
                        <div class="win95-group">
                            <label class="win95-label" for="has_buffer">🔄 Bufor:</label>
                            <div class="win95-button-group">
                                <label class="win95-label">
                                    <input type="checkbox" id="has_buffer" name="has_buffer">
                                </label>
                                <select id="buffer_capacity" name="buffer_capacity" class="win95-select" required>
                                    <option value="60">60 litrów</option>
                                    <option value="80">80 litrów</option>
                                    <option value="100">100 litrów</option>
                                    <option value="120">120 litrów</option>
                                    <option value="150">150 litrów</option>
                                    <option value="200">200 litrów</option>
                                    <option value="60-80">60-80 L</option>
                                    <option value="80-100">80-100 L</option>
                                    <option value="100-120">100-120 L</option>
                                    <option value="100-150">100-150 L</option>
                                    <option value="120-150">120-150 L</option>
                                    <option value="150-200">150-200 L</option>
                                </select>
                            </div>
                        </div>

                        <!-- Kit Selection -->
                        <div class="win95-group inline-field">
                            <label class="win95-label" for="kit_model">🎯 Model zestawu pompy ciepła:</label>
                            <select id="kit_model" name="kit_model" class="win95-select" required>
                                <option value="">Wybierz zestaw...</option>
                            </select>
                            <div id="kit-loading" class="win95-status loading" style="display: none;">⏳ Ładowanie zestawów...</div>
                        </div>

                        <!-- Price -->
                        <div class="win95-group">
                            <label class="win95-label" for="custom_price">💰 Cena (zł brutto):</label>
                            <input type="number" id="custom_price" name="custom_price" class="win95-input" value="41000" min="1000" required>
                        </div>


                        <!-- Output Format -->
                        <div class="win95-group">
                            <label class="win95-label" for="output_format">📄 Format wyjściowy:</label>
                            <div class="win95-button-group">
                                  <label class="win95-label">
                                    <input type="radio" name="output_format" value="pdf" checked>
                                    <span>PDF (.pdf)</span>
                                </label>
                                <label class="win95-label">
                                    <input type="radio" name="output_format" value="docx">
                                    <span>Word (.docx)</span>
                                </label>
                            </div>
                        </div>

                        </div> <!-- Koniec sekcji heat-pump-section -->

                        <div class="win95-separator"></div>

                        <!-- Sekcja Podłogówka -->
                        <div id="floor-heating-section" style="display: none;">
                            <div class="win95-group">
                                <label class="win95-label">📐 Powierzchnia podłogówki (m²):</label>
                                <input type="number" id="floor_area" name="floor_area" class="win95-input" value="100" min="10" max="500">
                            </div>

                            <div class="win95-group">
                                <label class="win95-label">🌡️ Typ ogrzewania:</label>
                                <div class="win95-button-group">
                                    <label class="win95-label">
                                        <input type="radio" name="heating_type" value="water" checked>
                                        <span>Wodne</span>
                                    </label>
                                    <label class="win95-label">
                                        <input type="radio" name="heating_type" value="electric">
                                        <span>Elektryczne</span>
                                    </label>
                                </div>
                            </div>

                            <div class="win95-group inline-field">
                                <label class="win95-label">🏠 Typ budynku:</label>
                                <select id="building_type" name="building_type" class="win95-select">
                                    <option value="house">Dom jednorodzinny</option>
                                    <option value="apartment">Mieszkanie</option>
                                    <option value="office">Biuro</option>
                                    <option value="commercial">Lokal użytkowy</option>
                                </select>
                            </div>

                            <div class="win95-group">
                                <label class="win95-label">💰 Cena (zł brutto):</label>
                                <input type="number" id="custom_price_floor" name="custom_price_floor" class="win95-input" value="15000" min="1000" required>
                            </div>
                        </div> <!-- Koniec sekcji floor-heating-section -->

                        <div class="win95-separator"></div>

                        <!-- Generate Button -->
                        <div class="win95-group">
                            <button type="submit" id="generateBtn" class="win95-button win95-button-primary">
                                🔄 Generuj Ofertę
                            </button>
                        </div>
                    </form>

                    <!-- Results -->
                    <div id="results" style="display: none;">
                        <div class="win95-status success">
                            <strong>✅ Oferta wygenerowana!</strong><br>
                            <span id="resultText"></span><br>
                            <a id="downloadLink" href="#" class="win95-button" target="_blank">⬇️ Pobierz ofertę</a>
                        </div>
                    </div>

                    <div id="error" style="display: none;">
                        <div class="win95-status error">
                            <strong>❌ Błąd</strong><br>
                            <span id="errorText"></span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="win95-status">
                <span>Ready</span> | <span>Top-Instal Generator v1.0</span> | <span id="currentTime"></span>
            </div>
        </div>
    </div>

<script></script>
   
    <?php
    return ob_get_clean();
}
// Register shortcode
add_action('init', function() {
    add_shortcode('top_instal_offer_generator', 'top_instal_quote_form_shortcode');
});

// AJAX: get kits
add_action('wp_ajax_get_kits', 'handle_get_kits');
add_action('wp_ajax_nopriv_get_kits', 'handle_get_kits');

function handle_get_kits() {
    if (class_exists('TopInstal_Ajax_Kits_Controller')) {
        TopInstal_Ajax_Kits_Controller::handle_get_kits();
        return;
    }

    check_ajax_referer('top_instal_nonce', 'nonce');

    $power_type = sanitize_text_field($_POST['power_type'] ?? '1fazowe');
    $tank_capacity = sanitize_text_field($_POST['tank_capacity'] ?? '200');
    $power_kw = isset($_POST['power_kw']) ? intval($_POST['power_kw']) : null;

    // Enhanced tank capacity mapping with new pump types (PHP 7.4 compatible)
    $merge_aio_260 = false; // łącz AIO 260 i T-CAP AIO 260
    $merge_aio_185 = false; // łącz AIO 185 i T-CAP AIO 185 oraz AIO 2-strefowy 185
    if ($tank_capacity === 'none') {
        // Bez CWU - pokazuj tylko pompy split (KIT-WC...)
        $data_key = 'all';
    } elseif ($tank_capacity === '185-aio') {
        // Uogólnienie: 185L łączy klasyczne AIO 185, T-CAP AIO 185 oraz AIO 2-strefowy (185L)
        $merge_aio_185 = true;
        $data_key = 'all_in_one_185';
    } elseif ($tank_capacity === '260-aio' || $tank_capacity === '260-tcap') {
        // Uogólnienie: T-CAP 260L traktujemy jak AIO 260L → połącz grupy
        $merge_aio_260 = true;
        $data_key = 'all_in_one_260';
    } elseif (in_array($tank_capacity, ['150', '200', '250', '300', '400'])) {
        // Standardowe zbiorniki - pokazuj tylko pompy split (KIT-WC...)
        $data_key = 'all';
    } elseif ($power_type === 'all') {
        $data_key = 'all';
    } else {
        $data_key = $power_type;
    }

    $kits_file = TOP_INSTAL_PLUGIN_PATH . 'kits.json';
    if (!file_exists($kits_file)) {
        wp_send_json_error('Plik z zestawami nie istnieje');
    }

    // Implement caching for product kits
    $cache_key = 'top_instal_kits_' . md5($kits_file . filemtime($kits_file));
    $kits_data = wp_cache_get($cache_key);

    if ($kits_data === false) {
        $kits_data = json_decode(file_get_contents($kits_file), true);
        wp_cache_set($cache_key, $kits_data, '', 3600); // Cache for 1 hour
    }

    // Zbuduj listę do zwrotu
    $result = [];
    if ($merge_aio_260) {
        // Połącz AIO 260L oraz T-CAP AIO 260L
        if (isset($kits_data['all_in_one_260'])) {
            foreach ($kits_data['all_in_one_260'] as $key => $kit) {
                $result[$key] = $kit;
            }
        }
        if (isset($kits_data['tcap_aio_260'])) {
            foreach ($kits_data['tcap_aio_260'] as $key => $kit) {
                $result[$key] = $kit;
            }
        }
    } elseif ($merge_aio_185) {
        // Połącz AIO 185L, T-CAP AIO 185L oraz AIO 2-strefowy 185L
        if (isset($kits_data['all_in_one_185'])) {
            foreach ($kits_data['all_in_one_185'] as $key => $kit) {
                $result[$key] = $kit;
            }
        }
        if (isset($kits_data['tcap_aio_185'])) {
            foreach ($kits_data['tcap_aio_185'] as $key => $kit) {
                $result[$key] = $kit;
            }
        }
        if (isset($kits_data['all_in_one_2strefowy'])) {
            foreach ($kits_data['all_in_one_2strefowy'] as $key => $kit) {
                $result[$key] = $kit;
            }
        }
    } elseif ($data_key === 'all') {
        foreach ($kits_data as $group => $group_data) {
            foreach ($group_data as $key => $kit) {
                $result[$key] = $kit;
            }
        }
    } else {
        if (!isset($kits_data[$data_key])) {
            wp_send_json_error("Nie znaleziono zestawów dla klucza: $data_key");
        }
        $result = $kits_data[$data_key];
    }

    // Opcjonalny filtr po mocy
    if (!empty($power_kw)) {
        $result = array_filter($result, function($kit) use ($power_kw) {
            if (empty($kit['power'])) return true;
            if (preg_match('/(\d+)/', $kit['power'], $m)) {
                return intval($m[1]) === $power_kw;
            }
            return true;
        });
    }

    // Filtr dla różnych typów zbiorników
    if ($tank_capacity === 'none' || in_array($tank_capacity, ['150', '200', '250', '300', '400'])) {
        // Bez CWU lub standardowe zbiorniki - ukryj tylko All-in-One (KIT-ADC... i KIT-AXC...)
        $result = array_filter($result, function($kit_key) {
            return !preg_match('/^KIT-(ADC|AXC)/', $kit_key);
        }, ARRAY_FILTER_USE_KEY);
    } elseif (in_array($tank_capacity, ['185-aio', '260-aio', '260-tcap'])) {
        // All-in-One zbiorniki - pokazuj tylko pompy AIO (KIT-ADC... lub KIT-AXC...)
        $result = array_filter($result, function($kit_key) {
            return preg_match('/^KIT-(ADC|AXC)/', $kit_key);
        }, ARRAY_FILTER_USE_KEY);
    }

    wp_send_json_success($result);
}

// AJAX: generate DOCX/PDF
add_action('wp_ajax_simple_generate', 'handle_simple_generate');
add_action('wp_ajax_nopriv_simple_generate', 'handle_simple_generate');

function handle_simple_generate() {
    if (class_exists('TopInstal_Ajax_GenerateOfferDocument_Controller')) {
        TopInstal_Ajax_GenerateOfferDocument_Controller::handle_simple_generate();
        return;
    }

    check_ajax_referer('top_instal_nonce', 'nonce');

    $input_data = json_decode(stripslashes($_POST['data']), true);
    if (!$input_data) {
        wp_send_json_error('Invalid JSON input');
    }

    $installation_type = sanitize_text_field($input_data['installation_type'] ?? 'heat_pump');
    $pompa_type = sanitize_text_field($input_data['pompa_type'] ?? '1f_split');

    // Domyślne wartości
    $power_type = '1fazowe';
    $tank_capacity = sanitize_text_field($input_data['tank_capacity'] ?? 'none');
    $tank_type = ($tank_capacity === 'none') ? 'without' : 'with'; // Nowa logika CWU
    $tank_manufacturer = sanitize_text_field($input_data['tank_manufacturer'] ?? '');
    $buffer_capacity = sanitize_text_field($input_data['buffer_capacity'] ?? 'none');
    $hasBuffer = ($buffer_capacity !== 'none'); // Nowa logika bufora
    $kit_model = sanitize_text_field($input_data['kit_model'] ?? '');
    $custom_price = intval($input_data['custom_price'] ?? 41000);
    // Format wyjściowy: 'pdf' = konwersja przez zewnętrzny konwerter (Gotenberg), 'docx' = tylko DOCX
    $output_format = sanitize_text_field($input_data['output_format'] ?? 'docx');
    if (!in_array($output_format, ['docx', 'pdf'])) {
        $output_format = 'docx';
    }
    
    // Pola dla podłogówki
    $floor_area = intval($input_data['floor_area'] ?? 100);
    $heating_type = sanitize_text_field($input_data['heating_type'] ?? 'water');
    $building_type = sanitize_text_field($input_data['building_type'] ?? 'house');
    $custom_price_floor = intval($input_data['custom_price_floor'] ?? 15000);

    // Debug - zapisz dane z formularza
    error_log("🔍 DEBUG - Dane z formularza:");
    error_log("input_data: " . print_r($input_data, true));
    error_log("buffer_capacity: '$buffer_capacity'");
    error_log("custom_price: '$custom_price'");
    
    // Debug - sprawdź czy buffer_capacity jest w input_data
    if (isset($input_data['buffer_capacity'])) {
        error_log("✅ buffer_capacity znaleziony w input_data: '" . $input_data['buffer_capacity'] . "'");
    } else {
        error_log("❌ buffer_capacity NIE znaleziony w input_data!");
        error_log("Dostępne klucze: " . implode(', ', array_keys($input_data)));
    }

    // Walidacja danych
    $errors = [];
    if ($installation_type === 'heat_pump') {
        if (empty($kit_model)) {
            $errors[] = 'Nie wybrano modelu zestawu pompy ciepła';
        }
        if ($custom_price <= 0) {
            $errors[] = 'Nieprawidłowa cena pompy ciepła';
        }
    } elseif ($installation_type === 'floor_heating') {
        if ($floor_area <= 0) {
            $errors[] = 'Nieprawidłowa powierzchnia podłogówki';
        }
        if ($custom_price_floor <= 0) {
            $errors[] = 'Nieprawidłowa cena podłogówki';
        }
    }
    if (!in_array($output_format, ['docx', 'pdf'])) {
        $errors[] = 'Nieprawidłowy format wyjściowy';
    }
    
    if (!empty($errors)) {
        wp_send_json_error('Błędy walidacji: ' . implode(', ', $errors));
    }

    // Wczytaj zestawy (tylko dla pompy ciepła)
    $kit_info = null;
    $kit_group = '';
    
    if ($installation_type === 'heat_pump') {
        $kits_file = TOP_INSTAL_PLUGIN_PATH . 'kits.json';
        if (!file_exists($kits_file)) {
            wp_send_json_error('Plik z zestawami nie istnieje');
        }
        $kits_data = json_decode(file_get_contents($kits_file), true);

        // Znajdź zestaw
        foreach ($kits_data as $group => $group_data) {
            if (isset($group_data[$kit_model])) {
                $kit_info = $group_data[$kit_model];
                $kit_group = $group;
                break;
            }
        }

        if (!$kit_info) {
            wp_send_json_error('Nie znaleziono wybranego zestawu');
        }
    }

    // 🔍 Logika wyboru szablonu
    $isAllInOne = $kit_info ? (strpos($kit_group, 'all_in_one') !== false) : false;
    $isTCAP = $kit_info ? (strpos($kit_group, 'tcap') !== false) : false;
    $is3Phase = $kit_info ? (($kit_info['voltage'] ?? '') === '400V') : false;
    $hasCWU = ($tank_type !== 'without');
    
    // Debug - logika wyboru szablonu
    error_log("🔍 DEBUG - Logika wyboru szablonu:");
    error_log("installation_type: '$installation_type'");
    error_log("kit_group: '$kit_group'");
    error_log("isAllInOne: " . ($isAllInOne ? 'true' : 'false'));
    error_log("isTCAP: " . ($isTCAP ? 'true' : 'false'));
    error_log("is3Phase: " . ($is3Phase ? 'true' : 'false'));
    error_log("hasCWU: " . ($hasCWU ? 'true' : 'false'));
    error_log("hasBuffer: " . ($hasBuffer ? 'true' : 'false'));

    // Sprawdź typ instalacji
    if ($installation_type === 'floor_heating') {
        // Logika dla podłogówki
        $template_name = 'szablon-podloga-parter-poddasze-garaz.docx'; // Szablon dla podłogówki
        error_log("🔍 DEBUG - Wybrany szablon podłogówki: '$template_name'");
    } elseif ($isAllInOne) {
        // AIO ma zawsze wbudowane CWU, sprawdzamy tylko bufor i pojemność
        if ($kit_group === 'all_in_one_185') {
            // AIO 185L (1F i 3F)
            if ($is3Phase) {
                $template_name = $hasBuffer ? 'szablon-3f-aio-cwu185-bufor.docx' : 'szablon-3f-aio-cwu185.docx';
            } else {
                $template_name = $hasBuffer ? 'szablon-1f-aio-cwu-bufor.docx' : 'szablon-1f-aio-cwu.docx';
            }
        } elseif ($kit_group === 'all_in_one_260') {
            // AIO 260L (tylko 3F)
            $template_name = $hasBuffer ? 'szablon-3f-aio-cwu260-bufor.docx' : 'szablon-3f-aio-cwu260.docx';
        } elseif ($kit_group === 'all_in_one_2strefowy') {
            // AIO 2-strefowy 185L (tylko 1F)
            $template_name = $hasBuffer ? 'szablon-1f-aio-cwu-bufor.docx' : 'szablon-1f-aio-cwu.docx';
        } elseif (strpos($kit_group, 'tcap_aio') !== false) {
            // T-CAP AIO - sprawdź pojemność
            if ($kit_group === 'tcap_aio_185') {
                // T-CAP AIO 185L (1F i 3F)
                if ($is3Phase) {
                    $template_name = $hasBuffer ? 'szablon-3f-aio-cwu185-bufor.docx' : 'szablon-3f-aio-cwu185.docx';
                } else {
                    $template_name = $hasBuffer ? 'szablon-1f-aio-cwu-bufor.docx' : 'szablon-1f-aio-cwu.docx';
                }
            } elseif ($kit_group === 'tcap_aio_260') {
                // T-CAP AIO 260L (tylko 3F)
                $template_name = $hasBuffer ? 'szablon-3f-aio-cwu260-bufor.docx' : 'szablon-3f-aio-cwu260.docx';
            }
        } else {
            // Fallback dla innych grup AIO
            if ($is3Phase) {
                $template_name = $hasBuffer ? 'szablon-3f-aio-cwu185-bufor.docx' : 'szablon-3f-aio-cwu185.docx';
            } else {
                $template_name = $hasBuffer ? 'szablon-1f-aio-cwu-bufor.docx' : 'szablon-1f-aio-cwu.docx';
            }
        }
    } else {
        // SPLIT - uwzględnij bufor i CWU
        if ($is3Phase) {
            // 3F Split - różne szablony w zależności od CWU i bufora
            if ($hasCWU && $hasBuffer) {
                $template_name = 'szablon-3f-split-cwu-bufor.docx';
            } elseif ($hasCWU && !$hasBuffer) {
                $template_name = 'szablon-3f-split-cwu.docx';
            } elseif (!$hasCWU && $hasBuffer) {
                $template_name = 'szablon-3f-split-bufor.docx';
            } else {
                $template_name = 'szablon-3f-split.docx'; // bez CWU i bufora
            }
        } else {
            // 1F Split - różne szablony w zależności od CWU i bufora
            if ($hasCWU && $hasBuffer) {
                $template_name = 'szablon-1f-split-cwu-bufor.docx';
            } elseif ($hasCWU && !$hasBuffer) {
                $template_name = 'szablon-1f-split-cwu.docx';
            } elseif (!$hasCWU && $hasBuffer) {
                $template_name = 'szablon-1f-split-bufor.docx';
            } else {
                $template_name = 'szablon-1f-split.docx'; // bez CWU i bufora
            }
        }
    }
    
    error_log("🔍 DEBUG - Wybrany szablon: '$template_name'");

    $template_path = TOP_INSTAL_PLUGIN_PATH . $template_name;

    if (!file_exists($template_path)) {
        wp_send_json_error('Szablon nie istnieje: ' . $template_name);
    }

    // 🔁 Ścieżki i przygotowanie pliku wyjściowego
    $upload_dir = wp_upload_dir();
    $output_dir = $upload_dir['basedir'] . '/top-instal-offers';
    if (!file_exists($output_dir)) {
        wp_mkdir_p($output_dir);
    }

    $timestamp = date('Y-m-d_H-i-s');
    if ($installation_type === 'floor_heating') {
        $filename = "Oferta-Podlogowka_{$timestamp}.docx";
    } else {
        $filename = "Oferta-PC-Panasonic_{$timestamp}.docx";
    }
    $output_path = "$output_dir/$filename";


// =====================================================================
// DOCX: generowanie pliku wynikowego z szablonu DOCX (bez dłubania w XML)
// Używamy PhpOffice\PhpWord\TemplateProcessor z makrami {{...}}
// =====================================================================

// Przygotowanie placeholderów w zależności od typu instalacji
if ($installation_type === 'floor_heating') {
    // Placeholdery dla podłogówki
    $kw_value = 'Podłogówka';
    $elektro_value = 'Instalacja podłogowa';
    $indoor_unit = 'System podłogowy';
    $outdoor_unit = 'Instalacja wodna/elektryczna';
    $voltage = '230V/400V';

    $tank_capacity_text = 'Podłogówka ' . $floor_area . ' m²';
    $tank_manufacturer_text = ucfirst($heating_type) . ' - ' . ucfirst($building_type);
    $buffer_capacity_text = 'System ' . $heating_type;
    $cwu_info = 'Podłogówka ' . $floor_area . ' m²';
    $formatted_price_with_spaces = number_format($custom_price_floor, 0, ',', ' ');
} else {
    // Placeholdery dla pompy ciepła
    $kw_value = '9';
    if ($kit_info && preg_match('/(\d+)/', $kit_info['power'], $matches)) {
        $kw_value = $matches[1];
    }

    $elektro_value = (($kit_info['voltage'] ?? '') === '400V') ? '3-FAZOWA | 400 V' : '1-FAZOWA | 230 V';
    $indoor_unit = $kit_info['indoor_unit'] ?? 'WH-SDC09K3E8';
    $outdoor_unit = $kit_info['outdoor_unit'] ?? 'WH-UDZ09KE8';
    $voltage = $kit_info['voltage'] ?? '230V';

    $tank_map = [
        'none' => 'BRAK - BEZ CWU', '150' => '150 litrów', '200' => '200 litrów',
        '250' => '250 litrów', '300' => '300 litrów', '400' => '400 litrów',
        '185-aio' => 'ALL-IN-ONE 185 litrów', '260-aio' => 'ALL-IN-ONE 260 litrów',
        '260-tcap' => 'ALL-IN-ONE 260 litrów'
    ];
    $tank_capacity_text = $tank_map[$tank_capacity] ?? 'BRAK - BEZ CWU';
    $tank_manufacturer_text = empty($tank_manufacturer) ? '' : $tank_manufacturer;
    $buffer_capacity_text = ($buffer_capacity === 'none') ? 'brak - nie rekomendowany' : $buffer_capacity . ' litrów';
    $cwu_info = ($tank_type === 'without') ? 'Bez c.w.u.' : $tank_capacity_text;
    $formatted_price_with_spaces = number_format($custom_price, 0, ',', ' ');
}

// Debug - zapisz wartości do loga (zostawiamy, bo masz i tak logi)
error_log("🔍 DEBUG - Wartości placeholderów (TemplateProcessor):");
error_log("kw_value: '$kw_value'");
error_log("kit_model: '$kit_model'");
error_log("indoor_unit: '$indoor_unit'");
error_log("outdoor_unit: '$outdoor_unit'");
error_log("cwu_info: '$cwu_info'");
error_log("tank_manufacturer_text: '$tank_manufacturer_text'");
error_log("buffer_capacity_text: '$buffer_capacity_text'");
error_log("formatted_price_with_spaces: '$formatted_price_with_spaces'");

// Wygeneruj finalny DOCX z szablonu
if (!class_exists('\PhpOffice\PhpWord\TemplateProcessor')) {
    wp_send_json_error('Brak zależności PhpWord (TemplateProcessor). Upewnij się, że folder vendor/ jest wgrany w pluginie.');
}

try {
    $tpl = new \PhpOffice\PhpWord\TemplateProcessor($template_path);

    // Szablony w Twoim projekcie używają {{MOC}}, {{PRC}} itd.
    if (method_exists($tpl, 'setMacroChars')) {
        $tpl->setMacroChars('{{', '}}');
    }

    // Podajemy NAZWY bez nawiasów, np. MOC zamiast {{MOC}}
    $tpl->setValue('MOC', (string)$kw_value);
    $tpl->setValue('KIT', (string)$kit_model);
    $tpl->setValue('INDOOR', (string)$indoor_unit);
    $tpl->setValue('OUTDOOR', (string)$outdoor_unit);
    $tpl->setValue('CWU', (string)$cwu_info);
    $tpl->setValue('TANK', (string)$tank_manufacturer_text);
    $tpl->setValue('BFR', (string)$buffer_capacity_text);
    $tpl->setValue('PRC', (string)$formatted_price_with_spaces);

    $tpl->saveAs($output_path);
    error_log("✅ DOCX wygenerowany przez TemplateProcessor: $output_path");
} catch (\Throwable $e) {
    error_log('❌ Błąd generowania DOCX (TemplateProcessor): ' . $e->getMessage());
    wp_send_json_error('Błąd generowania DOCX: ' . $e->getMessage());
}


    if ($output_format === 'pdf') {
    $pdf_filename = str_replace('.docx', '.pdf', $filename);
    $pdf_output_path = str_replace('.docx', '.pdf', $output_path);

    $converter_url = get_option('top_instal_pdf_converter_url', TOP_INSTAL_PDF_CONVERTER_URL_DEFAULT);
    $converter_token = get_option('top_instal_pdf_converter_token', TOP_INSTAL_PDF_CONVERTER_TOKEN_DEFAULT);

    if ($converter_url === '' || $converter_token === '') {
        error_log("❌ Konwerter PDF: brak URL lub tokenu w ustawieniach (Ustawienia → Top-Instal Generator). Zwracam DOCX.");
        $filename = str_replace('.pdf', '.docx', $pdf_filename);
    } else {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $converter_url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
        curl_setopt($ch, CURLOPT_TIMEOUT, 60);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'X-Converter-Token: ' . $converter_token
        ]);
        // Gotenberg / LibreOffice convert oczekuje pola "files" (nie "file")
        curl_setopt($ch, CURLOPT_POSTFIELDS, [
            'files' => new CURLFile($output_path, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', basename($output_path))
        ]);

        $response = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if (get_option('top_instal_pdf_debug_log', false) || (defined('WP_DEBUG') && WP_DEBUG)) {
            @file_put_contents(__DIR__ . '/curl_debug.txt', print_r([
                'converter_url' => $converter_url,
                'http_code' => $http_code,
                'error' => $error,
                'response_len' => is_string($response) ? strlen($response) : 0,
                'source_file' => $output_path,
            ], true));
        }

        if ($http_code === 200 && $response && strlen($response) > 0) {
            file_put_contents($pdf_output_path, $response);
            $filename = $pdf_filename;
            error_log("✅ PDF wygenerowany pomyślnie (konwerter: $converter_url)");
        } else {
            error_log("❌ Błąd konwersji na PDF (HTTP: $http_code, Error: $error) - zwracam DOCX");
            $filename = str_replace('.pdf', '.docx', $pdf_filename);
        }
    }
}

    // Cleanup old files (>30 dni)
    $max_age = 30 * 24 * 60 * 60;
    foreach (glob($output_dir . '/*.{docx,pdf}', GLOB_BRACE) as $f) {
        if (is_file($f) && (time() - filemtime($f)) > $max_age) {
            @unlink($f);
        }
    }

    $download_url = $upload_dir['baseurl'] . '/top-instal-offers/' . $filename;

    wp_send_json_success([
        'filename' => $filename,
        'download_url' => $download_url
    ]);
}

// Activation setup
function top_instal_create_directories() {
    $upload_dir = wp_upload_dir();
    $plugin_upload_dir = $upload_dir['basedir'] . '/top-instal-offers';
    if (!file_exists($plugin_upload_dir)) {
        wp_mkdir_p($plugin_upload_dir);
    }
}
register_activation_hook(__FILE__, 'top_instal_create_directories');

// === PDF Converter Settings (minimal) ===
add_action('admin_menu', function () {
    add_options_page(
        'Top-Instal Generator',
        'Top-Instal Generator',
        'manage_options',
        'top-instal-generator',
        'top_instal_generator_settings_page'
    );
});

add_action('admin_init', function () {
    register_setting('top_instal_generator_settings', 'top_instal_pdf_converter_url', [
        'type' => 'string',
        'sanitize_callback' => 'esc_url_raw',
        'default' => '',
    ]);

    register_setting('top_instal_generator_settings', 'top_instal_pdf_converter_token', [
        'type' => 'string',
        'sanitize_callback' => function ($v) { return trim((string)$v); },
        'default' => '',
    ]);

    register_setting('top_instal_generator_settings', 'top_instal_pdf_debug_log', [
        'type' => 'boolean',
        'sanitize_callback' => function ($v) { return (bool)$v; },
        'default' => false,
    ]);

    register_setting('top_instal_generator_settings', 'top_instal_agent_api_key', [
        'type' => 'string',
        'sanitize_callback' => function ($v) { return trim((string)$v); },
        'default' => '',
    ]);
});

function top_instal_generator_settings_page() {
    if (!current_user_can('manage_options')) return;

    ?>
    <div class="wrap">
        <h1>Top-Instal Generator</h1>
        <form method="post" action="options.php">
            <?php settings_fields('top_instal_generator_settings'); ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="top_instal_pdf_converter_url">URL konwertera PDF</label></th>
                    <td>
                        <input type="url" class="regular-text" id="top_instal_pdf_converter_url"
                               name="top_instal_pdf_converter_url"
                               value="<?php echo esc_attr(get_option('top_instal_pdf_converter_url', TOP_INSTAL_PDF_CONVERTER_URL_DEFAULT)); ?>"
                               placeholder="<?php echo esc_attr(TOP_INSTAL_PDF_CONVERTER_URL_DEFAULT); ?>" />
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="top_instal_pdf_converter_token">Token (X-Converter-Token)</label></th>
                    <td>
                        <input type="text" class="regular-text" id="top_instal_pdf_converter_token"
                               name="top_instal_pdf_converter_token"
                               value="<?php echo esc_attr(get_option('top_instal_pdf_converter_token', TOP_INSTAL_PDF_CONVERTER_TOKEN_DEFAULT)); ?>" />
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="top_instal_agent_api_key">Agent API key (REST)</label></th>
                    <td>
                        <input type="text" class="regular-text" id="top_instal_agent_api_key"
                               name="top_instal_agent_api_key"
                               value="<?php echo esc_attr(get_option('top_instal_agent_api_key', '')); ?>"
                               placeholder="Used by X-Top-Instal-Agent-Key header" />
                    </td>
                </tr>
                <tr>
                    <th scope="row">Debug log</th>
                    <td>
                        <label>
                            <input type="checkbox" name="top_instal_pdf_debug_log" value="1"
                                <?php checked((bool)get_option('top_instal_pdf_debug_log', false)); ?> />
                            Włącz logowanie diagnostyczne
                        </label>
                    </td>
                </tr>
            </table>
            <?php submit_button('Zapisz'); ?>
        </form>
    </div>
    <?php
}
?>
