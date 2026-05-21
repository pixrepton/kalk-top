<?php

if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists('TopInstal_Agent_HealthcheckService')) {
    /**
     * Backend-only healthchecks for services still owned by kalk-top.
     */
    class TopInstal_Agent_HealthcheckService {
        /**
         * @return array<string,mixed>
         */
        public function run_all() {
            return array(
                'checkedAt' => gmdate('c'),
                'generator' => $this->check_generator(),
                'converter' => $this->check_converter(),
            );
        }

        /**
         * @return array<string,mixed>
         */
        public function check_generator() {
            $summary = array();
            $endpoint = '';
            $auth_key = '';
            $timeout = 20;

            if (class_exists('TopInstal_MailIngressWorkflowConfig')) {
                $config = new TopInstal_MailIngressWorkflowConfig();
                $summary = $config->get_generator_debug_summary();
                $endpoint = isset($summary['resolvedEndpoint']) ? trim((string) $summary['resolvedEndpoint']) : '';
                $auth_key = trim((string) $config->get_generator_key());
                $timeout = isset($summary['timeoutSeconds']) ? max(5, (int) $summary['timeoutSeconds']) : (int) $config->get_generator_timeout();
            }

            if ($endpoint === '') {
                $endpoint = $this->get_string_config('topinstal_agent_offer_documents_endpoint', 'TOPINSTAL_AGENT_OFFER_DOCUMENTS_ENDPOINT', '');
            }
            if ($endpoint === '') {
                $endpoint = $this->get_string_config('topinstal_agent_pdf_direct_endpoint', 'TOPINSTAL_AGENT_PDF_DIRECT_ENDPOINT', '');
            }
            if ($endpoint === '') {
                return array(
                    'ok' => false,
                    'status' => 'ENDPOINT_MISSING',
                    'detail' => 'Missing generator endpoint.',
                    'summary' => $summary,
                );
            }

            if ($auth_key === '') {
                $key_bundle = class_exists('TopInstal_Agent_SecretStore')
                    ? TopInstal_Agent_SecretStore::get_bundle(
                        'topinstal_agent_offer_documents_key',
                        'TOPINSTAL_AGENT_OFFER_DOCUMENTS_KEY',
                        '',
                        'topinstal_agent_offer_documents_agent_key',
                        'TOPINSTAL_AGENT_OFFER_DOCUMENTS_AGENT_KEY'
                    )
                    : array('active' => '');
                $auth_key = isset($key_bundle['active']) ? (string) $key_bundle['active'] : '';
                if ($auth_key === '') {
                    $fallback = $this->get_string_config('top_instal_agent_api_key', 'TOP_INSTAL_AGENT_API_KEY', '');
                    if ($fallback !== '') {
                        $auth_key = $fallback;
                    }
                }
            }
            if ($auth_key === '') {
                return array(
                    'ok' => false,
                    'status' => 'KEY_MISSING',
                    'detail' => 'Missing generator key.',
                    'summary' => $summary,
                );
            }

            $payload = array(
                'schemaVersion' => '1.0',
                'traceId' => 'backend-health-' . substr(md5((string) microtime(true)), 0, 10),
                'mode' => 'from-offer-dto',
                'outputFormat' => 'pdf',
            );
            $headers = array(
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
            );
            if ($auth_key !== '') {
                $headers['X-Top-Instal-Agent-Key'] = $auth_key;
                $headers['Authorization'] = 'Bearer ' . $auth_key;
            }

            $response = wp_remote_post($endpoint, array(
                'timeout' => $timeout,
                'headers' => $headers,
                'body' => wp_json_encode($payload),
            ));

            if (is_wp_error($response)) {
                return array('ok' => false, 'status' => 'UNREACHABLE', 'detail' => 'Transport error.', 'summary' => $summary);
            }

            $status = (int) wp_remote_retrieve_response_code($response);
            $body = (string) wp_remote_retrieve_body($response);
            $decoded = json_decode($body, true);
            $error_code = is_array($decoded) && isset($decoded['errorCode']) ? (string) $decoded['errorCode'] : '';
            $response_status = is_array($decoded) && isset($decoded['status']) ? (string) $decoded['status'] : '';

            if ($status === 401 || $status === 403) {
                return array('ok' => false, 'status' => 'AUTH_FAIL', 'detail' => $error_code !== '' ? $error_code : ('HTTP_' . $status), 'summary' => $summary);
            }

            if ($status === 404) {
                return array('ok' => false, 'status' => 'NOT_FOUND', 'detail' => 'HTTP_404', 'summary' => $summary);
            }

            if ($status === 400 && $error_code === 'VALIDATION_ERROR') {
                return array('ok' => true, 'status' => 'AUTH_OK_VALIDATION_OK', 'detail' => 'Generator auth ok, payload validation responded as expected.', 'summary' => $summary);
            }

            if ($status >= 200 && $status < 300 && $response_status === 'success') {
                return array('ok' => true, 'status' => 'OK', 'detail' => 'Generator reachable and accepted request.', 'summary' => $summary);
            }

            return array('ok' => false, 'status' => 'HTTP_FAIL', 'detail' => 'HTTP_' . $status, 'summary' => $summary);
        }

        /**
         * @return array<string,mixed>
         */
        public function check_converter() {
            $url = $this->get_string_config('top_instal_pdf_converter_url', 'TOP_INSTAL_PDF_CONVERTER_URL', '');
            if ($url === '') {
                return array('ok' => false, 'status' => 'NOT_CONFIGURED', 'detail' => 'Missing converter URL.');
            }

            $token = $this->get_string_config('top_instal_pdf_converter_token', 'TOP_INSTAL_PDF_CONVERTER_TOKEN', '');
            $headers = array('Accept' => '*/*');
            if ($token !== '') {
                $headers['Authorization'] = 'Bearer ' . $token;
            }

            $response = wp_remote_get($url, array(
                'timeout' => 15,
                'headers' => $headers,
            ));
            if (is_wp_error($response)) {
                return array('ok' => false, 'status' => 'UNREACHABLE', 'detail' => 'Transport error.');
            }

            $status = (int) wp_remote_retrieve_response_code($response);
            $ok = $status > 0 && $status < 500;
            return array(
                'ok' => $ok,
                'status' => $ok ? 'PING_OK' : 'PING_FAIL',
                'detail' => 'HTTP_' . $status,
            );
        }

        /**
         * @param string $option_name
         * @param string $const_name
         * @param string $default
         * @return string
         */
        private function get_string_config($option_name, $const_name, $default = '') {
            if (defined($const_name)) {
                $value = constant($const_name);
                if (is_string($value) && trim($value) !== '') {
                    return trim($value);
                }
            }

            $env = getenv($const_name);
            if (is_string($env) && trim($env) !== '') {
                return trim($env);
            }

            $option = get_option($option_name, '');
            if (is_string($option) && trim($option) !== '') {
                return trim($option);
            }

            return (string) $default;
        }
    }
}
