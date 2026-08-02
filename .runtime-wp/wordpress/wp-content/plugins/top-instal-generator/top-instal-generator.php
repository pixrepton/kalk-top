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
    TOP_INSTAL_PLUGIN_PATH . 'wp-adapter/integrations/OsEventClient.php',
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
    if (!class_exists('TopInstal_Ajax_Kits_Controller')) {
        wp_send_json_error('Generator kits module not loaded.');
    }

    TopInstal_Ajax_Kits_Controller::handle_get_kits();
}

// AJAX: generate DOCX/PDF
add_action('wp_ajax_simple_generate', 'handle_simple_generate');
add_action('wp_ajax_nopriv_simple_generate', 'handle_simple_generate');

function handle_simple_generate() {
    if (!class_exists('TopInstal_Ajax_GenerateOfferDocument_Controller')) {
        wp_send_json_error('Generator document module not loaded.');
    }

    TopInstal_Ajax_GenerateOfferDocument_Controller::handle_simple_generate();
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
