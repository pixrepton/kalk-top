<?php

if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists('TopInstal_CalculateOffer_Controller')) {
    /**
     * REST controller skeleton for variant B migration.
     */
    class TopInstal_CalculateOffer_Controller {
        const NAMESPACE = 'topinstal/v1';
        const ROUTE = '/calculate-offer';
        const RATE_LIMIT_WINDOW_SECONDS = 60;
        const RATE_LIMIT_MAX_REQUESTS = 45;

        /**
         * Register REST routes.
         *
         * @return void
         */
        public static function register_routes() {
            register_rest_route(
                self::NAMESPACE,
                self::ROUTE,
                array(
                    'methods' => WP_REST_Server::CREATABLE,
                    'callback' => array(__CLASS__, 'calculate_offer'),
                    'permission_callback' => array(__CLASS__, 'permission_callback'),
                )
            );
        }

        /**
         * Permission callback intentionally delegates auth/rate checks to calculate_offer()
         * to preserve a stable custom error contract (TopInstal_RestErrors::response).
         *
         * @param WP_REST_Request $request
         * @return bool
         */
        public static function permission_callback($request) {
            return true;
        }

        /**
         * Endpoint callback.
         *
         * @param WP_REST_Request $request
         * @return WP_REST_Response
         */
        public static function calculate_offer($request) {
            $started_at = microtime(true);
            $body = $request->get_json_params();
            $trace_id = topinstal_ensure_trace_id(
                is_array($body) && isset($body['traceId']) ? $body['traceId'] : null
            );
            $rate = array();

            $gate_response = self::apply_request_gate($request, $trace_id, $rate);
            if (is_object($gate_response)) {
                return $gate_response;
            }

            $errors = TopInstal_CalcRequest_Validator::validate($body);
            if (!empty($errors)) {
                TopInstal_Logger_Wp::warn('CalcRequestDTO validation failed.', array(
                    'traceId' => $trace_id,
                    'errors' => $errors,
                ));

                $response = TopInstal_RestErrors::response(
                    400,
                    $trace_id,
                    'VALIDATION_ERROR',
                    'Invalid CalcRequestDTO payload.',
                    array('errors' => $errors)
                );
                self::apply_trace_header($response, $trace_id);
                self::apply_rate_limit_headers($response, $rate);
                return $response;
            }

            if (!is_array($body)) {
                $body = array();
            }
            $body['traceId'] = $trace_id;

            try {
                $use_case = self::build_use_case();
                $offer = $use_case->execute($body);
            } catch (Throwable $exception) {
                $details = array();
                if (defined('WP_DEBUG') && WP_DEBUG) {
                    $details['exception'] = $exception->getMessage();
                }
                TopInstal_Logger_Wp::error('calculate-offer execution failed.', array(
                    'traceId' => $trace_id,
                    'message' => $exception->getMessage(),
                ));
                $response = TopInstal_RestErrors::response(
                    500,
                    $trace_id,
                    'CALCULATION_FAILED',
                    'Calculation failed on server.',
                    $details
                );
                self::apply_trace_header($response, $trace_id);
                self::apply_rate_limit_headers($response, $rate);
                return $response;
            }

            $duration_ms = (int) round((microtime(true) - $started_at) * 1000);
            TopInstal_Logger_Wp::info('calculate-offer completed.', array(
                'traceId' => $trace_id,
                'durationMs' => $duration_ms,
            ));

            self::persist_form_state_snapshot($body, is_array($offer) ? $offer : array());

            $response = new WP_REST_Response($offer, 200);
            self::apply_trace_header($response, $trace_id);
            self::apply_rate_limit_headers($response, $rate);
            return $response;
        }

        /**
         * Apply request gates in stable order:
         * nonce -> rate limit.
         *
         * @param WP_REST_Request $request
         * @param string $trace_id
         * @param array<string,mixed> &$rate
         * @return WP_REST_Response|null
         */
        private static function apply_request_gate($request, $trace_id, &$rate) {
            $auth = self::verify_auth($request);
            if (empty($auth['ok'])) {
                TopInstal_Logger_Wp::warn('calculate-offer auth verification failed.', array(
                    'traceId' => $trace_id,
                    'authError' => isset($auth['errorCode']) ? (string) $auth['errorCode'] : 'AUTH_REQUIRED',
                ));
                $response = TopInstal_RestErrors::response(
                    isset($auth['status']) ? (int) $auth['status'] : 401,
                    $trace_id,
                    isset($auth['errorCode']) ? (string) $auth['errorCode'] : 'AUTH_REQUIRED',
                    isset($auth['message']) ? (string) $auth['message'] : 'Authorization required.'
                );
                self::apply_trace_header($response, $trace_id);
                return $response;
            }

            $rate = self::consume_rate_limit($request);
            if (!empty($rate['limited'])) {
                TopInstal_Logger_Wp::warn('calculate-offer rate limit exceeded.', array(
                    'traceId' => $trace_id,
                    'ip' => self::get_client_ip($request),
                ));
                $response = TopInstal_RestErrors::response(
                    429,
                    $trace_id,
                    'RATE_LIMITED',
                    'Too many requests. Please retry in a moment.'
                );
                self::apply_trace_header($response, $trace_id);
                self::apply_rate_limit_headers($response, $rate);
                if (!empty($rate['retryAfter'])) {
                    $response->header('Retry-After', (string) ((int) $rate['retryAfter']));
                }
                return $response;
            }

            return null;
        }

        /**
         * @return TopInstal_CalculateOffer_UseCase
         */
        private static function build_use_case() {
            return new TopInstal_CalculateOffer_UseCase(
                new TopInstal_PriceBookRepository_Wp(),
                new TopInstal_BufferRulesRepository_Wp(),
                new TopInstal_SelectionRulesRepository_Wp(),
                new TopInstal_Logger_Wp()
            );
        }

        /**
         * @param WP_REST_Request $request
         * @return array<string,mixed>
         */
        private static function verify_nonce($request) {
            $nonce = (string) $request->get_header('X-WP-Nonce');
            if ($nonce === '') {
                $nonce = (string) $request->get_header('X-Topinstal-Nonce');
            }
            if ($nonce === '') {
                $nonce = (string) $request->get_param('nonce');
            }
            if ($nonce === '') {
                return array(
                    'provided' => false,
                    'ok' => false,
                );
            }

            if (!function_exists('wp_verify_nonce')) {
                return array(
                    'provided' => true,
                    'ok' => true,
                );
            }

            $valid_custom = wp_verify_nonce($nonce, 'heatpump_calc_nonce');
            $valid_rest = wp_verify_nonce($nonce, 'wp_rest');

            return array(
                'provided' => true,
                'ok' => (bool) ($valid_custom || $valid_rest),
            );
        }

        /**
         * @param WP_REST_Request $request
         * @return array<string,mixed>
         */
        private static function verify_auth($request) {
            $nonce = self::verify_nonce($request);
            if (!empty($nonce['ok'])) {
                return array(
                    'ok' => true,
                    'type' => 'nonce',
                );
            }

            $agent_key_header = trim((string) $request->get_header('X-Top-Instal-Agent-Key'));
            if ($agent_key_header === '') {
                $agent_key_header = trim((string) $request->get_header('X-Topinstal-Agent-Key'));
            }

            $bundle = self::get_agent_api_key_bundle();
            if ($agent_key_header !== '') {
                if (self::matches_agent_key($agent_key_header, $bundle)) {
                    return array(
                        'ok' => true,
                        'type' => 'agent-key',
                    );
                }

                if (!empty($nonce['provided'])) {
                    return array(
                        'ok' => false,
                        'status' => 403,
                        'errorCode' => 'NONCE_INVALID',
                        'message' => 'Nonce verification failed.',
                    );
                }

                return array(
                    'ok' => false,
                    'status' => 403,
                    'errorCode' => 'AGENT_KEY_INVALID',
                    'message' => 'Agent key is invalid.',
                );
            }

            if (!empty($nonce['provided'])) {
                return array(
                    'ok' => false,
                    'status' => 403,
                    'errorCode' => 'NONCE_INVALID',
                    'message' => 'Nonce verification failed.',
                );
            }

            return array(
                'ok' => false,
                'status' => 401,
                'errorCode' => 'AUTH_REQUIRED',
                'message' => 'Provide valid nonce or X-Top-Instal-Agent-Key.',
            );
        }

        /**
         * @return array<string,mixed>
         */
        private static function get_agent_api_key_bundle() {
            if (class_exists('TopInstal_Agent_SecretStore')) {
                $bundle = TopInstal_Agent_SecretStore::get_bundle('topinstal_calc_agent_api_key', 'TOPINSTAL_CALC_AGENT_API_KEY', '');
                if ((!isset($bundle['active']) || trim((string) $bundle['active']) === '')) {
                    $fallback = self::get_config_string('top_instal_agent_api_key', 'TOP_INSTAL_AGENT_API_KEY', '');
                    if ($fallback !== '') {
                        $bundle['active'] = $fallback;
                        $bundle['source'] = 'generator-alias';
                    }
                }
                return $bundle;
            }

            $active = self::get_config_string('topinstal_calc_agent_api_key', 'TOPINSTAL_CALC_AGENT_API_KEY', '');
            if ($active === '') {
                $active = self::get_config_string('top_instal_agent_api_key', 'TOP_INSTAL_AGENT_API_KEY', '');
            }

            return array(
                'active' => $active,
                'previous' => '',
                'previousValidUntil' => 0,
            );
        }

        /**
         * @param string $candidate
         * @param array<string,mixed> $bundle
         * @return bool
         */
        private static function matches_agent_key($candidate, $bundle) {
            $candidate = trim((string) $candidate);
            if ($candidate === '') {
                return false;
            }
            if (class_exists('TopInstal_Agent_SecretStore')) {
                return TopInstal_Agent_SecretStore::matches_any_active_or_previous($candidate, $bundle);
            }

            $active = isset($bundle['active']) ? trim((string) $bundle['active']) : '';
            if ($active !== '' && hash_equals($active, $candidate)) {
                return true;
            }
            return false;
        }

        /**
         * @param string $option_name
         * @param string $const_name
         * @param string $default
         * @return string
         */
        private static function get_config_string($option_name, $const_name, $default = '') {
            if (defined($const_name)) {
                $value = constant($const_name);
                if (is_string($value) && trim($value) !== '') {
                    return trim($value);
                }
            }

            $env_value = getenv($const_name);
            if (is_string($env_value) && trim($env_value) !== '') {
                return trim($env_value);
            }

            if (function_exists('get_option')) {
                $option = get_option($option_name, '');
                if (is_string($option) && trim($option) !== '') {
                    return trim($option);
                }
            }

            return (string) $default;
        }

        /**
         * @param WP_REST_Request $request
         * @return array<string,mixed>
         */
        private static function consume_rate_limit($request) {
            $key = 'topinstal_rate_' . md5(self::get_client_ip($request));
            $window_seconds = self::get_rate_limit_window_seconds();
            $max_requests = self::get_rate_limit_max_requests();
            $bucket = function_exists('get_transient') ? get_transient($key) : false;
            if (!is_array($bucket) || !isset($bucket['resetAt'])) {
                $bucket = array(
                    'count' => 0,
                    'resetAt' => time() + $window_seconds,
                );
            }

            $now = time();
            if ($now >= (int) $bucket['resetAt']) {
                $bucket['count'] = 0;
                $bucket['resetAt'] = $now + $window_seconds;
            }

            $count = isset($bucket['count']) ? (int) $bucket['count'] : 0;
            $reset_at = isset($bucket['resetAt']) ? (int) $bucket['resetAt'] : ($now + $window_seconds);
            $retry_after = max(0, $reset_at - $now);

            if ($count >= $max_requests) {
                return array(
                    'limited' => true,
                    'limit' => $max_requests,
                    'remaining' => 0,
                    'retryAfter' => $retry_after,
                );
            }

            $bucket['count'] = $count + 1;
            if (function_exists('set_transient')) {
                set_transient($key, $bucket, max(1, $retry_after));
            }

            return array(
                'limited' => false,
                'limit' => $max_requests,
                'remaining' => max(0, $max_requests - (int) $bucket['count']),
                'retryAfter' => max(0, ((int) $bucket['resetAt']) - time()),
            );
        }

        /**
         * @param WP_REST_Response $response
         * @param string $trace_id
         * @return void
         */
        private static function apply_trace_header($response, $trace_id) {
            if (is_object($response) && method_exists($response, 'header')) {
                $response->header('X-Topinstal-Trace-Id', (string) $trace_id);
            }
        }

        /**
         * @param WP_REST_Response $response
         * @param array<string,mixed> $rate
         * @return void
         */
        private static function apply_rate_limit_headers($response, $rate) {
            if (!is_object($response) || !method_exists($response, 'header') || !is_array($rate)) {
                return;
            }

            $limit = isset($rate['limit']) ? (int) $rate['limit'] : self::get_rate_limit_max_requests();
            $remaining = isset($rate['remaining']) ? (int) $rate['remaining'] : 0;
            $retry_after = isset($rate['retryAfter']) ? (int) $rate['retryAfter'] : 0;

            $response->header('X-RateLimit-Limit', (string) max(0, $limit));
            $response->header('X-RateLimit-Remaining', (string) max(0, $remaining));
            $response->header('X-RateLimit-Window', (string) self::get_rate_limit_window_seconds());
            $response->header('X-RateLimit-Reset-In', (string) max(0, $retry_after));
        }

        /**
         * @return int
         */
        private static function get_rate_limit_window_seconds() {
            $value = self::RATE_LIMIT_WINDOW_SECONDS;
            if (function_exists('apply_filters')) {
                $value = (int) apply_filters('topinstal_calculate_offer_rate_limit_window', $value);
            }
            if ($value < 1) $value = 1;
            return $value;
        }

        /**
         * @return int
         */
        private static function get_rate_limit_max_requests() {
            $value = self::RATE_LIMIT_MAX_REQUESTS;
            if (function_exists('apply_filters')) {
                $value = (int) apply_filters('topinstal_calculate_offer_rate_limit_max_requests', $value);
            }
            if ($value < 1) $value = 1;
            return $value;
        }

        /**
         * @param WP_REST_Request $request
         * @return string
         */
        private static function get_client_ip($request) {
            $remote_addr = self::get_remote_addr();
            if ($remote_addr !== '' && self::is_trusted_proxy_ip($remote_addr)) {
                $forwarded = (string) $request->get_header('X-Forwarded-For');
                $forwarded_ip = self::extract_forwarded_client_ip($forwarded);
                if ($forwarded_ip !== '') {
                    return $forwarded_ip;
                }
            }

            if ($remote_addr !== '') {
                return $remote_addr;
            }

            // Last-resort fallback for unusual runtimes where REMOTE_ADDR is missing.
            $forwarded_fallback = self::extract_forwarded_client_ip((string) $request->get_header('X-Forwarded-For'));
            if ($forwarded_fallback !== '') {
                return $forwarded_fallback;
            }

            return '0.0.0.0';
        }

        /**
         * @return string
         */
        private static function get_remote_addr() {
            $remote_addr = isset($_SERVER['REMOTE_ADDR']) ? (string) $_SERVER['REMOTE_ADDR'] : '';
            $remote_addr = trim($remote_addr);
            if ($remote_addr === '') {
                return '';
            }
            return filter_var($remote_addr, FILTER_VALIDATE_IP) ? $remote_addr : '';
        }

        /**
         * @param string $forwarded
         * @return string
         */
        private static function extract_forwarded_client_ip($forwarded) {
            if (!is_string($forwarded) || trim($forwarded) === '') {
                return '';
            }

            $parts = explode(',', $forwarded);
            foreach ($parts as $part) {
                $candidate = trim((string) $part);
                if ($candidate === '') {
                    continue;
                }
                if (filter_var($candidate, FILTER_VALIDATE_IP)) {
                    return $candidate;
                }
            }
            return '';
        }

        /**
         * @param string $ip
         * @return bool
         */
        private static function is_trusted_proxy_ip($ip) {
            if (!is_string($ip) || $ip === '') {
                return false;
            }

            $trusted = self::get_trusted_proxy_list();
            if (empty($trusted)) {
                return false;
            }

            foreach ($trusted as $entry) {
                if (self::ip_matches_entry($ip, $entry)) {
                    return true;
                }
            }
            return false;
        }

        /**
         * Sources:
         * - TOPINSTAL_TRUSTED_PROXIES constant (CSV or array)
         * - filter: topinstal_calculate_offer_trusted_proxies
         *
         * @return array<int,string>
         */
        private static function get_trusted_proxy_list() {
            $list = array();
            if (defined('TOPINSTAL_TRUSTED_PROXIES')) {
                $constant_value = TOPINSTAL_TRUSTED_PROXIES;
                if (is_array($constant_value)) {
                    $list = $constant_value;
                } elseif (is_string($constant_value)) {
                    $list = preg_split('/\s*,\s*/', $constant_value);
                }
            }

            if (function_exists('apply_filters')) {
                $filtered = apply_filters('topinstal_calculate_offer_trusted_proxies', $list);
                if (is_array($filtered)) {
                    $list = $filtered;
                } elseif (is_string($filtered)) {
                    $list = preg_split('/\s*,\s*/', $filtered);
                }
            }

            $normalized = array();
            foreach ((array) $list as $entry) {
                if (!is_scalar($entry)) {
                    continue;
                }
                $value = trim((string) $entry);
                if ($value === '') {
                    continue;
                }
                $normalized[] = $value;
            }
            $normalized = array_values(array_unique($normalized));

            return $normalized;
        }

        /**
         * @param string $ip
         * @param string $entry
         * @return bool
         */
        private static function ip_matches_entry($ip, $entry) {
            if (strpos($entry, '/') !== false) {
                return self::ip_in_cidr($ip, $entry);
            }

            if (!filter_var($entry, FILTER_VALIDATE_IP)) {
                return false;
            }

            return $ip === $entry;
        }

        /**
         * @param string $ip
         * @param string $cidr
         * @return bool
         */
        private static function ip_in_cidr($ip, $cidr) {
            $parts = explode('/', $cidr, 2);
            if (count($parts) !== 2) {
                return false;
            }

            $subnet = trim((string) $parts[0]);
            $prefix = trim((string) $parts[1]);

            if (!filter_var($ip, FILTER_VALIDATE_IP) || !filter_var($subnet, FILTER_VALIDATE_IP)) {
                return false;
            }
            if (!is_numeric($prefix)) {
                return false;
            }

            $ip_bin = @inet_pton($ip);
            $subnet_bin = @inet_pton($subnet);
            if (!is_string($ip_bin) || !is_string($subnet_bin)) {
                return false;
            }
            if (strlen($ip_bin) !== strlen($subnet_bin)) {
                return false;
            }

            $bits_total = strlen($ip_bin) * 8;
            $prefix_int = (int) $prefix;
            if ($prefix_int < 0 || $prefix_int > $bits_total) {
                return false;
            }

            $bytes = (int) floor($prefix_int / 8);
            $bits = $prefix_int % 8;

            if ($bytes > 0) {
                if (substr($ip_bin, 0, $bytes) !== substr($subnet_bin, 0, $bytes)) {
                    return false;
                }
            }

            if ($bits === 0) {
                return true;
            }

            $mask = chr((0xFF << (8 - $bits)) & 0xFF);
            return (ord($ip_bin[$bytes]) & ord($mask)) === (ord($subnet_bin[$bytes]) & ord($mask));
        }

        /**
         * Persist raw formEngine.state snapshot for session traceability (UPSERT by session_id).
         *
         * @param array<string,mixed> $request_body
         * @param array<string,mixed> $offer
         * @return void
         */
        private static function persist_form_state_snapshot($request_body, $offer) {
            if (!is_array($request_body)) {
                return;
            }

            if (class_exists('HeatPump_Calculator')) {
                $plugin = HeatPump_Calculator::get_instance();
                if (is_object($plugin) && method_exists($plugin, 'persist_calc_session_from_calculate_request')) {
                    $plugin->persist_calc_session_from_calculate_request($request_body, $offer);
                    return;
                }
            }

            if (!class_exists('TopInstal_CalcSessionStateRepository')) {
                return;
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
    }
}
