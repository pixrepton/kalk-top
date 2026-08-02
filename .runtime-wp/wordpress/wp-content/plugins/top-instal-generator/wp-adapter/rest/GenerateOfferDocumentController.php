<?php

if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists('TopInstal_GenerateOfferDocument_Controller')) {
    class TopInstal_GenerateOfferDocument_Controller {
        const NAMESPACE = 'topinstal/v1';
        const ROUTE = '/offer-documents/generate';
        const RATE_LIMIT_WINDOW_SECONDS = 60;
        const RATE_LIMIT_MAX_REQUESTS = 30;

        /**
         * @return void
         */
        public static function register_routes() {
            register_rest_route(
                self::NAMESPACE,
                self::ROUTE,
                array(
                    'methods' => WP_REST_Server::CREATABLE,
                    'callback' => array(__CLASS__, 'generate_document'),
                    'permission_callback' => array(__CLASS__, 'permission_callback'),
                )
            );
        }

        /**
         * @param WP_REST_Request $request
         * @return bool
         */
        public static function permission_callback($request) {
            return true;
        }

        /**
         * @param WP_REST_Request $request
         * @return WP_REST_Response
         */
        public static function generate_document($request) {
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

            $errors = TopInstal_OfferDocumentRequest_Validator::validate($body);
            if (!empty($errors)) {
                $response = TopInstal_RestErrors::response(
                    400,
                    $trace_id,
                    TopInstal_DocumentReasonCodes::VALIDATION_ERROR,
                    'Invalid OfferDocumentRequestDTO payload.',
                    array('errors' => $errors)
                );
                self::apply_trace_header($response, $trace_id);
                self::apply_rate_limit_headers($response, $rate);
                self::emit_document_failed($trace_id, $body, TopInstal_DocumentReasonCodes::VALIDATION_ERROR, 400);
                return $response;
            }

            if (!is_array($body)) {
                $body = array();
            }
            $body['traceId'] = $trace_id;

            try {
                $use_case = new TopInstal_GenerateOfferDocument_UseCase();
                $result = $use_case->execute($body);
            } catch (TopInstal_OfferDocument_Exception $e) {
                self::emit_document_failed($trace_id, $body, $e->get_error_code(), $e->get_status());
                $response = TopInstal_RestErrors::response(
                    $e->get_status(),
                    $trace_id,
                    $e->get_error_code(),
                    $e->getMessage(),
                    $e->get_details()
                );
                self::apply_trace_header($response, $trace_id);
                self::apply_rate_limit_headers($response, $rate);
                return $response;
            } catch (Throwable $e) {
                TopInstal_Logger_Wp::error('offer-documents generate failed', array(
                    'traceId' => $trace_id,
                    'message' => $e->getMessage(),
                ));
                self::emit_document_failed($trace_id, $body, 'DOCUMENT_GENERATION_FAILED', 500);
                $details = array();
                if (defined('WP_DEBUG') && WP_DEBUG) {
                    $details['exception'] = $e->getMessage();
                }
                $response = TopInstal_RestErrors::response(
                    500,
                    $trace_id,
                    'DOCUMENT_GENERATION_FAILED',
                    'Offer document generation failed on server.',
                    $details
                );
                self::apply_trace_header($response, $trace_id);
                self::apply_rate_limit_headers($response, $rate);
                return $response;
            }

            $duration_ms = (int) round((microtime(true) - $started_at) * 1000);
            TopInstal_Logger_Wp::info('offer-documents generate completed', array(
                'traceId' => $trace_id,
                'durationMs' => $duration_ms,
                'format' => isset($result['document']['format']) ? $result['document']['format'] : '',
            ));

            $response = new WP_REST_Response($result, 200);
            self::apply_trace_header($response, $trace_id);
            self::apply_rate_limit_headers($response, $rate);
            return $response;
        }

        /**
         * @param WP_REST_Request $request
         * @param string $trace_id
         * @param array<string,mixed> &$rate
         * @return WP_REST_Response|null
         */
        private static function apply_request_gate($request, $trace_id, &$rate) {
            $auth = self::verify_auth($request);
            if (empty($auth['ok'])) {
                $response = TopInstal_RestErrors::response(
                    isset($auth['status']) ? (int) $auth['status'] : 401,
                    $trace_id,
                    isset($auth['errorCode']) ? (string) $auth['errorCode'] : TopInstal_DocumentReasonCodes::AUTH_REQUIRED,
                    isset($auth['message']) ? (string) $auth['message'] : 'Authorization required.'
                );
                self::apply_trace_header($response, $trace_id);
                return $response;
            }

            $rate = self::consume_rate_limit($request);
            if (!empty($rate['limited'])) {
                $response = TopInstal_RestErrors::response(
                    429,
                    $trace_id,
                    TopInstal_DocumentReasonCodes::RATE_LIMITED,
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
         * @param WP_REST_Request $request
         * @return array<string,mixed>
         */
        private static function verify_auth($request) {
            $agent_key_header = trim((string) $request->get_header('X-Top-Instal-Agent-Key'));
            if ($agent_key_header === '') {
                $agent_key_header = trim((string) $request->get_header('X-Topinstal-Agent-Key'));
            }

            $config = new TopInstal_Generator_Config_Wp();
            $expected_agent_key = trim((string) $config->get_agent_api_key());

            if ($agent_key_header !== '') {
                if ($expected_agent_key !== '' && hash_equals($expected_agent_key, $agent_key_header)) {
                    return array('ok' => true, 'type' => 'agent-key');
                }
                return array(
                    'ok' => false,
                    'status' => 403,
                    'errorCode' => TopInstal_DocumentReasonCodes::AGENT_KEY_INVALID,
                    'message' => 'Agent key is invalid.',
                );
            }

            if (self::verify_nonce($request)) {
                return array('ok' => true, 'type' => 'nonce');
            }

            return array(
                'ok' => false,
                'status' => 401,
                'errorCode' => TopInstal_DocumentReasonCodes::AUTH_REQUIRED,
                'message' => 'Provide valid nonce or X-Top-Instal-Agent-Key.',
            );
        }

        /**
         * @param WP_REST_Request $request
         * @return bool
         */
        private static function verify_nonce($request) {
            $nonce = (string) $request->get_header('X-Topinstal-Nonce');
            if ($nonce === '') {
                $nonce = (string) $request->get_header('X-WP-Nonce');
            }
            if ($nonce === '') {
                $nonce = (string) $request->get_param('nonce');
            }
            if ($nonce === '') {
                return false;
            }
            if (!function_exists('wp_verify_nonce')) {
                return true;
            }
            return (bool) (wp_verify_nonce($nonce, 'top_instal_nonce') || wp_verify_nonce($nonce, 'wp_rest'));
        }

        /**
         * @param WP_REST_Request $request
         * @return array<string,mixed>
         */
        private static function consume_rate_limit($request) {
            $key = 'top_instal_docs_rate_' . md5(self::get_client_ip($request));
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
         * @return int
         */
        private static function get_rate_limit_window_seconds() {
            $value = self::RATE_LIMIT_WINDOW_SECONDS;
            if (function_exists('apply_filters')) {
                $value = (int) apply_filters('topinstal_offer_documents_rate_limit_window', $value);
            }
            return max(1, $value);
        }

        /**
         * @return int
         */
        private static function get_rate_limit_max_requests() {
            $value = self::RATE_LIMIT_MAX_REQUESTS;
            if (function_exists('apply_filters')) {
                $value = (int) apply_filters('topinstal_offer_documents_rate_limit_max_requests', $value);
            }
            return max(1, $value);
        }

        /**
         * @param WP_REST_Request $request
         * @return string
         */
        private static function get_client_ip($request) {
            $remote_addr = isset($_SERVER['REMOTE_ADDR']) ? trim((string) $_SERVER['REMOTE_ADDR']) : '';
            if ($remote_addr !== '' && filter_var($remote_addr, FILTER_VALIDATE_IP)) {
                return $remote_addr;
            }
            $forwarded = (string) $request->get_header('X-Forwarded-For');
            foreach (explode(',', $forwarded) as $part) {
                $candidate = trim((string) $part);
                if ($candidate !== '' && filter_var($candidate, FILTER_VALIDATE_IP)) {
                    return $candidate;
                }
            }
            return '0.0.0.0';
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
         * @param string $trace_id
         * @param array<string,mixed>|null $body
         * @param string $error_code
         * @param int $http_status
         * @return void
         */
        private static function emit_document_failed($trace_id, $body, $error_code, $http_status) {
            if (!class_exists('TopInstal_Generator_OsEvent_Client')) {
                return;
            }

            $engagement_id = '';
            if (is_array($body)) {
                if (isset($body['engagementId'])) {
                    $engagement_id = trim((string) $body['engagementId']);
                } elseif (isset($body['engagement_id'])) {
                    $engagement_id = trim((string) $body['engagement_id']);
                }
            }

            TopInstal_Generator_OsEvent_Client::emit(
                'generator.document.failed',
                'Generator: utworzenie dokumentu nie powiodło się',
                'error',
                $engagement_id,
                array(
                    'trace_id' => $trace_id,
                    'error_code' => (string) $error_code,
                    'http_status' => (int) $http_status,
                ),
                array(
                    'trace_id' => $trace_id,
                )
            );
        }
    }
}
