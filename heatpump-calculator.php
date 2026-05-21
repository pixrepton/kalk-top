<?php
/**
 * Plugin Name: TOP-INSTAL Heat Pump Calculator
 * Plugin URI: https://topinstal.com.pl
 * Description: Profesjonalny kalkulator mocy pompy ciepła i konfigurator maszynowni. Oblicza zapotrzebowanie na moc zgodnie z normami PN-B 02025 i PN-EN 832, dobiera komponenty maszynowni oraz generuje raporty PDF.
 * Version: 1.0.2
 * Author: TOP-INSTAL
 * Author URI: https://topinstal.com.pl
 * License: Proprietary
 * License URI: https://topinstal.com.pl
 * Text Domain: heatpump-calculator
 * Domain Path: /languages
 * Requires at least: 5.0
 * Requires PHP: 7.4
 * Network: false
 */

// Standalone dev preview (Five Server / lokalnie bez WordPress):
// Jeżeli ABSPATH nie istnieje, uruchom przez root `index.php`, który symuluje minimalne WP i renderuje kalkulator.
if (!defined('ABSPATH')) {
    $rootIndex = dirname(__DIR__) . '/index.php';
    if (file_exists($rootIndex)) {
        require_once $rootIndex;
        exit;
    }
    // Fallback: jeżeli ktoś skopiował tylko `main/`, pokaż czytelny błąd.
    header('Content-Type: text/plain; charset=UTF-8');
    echo "Standalone preview error: missing WordPress and missing root index.php.\n";
    echo "Expected: " . $rootIndex . "\n";
    exit;
}

// Migration scaffolding bootstrap (safe no-op if files are missing).
$topinstal_bootstrap_files = array(
    __DIR__ . '/wp-adapter/bootstrap/trace.php',
    __DIR__ . '/wp-adapter/logging/LoggerWp.php',
    __DIR__ . '/core/contracts/ReasonCodes.php',
    __DIR__ . '/wp-adapter/rest/RequestValidator.php',
    __DIR__ . '/wp-adapter/rest/RestErrors.php',
    __DIR__ . '/core/domain/cwu/CwuEngine.php',
    __DIR__ . '/core/domain/ozc/OzcEngine.php',
    __DIR__ . '/core/domain/selection/SelectionEngine.php',
    __DIR__ . '/core/domain/buffer/BufferEngine.php',
    __DIR__ . '/core/domain/pricing/PricingEngine.php',
    __DIR__ . '/wp-adapter/repositories/MasterDataRepositoryWp.php',
    __DIR__ . '/wp-adapter/repositories/PriceBookRepositoryWp.php',
    __DIR__ . '/wp-adapter/repositories/BufferRulesRepositoryWp.php',
    __DIR__ . '/wp-adapter/repositories/SelectionRulesRepositoryWp.php',
    __DIR__ . '/wp-adapter/infrastructure/CalcSessionStateRepository.php',
    __DIR__ . '/wp-adapter/admin/LeadEnergyProfilePresenter.php',
    __DIR__ . '/wp-adapter/dev/SmokeAdminPage.php',
    __DIR__ . '/core/application/CalculateOfferUseCase.php',
    __DIR__ . '/wp-adapter/rest/CalculateOfferController.php',
    __DIR__ . '/wp-adapter/rest/AgentHealthController.php',
    __DIR__ . '/wp-adapter/agents/HealthcheckService.php',
    __DIR__ . '/wp-adapter/bootstrap/routes.php',
    __DIR__ . '/wp-adapter/bootstrap/offer-documents.php',
);
foreach ($topinstal_bootstrap_files as $topinstal_bootstrap_file) {
    if (file_exists($topinstal_bootstrap_file)) {
        require_once $topinstal_bootstrap_file;
    }
}

/**
 * Główna klasa wtyczki
 */
class HeatPump_Calculator {

    /**
     * Wersja wtyczki
     */
    const VERSION = '1.0.2';

    /**
     * Singleton instance
     */
    private static $instance = null;

    /**
     * Ścieżka do katalogu wtyczki
     */
    private $plugin_path;

    /**
     * URL do katalogu wtyczki
     */
    private $plugin_url;

    /**
     * Bazowy URL do zasobów aplikacji
     */
    private $base_url;

    /**
     * Czy shortcode został wykryty na bieżącej stronie (dla warunkowych poprawek WP/Elementor)
     */
    private $shortcode_detected = false;

    /**
     * Konstruktor
     */
    private function __construct() {
        $this->plugin_path = plugin_dir_path(__FILE__);
        $this->plugin_url = plugin_dir_url(__FILE__);
        // base_url bez trailing slash -> brak podwójnych "//" w URL-ach zasobów
        $this->base_url = rtrim($this->plugin_url, '/');

        $this->init_hooks();
    }

    /**
     * Pobierz instancję singleton
     */
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Inicjalizacja hooków WordPress
     */
    private function init_hooks() {
        // Rejestracja shortcode
        add_shortcode('heatpump_calc', array($this, 'render_calculator'));

        // Enqueue skryptów i stylów
        add_action('wp_enqueue_scripts', array($this, 'enqueue_assets'));

        // Elementor compatibility - enqueue dla Elementora (przed i po renderowaniu)
        add_action('elementor/frontend/before_enqueue_scripts', array($this, 'enqueue_assets'));
        add_action('elementor/frontend/after_enqueue_scripts', array($this, 'enqueue_assets'));
        add_action('elementor/frontend/after_enqueue_styles', array($this, 'enqueue_assets'));

        // Elementor editor mode - zawsze ładuj zasoby w edytorze
        add_action('elementor/editor/before_enqueue_scripts', array($this, 'enqueue_assets'));

        // Aktywacja wtyczki
        register_activation_hook(__FILE__, array($this, 'activate'));

        // Deaktywacja wtyczki
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));

        // Lead / CRM upsert endpoint (admin-ajax.php) — optional, non-breaking.
        add_action('wp_ajax_heatpump_lead_upsert', array($this, 'ajax_lead_upsert'));
        add_action('wp_ajax_nopriv_heatpump_lead_upsert', array($this, 'ajax_lead_upsert'));
        add_action('wp_ajax_heatpump_track_event', array($this, 'ajax_track_event'));
        add_action('wp_ajax_nopriv_heatpump_track_event', array($this, 'ajax_track_event'));

        // DEV-only dual-run diagnostics (admin only).
        add_action('wp_ajax_heatpump_dual_run_log', array($this, 'ajax_dual_run_log'));

        // Admin pages for calculator leads and funnel events.
        add_action('admin_menu', array($this, 'register_admin_pages'));
        add_action('admin_post_topinstal_mark_lead_handled', array($this, 'handle_mark_lead_handled'));
        add_action('admin_post_topinstal_update_journey_note', array($this, 'handle_update_journey_note'));

        add_action('wp_ajax_heatpump_generate_offer_document', array($this, 'ajax_generate_offer_document'));
        add_action('wp_ajax_nopriv_heatpump_generate_offer_document', array($this, 'ajax_generate_offer_document'));

        add_action('init', array($this, 'maybe_ensure_tracking_tables'), 1);

        // Variant B migration: REST route registration.
        if (function_exists('topinstal_register_routes')) {
            add_action('rest_api_init', 'topinstal_register_routes');
        }

        // Dev-only smoke diagnostics page in wp-admin > Tools.
        if (function_exists('topinstal_register_smoke_admin_page')) {
            add_action('admin_menu', 'topinstal_register_smoke_admin_page');
        }
    }

    /**
     * Feature flag for backend-side calculation (variant B).
     *
     * Priority:
     * 1) PHP constant USE_BACKEND_CALC (if defined)
     * 2) WP option topinstal_use_backend_calc (if set)
     * 3) default true (migration baseline)
     * Can be overridden by filter topinstal_use_backend_calc.
     *
     * @return bool
     */
    private function is_backend_calc_enabled() {
        $enabled = true;

        if (defined('USE_BACKEND_CALC')) {
            $enabled = (bool) USE_BACKEND_CALC;
        }

        if (function_exists('get_option')) {
            $option = get_option('topinstal_use_backend_calc', null);
            if ($option !== null && $option !== '' && $option !== false) {
                $parsed = filter_var($option, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
                if ($parsed !== null) {
                    $enabled = (bool) $parsed;
                }
            }
        }

        if (function_exists('apply_filters')) {
            $enabled = (bool) apply_filters('topinstal_use_backend_calc', $enabled);
        }

        return $enabled;
    }

    /**
     * Optional dev bypass for PDF contact gate (Playwright hp_debug=1).
     *
     * @return bool
     */
    private function is_pdf_lead_gate_bypass_requested() {
        if (!isset($_GET['hp_debug'])) {
            return false;
        }
        return (string) wp_unslash($_GET['hp_debug']) === '1';
    }

    /**
     * Engineering policy snapshot for configurator UI (buffer capacities, CWU rules, thresholds).
     *
     * @return array<string,mixed>
     */
    private function get_frontend_buffer_rules() {
        if (!class_exists('TopInstal_BufferRulesRepository_Wp')) {
            return array();
        }

        $repository = new TopInstal_BufferRulesRepository_Wp();
        $rules = $repository->get_rules();
        return is_array($rules) ? $rules : array();
    }

    /**
     * Calculate-offer endpoint URL.
     *
     * @return string
     */
    private function get_calculate_offer_endpoint() {
        if (function_exists('rest_url')) {
            return (string) rest_url('topinstal/v1/calculate-offer');
        }
        return (string) (get_site_url() . '/wp-json/topinstal/v1/calculate-offer');
    }

    /**
     * Resolve runtime proxy URL with optional filter override.
     *
     * @param string $proxy_file
     * @param string $filter_tag
     * @return string
     */
    private function get_runtime_proxy_url($proxy_file, $filter_tag) {
        $file = ltrim((string) $proxy_file, "/\\");
        $url = (string) (get_site_url() . '/' . $file);

        if (function_exists('apply_filters') && is_string($filter_tag) && $filter_tag !== '') {
            $filtered = apply_filters($filter_tag, $url);
            if (is_string($filtered) && trim($filtered) !== '') {
                return trim($filtered);
            }
        }

        return $url;
    }

    /**
     * Detect whether a proxy endpoint file exists in WP runtime root.
     *
     * @param string $proxy_file
     * @return bool
     */
    private function is_runtime_proxy_available($proxy_file) {
        $file = ltrim((string) $proxy_file, "/\\");
        if ($file === '') {
            return false;
        }

        $path = ABSPATH . $file;
        return is_file($path);
    }

    /**
     * AJAX: Generate offer PDF via top-instal-generator using canonical OfferDTO.
     *
     * Contract:
     * - POST action=heatpump_generate_offer_document
     * - nonce: heatpump_calc_nonce
     * - payload: JSON string with offerDto / offer_dto
     */
    public function ajax_generate_offer_document() {
        $nonce_ok = $this->validate_ajax_nonce_from_param_or_header('heatpump_calc_nonce', 'nonce');
        if (!$nonce_ok) {
            wp_send_json_error(array('message' => 'Invalid nonce.'), 403);
        }

        $raw = isset($_POST['payload']) ? wp_unslash($_POST['payload']) : '';
        if (!is_string($raw) || trim($raw) === '') {
            wp_send_json_error(array('message' => 'Missing payload.'), 400);
        }

        $payload = json_decode($raw, true);
        if (!is_array($payload)) {
            wp_send_json_error(array('message' => 'Invalid payload JSON.'), 400);
        }

        $offer_dto = null;
        if (isset($payload['offerDto']) && is_array($payload['offerDto'])) {
            $offer_dto = $payload['offerDto'];
        } elseif (isset($payload['offer_dto']) && is_array($payload['offer_dto'])) {
            $offer_dto = $payload['offer_dto'];
        }

        if (!is_array($offer_dto) || empty($offer_dto)) {
            wp_send_json_error(array('message' => 'Missing canonical offerDto.'), 400);
        }

        if (!class_exists('TopInstal_OfferDocumentsGeneratorClient')) {
            if (class_exists('TopInstal_Logger_Wp')) {
                TopInstal_Logger_Wp::error('offer documents generator client unavailable', array(
                    'traceId' => isset($payload['traceId']) && is_string($payload['traceId']) ? trim((string) $payload['traceId']) : null,
                    'workflowConfigClassAvailable' => class_exists('TopInstal_MailIngressWorkflowConfig'),
                    'workflowBootstrap' => isset($GLOBALS['topinstal_offer_workflow_config_bootstrap']) && is_array($GLOBALS['topinstal_offer_workflow_config_bootstrap'])
                        ? $GLOBALS['topinstal_offer_workflow_config_bootstrap']
                        : array(),
                    'clientBootstrap' => isset($GLOBALS['topinstal_offer_documents_client_bootstrap']) && is_array($GLOBALS['topinstal_offer_documents_client_bootstrap'])
                        ? $GLOBALS['topinstal_offer_documents_client_bootstrap']
                        : array(),
                ));
            }
            wp_send_json_error(array('message' => 'Offer documents generator client unavailable.'), 500);
        }

        $trace_id = '';
        if (isset($payload['traceId']) && is_string($payload['traceId']) && trim($payload['traceId']) !== '') {
            $trace_id = trim((string) $payload['traceId']);
        } elseif (isset($offer_dto['traceId']) && is_string($offer_dto['traceId']) && trim($offer_dto['traceId']) !== '') {
            $trace_id = trim((string) $offer_dto['traceId']);
        }
        if (function_exists('topinstal_ensure_trace_id')) {
            $trace_id = topinstal_ensure_trace_id($trace_id);
        } elseif ($trace_id === '') {
            $trace_id = uniqid('offer_doc_', true);
        }

        $raw_context = isset($payload['context']) && is_array($payload['context']) ? $payload['context'] : array();

        $context = array(
            'trace_id' => $trace_id,
            'lead_id' => isset($payload['leadId']) ? sanitize_text_field((string) $payload['leadId']) : '',
            'request_id' => isset($payload['requestId']) ? sanitize_text_field((string) $payload['requestId']) : '',
            'message_id' => 'calculator-summary',
            'source' => isset($raw_context['source']) ? sanitize_text_field((string) $raw_context['source']) : 'kalk-top',
            'channel' => isset($raw_context['channel']) ? sanitize_text_field((string) $raw_context['channel']) : 'calculator_summary',
            'workflow' => isset($raw_context['workflow']) ? sanitize_text_field((string) $raw_context['workflow']) : 'calculator_offer_document',
            'document_mode' => isset($raw_context['documentMode']) ? sanitize_text_field((string) $raw_context['documentMode']) : 'offer',
        );
        if (isset($raw_context['generatedAt']) && is_string($raw_context['generatedAt']) && trim($raw_context['generatedAt']) !== '') {
            $context['generated_at'] = trim((string) $raw_context['generatedAt']);
        }
        if (isset($raw_context['machineRoomSnapshot']) && is_array($raw_context['machineRoomSnapshot'])) {
            $context['machine_room_snapshot'] = $raw_context['machineRoomSnapshot'];
        }

        $generator = new TopInstal_OfferDocumentsGeneratorClient();
        $result = $generator->generate($offer_dto, $context);

        if (!is_array($result) || empty($result['ok'])) {
            $error = is_array($result) && isset($result['error']) && is_array($result['error'])
                ? $result['error']
                : array();
            $details = isset($error['details']) && is_array($error['details'])
                ? $error['details']
                : array();
            $public_details = array();
            foreach (array('reason', 'httpStatus', 'responseParseResult', 'responseStatusField', 'documentFormat', 'upstreamErrorCode', 'upstreamTraceId') as $key) {
                if (isset($details[$key]) && (is_scalar($details[$key]) || $details[$key] === null)) {
                    $public_details[$key] = $details[$key];
                }
            }
            $status = isset($result['http_status']) && is_numeric($result['http_status'])
                ? max(400, min(599, (int) $result['http_status']))
                : 502;

            if (class_exists('TopInstal_Logger_Wp')) {
                TopInstal_Logger_Wp::warn('offer document generation failed', array(
                    'traceId' => $trace_id,
                    'errorCode' => isset($error['code']) ? (string) $error['code'] : 'GENERATOR_REQUEST_FAILED',
                    'httpStatus' => $status,
                    'details' => $details,
                ));
            }

            wp_send_json_error(array(
                'message' => isset($error['message']) ? (string) $error['message'] : 'Generator request failed.',
                'errorCode' => isset($error['code']) ? (string) $error['code'] : 'GENERATOR_REQUEST_FAILED',
                'traceId' => $trace_id,
                'details' => $public_details,
            ), $status);
        }

        wp_send_json_success(array(
            'document' => isset($result['document']) && is_array($result['document']) ? $result['document'] : array(),
            'meta' => isset($result['meta']) && is_array($result['meta']) ? $result['meta'] : array(),
            'warnings' => isset($result['warnings']) && is_array($result['warnings']) ? $result['warnings'] : array(),
            'traceId' => isset($result['traceId']) ? (string) $result['traceId'] : $trace_id,
        ));
    }

    /**
     * AJAX: save dual-run comparison diagnostics (admin-only, DEV helper).
     *
     * Contract:
     * - POST action=heatpump_dual_run_log
     * - nonce: heatpump_calc_nonce
     * - payload: JSON object with diff report
     */
    public function ajax_dual_run_log() {
        if (!current_user_can('manage_options')) {
            wp_send_json_error(array('message' => 'Insufficient permissions.'), 403);
        }

        if (function_exists('check_ajax_referer')) {
            check_ajax_referer('heatpump_calc_nonce', 'nonce');
        }

        $raw = isset($_POST['payload']) ? wp_unslash($_POST['payload']) : '';
        if (!is_string($raw) || trim($raw) === '') {
            wp_send_json_error(array('message' => 'Missing payload.'), 400);
        }

        $payload = json_decode($raw, true);
        if (!is_array($payload)) {
            wp_send_json_error(array('message' => 'Invalid payload JSON.'), 400);
        }

        $trace_id = isset($payload['traceId']) ? (string) $payload['traceId'] : '';
        if (function_exists('topinstal_ensure_trace_id')) {
            $trace_id = topinstal_ensure_trace_id($trace_id);
        } elseif ($trace_id === '') {
            $trace_id = uniqid('trace_', true);
        }
        $payload['traceId'] = $trace_id;
        $payload['loggedAt'] = gmdate('c');

        $history_key = 'topinstal_dual_run_history';
        $history = function_exists('get_transient') ? get_transient($history_key) : false;
        if (!is_array($history)) {
            $history = array();
        }
        $history[] = $payload;
        if (count($history) > 30) {
            $history = array_slice($history, -30);
        }

        if (function_exists('set_transient')) {
            set_transient($history_key, $history, DAY_IN_SECONDS);
            set_transient('topinstal_dual_run_last', $payload, DAY_IN_SECONDS);
        }

        if (class_exists('TopInstal_Logger_Wp')) {
            TopInstal_Logger_Wp::info('dual-run diff captured', array(
                'traceId' => $trace_id,
                'passed' => isset($payload['passed']) ? (bool) $payload['passed'] : null,
                'deltaKw' => isset($payload['deltaKw']) ? $payload['deltaKw'] : null,
                'deltaGross' => isset($payload['deltaGross']) ? $payload['deltaGross'] : null,
            ));
        }

        wp_send_json_success(array(
            'traceId' => $trace_id,
            'stored' => true,
            'items' => count($history),
        ));
    }

    /**
     * AJAX: Upsert lead payload (idempotent by lead_id)
     *
     * Contract:
     * - POST action=heatpump_lead_upsert
     * - nonce: heatpump_calc_nonce
     * - payload: JSON string (offer_v1)
     *
     * Persists payload in wp_topinstal_leads table, with transient fallback.
     */
    /**
     * Ensures tracking tables exist (activation-safe for symlinked dev installs).
     *
     * @return void
     */
    public function maybe_ensure_tracking_tables() {
        $schema_version = '2026-05-20-v2';
        if (get_option('topinstal_calc_tracking_schema') === $schema_version) {
            return;
        }
        $this->ensure_database_tables();
        update_option('topinstal_calc_tracking_schema', $schema_version, false);
    }

    /**
     * @return void
     */
    private function ensure_tracking_tables_ready() {
        if ($this->is_table_available($this->get_events_table_name())) {
            return;
        }
        $this->ensure_database_tables();
    }

    /**
     * Event names that mark "client saw OZC / offer result" in funnel SQL.
     *
     * @return string[]
     */
    private function get_result_milestone_event_names() {
        return array('calc_result_view', 'calc_success', 'configurator_offer_ready');
    }

    public function ajax_lead_upsert() {
        $nonce_ok = $this->validate_ajax_nonce_from_param_or_header('heatpump_calc_nonce', 'nonce');
        if (!$nonce_ok) {
            wp_send_json_error(array('message' => 'Invalid nonce.'), 403);
        }

        $this->ensure_tracking_tables_ready();

        $payload = $this->extract_lead_payload_from_request();
        if (!is_array($payload)) {
            wp_send_json_error(array('message' => 'Invalid JSON payload.'), 400);
        }

        $lead_id = $this->resolve_or_create_lead_id($payload);
        if (!$this->is_valid_uuid($lead_id)) {
            wp_send_json_error(array('message' => 'Invalid lead_id format.'), 400);
        }
        $payload['lead_id'] = $lead_id;
        if (!isset($payload['lead']) || !is_array($payload['lead'])) {
            $payload['lead'] = array();
        }
        if (!isset($payload['lead']['lead_id']) || !is_string($payload['lead']['lead_id']) || trim((string) $payload['lead']['lead_id']) === '') {
            $payload['lead']['lead_id'] = $lead_id;
        }

        $stored = false;
        $storage = 'transient';
        $table_name = $this->get_leads_table_name();

        if ($this->is_table_available($table_name)) {
            $stored = $this->persist_lead_in_database($table_name, $lead_id, $payload);
            if ($stored) {
                $storage = 'db';
            } else {
                $this->log_warning('lead_upsert db write failed, switching to transient fallback', array(
                    'lead_id' => $lead_id,
                    'table' => $table_name,
                ));
            }
        } else {
            $this->log_warning('lead_upsert table missing, using transient fallback', array(
                'lead_id' => $lead_id,
                'table' => $table_name,
            ));
        }

        if (!$stored) {
            $stored = $this->persist_lead_in_transient($lead_id, $payload);
            $storage = 'transient';
        }

        $event_table = $this->get_events_table_name();
        if ($stored && $this->is_table_available($event_table)) {
            $lead_event = array(
                'session_id' => sanitize_text_field((string) $this->get_nested_value($payload, array('sessionId'), $this->get_nested_value($payload, array('lead', 'session_id'), ''))),
                'lead_id' => strtolower($lead_id),
                'trace_id' => sanitize_text_field((string) $this->get_nested_value($payload, array('traceId'), $this->get_nested_value($payload, array('offer_dto', 'traceId'), ''))),
                'source' => sanitize_text_field((string) $this->get_nested_value($payload, array('source'), 'calc')),
                'event_name' => 'lead_success',
                'tab' => null,
                'step_key' => 'lead',
                'ts' => $this->normalize_timestamp_to_unix_ms(time()),
                'meta_json' => $this->json_encode_safe(array(
                    'kind' => $this->get_nested_value($payload, array('kind'), $this->get_nested_value($payload, array('lead', 'kind'), null)),
                )),
            );
            $this->persist_events_in_database($event_table, array($lead_event));
        }

        wp_send_json_success(array(
            'lead_id' => $lead_id,
            'stored' => (bool) $stored,
            'storage' => $storage,
        ));
    }

    /**
     * AJAX: Track calculator events (single or batch) into wp_topinstal_calc_events.
     *
     * Contract:
     * - POST action=heatpump_track_event
     * - nonce: heatpump_calc_nonce
     * - events: JSON array of events (preferred)
     *   OR
     * - event: JSON object (single event)
     */
    public function ajax_track_event() {
        $nonce_ok = $this->validate_ajax_nonce_from_param_or_header('heatpump_calc_nonce', 'nonce');
        if (!$nonce_ok) {
            wp_send_json_error(array('message' => 'Invalid nonce.'), 403);
        }

        $this->ensure_tracking_tables_ready();

        $events_payload = $this->extract_events_payload_from_request();
        $events = $this->normalize_event_batch($events_payload);

        if (empty($events)) {
            wp_send_json_error(array('message' => 'No events to persist.'), 400);
        }

        $rate_window_seconds = 10 * MINUTE_IN_SECONDS;
        $rate_limit_per_window = 120;
        $rate_limit_samples = array();
        $batch_session_counts = array();
        foreach ($events as $candidate_event) {
            if (!is_array($candidate_event)) {
                continue;
            }
            $session_for_limit = isset($candidate_event['session_id']) ? (string) $candidate_event['session_id'] : '';
            if ($session_for_limit === '') {
                continue;
            }
            if (!isset($batch_session_counts[$session_for_limit])) {
                $batch_session_counts[$session_for_limit] = 0;
            }
            $batch_session_counts[$session_for_limit]++;
        }
        foreach ($batch_session_counts as $session_for_limit => $increment) {
            $sample = null;
            if ($this->is_track_rate_limited($session_for_limit, $rate_window_seconds, $rate_limit_per_window, $sample, (int) $increment)) {
                $this->log_warning_once('track_event_rate_limited_' . $session_for_limit, 'track_event rate limited, skipping analytics persistence', array(
                    'sessionId' => $session_for_limit,
                    'limit' => $rate_limit_per_window,
                    'windowSeconds' => $rate_window_seconds,
                    'events' => count($events),
                ), $rate_window_seconds);
                wp_send_json_success(array(
                    'stored' => 0,
                    'received' => count($events),
                    'skipped' => true,
                    'reason' => 'rate_limited',
                    'sessionId' => $session_for_limit,
                    'limit' => $rate_limit_per_window,
                    'windowSeconds' => $rate_window_seconds,
                ));
            }
            if (is_array($sample)) {
                $rate_limit_samples[] = $sample;
            }
        }

        $table_name = $this->get_events_table_name();
        if (!$this->is_table_available($table_name)) {
            $this->log_warning_once('track_event_table_missing', 'track_event table missing, skipping analytics persistence', array(
                'table' => $table_name,
                'events' => count($events),
            ));
            wp_send_json_success(array(
                'stored' => 0,
                'received' => count($events),
                'skipped' => true,
                'reason' => 'tracking_table_unavailable',
            ));
        }

        $stored = $this->persist_events_in_database($table_name, $events);
        if ($stored <= 0) {
            wp_send_json_error(array('message' => 'Events were not persisted.'), 500);
        }

        foreach ($rate_limit_samples as $rate_limit_sample) {
            if (is_array($rate_limit_sample)) {
                $this->persist_track_rate_limit_sample($rate_limit_sample);
            }
        }

        wp_send_json_success(array(
            'stored' => $stored,
            'received' => count($events),
        ));
    }

    /**
     * @return string
     */
    private function get_leads_table_name() {
        global $wpdb;
        return $wpdb->prefix . 'topinstal_leads';
    }

    /**
     * @return string
     */
    private function get_events_table_name() {
        global $wpdb;
        return $wpdb->prefix . 'topinstal_calc_events';
    }

    /**
     * @return string
     */
    private function get_journey_notes_table_name() {
        global $wpdb;
        return $wpdb->prefix . 'topinstal_journey_notes';
    }

    /**
     * @return string
     */
    private function get_calc_sessions_table_name() {
        if (class_exists('TopInstal_CalcSessionStateRepository')) {
            return TopInstal_CalcSessionStateRepository::get_table_name();
        }
        global $wpdb;
        return $wpdb->prefix . 'topinstal_calc_sessions';
    }

    /**
     * @param string $table_name
     * @return bool
     */
    private function is_table_available($table_name) {
        global $wpdb;
        if (!isset($wpdb) || !is_object($wpdb)) {
            return false;
        }

        $found = $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $table_name));
        return is_string($found) && $found === $table_name;
    }

    /**
     * @return void
     */
    private function ensure_database_tables() {
        global $wpdb;
        if (!isset($wpdb) || !is_object($wpdb)) {
            return;
        }

        if (!function_exists('dbDelta')) {
            require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        }

        $charset_collate = $wpdb->get_charset_collate();
        $leads_table = $this->get_leads_table_name();
        $events_table = $this->get_events_table_name();
        $journey_notes_table = $this->get_journey_notes_table_name();

        $sql_leads = "CREATE TABLE {$leads_table} (
            id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            lead_id VARCHAR(36) NOT NULL,
            session_id VARCHAR(36) NULL,
            trace_id VARCHAR(64) NULL,
            source VARCHAR(16) NOT NULL DEFAULT 'calc',
            kind VARCHAR(32) NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            status VARCHAR(16) NOT NULL DEFAULT 'new',
            name VARCHAR(128) NULL,
            email VARCHAR(190) NULL,
            phone VARCHAR(64) NULL,
            city VARCHAR(128) NULL,
            external_key VARCHAR(64) NULL,
            consent_json TEXT NULL,
            payload_json LONGTEXT NULL,
            building_profile_json LONGTEXT NULL,
            utm_json TEXT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY lead_id (lead_id),
            KEY status (status),
            KEY created_at (created_at),
            KEY session_id (session_id),
            KEY trace_id (trace_id),
            KEY source (source),
            KEY external_key (external_key)
        ) {$charset_collate};";

        $sql_events = "CREATE TABLE {$events_table} (
            id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            session_id VARCHAR(36) NOT NULL,
            lead_id VARCHAR(36) NULL,
            trace_id VARCHAR(64) NULL,
            source VARCHAR(16) NOT NULL,
            event_name VARCHAR(64) NOT NULL,
            tab TINYINT NULL,
            step_key VARCHAR(64) NULL,
            ts BIGINT(20) NOT NULL,
            meta_json LONGTEXT NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY  (id),
            KEY event_name (event_name),
            KEY ts (ts),
            KEY session_id (session_id),
            KEY lead_id (lead_id),
            KEY trace_id (trace_id),
            KEY source (source),
            KEY event_name_ts (event_name, ts)
        ) {$charset_collate};";

        $sql_journey_notes = "CREATE TABLE {$journey_notes_table} (
            id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            journey_key VARCHAR(64) NOT NULL,
            status VARCHAR(16) NOT NULL DEFAULT 'new',
            note TEXT NULL,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY journey_key (journey_key),
            KEY status (status)
        ) {$charset_collate};";

        dbDelta($sql_leads);
        dbDelta($sql_events);
        dbDelta($sql_journey_notes);

        if (class_exists('TopInstal_CalcSessionStateRepository')) {
            dbDelta(TopInstal_CalcSessionStateRepository::get_create_table_sql());
        }

        $this->maybe_add_leads_building_profile_column($leads_table);
    }

    /**
     * @param string $leads_table
     * @return void
     */
    private function maybe_add_leads_building_profile_column($leads_table) {
        global $wpdb;
        if (!isset($wpdb) || !is_object($wpdb) || !$this->is_table_available($leads_table)) {
            return;
        }

        $column = $wpdb->get_var("SHOW COLUMNS FROM {$leads_table} LIKE 'building_profile_json'");
        if (is_string($column) && $column === 'building_profile_json') {
            return;
        }

        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name from trusted prefix helper.
        $wpdb->query("ALTER TABLE {$leads_table} ADD COLUMN building_profile_json LONGTEXT NULL AFTER payload_json");
    }

    /**
     * @param string $lead_id
     * @param array<string,mixed> $payload
     * @return bool
     */
    private function persist_lead_in_transient($lead_id, $payload) {
        if (!function_exists('set_transient')) {
            return false;
        }
        $key = 'heatpump_lead_' . strtolower($lead_id);
        return (bool) set_transient($key, $payload, 14 * DAY_IN_SECONDS);
    }

    /**
     * @param string $table_name
     * @param string $lead_id
     * @param array<string,mixed> $payload
     * @return bool
     */
    private function persist_lead_in_database($table_name, $lead_id, $payload) {
        global $wpdb;
        if (!isset($wpdb) || !is_object($wpdb)) {
            return false;
        }

        $lead = isset($payload['lead']) && is_array($payload['lead']) ? $payload['lead'] : array();
        $consents = isset($lead['consents']) && is_array($lead['consents']) ? $lead['consents'] : array();
        if (isset($payload['consent']) && is_array($payload['consent'])) {
            $consents = array_merge($consents, $payload['consent']);
        }
        $utm = isset($lead['utm']) && is_array($lead['utm']) ? $lead['utm'] : array();
        if (isset($payload['utm']) && is_array($payload['utm'])) {
            $utm = array_merge($utm, $payload['utm']);
        }

        $trace_id = $this->resolve_trace_id_from_payload($payload);
        $source = $this->resolve_source_from_payload($payload);
        $status = $this->sanitize_journey_status($this->get_nested_value($payload, array('status'), $this->get_nested_value($lead, array('status'), 'new')));
        $kind = sanitize_key((string) $this->get_nested_value($payload, array('kind'), $this->get_nested_value($lead, array('kind'), '')));
        if ($kind === '') {
            $kind = null;
        }

        $session_id = sanitize_text_field((string) $this->get_nested_value($payload, array('sessionId'), $this->get_nested_value($lead, array('session_id'), '')));
        $building_profile_json = $this->resolve_building_profile_snapshot_for_lead($session_id, $trace_id);
        $name = sanitize_text_field((string) $this->get_nested_value($payload, array('name'), $this->get_nested_value($lead, array('name'), '')));
        $email = sanitize_email((string) $this->get_nested_value($payload, array('email'), $this->get_nested_value($lead, array('email'), '')));
        $phone = sanitize_text_field((string) $this->get_nested_value($payload, array('phone'), $this->get_nested_value($lead, array('phone'), '')));
        $city = sanitize_text_field((string) $this->get_nested_value($payload, array('city'), $this->get_nested_value($lead, array('city'), $this->get_nested_value($lead, array('postal_code'), ''))));
        $external_key = sanitize_text_field((string) $this->get_nested_value($payload, array('externalKey'), $this->get_nested_value($lead, array('externalKey'), $this->get_nested_value($payload, array('agent', 'externalKey'), ''))));
        if ($external_key === '') {
            $external_key = null;
        }

        $data = array(
            'session_id' => $session_id !== '' ? $session_id : null,
            'trace_id' => $trace_id !== '' ? $trace_id : null,
            'source' => $source,
            'kind' => $kind,
            'status' => $status,
            'name' => $name !== '' ? $name : null,
            'email' => $email !== '' ? $email : null,
            'phone' => $phone !== '' ? $phone : null,
            'city' => $city !== '' ? $city : null,
            'external_key' => $external_key,
            'consent_json' => $this->json_encode_safe($consents),
            'payload_json' => $this->json_encode_safe($payload),
            'building_profile_json' => $building_profile_json,
            'utm_json' => $this->json_encode_safe($utm),
            'updated_at' => current_time('mysql', true),
        );

        $formats = array('%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s');

        $existing_id = $wpdb->get_var($wpdb->prepare("SELECT id FROM {$table_name} WHERE lead_id = %s LIMIT 1", $lead_id));
        if ($existing_id) {
            $updated = $wpdb->update(
                $table_name,
                $data,
                array('id' => (int) $existing_id),
                $formats,
                array('%d')
            );
            return $updated !== false;
        }

        $insert_data = array_merge(array(
            'lead_id' => strtolower($lead_id),
            'created_at' => current_time('mysql', true),
        ), $data);
        $insert_formats = array_merge(array('%s', '%s'), $formats);
        $inserted = $wpdb->insert($table_name, $insert_data, $insert_formats);
        return $inserted !== false;
    }

    /**
     * @param string $session_id
     * @param string $trace_id
     * @return string|null
     */
    private function resolve_building_profile_snapshot_for_lead($session_id, $trace_id) {
        if ($session_id === '' || !class_exists('TopInstal_CalcSessionStateRepository')) {
            return null;
        }

        $sessions_table = $this->get_calc_sessions_table_name();
        if (!$this->is_table_available($sessions_table)) {
            return null;
        }

        $session_row = TopInstal_CalcSessionStateRepository::get_by_session_id($session_id);
        if (!is_array($session_row)) {
            return null;
        }

        $snapshot = array(
            'session_id' => $session_id,
            'trace_id' => $trace_id !== '' ? $trace_id : (isset($session_row['trace_id']) ? (string) $session_row['trace_id'] : null),
            'ozc_peak_kw' => isset($session_row['ozc_peak_kw']) ? $session_row['ozc_peak_kw'] : null,
            'form_state' => isset($session_row['form_state']) && is_array($session_row['form_state']) ? $session_row['form_state'] : null,
            'captured_at' => current_time('mysql', true),
        );

        return $this->json_encode_safe($snapshot);
    }

    /**
     * @param array<string,mixed> $request_body
     * @param array<string,mixed> $offer
     * @return void
     */
    public function persist_calc_session_from_calculate_request($request_body, $offer) {
        if (!class_exists('TopInstal_CalcSessionStateRepository')) {
            return;
        }

        $sessions_table = $this->get_calc_sessions_table_name();
        if (!$this->is_table_available($sessions_table)) {
            $this->ensure_database_tables();
            if (!$this->is_table_available($sessions_table)) {
                return;
            }
        }

        $session_id = '';
        if (isset($request_body['sessionId'])) {
            $session_id = sanitize_text_field((string) $request_body['sessionId']);
        } elseif (isset($request_body['session_id'])) {
            $session_id = sanitize_text_field((string) $request_body['session_id']);
        }
        if ($session_id === '') {
            return;
        }

        $trace_id = isset($request_body['traceId']) ? sanitize_text_field((string) $request_body['traceId']) : '';
        $form_state = null;
        if (isset($request_body['formStateSnapshot']) && is_array($request_body['formStateSnapshot'])) {
            $form_state = $request_body['formStateSnapshot'];
        } elseif (isset($request_body['form_state_snapshot']) && is_array($request_body['form_state_snapshot'])) {
            $form_state = $request_body['form_state_snapshot'];
        }

        $peak_kw = TopInstal_CalcSessionStateRepository::extract_peak_kw_from_offer($offer);
        TopInstal_CalcSessionStateRepository::upsert($session_id, $trace_id, $form_state, $peak_kw);
    }

    /**
     * @param mixed $events
     * @return array<int,array<string,mixed>>
     */
    private function normalize_event_batch($events) {
        $rows = array();
        if (!is_array($events)) {
            return $rows;
        }

        $is_assoc = array_keys($events) !== range(0, count($events) - 1);
        if ($is_assoc && isset($events['event_name'])) {
            $events = array($events);
        }

        foreach ($events as $event) {
            if (!is_array($event)) {
                continue;
            }

            $event_name = '';
            if (isset($event['event_name'])) {
                $event_name = sanitize_key((string) $event['event_name']);
            } elseif (isset($event['event'])) {
                $event_name = sanitize_key((string) $event['event']);
            }
            if ($event_name === '') {
                continue;
            }

            $metadata = array();
            if (isset($event['meta']) && is_array($event['meta'])) {
                $metadata = $event['meta'];
            } elseif (isset($event['metadata']) && is_array($event['metadata'])) {
                $metadata = $event['metadata'];
            } elseif (isset($event['params']) && is_array($event['params'])) {
                $metadata = $event['params'];
            } else {
                $metadata = $event;
                unset($metadata['event_name'], $metadata['event'], $metadata['session_id'], $metadata['sessionId'], $metadata['lead_id'], $metadata['leadId'], $metadata['trace_id'], $metadata['traceId'], $metadata['ts'], $metadata['tab_id'], $metadata['tab'], $metadata['step_id'], $metadata['step'], $metadata['stepKey'], $metadata['source'], $metadata['sourceType']);
            }
            $metadata = $this->scrub_event_meta($metadata);

            $lead_id = null;
            $raw_lead_id = $this->get_nested_value($event, array('lead_id'), $this->get_nested_value($event, array('leadId'), ''));
            if ($this->is_valid_uuid($raw_lead_id)) {
                $lead_id = strtolower((string) $raw_lead_id);
            }

            $source = sanitize_key((string) $this->get_nested_value($event, array('source'), 'calc'));
            if (!in_array($source, array('calc', 'configurator'), true)) {
                $source = 'calc';
            }

            $trace_id = sanitize_text_field((string) $this->get_nested_value($event, array('trace_id'), $this->get_nested_value($event, array('traceId'), '')));
            if ($trace_id === '') {
                $trace_id = null;
            }

            $tab_value = $this->get_nested_value($event, array('tab'), $this->get_nested_value($event, array('tab_id'), null));
            $tab = null;
            if ($tab_value !== null && $tab_value !== '') {
                $tab_number = (int) $tab_value;
                if ($tab_number >= 0 && $tab_number <= 127) {
                    $tab = $tab_number;
                }
            }

            $step_key = sanitize_key((string) $this->get_nested_value($event, array('stepKey'), $this->get_nested_value($event, array('step_key'), $this->get_nested_value($event, array('step_id'), $this->get_nested_value($event, array('step'), '')))));
            if ($step_key === '') {
                $step_key = null;
            }

            $session_id = sanitize_text_field((string) $this->get_nested_value($event, array('session_id'), $this->get_nested_value($event, array('sessionId'), '')));
            if ($session_id === '') {
                $session_id = sanitize_text_field((string) $this->get_nested_value($metadata, array('session_id'), $this->get_nested_value($metadata, array('sessionId'), '')));
            }

            $rows[] = array(
                'session_id' => $session_id,
                'lead_id' => $lead_id,
                'trace_id' => $trace_id,
                'source' => $source,
                'event_name' => $event_name,
                'tab' => $tab,
                'step_key' => $step_key,
                'ts' => $this->normalize_timestamp_to_unix_ms($this->get_nested_value($event, array('ts'), null)),
                'meta_json' => $this->json_encode_safe($metadata),
            );
        }

        return $rows;
    }

    /**
     * @param string $table_name
     * @param array<int,array<string,mixed>> $events
     * @return int
     */
    private function persist_events_in_database($table_name, $events) {
        global $wpdb;
        if (!isset($wpdb) || !is_object($wpdb)) {
            return 0;
        }

        $stored = 0;
        $now = current_time('mysql', true);

        foreach ($events as $event) {
            if (!is_array($event) || empty($event['event_name'])) {
                continue;
            }

            $session_id = isset($event['session_id']) ? (string) $event['session_id'] : '';
            if ($session_id === '') {
                $session_id = 'anon_' . wp_generate_uuid4();
            }

            $inserted = $wpdb->insert(
                $table_name,
                array(
                    'session_id' => $session_id,
                    'lead_id' => isset($event['lead_id']) ? $event['lead_id'] : null,
                    'trace_id' => isset($event['trace_id']) ? $event['trace_id'] : null,
                    'source' => isset($event['source']) ? (string) $event['source'] : 'calc',
                    'event_name' => (string) $event['event_name'],
                    'tab' => isset($event['tab']) ? $event['tab'] : null,
                    'step_key' => isset($event['step_key']) ? (string) $event['step_key'] : null,
                    'ts' => isset($event['ts']) ? (int) $event['ts'] : (int) round(microtime(true) * 1000),
                    'meta_json' => isset($event['meta_json']) ? (string) $event['meta_json'] : '{}',
                    'created_at' => $now,
                ),
                array('%s', '%s', '%s', '%s', '%s', '%d', '%s', '%d', '%s', '%s')
            );
            if ($inserted !== false) {
                $stored++;
            }
        }

        return $stored;
    }

    /**
     * @param mixed $raw_ts
     * @return string
     */
    private function normalize_timestamp_for_db($raw_ts) {
        if (is_string($raw_ts) && trim($raw_ts) !== '') {
            $timestamp = strtotime($raw_ts);
            if ($timestamp !== false) {
                return gmdate('Y-m-d H:i:s', $timestamp);
            }
        }
        return current_time('mysql', true);
    }

    /**
     * @param mixed $raw_ts
     * @return int
     */
    private function normalize_timestamp_to_unix_ms($raw_ts) {
        if (is_numeric($raw_ts)) {
            $value = (float) $raw_ts;
            if ($value <= 0) {
                return (int) round(microtime(true) * 1000);
            }
            if ($value < 1000000000000) {
                return (int) round($value * 1000);
            }
            return (int) round($value);
        }

        if (is_string($raw_ts) && trim($raw_ts) !== '') {
            $trimmed = trim($raw_ts);
            if (is_numeric($trimmed)) {
                return $this->normalize_timestamp_to_unix_ms((float) $trimmed);
            }
            $timestamp = strtotime($trimmed);
            if ($timestamp !== false) {
                return (int) $timestamp * 1000;
            }
        }

        return (int) round(microtime(true) * 1000);
    }

    /**
     * @param mixed $status
     * @return string
     */
    private function sanitize_lead_status($status) {
        return $this->sanitize_journey_status($status);
    }

    /**
     * @param mixed $status
     * @return string
     */
    private function sanitize_journey_status($status) {
        $normalized = sanitize_key((string) $status);
        if ($normalized === 'handled') {
            return 'done';
        }
        if (in_array($normalized, array('new', 'in_progress', 'done', 'needs_review'), true)) {
            return $normalized;
        }
        return 'new';
    }

    /**
     * @param mixed $value
     * @return bool
     */
    private function normalize_bool($value) {
        if (is_bool($value)) {
            return $value;
        }
        if (is_numeric($value)) {
            return ((int) $value) === 1;
        }
        if (!is_string($value)) {
            return false;
        }
        $value = strtolower(trim($value));
        return in_array($value, array('1', 'true', 'yes', 'on'), true);
    }

    /**
     * @param mixed $data
     * @return string
     */
    private function json_encode_safe($data) {
        $encoded = function_exists('wp_json_encode')
            ? wp_json_encode($data)
            : json_encode($data);
        if (!is_string($encoded) || $encoded === '') {
            return '{}';
        }
        return $encoded;
    }

    /**
     * @param array<string,mixed> $source
     * @param array<int,string> $path
     * @param mixed $default
     * @return mixed
     */
    private function get_nested_value($source, $path, $default = null) {
        if (!is_array($source)) {
            return $default;
        }
        $cursor = $source;
        foreach ($path as $segment) {
            if (!is_array($cursor) || !array_key_exists($segment, $cursor)) {
                return $default;
            }
            $cursor = $cursor[$segment];
        }
        return $cursor;
    }

    /**
     * @param string $action
     * @param string $param_name
     * @return bool
     */
    private function validate_ajax_nonce_from_param_or_header($action, $param_name = 'nonce') {
        $nonce = '';
        if (isset($_REQUEST[$param_name])) {
            $nonce = (string) wp_unslash($_REQUEST[$param_name]);
        }
        if ($nonce === '' && isset($_SERVER['HTTP_X_TOPINSTAL_NONCE'])) {
            $nonce = (string) wp_unslash($_SERVER['HTTP_X_TOPINSTAL_NONCE']);
        }
        if ($nonce === '' && isset($_SERVER['HTTP_X_WP_NONCE'])) {
            $nonce = (string) wp_unslash($_SERVER['HTTP_X_WP_NONCE']);
        }
        if ($nonce === '') {
            return false;
        }
        return function_exists('wp_verify_nonce') ? (bool) wp_verify_nonce($nonce, $action) : false;
    }

    /**
     * @return array<int,mixed>
     */
    private function extract_events_payload_from_request() {
        $events = array();

        $raw_events = isset($_POST['events']) ? wp_unslash($_POST['events']) : '';
        if (is_string($raw_events) && trim($raw_events) !== '') {
            $decoded = json_decode($raw_events, true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }

        $raw_event = isset($_POST['event']) ? wp_unslash($_POST['event']) : '';
        if (is_string($raw_event) && trim($raw_event) !== '') {
            $decoded_event = json_decode($raw_event, true);
            if (is_array($decoded_event)) {
                return array($decoded_event);
            }
        }

        $body = $this->get_request_json_body();
        if (is_array($body)) {
            if (isset($body['events']) && is_array($body['events'])) {
                return $body['events'];
            }
            if (isset($body['event']) && is_array($body['event'])) {
                return array($body['event']);
            }
            if (isset($body[0])) {
                return $body;
            }
        }

        return $events;
    }

    /**
     * @return array<string,mixed>|array<int,mixed>|null
     */
    private function get_request_json_body() {
        $raw = file_get_contents('php://input');
        if (!is_string($raw) || trim($raw) === '') {
            return null;
        }
        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            return null;
        }
        return $decoded;
    }

    /**
     * @param array<string,mixed> $sample
     * @return void
     */
    private function persist_track_rate_limit_sample($sample) {
        $key = isset($sample['key']) ? (string) $sample['key'] : '';
        if ($key === '' || !function_exists('set_transient')) {
            return;
        }
        $window_seconds = isset($sample['window']) ? (int) $sample['window'] : 600;
        $count = isset($sample['count']) ? (int) $sample['count'] : 0;
        if ($count < 0) {
            $count = 0;
        }
        set_transient($key, $count, $window_seconds);
    }

    /**
     * @param string $session_id
     * @param int $window_seconds
     * @param int $limit
     * @param array<string,mixed>|null $sample
     * @return bool
     */
    private function is_track_rate_limited($session_id, $window_seconds, $limit, &$sample, $increment = 1) {
        $session_id = sanitize_text_field((string) $session_id);
        if ($session_id === '' || !function_exists('get_transient')) {
            return false;
        }
        $hash = md5($session_id);
        $transient_key = 'ti_rl_' . $hash;
        $current = get_transient($transient_key);
        $current_count = is_numeric($current) ? (int) $current : 0;
        $step = max(1, (int) $increment);
        $next_count = $current_count + $step;
        $sample = array(
            'key' => $transient_key,
            'count' => $next_count,
            'window' => $window_seconds,
        );
        return $next_count > $limit;
    }

    /**
     * @param mixed $meta
     * @return array<string,mixed>
     */
    private function scrub_event_meta($meta) {
        if (!is_array($meta)) {
            return array();
        }
        $blocked = array(
            'email',
            'phone',
            'name',
            'full_name',
            'first_name',
            'last_name',
            'customer_email',
            'customer_phone',
            'city',
            'postal_code',
            'address',
        );
        $clean = array();
        foreach ($meta as $key => $value) {
            $normalized_key = sanitize_key((string) $key);
            if ($normalized_key === '' || in_array($normalized_key, $blocked, true)) {
                continue;
            }
            if (is_array($value)) {
                $clean[$normalized_key] = $this->scrub_event_meta($value);
                continue;
            }
            if (is_bool($value) || is_numeric($value) || $value === null) {
                $clean[$normalized_key] = $value;
                continue;
            }
            $clean[$normalized_key] = sanitize_text_field((string) $value);
        }
        return $clean;
    }

    /**
     * @param mixed $value
     * @return bool
     */
    private function is_valid_uuid($value) {
        return is_string($value) && (bool) preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $value);
    }

    /**
     * @param array<string,mixed> $payload
     * @return string
     */
    private function resolve_or_create_lead_id($payload) {
        $candidate = '';
        $possible = array(
            $this->get_nested_value($payload, array('lead_id'), ''),
            $this->get_nested_value($payload, array('leadId'), ''),
            $this->get_nested_value($payload, array('lead', 'lead_id'), ''),
            $this->get_nested_value($payload, array('lead', 'leadId'), ''),
        );
        foreach ($possible as $value) {
            if ($this->is_valid_uuid($value)) {
                $candidate = strtolower((string) $value);
                break;
            }
        }
        if ($candidate !== '') {
            return $candidate;
        }
        if (function_exists('wp_generate_uuid4')) {
            return strtolower((string) wp_generate_uuid4());
        }
        $fallback = md5((string) microtime(true) . ':' . mt_rand());
        return strtolower(sprintf(
            '%s-%s-%s-%s-%s',
            substr($fallback, 0, 8),
            substr($fallback, 8, 4),
            substr($fallback, 12, 4),
            substr($fallback, 16, 4),
            substr($fallback, 20, 12)
        ));
    }

    /**
     * @param array<string,mixed> $payload
     * @return string
     */
    private function resolve_trace_id_from_payload($payload) {
        $trace_id = (string) $this->get_nested_value($payload, array('traceId'), $this->get_nested_value($payload, array('trace_id'), ''));
        if ($trace_id === '') {
            $trace_id = (string) $this->get_nested_value($payload, array('offer_dto', 'traceId'), $this->get_nested_value($payload, array('offer', 'traceId'), ''));
        }
        return sanitize_text_field($trace_id);
    }

    /**
     * @param array<string,mixed> $payload
     * @return string
     */
    private function resolve_source_from_payload($payload) {
        $source = (string) $this->get_nested_value($payload, array('source'), $this->get_nested_value($payload, array('context', 'source'), 'calc'));
        $source = sanitize_key($source);
        if (!in_array($source, array('calc', 'configurator'), true)) {
            $source = 'calc';
        }
        return $source;
    }

    /**
     * @return array<string,mixed>|null
     */
    private function extract_lead_payload_from_request() {
        $raw = isset($_POST['payload']) ? wp_unslash($_POST['payload']) : '';
        if (is_string($raw) && trim($raw) !== '') {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }

        $json = $this->get_request_json_body();
        if (is_array($json)) {
            if (isset($json['payload']) && is_array($json['payload'])) {
                return $json['payload'];
            }
            return $json;
        }
        return null;
    }

    /**
     * @param string $message
     * @param array<string,mixed> $context
     * @return void
     */
    private function log_warning($message, $context = array()) {
        if (class_exists('TopInstal_Logger_Wp')) {
            TopInstal_Logger_Wp::warn($message, $context);
            return;
        }

        $encoded_context = $this->json_encode_safe($context);
        error_log('[topinstal][WARN] ' . $message . ' ' . $encoded_context);
    }

    /**
     * @param string $key
     * @param string $message
     * @param array<string,mixed> $context
     * @param int $ttl_seconds
     * @return void
     */
    private function log_warning_once($key, $message, $context = array(), $ttl_seconds = 300) {
        $transient_key = 'topinstal_warn_' . sanitize_key((string) $key);
        if ($transient_key === 'topinstal_warn_') {
            $this->log_warning($message, $context);
            return;
        }

        if (function_exists('get_transient') && function_exists('set_transient')) {
            $cached = get_transient($transient_key);
            if ($cached) {
                return;
            }
            set_transient($transient_key, 1, max(60, (int) $ttl_seconds));
        }

        $this->log_warning($message, $context);
    }

    /**
     * @return void
     */
    public function register_admin_pages() {
        $capability = 'manage_options';
        add_menu_page(
            'TOP-INSTAL',
            'TOP-INSTAL',
            $capability,
            'topinstal-calculator-funnel',
            array($this, 'render_funnel_admin_page'),
            'dashicons-chart-area',
            58
        );

        add_submenu_page(
            'topinstal-calculator-funnel',
            'Lejek',
            'Lejek',
            $capability,
            'topinstal-calculator-funnel',
            array($this, 'render_funnel_admin_page')
        );

        add_submenu_page(
            'topinstal-calculator-funnel',
            'Sukcesy',
            'Sukcesy',
            $capability,
            'topinstal-calculator-successes',
            array($this, 'render_successes_admin_page')
        );

        add_submenu_page(
            'topinstal-calculator-funnel',
            'Leady z kalkulatora',
            'Leady z kalkulatora',
            $capability,
            'topinstal-calculator-leads',
            array($this, 'render_leads_admin_page')
        );
    }

    /**
     * @return array<string,mixed>
     */
    public function run_agent_healthcheck_now() {
        if (!class_exists('TopInstal_Agent_HealthcheckService')) {
            return array(
                'ok' => false,
                'status' => 'SERVICE_MISSING',
                'checkedAt' => gmdate('c'),
            );
        }

        $service = new TopInstal_Agent_HealthcheckService();
        $result = $service->run_all();
        $all_ok = true;
        foreach (array('generator', 'converter') as $target) {
            if (!isset($result[$target]['ok']) || !$result[$target]['ok']) {
                $all_ok = false;
                break;
            }
        }
        $result['ok'] = $all_ok;
        update_option('topinstal_agent_healthcheck_last_result', $this->json_encode_safe($result), false);
        return $result;
    }

    /**
     * @return void
     */
    public function handle_mark_lead_handled() {
        if (!current_user_can('manage_options')) {
            wp_die('Insufficient permissions.');
        }

        $lead_id = isset($_POST['lead_id']) ? sanitize_text_field(wp_unslash($_POST['lead_id'])) : '';
        if ($lead_id === '') {
            wp_die('Missing lead_id.');
        }

        check_admin_referer('topinstal_mark_lead_handled_' . $lead_id);

        $table_name = $this->get_leads_table_name();
        if ($this->is_table_available($table_name)) {
            global $wpdb;
            $wpdb->update(
                $table_name,
                array(
                    'status' => 'done',
                    'updated_at' => current_time('mysql', true),
                ),
                array('lead_id' => strtolower($lead_id)),
                array('%s', '%s'),
                array('%s')
            );
        }

        $redirect = isset($_POST['redirect_to']) ? wp_unslash($_POST['redirect_to']) : admin_url('admin.php?page=topinstal-calculator-leads');
        $redirect = add_query_arg('lead_updated', '1', $redirect);
        wp_safe_redirect($redirect);
        exit;
    }

    /**
     * @return void
     */
    public function render_leads_admin_page() {
        if (!current_user_can('manage_options')) {
            wp_die('Insufficient permissions.');
        }

        global $wpdb;
        $table_name = $this->get_leads_table_name();
        $status_filter = isset($_GET['status']) ? sanitize_key(wp_unslash($_GET['status'])) : 'all';
        if (!in_array($status_filter, array('all', 'new', 'done'), true)) {
            $status_filter = 'all';
        }
        $paged = isset($_GET['paged']) ? max(1, (int) $_GET['paged']) : 1;
        $per_page = 20;
        $offset = ($paged - 1) * $per_page;

        $rows = array();
        $total = 0;

        if ($this->is_table_available($table_name)) {
            $where_sql = '1=1';
            $where_args = array();
            if ($status_filter !== 'all') {
                $where_sql = 'status = %s';
                $where_args[] = $status_filter;
            }

            $total_query = "SELECT COUNT(*) FROM {$table_name} WHERE {$where_sql}";
            if (!empty($where_args)) {
                $total = (int) $wpdb->get_var($wpdb->prepare($total_query, $where_args));
            } else {
                $total = (int) $wpdb->get_var($total_query);
            }

            $list_query = "SELECT * FROM {$table_name} WHERE {$where_sql} ORDER BY updated_at DESC, id DESC LIMIT %d OFFSET %d";
            $list_args = array_merge($where_args, array($per_page, $offset));
            $prepared = $wpdb->prepare($list_query, $list_args);
            $rows = $wpdb->get_results($prepared, ARRAY_A);
            if (!is_array($rows)) {
                $rows = array();
            }
        }

        $total_pages = max(1, (int) ceil($total / $per_page));
        $view_lead_id = isset($_GET['view_lead']) ? sanitize_text_field(wp_unslash($_GET['view_lead'])) : '';
        $lead_details = null;
        if ($view_lead_id !== '' && $this->is_table_available($table_name)) {
            $lead_details = $wpdb->get_row(
                $wpdb->prepare("SELECT * FROM {$table_name} WHERE lead_id = %s LIMIT 1", strtolower($view_lead_id)),
                ARRAY_A
            );
        }

        $base_url = admin_url('admin.php?page=topinstal-calculator-leads');
        ?>
        <div class="wrap">
            <h1>Leady z kalkulatora</h1>
            <?php if (isset($_GET['lead_updated'])) : ?>
                <div class="notice notice-success is-dismissible"><p>Lead oznaczony jako obsluzony.</p></div>
            <?php endif; ?>
            <?php if (!$this->is_table_available($table_name)) : ?>
                <div class="notice notice-warning"><p>Tabela leadow nie istnieje. Upsert dziala w fallbacku transient.</p></div>
            <?php endif; ?>

            <p>
                Filtr statusu:
                <a href="<?php echo esc_url(add_query_arg(array('status' => 'all', 'paged' => 1), $base_url)); ?>">Wszystkie</a> |
                <a href="<?php echo esc_url(add_query_arg(array('status' => 'new', 'paged' => 1), $base_url)); ?>">Nowe</a> |
                <a href="<?php echo esc_url(add_query_arg(array('status' => 'done', 'paged' => 1), $base_url)); ?>">Obsluzone</a>
            </p>

            <table class="widefat fixed striped">
                <thead>
                    <tr>
                        <th>Lead ID</th>
                        <th>Session</th>
                        <th>Status</th>
                        <th>Source</th>
                        <th>Trace ID</th>
                        <th>Created</th>
                        <th>Updated</th>
                        <th>Akcje</th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (empty($rows)) : ?>
                        <tr><td colspan="8">Brak leadow.</td></tr>
                    <?php else : ?>
                        <?php foreach ($rows as $row) : ?>
                            <?php $lead_id = isset($row['lead_id']) ? (string) $row['lead_id'] : ''; ?>
                            <tr>
                                <td><code><?php echo esc_html($lead_id); ?></code></td>
                                <td><?php echo esc_html(isset($row['session_id']) ? (string) $row['session_id'] : ''); ?></td>
                                <td><?php echo esc_html(isset($row['status']) ? (string) $row['status'] : 'new'); ?></td>
                                <td><?php echo esc_html(isset($row['source']) ? (string) $row['source'] : 'calc'); ?></td>
                                <td><code><?php echo esc_html(isset($row['trace_id']) ? (string) $row['trace_id'] : ''); ?></code></td>
                                <td><?php echo esc_html(isset($row['created_at']) ? (string) $row['created_at'] : ''); ?></td>
                                <td><?php echo esc_html(isset($row['updated_at']) ? (string) $row['updated_at'] : ''); ?></td>
                                <td>
                                    <a class="button button-small" href="<?php echo esc_url(add_query_arg(array('status' => $status_filter, 'paged' => $paged, 'view_lead' => $lead_id), $base_url)); ?>">Podglad</a>
                                    <?php if (isset($row['status']) && $row['status'] !== 'done') : ?>
                                        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="display:inline;">
                                            <input type="hidden" name="action" value="topinstal_mark_lead_handled" />
                                            <input type="hidden" name="lead_id" value="<?php echo esc_attr($lead_id); ?>" />
                                            <input type="hidden" name="redirect_to" value="<?php echo esc_attr(add_query_arg(array('status' => $status_filter, 'paged' => $paged), $base_url)); ?>" />
                                            <?php wp_nonce_field('topinstal_mark_lead_handled_' . $lead_id); ?>
                                            <button type="submit" class="button button-small">Oznacz jako obsluzony</button>
                                        </form>
                                    <?php endif; ?>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>

            <?php if ($total_pages > 1) : ?>
                <p>
                    Strona:
                    <?php for ($page = 1; $page <= $total_pages; $page++) : ?>
                        <?php if ($page === $paged) : ?>
                            <strong><?php echo esc_html((string) $page); ?></strong>
                        <?php else : ?>
                            <a href="<?php echo esc_url(add_query_arg(array('status' => $status_filter, 'paged' => $page), $base_url)); ?>"><?php echo esc_html((string) $page); ?></a>
                        <?php endif; ?>
                        <?php if ($page < $total_pages) echo ' | '; ?>
                    <?php endfor; ?>
                </p>
            <?php endif; ?>

            <?php if (is_array($lead_details)) : ?>
                <hr />
                <h2>Szczegoly leadu: <code><?php echo esc_html($lead_details['lead_id']); ?></code></h2>
                <p><strong>Email:</strong> <?php echo esc_html((string) $lead_details['email']); ?> | <strong>Telefon:</strong> <?php echo esc_html((string) $lead_details['phone']); ?></p>
                <p><strong>Source:</strong> <?php echo esc_html((string) $lead_details['source']); ?> | <strong>Status:</strong> <?php echo esc_html((string) $lead_details['status']); ?></p>
                <p><strong>Session:</strong> <code><?php echo esc_html((string) $lead_details['session_id']); ?></code> | <strong>Trace:</strong> <code><?php echo esc_html((string) $lead_details['trace_id']); ?></code></p>

                <h3>Profil Energetyczny Budynku</h3>
                <?php
                $profile_rows = array();
                if (class_exists('TopInstal_LeadEnergyProfilePresenter')) {
                    try {
                        $profile_rows = TopInstal_LeadEnergyProfilePresenter::build_rows(
                            isset($lead_details['building_profile_json']) ? $lead_details['building_profile_json'] : null
                        );
                    } catch (Throwable $profile_exception) {
                        $profile_rows = array();
                    }
                }
                ?>
                <?php if (empty($profile_rows)) : ?>
                    <p><em>Brak danych historycznych profilu energetycznego</em></p>
                <?php else : ?>
                    <table class="widefat striped" style="max-width:960px;">
                        <tbody>
                            <?php foreach ($profile_rows as $profile_row) : ?>
                                <tr>
                                    <th style="width:280px;"><?php echo esc_html((string) $profile_row['label']); ?></th>
                                    <td><?php echo esc_html((string) $profile_row['value']); ?></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                <?php endif; ?>

                <h3>payload_json</h3>
                <textarea readonly rows="12" style="width:100%;"><?php echo esc_textarea((string) $lead_details['payload_json']); ?></textarea>
                <h3>utm_json</h3>
                <textarea readonly rows="4" style="width:100%;"><?php echo esc_textarea((string) $lead_details['utm_json']); ?></textarea>
            <?php endif; ?>
        </div>
        <?php
    }

    /**
     * @return void
     */
    public function render_funnel_admin_page() {
        if (!current_user_can('manage_options')) {
            wp_die('Insufficient permissions.');
        }

        global $wpdb;
        $table_name = $this->get_events_table_name();
        $range = isset($_GET['range']) ? sanitize_key(wp_unslash($_GET['range'])) : '7d';
        if (!in_array($range, array('today', '7d', '30d'), true)) {
            $range = '7d';
        }

        $range_start_ms = $this->get_range_start_ms($range);
        $metrics = array(
            'sessions' => 0,
            'reached_end' => 0,
            'result_view' => 0,
            'pdf_success' => 0,
            'pdf_download' => 0,
            'lead_success' => 0,
        );
        $rows = array();

        if ($this->is_table_available($table_name)) {
            $metrics['sessions'] = (int) $wpdb->get_var(
                $wpdb->prepare(
                    "SELECT COUNT(DISTINCT session_id) FROM {$table_name} WHERE event_name = %s AND ts >= %d",
                    'calc_session_start',
                    $range_start_ms
                )
            );
            $metrics['reached_end'] = (int) $wpdb->get_var(
                $wpdb->prepare(
                    "SELECT COUNT(DISTINCT session_id) FROM {$table_name} WHERE event_name = %s AND ts >= %d",
                    'calc_reached_end',
                    $range_start_ms
                )
            );
            $result_events = $this->get_result_milestone_event_names();
            $result_placeholders = implode(', ', array_fill(0, count($result_events), '%s'));
            $metrics['result_view'] = (int) $wpdb->get_var(
                $wpdb->prepare(
                    "SELECT COUNT(DISTINCT session_id) FROM {$table_name} WHERE event_name IN ({$result_placeholders}) AND ts >= %d",
                    array_merge($result_events, array($range_start_ms))
                )
            );
            $metrics['pdf_success'] = (int) $wpdb->get_var(
                $wpdb->prepare(
                    "SELECT COUNT(DISTINCT session_id) FROM {$table_name} WHERE event_name = %s AND ts >= %d",
                    'pdf_generate_success',
                    $range_start_ms
                )
            );
            $metrics['pdf_download'] = (int) $wpdb->get_var(
                $wpdb->prepare(
                    "SELECT COUNT(DISTINCT session_id) FROM {$table_name} WHERE event_name = %s AND ts >= %d",
                    'pdf_download_click',
                    $range_start_ms
                )
            );
            $metrics['lead_success'] = (int) $wpdb->get_var(
                $wpdb->prepare(
                    "SELECT COUNT(DISTINCT lead_id) FROM {$table_name} WHERE event_name = %s AND lead_id IS NOT NULL AND ts >= %d",
                    'lead_success',
                    $range_start_ms
                )
            );

            $funnel_events = array_merge(
                array('calc_reached_end', 'pdf_generate_success', 'pdf_download_click', 'lead_success'),
                $this->get_result_milestone_event_names()
            );
            $funnel_placeholders = implode(', ', array_fill(0, count($funnel_events), '%s'));
            $rows = $wpdb->get_results(
                $wpdb->prepare(
                    "SELECT session_id, lead_id, trace_id, event_name, ts, source, meta_json
                     FROM {$table_name}
                     WHERE ts >= %d
                       AND event_name IN ({$funnel_placeholders})
                     ORDER BY ts DESC, id DESC
                     LIMIT 100",
                    array_merge(array($range_start_ms), $funnel_events)
                ),
                ARRAY_A
            );
            if (!is_array($rows)) {
                $rows = array();
            }
        }

        $sessions = max(1, (int) $metrics['sessions']);
        $conv_reached = round(((int) $metrics['reached_end'] / $sessions) * 100, 1);
        $conv_result = round(((int) $metrics['result_view'] / $sessions) * 100, 1);
        $conv_pdf = round(((int) $metrics['pdf_success'] / $sessions) * 100, 1);
        $conv_lead = round(((int) $metrics['lead_success'] / $sessions) * 100, 1);
        $base_url = admin_url('admin.php?page=topinstal-calculator-funnel');
        ?>
        <div class="wrap">
            <h1>Lejek</h1>
            <?php if (!$this->is_table_available($table_name)) : ?>
                <div class="notice notice-warning"><p>Tabela eventow nie istnieje.</p></div>
            <?php endif; ?>

            <p>
                Zakres:
                <a href="<?php echo esc_url(add_query_arg(array('range' => 'today'), $base_url)); ?>">Dzisiaj</a> |
                <a href="<?php echo esc_url(add_query_arg(array('range' => '7d'), $base_url)); ?>">7 dni</a> |
                <a href="<?php echo esc_url(add_query_arg(array('range' => '30d'), $base_url)); ?>">30 dni</a>
            </p>

            <table class="widefat striped" style="max-width:860px;">
                <thead><tr><th>Krok lejka</th><th>Liczba</th><th>Konwersja od sesji</th></tr></thead>
                <tbody>
                    <tr><td><code>calc_session_start</code></td><td><?php echo esc_html((string) $metrics['sessions']); ?></td><td>100%</td></tr>
                    <tr><td><code>calc_reached_end</code></td><td><?php echo esc_html((string) $metrics['reached_end']); ?></td><td><?php echo esc_html((string) $conv_reached); ?>%</td></tr>
                    <tr><td><code>calc_result_view</code></td><td><?php echo esc_html((string) $metrics['result_view']); ?></td><td><?php echo esc_html((string) $conv_result); ?>%</td></tr>
                    <tr><td><code>pdf_generate_success</code></td><td><?php echo esc_html((string) $metrics['pdf_success']); ?></td><td><?php echo esc_html((string) $conv_pdf); ?>%</td></tr>
                    <tr><td><code>pdf_download_click</code></td><td><?php echo esc_html((string) $metrics['pdf_download']); ?></td><td><?php echo esc_html((string) round(((int) $metrics['pdf_download'] / $sessions) * 100, 1)); ?>%</td></tr>
                    <tr><td><code>lead_success</code></td><td><?php echo esc_html((string) $metrics['lead_success']); ?></td><td><?php echo esc_html((string) $conv_lead); ?>%</td></tr>
                </tbody>
            </table>

            <h2>Ostatnie 100 sukcesow</h2>
            <table class="widefat fixed striped">
                <thead>
                    <tr>
                        <th>TS</th>
                        <th>Session</th>
                        <th>Lead</th>
                        <th>Trace</th>
                        <th>Zrodlo</th>
                        <th>Event</th>
                        <th>Meta</th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (empty($rows)) : ?>
                        <tr><td colspan="7">Brak zdarzen.</td></tr>
                    <?php else : ?>
                        <?php foreach ($rows as $row) : ?>
                            <tr>
                                <td><?php echo esc_html($this->format_unix_ms_for_admin(isset($row['ts']) ? $row['ts'] : null)); ?></td>
                                <td><code><?php echo esc_html((string) $row['session_id']); ?></code></td>
                                <td><code><?php echo esc_html((string) $row['lead_id']); ?></code></td>
                                <td><code><?php echo esc_html((string) $row['trace_id']); ?></code></td>
                                <td><?php echo esc_html((string) $row['source']); ?></td>
                                <td><code><?php echo esc_html((string) $row['event_name']); ?></code></td>
                                <td><textarea readonly rows="3" style="width:100%;"><?php echo esc_textarea((string) $row['meta_json']); ?></textarea></td>
                            </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>
        <?php
    }

    /**
     * Backward compatible alias for previous submenu callback.
     *
     * @return void
     */
    public function render_events_admin_page() {
        $this->render_funnel_admin_page();
    }

    /**
     * @return void
     */
    public function handle_update_journey_note() {
        if (!current_user_can('manage_options')) {
            wp_die('Insufficient permissions.');
        }

        $journey_key = isset($_POST['journey_key']) ? sanitize_text_field(wp_unslash($_POST['journey_key'])) : '';
        if ($journey_key === '') {
            wp_die('Missing journey_key.');
        }

        check_admin_referer('topinstal_update_journey_note_' . $journey_key);

        $status = $this->sanitize_journey_status(isset($_POST['status']) ? wp_unslash($_POST['status']) : 'new');
        $note = isset($_POST['note']) ? sanitize_textarea_field(wp_unslash($_POST['note'])) : '';

        $table_name = $this->get_journey_notes_table_name();
        if ($this->is_table_available($table_name)) {
            global $wpdb;
            $existing_id = $wpdb->get_var($wpdb->prepare("SELECT id FROM {$table_name} WHERE journey_key = %s LIMIT 1", $journey_key));
            $data = array(
                'status' => $status,
                'note' => $note !== '' ? $note : null,
                'updated_at' => current_time('mysql', true),
            );
            if ($existing_id) {
                $wpdb->update(
                    $table_name,
                    $data,
                    array('id' => (int) $existing_id),
                    array('%s', '%s', '%s'),
                    array('%d')
                );
            } else {
                $wpdb->insert(
                    $table_name,
                    array_merge(array('journey_key' => $journey_key), $data),
                    array('%s', '%s', '%s', '%s')
                );
            }
        }

        $redirect = isset($_POST['redirect_to']) ? wp_unslash($_POST['redirect_to']) : admin_url('admin.php?page=topinstal-calculator-successes');
        $redirect = add_query_arg('journey_updated', '1', $redirect);
        wp_safe_redirect($redirect);
        exit;
    }

    /**
     * @param mixed $range
     * @return int
     */
    private function get_range_start_ms($range) {
        $now = time();
        if ($range === 'today') {
            return ((int) strtotime('today')) * 1000;
        }
        if ($range === '30d') {
            return ((int) ($now - (30 * DAY_IN_SECONDS))) * 1000;
        }
        return ((int) ($now - (7 * DAY_IN_SECONDS))) * 1000;
    }

    /**
     * @param mixed $unix_ms
     * @return string
     */
    private function format_unix_ms_for_admin($unix_ms) {
        $ms = is_numeric($unix_ms) ? (int) $unix_ms : 0;
        if ($ms <= 0) {
            return '';
        }
        return gmdate('Y-m-d H:i:s', (int) floor($ms / 1000));
    }

    /**
     * @param mixed $unix_ms
     * @return string
     */
    private function humanize_time_ago_from_ms($unix_ms) {
        $ms = is_numeric($unix_ms) ? (int) $unix_ms : 0;
        if ($ms <= 0) {
            return '';
        }
        $seconds = max(0, time() - (int) floor($ms / 1000));
        if ($seconds < 60) {
            return $seconds . ' s temu';
        }
        if ($seconds < HOUR_IN_SECONDS) {
            return floor($seconds / 60) . ' min temu';
        }
        if ($seconds < DAY_IN_SECONDS) {
            return floor($seconds / HOUR_IN_SECONDS) . ' h temu';
        }
        return floor($seconds / DAY_IN_SECONDS) . ' dni temu';
    }

    /**
     * @param array<string,mixed> $row
     * @return string
     */
    private function determine_journey_stage($row) {
        if (!empty($row['has_lead_success'])) {
            return 'lead';
        }
        if (!empty($row['has_pdf_success']) || !empty($row['has_pdf_download'])) {
            return 'pdf';
        }
        if (!empty($row['has_result'])) {
            return 'wynik';
        }
        if (!empty($row['has_reached_end'])) {
            return 'koniec';
        }
        return 'inne';
    }

    /**
     * @param array<string,mixed> $row
     * @return int
     */
    private function compute_journey_score($row) {
        $score = 0;
        if (!empty($row['has_result'])) {
            $score += 20;
        }
        if (!empty($row['has_pdf_success'])) {
            $score += 25;
        }
        if (!empty($row['has_pdf_download'])) {
            $score += 15;
        }
        if (!empty($row['has_lead_submit'])) {
            $score += 20;
        }
        if (!empty($row['has_lead_success'])) {
            $score += 30;
        }

        if (!empty($row['phone'])) {
            $score += 15;
        }
        if (!empty($row['email'])) {
            $score += 10;
        }
        if (!empty($row['city'])) {
            $score += 5;
        }

        $summary = $this->extract_summary_from_payload(isset($row['payload_json']) ? $row['payload_json'] : '');
        if (!empty($summary['area']) && !empty($summary['standard']) && !empty($summary['heating'])) {
            $score += 10;
        }

        if (isset($row['calc_error_count']) && (int) $row['calc_error_count'] >= 2) {
            $score -= 10;
        }

        $last_activity_ms = isset($row['last_activity']) ? (int) $row['last_activity'] : 0;
        if ($last_activity_ms > 0) {
            $age_seconds = max(0, time() - (int) floor($last_activity_ms / 1000));
            if ($age_seconds < 15 * MINUTE_IN_SECONDS) {
                $score += 15;
            } elseif ($age_seconds < HOUR_IN_SECONDS) {
                $score += 10;
            } elseif ($age_seconds < DAY_IN_SECONDS) {
                $score += 5;
            }
        }

        return max(0, min(100, (int) $score));
    }

    /**
     * @param mixed $payload_json
     * @return array<string,mixed>
     */
    private function extract_summary_from_payload($payload_json) {
        $summary = array(
            'area' => null,
            'standard' => null,
            'heating' => null,
            'power_kw' => null,
            'quoteCode' => null,
        );
        if (!is_string($payload_json) || trim($payload_json) === '') {
            return $summary;
        }
        $payload = json_decode($payload_json, true);
        if (!is_array($payload)) {
            return $summary;
        }

        $summary['area'] = $this->get_nested_value($payload, array('building', 'heatedArea_m2'), null);
        if ($summary['area'] === null) {
            $summary['area'] = $this->get_nested_value($payload, array('building', 'total_area'), null);
        }
        $summary['standard'] = $this->get_nested_value($payload, array('building', 'insulation_level', 'construction_year'), null);
        if ($summary['standard'] === null) {
            $summary['standard'] = $this->get_nested_value($payload, array('building', 'construction_year'), null);
        }
        $summary['heating'] = $this->get_nested_value($payload, array('building', 'heating_type'), null);
        if ($summary['heating'] === null) {
            $summary['heating'] = $this->get_nested_value($payload, array('preferences', 'heating', 'emitterType'), null);
        }
        $summary['power_kw'] = $this->get_nested_value($payload, array('building', 'designHeatLoss_kW'), null);
        if ($summary['power_kw'] === null) {
            $summary['power_kw'] = $this->get_nested_value($payload, array('selection', 'heatpump', 'power_kW'), null);
        }
        $summary['quoteCode'] = $this->get_nested_value($payload, array('meta', 'quoteCode'), null);
        if ($summary['quoteCode'] === null) {
            $summary['quoteCode'] = $this->get_nested_value($payload, array('quoteCode'), null);
        }

        return $summary;
    }

    /**
     * @param array<string,mixed> $summary
     * @param mixed $session_id
     * @return string
     */
    private function resolve_quote_code($summary, $session_id) {
        $existing = isset($summary['quoteCode']) ? (string) $summary['quoteCode'] : '';
        if ($existing !== '') {
            return $existing;
        }
        $seed = sanitize_text_field((string) $session_id);
        if ($seed === '') {
            $seed = 'anon';
        }
        $hash_binary = hash('sha256', $seed, true);
        $base32 = $this->encode_base32_binary($hash_binary);
        if ($base32 === '') {
            return 'TI-' . strtoupper(substr(hash('sha256', $seed), 0, 4));
        }
        return 'TI-' . strtoupper(substr($base32, 0, 4));
    }

    /**
     * @param string $binary
     * @return string
     */
    private function encode_base32_binary($binary) {
        if (!is_string($binary) || $binary === '') {
            return '';
        }
        $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $bits = '';
        $length = strlen($binary);
        for ($i = 0; $i < $length; $i++) {
            $bits .= str_pad(decbin(ord($binary[$i])), 8, '0', STR_PAD_LEFT);
        }
        $encoded = '';
        $bits_length = strlen($bits);
        for ($offset = 0; $offset < $bits_length; $offset += 5) {
            $chunk = substr($bits, $offset, 5);
            if ($chunk === '') {
                continue;
            }
            if (strlen($chunk) < 5) {
                $chunk = str_pad($chunk, 5, '0', STR_PAD_RIGHT);
            }
            $encoded .= $alphabet[bindec($chunk)];
        }
        return $encoded;
    }

    /**
     * @param string $events_table
     * @param string $leads_table
     * @param string $notes_table
     * @param int $range_start_ms
     * @param string $stage_filter
     * @param string $source_filter
     * @param string $status_filter
     * @param bool $pdf_no_contact
     * @return array<int,array<string,mixed>>
     */
    private function load_success_journeys($events_table, $leads_table, $notes_table, $range_start_ms, $stage_filter, $source_filter, $status_filter, $pdf_no_contact) {
        global $wpdb;
        $result = array();
        if (!isset($wpdb) || !is_object($wpdb)) {
            return $result;
        }

        $notes_join = $this->is_table_available($notes_table)
            ? "LEFT JOIN {$notes_table} N ON N.journey_key = agg.journey_key"
            : "LEFT JOIN (SELECT NULL AS journey_key, NULL AS status, NULL AS note, NULL AS updated_at) N ON 1=0";
        $leads_join = $this->is_table_available($leads_table)
            ? "LEFT JOIN {$leads_table} L ON L.lead_id = agg.lead_id"
            : "LEFT JOIN (SELECT NULL AS lead_id, NULL AS phone, NULL AS email, NULL AS city, NULL AS payload_json) L ON 1=0";

        $sql = $wpdb->prepare(
            "SELECT
                agg.journey_key,
                agg.lead_id,
                agg.trace_id,
                agg.session_id,
                agg.source,
                agg.last_activity,
                agg.has_result,
                agg.has_pdf_success,
                agg.has_pdf_download,
                agg.has_lead_submit,
                agg.has_lead_success,
                agg.has_reached_end,
                agg.pdf_clicks,
                agg.calc_error_count,
                L.phone,
                L.email,
                L.city,
                L.payload_json,
                N.status AS note_status,
                N.note AS note_text
            FROM (
                SELECT
                    COALESCE(NULLIF(lead_id, ''), NULLIF(trace_id, ''), session_id) AS journey_key,
                    MAX(lead_id) AS lead_id,
                    MAX(trace_id) AS trace_id,
                    MAX(session_id) AS session_id,
                    SUBSTRING_INDEX(GROUP_CONCAT(source ORDER BY ts DESC), ',', 1) AS source,
                    MAX(ts) AS last_activity,
                    MAX(CASE WHEN event_name IN ('calc_result_view', 'calc_success', 'configurator_offer_ready') THEN 1 ELSE 0 END) AS has_result,
                    MAX(CASE WHEN event_name = 'pdf_generate_success' THEN 1 ELSE 0 END) AS has_pdf_success,
                    MAX(CASE WHEN event_name = 'pdf_download_click' THEN 1 ELSE 0 END) AS has_pdf_download,
                    MAX(CASE WHEN event_name = 'lead_submit' THEN 1 ELSE 0 END) AS has_lead_submit,
                    MAX(CASE WHEN event_name = 'lead_success' THEN 1 ELSE 0 END) AS has_lead_success,
                    MAX(CASE WHEN event_name = 'calc_reached_end' THEN 1 ELSE 0 END) AS has_reached_end,
                    SUM(CASE WHEN event_name = 'pdf_download_click' THEN 1 ELSE 0 END) AS pdf_clicks,
                    SUM(CASE WHEN event_name = 'calc_error' THEN 1 ELSE 0 END) AS calc_error_count
                FROM {$events_table}
                WHERE ts >= %d
                GROUP BY journey_key
            ) agg
            {$leads_join}
            {$notes_join}",
            $range_start_ms
        );

        $rows = $wpdb->get_results($sql, ARRAY_A);
        if (!is_array($rows)) {
            return $result;
        }

        foreach ($rows as $row) {
            $stage = $this->determine_journey_stage($row);
            if ($stage === 'inne') {
                continue;
            }
            if ($stage_filter !== 'all' && $stage_filter !== $stage) {
                continue;
            }

            $source = isset($row['source']) ? sanitize_key((string) $row['source']) : 'calc';
            if (!in_array($source, array('calc', 'configurator'), true)) {
                $source = 'calc';
            }
            if ($source_filter !== 'all' && $source_filter !== $source) {
                continue;
            }

            $status = isset($row['note_status']) ? $this->sanitize_journey_status($row['note_status']) : 'new';
            if ($status_filter !== 'all' && $status_filter !== $status) {
                continue;
            }

            $has_contact = !empty($row['phone']) || !empty($row['email']);
            if ($pdf_no_contact && !($stage === 'pdf' && !$has_contact)) {
                continue;
            }

            $summary = $this->extract_summary_from_payload(isset($row['payload_json']) ? $row['payload_json'] : '');
            $result[] = array(
                'journey_key' => isset($row['journey_key']) ? (string) $row['journey_key'] : '',
                'lead_id' => isset($row['lead_id']) ? (string) $row['lead_id'] : '',
                'trace_id' => isset($row['trace_id']) ? (string) $row['trace_id'] : '',
                'session_id' => isset($row['session_id']) ? (string) $row['session_id'] : '',
                'source' => $source,
                'last_activity' => isset($row['last_activity']) ? (int) $row['last_activity'] : 0,
                'stage' => $stage,
                'status' => $status,
                'note' => isset($row['note_text']) ? (string) $row['note_text'] : '',
                'phone' => isset($row['phone']) ? (string) $row['phone'] : '',
                'email' => isset($row['email']) ? (string) $row['email'] : '',
                'city' => isset($row['city']) ? (string) $row['city'] : '',
                'score' => $this->compute_journey_score($row),
                'power_kw' => isset($summary['power_kw']) ? $summary['power_kw'] : null,
                'quote_code' => $this->resolve_quote_code($summary, isset($row['session_id']) ? $row['session_id'] : ''),
            );
        }

        return $result;
    }

    /**
     * @param string $events_table
     * @param string $journey_key
     * @param int $range_start_ms
     * @return array<string,mixed>|null
     */
    private function load_journey_detail($events_table, $journey_key, $range_start_ms) {
        $journeys = $this->load_success_journeys(
            $events_table,
            $this->get_leads_table_name(),
            $this->get_journey_notes_table_name(),
            $range_start_ms,
            'all',
            'all',
            'all',
            false
        );
        $selected = null;
        foreach ($journeys as $journey) {
            if ((string) $journey['journey_key'] === (string) $journey_key) {
                $selected = $journey;
                break;
            }
        }
        if (!is_array($selected)) {
            return null;
        }

        global $wpdb;
        $timeline = array();
        if (!empty($selected['lead_id']) && $this->is_valid_uuid($selected['lead_id'])) {
            $timeline = $wpdb->get_results(
                $wpdb->prepare(
                    "SELECT event_name, ts, tab, step_key, meta_json
                     FROM {$events_table}
                     WHERE lead_id = %s
                     ORDER BY ts DESC, id DESC
                     LIMIT 30",
                    $selected['lead_id']
                ),
                ARRAY_A
            );
        } elseif (!empty($selected['trace_id'])) {
            $timeline = $wpdb->get_results(
                $wpdb->prepare(
                    "SELECT event_name, ts, tab, step_key, meta_json
                     FROM {$events_table}
                     WHERE trace_id = %s
                     ORDER BY ts DESC, id DESC
                     LIMIT 30",
                    $selected['trace_id']
                ),
                ARRAY_A
            );
        } else {
            $timeline = $wpdb->get_results(
                $wpdb->prepare(
                    "SELECT event_name, ts, tab, step_key, meta_json
                     FROM {$events_table}
                     WHERE session_id = %s
                     ORDER BY ts DESC, id DESC
                     LIMIT 30",
                    $selected['session_id']
                ),
                ARRAY_A
            );
        }
        if (!is_array($timeline)) {
            $timeline = array();
        }

        $payload_json = '';
        $leads_table = $this->get_leads_table_name();
        if (!empty($selected['lead_id']) && $this->is_table_available($leads_table)) {
            $payload_json = (string) $wpdb->get_var(
                $wpdb->prepare("SELECT payload_json FROM {$leads_table} WHERE lead_id = %s LIMIT 1", $selected['lead_id'])
            );
        }

        $selected['timeline'] = $timeline;
        $selected['summary'] = $this->extract_summary_from_payload($payload_json);
        return $selected;
    }

    /**
     * @return void
     */
    public function render_successes_admin_page() {
        if (!current_user_can('manage_options')) {
            wp_die('Insufficient permissions.');
        }

        $events_table = $this->get_events_table_name();
        $leads_table = $this->get_leads_table_name();
        $notes_table = $this->get_journey_notes_table_name();

        $range = isset($_GET['range']) ? sanitize_key(wp_unslash($_GET['range'])) : '7d';
        if (!in_array($range, array('today', '7d', '30d'), true)) {
            $range = '7d';
        }
        $stage_filter = isset($_GET['stage']) ? sanitize_key(wp_unslash($_GET['stage'])) : 'all';
        if (!in_array($stage_filter, array('all', 'wynik', 'pdf', 'lead', 'koniec'), true)) {
            $stage_filter = 'all';
        }
        $source_filter = isset($_GET['source']) ? sanitize_key(wp_unslash($_GET['source'])) : 'all';
        if (!in_array($source_filter, array('all', 'calc', 'configurator'), true)) {
            $source_filter = 'all';
        }
        $status_filter = isset($_GET['status']) ? sanitize_key(wp_unslash($_GET['status'])) : 'all';
        if (!in_array($status_filter, array('all', 'new', 'in_progress', 'done', 'needs_review'), true)) {
            $status_filter = 'all';
        }
        $sort = isset($_GET['sort']) ? sanitize_key(wp_unslash($_GET['sort'])) : 'score';
        if (!in_array($sort, array('score', 'last_activity'), true)) {
            $sort = 'score';
        }
        $pdf_no_contact = isset($_GET['pdf_no_contact']) && wp_unslash($_GET['pdf_no_contact']) === '1';
        $paged = isset($_GET['paged']) ? max(1, (int) $_GET['paged']) : 1;
        $per_page = 50;
        $journey_key = isset($_GET['journey']) ? sanitize_text_field(wp_unslash($_GET['journey'])) : '';

        $range_start_ms = $this->get_range_start_ms($range);
        $rows = array();
        if ($this->is_table_available($events_table)) {
            $rows = $this->load_success_journeys(
                $events_table,
                $leads_table,
                $notes_table,
                $range_start_ms,
                $stage_filter,
                $source_filter,
                $status_filter,
                $pdf_no_contact
            );
            if ($sort === 'score') {
                usort($rows, function ($a, $b) {
                    $diff = ((int) $b['score']) <=> ((int) $a['score']);
                    if ($diff !== 0) {
                        return $diff;
                    }
                    return ((int) $b['last_activity']) <=> ((int) $a['last_activity']);
                });
            } else {
                usort($rows, function ($a, $b) {
                    return ((int) $b['last_activity']) <=> ((int) $a['last_activity']);
                });
            }
        }

        $total = count($rows);
        $offset = ($paged - 1) * $per_page;
        $paged_rows = array_slice($rows, $offset, $per_page);
        $total_pages = max(1, (int) ceil(max(1, $total) / $per_page));
        $base_url = admin_url('admin.php?page=topinstal-calculator-successes');
        $detail = $journey_key !== '' ? $this->load_journey_detail($events_table, $journey_key, $range_start_ms) : null;
        ?>
        <div class="wrap">
            <h1>Sukcesy</h1>
            <?php if (isset($_GET['journey_updated'])) : ?>
                <div class="notice notice-success is-dismissible"><p>Zapisano status/notatke.</p></div>
            <?php endif; ?>

            <form method="get" action="<?php echo esc_url(admin_url('admin.php')); ?>">
                <input type="hidden" name="page" value="topinstal-calculator-successes" />
                <p>
                    Zakres:
                    <select name="range"><option value="today" <?php selected($range, 'today'); ?>>Dzisiaj</option><option value="7d" <?php selected($range, '7d'); ?>>7 dni</option><option value="30d" <?php selected($range, '30d'); ?>>30 dni</option></select>
                    Etap:
                    <select name="stage"><option value="all" <?php selected($stage_filter, 'all'); ?>>Wszystkie</option><option value="wynik" <?php selected($stage_filter, 'wynik'); ?>>Wynik</option><option value="pdf" <?php selected($stage_filter, 'pdf'); ?>>PDF</option><option value="lead" <?php selected($stage_filter, 'lead'); ?>>Lead</option><option value="koniec" <?php selected($stage_filter, 'koniec'); ?>>Koniec</option></select>
                    Zrodlo:
                    <select name="source"><option value="all" <?php selected($source_filter, 'all'); ?>>Wszystkie</option><option value="calc" <?php selected($source_filter, 'calc'); ?>>Kalkulator</option><option value="configurator" <?php selected($source_filter, 'configurator'); ?>>Konfigurator</option></select>
                    Status:
                    <select name="status"><option value="all" <?php selected($status_filter, 'all'); ?>>Wszystkie</option><option value="new" <?php selected($status_filter, 'new'); ?>>Nowy</option><option value="in_progress" <?php selected($status_filter, 'in_progress'); ?>>W toku</option><option value="done" <?php selected($status_filter, 'done'); ?>>Obsluzony</option><option value="needs_review" <?php selected($status_filter, 'needs_review'); ?>>Do wyjasnienia</option></select>
                    Sort:
                    <select name="sort"><option value="score" <?php selected($sort, 'score'); ?>>Score</option><option value="last_activity" <?php selected($sort, 'last_activity'); ?>>Ostatnia aktywnosc</option></select>
                    <label><input type="checkbox" name="pdf_no_contact" value="1" <?php checked($pdf_no_contact); ?> /> PDF bez kontaktu</label>
                    <button type="submit" class="button button-primary">Filtruj</button>
                </p>
            </form>

            <table class="widefat fixed striped">
                <thead><tr><th>Status</th><th>Score</th><th>Ostatnia aktywnosc</th><th>Zrodlo</th><th>Etap</th><th>Kontakt</th><th>Moc kW</th><th>Kod wyceny</th><th>Akcje</th></tr></thead>
                <tbody>
                <?php if (empty($paged_rows)) : ?>
                    <tr><td colspan="9">Brak rekordow.</td></tr>
                <?php else : ?>
                    <?php foreach ($paged_rows as $row) : ?>
                        <?php
                        $journey_row_key = (string) $row['journey_key'];
                        $query_args = array('range' => $range, 'stage' => $stage_filter, 'source' => $source_filter, 'status' => $status_filter, 'sort' => $sort, 'paged' => $paged);
                        if ($pdf_no_contact) { $query_args['pdf_no_contact'] = '1'; }
                        $contact = trim(((string) $row['phone']) . ' ' . ((string) $row['email'])) !== '' ? trim(((string) $row['phone']) . ' / ' . ((string) $row['email'])) : 'brak';
                        ?>
                        <tr>
                            <td><?php echo esc_html((string) $row['status']); ?></td>
                            <td><?php echo esc_html((string) $row['score']); ?></td>
                            <td title="<?php echo esc_attr($this->format_unix_ms_for_admin($row['last_activity'])); ?>"><?php echo esc_html($this->humanize_time_ago_from_ms($row['last_activity'])); ?></td>
                            <td><?php echo esc_html((string) $row['source']); ?></td>
                            <td><?php echo esc_html((string) $row['stage']); ?></td>
                            <td><?php echo esc_html($contact); ?></td>
                            <td><?php echo esc_html(isset($row['power_kw']) && $row['power_kw'] !== null ? (string) $row['power_kw'] : '—'); ?></td>
                            <td><code><?php echo esc_html((string) $row['quote_code']); ?></code></td>
                            <td>
                                <a class="button button-small" href="<?php echo esc_url(add_query_arg(array_merge($query_args, array('journey' => $journey_row_key)), $base_url)); ?>">Szczegoly</a>
                                <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="display:inline;">
                                    <input type="hidden" name="action" value="topinstal_update_journey_note" />
                                    <input type="hidden" name="journey_key" value="<?php echo esc_attr($journey_row_key); ?>" />
                                    <input type="hidden" name="status" value="done" />
                                    <input type="hidden" name="redirect_to" value="<?php echo esc_attr(add_query_arg($query_args, $base_url)); ?>" />
                                    <?php wp_nonce_field('topinstal_update_journey_note_' . $journey_row_key); ?>
                                    <button type="submit" class="button button-small">Obsluzony</button>
                                </form>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                <?php endif; ?>
                </tbody>
            </table>

            <?php if ($total_pages > 1) : ?>
                <p>
                    <?php for ($page_num = 1; $page_num <= $total_pages; $page_num++) : ?>
                        <?php if ($page_num === $paged) : ?><strong><?php echo esc_html((string) $page_num); ?></strong><?php else : ?><a href="<?php echo esc_url(add_query_arg(array_merge(array('range' => $range, 'stage' => $stage_filter, 'source' => $source_filter, 'status' => $status_filter, 'sort' => $sort, 'paged' => $page_num), $pdf_no_contact ? array('pdf_no_contact' => '1') : array()), $base_url)); ?>"><?php echo esc_html((string) $page_num); ?></a><?php endif; ?>
                        <?php if ($page_num < $total_pages) echo ' | '; ?>
                    <?php endfor; ?>
                </p>
            <?php endif; ?>

            <?php if (is_array($detail)) : ?>
                <hr />
                <h2>Szczegoly journey: <code><?php echo esc_html((string) $detail['journey_key']); ?></code></h2>
                <p><strong>Etap:</strong> <?php echo esc_html((string) $detail['stage']); ?> | <strong>Score:</strong> <?php echo esc_html((string) $detail['score']); ?> | <strong>Ostatnia aktywnosc:</strong> <?php echo esc_html($this->format_unix_ms_for_admin($detail['last_activity'])); ?></p>
                <p><strong>Kod wyceny:</strong> <code><?php echo esc_html((string) $detail['quote_code']); ?></code> | <strong>Trace ID:</strong> <code><?php echo esc_html((string) $detail['trace_id']); ?></code></p>
                <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                    <input type="hidden" name="action" value="topinstal_update_journey_note" />
                    <input type="hidden" name="journey_key" value="<?php echo esc_attr((string) $detail['journey_key']); ?>" />
                    <input type="hidden" name="redirect_to" value="<?php echo esc_attr(add_query_arg(array('range' => $range, 'stage' => $stage_filter, 'source' => $source_filter, 'status' => $status_filter, 'sort' => $sort, 'journey' => (string) $detail['journey_key']), $base_url)); ?>" />
                    <?php wp_nonce_field('topinstal_update_journey_note_' . (string) $detail['journey_key']); ?>
                    <p><label>Status</label> <select name="status"><option value="new" <?php selected($detail['status'], 'new'); ?>>Nowy</option><option value="in_progress" <?php selected($detail['status'], 'in_progress'); ?>>W toku</option><option value="done" <?php selected($detail['status'], 'done'); ?>>Obsluzony</option><option value="needs_review" <?php selected($detail['status'], 'needs_review'); ?>>Do wyjasnienia</option></select></p>
                    <p><label>Notatka</label><br /><textarea name="note" rows="4" style="width:100%;max-width:860px;"><?php echo esc_textarea((string) $detail['note']); ?></textarea></p>
                    <p><button type="submit" class="button button-primary">Zapisz</button></p>
                </form>
                <h3>Timeline (ostatnie 30 zdarzen)</h3>
                <table class="widefat fixed striped"><thead><tr><th>TS</th><th>Event</th><th>Tab/Step</th><th>Meta</th></tr></thead><tbody>
                <?php if (empty($detail['timeline'])) : ?>
                    <tr><td colspan="4">Brak zdarzen.</td></tr>
                <?php else : ?>
                    <?php foreach ($detail['timeline'] as $event_row) : ?>
                        <tr>
                            <td><?php echo esc_html($this->format_unix_ms_for_admin(isset($event_row['ts']) ? $event_row['ts'] : null)); ?></td>
                            <td><code><?php echo esc_html((string) $event_row['event_name']); ?></code></td>
                            <td><?php echo esc_html((string) (isset($event_row['tab']) ? $event_row['tab'] : '')); ?> / <?php echo esc_html((string) (isset($event_row['step_key']) ? $event_row['step_key'] : '')); ?></td>
                            <td><textarea readonly rows="3" style="width:100%;"><?php echo esc_textarea((string) (isset($event_row['meta_json']) ? $event_row['meta_json'] : '')); ?></textarea></td>
                        </tr>
                    <?php endforeach; ?>
                <?php endif; ?>
                </tbody></table>
            <?php endif; ?>
        </div>
        <?php
    }

    /**
     * Aktywacja wtyczki
     */
        public function activate() {
        // Sprawdź wymagania
        if (version_compare(PHP_VERSION, '7.4', '<')) {
            deactivate_plugins(plugin_basename(__FILE__));
            wp_die('Wtyczka wymaga PHP 7.4 lub nowszej wersji.');
        }

        if (version_compare(get_bloginfo('version'), '5.0', '<')) {
            deactivate_plugins(plugin_basename(__FILE__));
            wp_die('Wtyczka wymaga WordPress 5.0 lub nowszej wersji.');
        }

        // Flush rewrite rules jeżeli potrzeba
        $this->ensure_database_tables();
        flush_rewrite_rules();
    }

    /**
     * Deaktywacja wtyczki
     */
    public function deactivate() {
        flush_rewrite_rules();
    }

    /**
     * Enqueue skryptów i stylów
     */
    public function enqueue_assets() {
        // Enqueue tylko jeżeli shortcode jest użyty na stronie
        global $post;

        // Sprawdź czy shortcode jest w treści posta
        $has_shortcode = false;
        if (is_a($post, 'WP_Post')) {
            $has_shortcode = has_shortcode($post->post_content, 'heatpump_calc');
        }

        // Sprawdź też w globalnym buforze (dla kompatybilności z niektórymi builderami)
        if (!$has_shortcode && isset($GLOBALS['wp_query'])) {
            $post_id = get_the_ID();
            if ($post_id) {
                $has_shortcode = has_shortcode(get_post_field('post_content', $post_id), 'heatpump_calc');
            }
        }

        // Elementor compatibility - sprawdź czy shortcode jest w Elementor data
        if (!$has_shortcode && class_exists('\Elementor\Plugin')) {
            $elementor = \Elementor\Plugin::$instance;
            if ($elementor && $elementor->frontend) {
                $current_post_id = get_the_ID();
                if ($current_post_id) {
                    $document = $elementor->frontend->get_builder_content_for_display($current_post_id);
                    if ($document && strpos($document, '[heatpump_calc') !== false) {
                        $has_shortcode = true;
                    }
                }
            }
        }

        // Sprawdź też w całym output bufferze (dla widgetów i innych miejsc)
        if (!$has_shortcode) {
            // Sprawdź czy shortcode jest w jakimkolwiek miejscu na stronie
            // To jest fallback dla przypadków, gdy shortcode jest w widget'cie lub innym miejscu
            $has_shortcode = $this->check_shortcode_in_output();
        }

        // Jeżeli shortcode jest użyty, załaduj zasoby
        if ($has_shortcode) {
            $this->shortcode_detected = true;
            $this->enqueue_calculator_assets();
        }
    }

    /**
     * Wyłącz problematyczne style Elementor, które generują błędy parsowania CSS w konsoli
     * (np. widget-*.min.css). Stosowane TYLKO na stronach z kalkulatorem.
     *
     * Uwaga: te komunikaty nie są błędami logiki aplikacji — to ostrzeżenia parsera CSS
     * związane z assetami WP/Elementor (często 404/HTML zamiast CSS lub wadliwy minify).
     */
    private function maybe_dequeue_noisy_elementor_widget_styles() {
        if (!$this->shortcode_detected) {
            return;
        }
        if (is_admin()) {
            return;
        }

        // Pozwól włączyć tę poprawkę filtrem, jeżeli ktoś chce usunąć problematyczne style Elementora.
        // Domyślnie wyłączone (false) - bezpieczne zachowanie, nie wpływa na resztę strony.
        $enabled = apply_filters('heatpump_dequeue_noisy_elementor_widget_css', false);
        if (!$enabled) {
            return;
        }

        // WP_Styles bywa niedostępne w niektórych kontekstach (np. bardzo wczesne hooki).
        global $wp_styles;
        if (!($wp_styles instanceof \WP_Styles)) {
            return;
        }

        $targets = array(
            'widget-blockquote.min.css',
            'widget-mega-menu.min.css',
            'widget-nav-menu.min.css',
        );

        foreach ($wp_styles->registered as $handle => $style) {
            if (!is_object($style) || empty($style->src)) {
                continue;
            }
            $src = (string) $style->src;
            // Upewnij się, że dotykamy tylko Elementorowych assetów (nie theme/plugin o tej samej nazwie).
            if (stripos($src, 'elementor') === false) {
                continue;
            }

            $path = parse_url($src, PHP_URL_PATH);
            if (!$path) {
                continue;
            }
            $basename = basename($path);
            if (in_array($basename, $targets, true)) {
                wp_dequeue_style($handle);
                wp_deregister_style($handle);
            }
        }
    }

    /**
     * Sprawdź czy shortcode jest w output bufferze (dla widgetów, itp.)
     */
    private function check_shortcode_in_output() {
        // Sprawdź wszystkie aktywne widgety
        if (is_active_sidebar('sidebar-1') || is_active_sidebar('sidebar-2') || is_active_sidebar('footer-1')) {
            // Shortcode może być w widget'cie - załaduj zasoby prewencyjnie
            // (lepiej załadować niepotrzebnie niż nie załadować wcale)
            return true;
        }

        return false;
    }

    /**
     * Znajdź plik rekurencyjnie w katalogu
     */
    private function find_file_recursive($directory, $filename) {
        if (!is_dir($directory)) {
            return null;
        }

        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($directory, \RecursiveDirectoryIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::SELF_FIRST
        );

        foreach ($iterator as $file) {
            if ($file->isFile() && $file->getFilename() === $filename) {
                return $file->getPathname();
            }
        }

        return null;
    }

    /**
     * Resolve cache-busting version for a local plugin asset.
     * Falls back to plugin VERSION if file is missing or mtime unavailable.
     *
     * @param string $relative_path Path relative to plugin root (e.g. "kalkulator/js/app.js")
     * @return string
     */
    private function get_local_asset_version($relative_path) {
        $relative = ltrim((string) $relative_path, "/\\");
        if ($relative === '') {
            return (string) self::VERSION;
        }

        $normalized = str_replace(array('/', '\\'), DIRECTORY_SEPARATOR, $relative);
        $absolute = $this->plugin_path . $normalized;

        if (!is_file($absolute)) {
            return (string) self::VERSION;
        }

        $mtime = @filemtime($absolute);
        if ($mtime === false || $mtime <= 0) {
            return (string) self::VERSION;
        }

        return (string) $mtime;
    }

    /**
     * Enqueue zasobów kalkulatora
     *
     * @param bool $force Wymuś enqueue nawet jeżeli shortcode nie został wykryty
     */
    private function enqueue_calculator_assets($force = false) {
        // Zapobiegaj wielokrotnemu enqueue (WordPress automatycznie zapobiega duplikatom)
        static $enqueued = false;
        if ($enqueued && !$force) {
            return; // WordPress już zapobiega duplikatom
        }
        // Jeżeli $force = true, pozwól na ponowne enqueue (dla Elementora)
        // WordPress i tak zapobiega duplikatom przez handle, więc można wywołać wielokrotnie
        $enqueued = true;
        // Jesteśmy już w main/, więc ścieżki są bezpośrednie (z ukośnikiem na początku)
        $kalkulator_url = $this->base_url . '/kalkulator';
        $konfigurator_url = $this->base_url . '/konfigurator';
        $img_url = $this->base_url . '/img';
        $libraries_url = $this->base_url . '/libraries';

        // Preconnect i DNS prefetch (tylko raz, bez hardcoded domen)
        static $head_hints_added = false;
        if (!$head_hints_added) {
            $head_hints_added = true;
            add_action('wp_head', function() {
                echo '<link rel="preconnect" href="https://fonts.googleapis.com" />' . "\n";
                echo '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />' . "\n";
                echo '<link rel="dns-prefetch" href="https://cdnjs.cloudflare.com" />' . "\n";
                echo '<link rel="dns-prefetch" href="https://unpkg.com" />' . "\n";
            }, 1);
        }

        // Fonty i ikony
        wp_enqueue_style('heatpump-fonts', 'https://fonts.googleapis.com/css2?family=Titillium+Web:wght@300;400;600;700&display=swap', [], null);
        wp_enqueue_style('heatpump-fontawesome', 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css', [], '6.0.0');
        wp_enqueue_style('heatpump-remixicon', 'https://cdn.jsdelivr.net/npm/remixicon@3.5.0/fonts/remixicon.css', [], '3.5.0');

        // WordPress/Elementor integration styles (MUSI być pierwszy - reset layoutu)
        wp_enqueue_style(
            'heatpump-wordpress-integration',
            $kalkulator_url . '/css/wordpress-integration.css',
            [],
            $this->get_local_asset_version('kalkulator/css/wordpress-integration.css')
        );

        // Lokalne style kalkulatora
        wp_enqueue_style(
            'heatpump-main',
            $kalkulator_url . '/css/main.css',
            ['heatpump-wordpress-integration'],
            $this->get_local_asset_version('kalkulator/css/main.css')
        );
        wp_enqueue_style(
            'heatpump-error',
            $kalkulator_url . '/css/error-system.css',
            ['heatpump-main'],
            $this->get_local_asset_version('kalkulator/css/error-system.css')
        );
        wp_enqueue_style(
            'heatpump-onboarding',
            $kalkulator_url . '/css/onboarding-modal.css',
            ['heatpump-main'],
            $this->get_local_asset_version('kalkulator/css/onboarding-modal.css')
        );
        wp_enqueue_style(
            'heatpump-workflow',
            $kalkulator_url . '/css/workflow-system.css',
            ['heatpump-main'],
            $this->get_local_asset_version('kalkulator/css/workflow-system.css')
        );
        wp_enqueue_style(
            'heatpump-mobile',
            $kalkulator_url . '/css/mobile-redesign.css',
            ['heatpump-main'],
            $this->get_local_asset_version('kalkulator/css/mobile-redesign.css')
        );

        // Style konfiguratora (z zależnościami dla poprawnej kolejności)
        wp_enqueue_style(
            'heatpump-configurator',
            $konfigurator_url . '/configurator.css',
            ['heatpump-main'],
            $this->get_local_asset_version('konfigurator/configurator.css')
        );
        wp_enqueue_style(
            'heatpump-configurator-v2',
            $konfigurator_url . '/configurator-v2-flat.css',
            ['heatpump-configurator'],
            $this->get_local_asset_version('konfigurator/configurator-v2-flat.css')
        );

        // Biblioteki zewnętrzne
        wp_enqueue_script('heatpump-phosphor-icons', 'https://unpkg.com/@phosphor-icons/web', [], null, false);
        wp_enqueue_script(
            'heatpump-html2pdf',
            $libraries_url . '/html2pdf.bundle.min.js',
            [],
            $this->get_local_asset_version('libraries/html2pdf.bundle.min.js'),
            true
        );
        wp_enqueue_script(
            'heatpump-html2canvas',
            $libraries_url . '/html2canvas.min.js',
            [],
            $this->get_local_asset_version('libraries/html2canvas.min.js'),
            true
        );
        wp_enqueue_script(
            'heatpump-jspdf',
            $libraries_url . '/jspdf.umd.min.js',
            [],
            $this->get_local_asset_version('libraries/jspdf.umd.min.js'),
            true
        );

        // Skrypty kalkulatora (w odpowiedniej kolejności)
        $scripts = array(
            'elementor-fix.js',
            'logger.js',
            'frontend/api/traceId.js',
            // MUST be early: provides createScopedDom + hpQs/hpQsa/hpById used across modules
            'scopedDom.js',
            'gdpr-compliance.js',
            'tooltipSystem.js',
            'floorRenderer.js',
            'urlManager.js',
            'state.js',
            'uiSummary.js',
            'offerProjection/core.js',
            'offerProjection/summary.js',
            'offerProjection/resultsHeader.js',
            'offerProjection/document.js',
            'offerProjection/email.js',
            'offerProjection/index.js',
            // Canonical offer payload + analytics + last screen controller
            'offerPayload.js',
            'analytics.js',
            'rules.js',
            'visibility.js',
            'enablement.js',
            'render.js',
            'engine.js',
            'progressiveDisclosure.js',
            'formDataProcessor.js',
            'frontend/api/mapUiStateToCalcRequestDTO.js',
            'topinstalApi.js',
            'apiCaller.js',
            'pdfLeadGate.js',
            'downloadPDF.js',
            'pdfGenerator.js',
            'emailSender.js',
            'aiWatchers.js',
            'errorHandler.js',
            'onboardingSystem.js',
            'workflowController.js',
            'pumpMatchingTable.js',
            'offerSummary.js',
            'resultsRenderer.js',
            'tabNavigation.js',
            'calculatorUI.js',
            'motionSystem.js',
            'mobileController.js',
            'calculatorInit.js'
        );

        // Na końcu enqueue usuń znane, problematyczne style Elementor powodujące błędy w konsoli.
        // Wywołanie jest idempotentne i działa także, gdy Elementor doładowuje CSS później (mamy hooki Elementor).
        $this->maybe_dequeue_noisy_elementor_widget_styles();

        // HEATPUMP_CONFIG must print before any calculator script executes.
        wp_register_script('heatpump-runtime-config', '', array(), self::VERSION, true);
        wp_enqueue_script('heatpump-runtime-config');

        // Konfigurator (musi być znany zanim inne skrypty dadzą go w deps)
        wp_enqueue_script(
            'heatpump-configurator',
            $konfigurator_url . '/configurator-unified.js',
            array('heatpump-runtime-config', 'heatpump-motionSystem', 'heatpump-pumpMatchingTable'),
            $this->get_local_asset_version('konfigurator/configurator-unified.js'),
            true
        );

        $dependencies = array('heatpump-runtime-config');
        foreach ($scripts as $script) {
            $handle = 'heatpump-' . str_replace(array('/', '.js'), array('-', ''), $script);
            if (strpos($script, 'frontend/') === 0) {
                $relative_script_path = $script;
            } else {
                $relative_script_path = strpos($script, 'engine/') === 0
                    ? 'kalkulator/' . $script
                    : 'kalkulator/js/' . $script;
            }
            $path = $this->base_url . '/' . $relative_script_path;

            $deps = $dependencies;
            if ($script === 'calculatorInit.js') {
                $deps[] = 'heatpump-configurator';
            }

            wp_enqueue_script(
                $handle,
                $path,
                $deps,
                $this->get_local_asset_version($relative_script_path),
                true
            );
            $dependencies[] = $handle;
        }

        // Wstrzyknij zmienne JavaScript (użyj pierwszego skryptu jako dependency)
        // Dodaj wszystkie potrzebne URL-e dla kompatybilności WordPress
        $upload_dir = wp_upload_dir();
        // email-proxy.php nie jest częścią repozytorium — opcjonalny skrypt w katalogu głównym WordPressa (ABSPATH).
        // URL domyślny: site_url/email-proxy.php; nadpisanie: filtr topinstal_email_proxy_url.
        $email_proxy_url = $this->get_runtime_proxy_url('email-proxy.php', 'topinstal_email_proxy_url');
        $email_proxy_available = $this->is_runtime_proxy_available('email-proxy.php');
        $rest_cookie_auth_enabled = function_exists('is_user_logged_in') && is_user_logged_in();
        $skip_pdf_lead_gate = $this->is_pdf_lead_gate_bypass_requested();
        wp_localize_script('heatpump-runtime-config', 'HEATPUMP_CONFIG', array(
            'baseUrl' => $this->base_url,
            'pluginVersion' => self::VERSION,
            'uiVersion' => self::VERSION,
            'kalkulatorUrl' => $kalkulator_url,
            'konfiguratorUrl' => $konfigurator_url,
            'bufferRules' => $this->get_frontend_buffer_rules(),
            'imgUrl' => $img_url,
            'librariesUrl' => $libraries_url,
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('heatpump_calc_nonce'),
            'restNonce' => $rest_cookie_auth_enabled ? wp_create_nonce('wp_rest') : '',
            'restCookieAuthEnabled' => $rest_cookie_auth_enabled,
            'useBackendCalc' => $this->is_backend_calc_enabled(),
            'calculateOfferEndpoint' => $this->get_calculate_offer_endpoint(),
            'calculateOfferTimeoutMs' => 15000,
            'offerDocumentEndpoint' => admin_url('admin-ajax.php'),
            'offerDocumentAction' => 'heatpump_generate_offer_document',
            'offerDocumentTimeoutMs' => 150000,
            // DEV-only migration helper: backend vs legacy comparison (default off)
            'dualRunDev' => (defined('HEATPUMP_DUAL_RUN_DEV') && HEATPUMP_DUAL_RUN_DEV) ? true : false,
            'dualRunToleranceKw' => 0.2,
            'dualRunToleranceGross' => 100,
            'dualRunDebugEnabled' => (defined('WP_DEBUG') && WP_DEBUG && current_user_can('manage_options')) ? true : false,
            'dualRunDebugAction' => 'heatpump_dual_run_log',
            'dualRunDebugEndpoint' => admin_url('admin-ajax.php'),
            'trackEventAction' => 'heatpump_track_event',
            'trackEventEndpoint' => admin_url('admin-ajax.php'),
            'trackEventBatchSize' => 10,
            'trackEventFlushMs' => 5000,
            'skipPdfLeadGate' => $skip_pdf_lead_gate,
            // Dynamiczne URLi zamiast hardcoded
            'siteUrl' => get_site_url(),
            'emailProxyUrl' => $email_proxy_url,
            'emailProxyAvailable' => $email_proxy_available,
            'uploadsUrl' => trailingslashit($upload_dir['baseurl'])
        ));
        wp_add_inline_script(
            'heatpump-runtime-config',
            'window.HEATPUMP_CONFIG = Object.assign({}, window.HEATPUMP_CONFIG || {}, ' . wp_json_encode(array(
                'restCookieAuthEnabled' => (bool) $rest_cookie_auth_enabled,
                'useBackendCalc' => (bool) $this->is_backend_calc_enabled(),
                'dualRunDev' => (defined('HEATPUMP_DUAL_RUN_DEV') && HEATPUMP_DUAL_RUN_DEV) ? true : false,
                'dualRunDebugEnabled' => (defined('WP_DEBUG') && WP_DEBUG && current_user_can('manage_options')) ? true : false,
            )) . ');',
            'after'
        );
    }

    /**
     * Renderowanie kalkulatora (shortcode)
     *
     * @param array $atts Atrybuty shortcode
     * @return string HTML kalkulatora
     */
    public function render_calculator($atts = array()) {
        // Atrybuty shortcode
        $atts = shortcode_atts(array(
            'mode' => 'full', // full, calculator-only, configurator-only
        ), $atts, 'heatpump_calc');

        // Sprawdź czy plik istnieje - spróbuj różnych ścieżek
        // Jesteśmy już w main/, więc ścieżki są bezpośrednie
        $possible_paths = array(
            $this->plugin_path . 'kalkulator/calculator.php',
            $this->plugin_path . '/kalkulator/calculator.php',
            plugin_dir_path(__FILE__) . 'kalkulator/calculator.php',
            plugin_dir_path(__FILE__) . '/kalkulator/calculator.php',
            dirname(__FILE__) . '/kalkulator/calculator.php',
        );

        // Jeżeli żadna ścieżka nie działa, spróbuj znaleźć plik rekurencyjnie
        $calculator_file = null;
        foreach ($possible_paths as $path) {
            if (file_exists($path)) {
                $calculator_file = $path;
                break;
            }
        }

        // Ostatnia deska ratunku: znajdź plik rekurencyjnie w katalogu wtyczki
        if (!$calculator_file) {
            $found_file = $this->find_file_recursive($this->plugin_path, 'calculator.php');
            if ($found_file && strpos($found_file, 'kalkulator') !== false) {
                $calculator_file = $found_file;
            }
        }

        if (!$calculator_file) {
            // Debug: pokaż wszystkie możliwe ścieżki
            $debug_info = '<div class="heatpump-error">';
            $debug_info .= '<p><strong>Błąd: Nie znaleziono pliku kalkulatora.</strong></p>';
            $debug_info .= '<p>Sprawdzane ścieżki:</p><ul>';
            foreach ($possible_paths as $path) {
                $exists = file_exists($path) ? 'ISTNIEJE' : 'NIE ISTNIEJE';
                $debug_info .= '<li>' . esc_html($path) . ' - ' . $exists . '</li>';
            }
            $debug_info .= '</ul>';
            $debug_info .= '<p><strong>Plugin path:</strong> ' . esc_html($this->plugin_path) . '</p>';
            $debug_info .= '<p><strong>Plugin dir:</strong> ' . esc_html(plugin_dir_path(__FILE__)) . '</p>';
            $debug_info .= '<p><strong>File dir:</strong> ' . esc_html(dirname(__FILE__)) . '</p>';
            $debug_info .= '</div>';
            return $debug_info;
        }

        // Przygotuj zmienne do przekazania do calculator.php
        // Jesteśmy już w main/, więc ścieżki są bezpośrednie (z ukośnikiem na początku)
        $kalkulator_url = $this->base_url . '/kalkulator';
        $konfigurator_url = $this->base_url . '/konfigurator';
        $img_url = $this->base_url . '/img';
        $libraries_url = $this->base_url . '/libraries';

        // Zawsze załaduj zasoby (na wypadek gdyby enqueue nie zadziałał)
        // To jest szczególnie ważne dla Elementora, który może renderować shortcode asynchronicznie
        $this->enqueue_calculator_assets(true);

        // Rozpocznij buforowanie outputu
        ob_start();

        // Włącz calculator.php z przekazanymi zmiennymi
        include $calculator_file;

        // Pobierz zawartość z bufora
        $output = ob_get_clean();

        // Jeżeli output jest pusty, zwróć komunikat błędu
        if (empty($output)) {
            return '<div class="heatpump-error"><p>Błąd: Kalkulator nie wygenerował treści. Sprawdź logi błędów PHP.</p></div>';
        }

        return $output;
    }
}

/**
 * Inicjalizacja wtyczki
 */
function heatpump_calculator_init() {
    return HeatPump_Calculator::get_instance();
}

// Uruchom wtyczkę
add_action('plugins_loaded', 'heatpump_calculator_init');
