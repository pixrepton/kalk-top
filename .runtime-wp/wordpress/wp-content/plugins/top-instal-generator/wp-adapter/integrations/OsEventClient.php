<?php

if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists('TopInstal_Generator_OsEvent_Client')) {
    /**
     * Best-effort POST to gmail-agent Node B unified_os_events (channel A′).
     */
    class TopInstal_Generator_OsEvent_Client {
        const SOURCE_REPO = 'top-instal-generator';

        /**
         * @param string $event_type
         * @param string $summary_pl
         * @param string $status ok|warning|error
         * @param string $engagement_id
         * @param array<string,mixed> $payload_extra
         * @param array<string,mixed> $correlation
         * @return void
         */
        public static function emit(
            $event_type,
            $summary_pl,
            $status = 'ok',
            $engagement_id = '',
            $payload_extra = array(),
            $correlation = array()
        ) {
            $base = self::base_url();
            if ($base === '') {
                return;
            }

            $et = trim((string) $event_type);
            if ($et === '') {
                return;
            }

            $payload = array(
                'schema_version' => 'topinstal.os_event.v1',
                'summary_pl' => trim((string) $summary_pl) !== '' ? trim((string) $summary_pl) : $et,
                'status' => trim((string) $status) !== '' ? trim((string) $status) : 'ok',
            );
            if (is_array($payload_extra)) {
                foreach ($payload_extra as $key => $value) {
                    if ($value === null || $value === '') {
                        continue;
                    }
                    $payload[(string) $key] = $value;
                }
            }

            $body = array(
                'event_type' => $et,
                'source_repo' => self::SOURCE_REPO,
                'engagement_id' => trim((string) $engagement_id),
                'payload' => $payload,
                'correlation' => is_array($correlation) ? $correlation : array(),
            );

            $headers = array(
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
            );
            $token = self::registry_token();
            if ($token !== '') {
                $headers['Authorization'] = 'Bearer ' . $token;
            }

            $response = wp_remote_post(
                $base . '/internal/os-events',
                array(
                    'timeout' => 8,
                    'blocking' => true,
                    'headers' => $headers,
                    'body' => wp_json_encode($body),
                )
            );

            if (is_wp_error($response)) {
                if (class_exists('TopInstal_Logger_Wp')) {
                    TopInstal_Logger_Wp::warn('os_event emit transport failed.', array(
                        'event_type' => $et,
                        'message' => $response->get_error_message(),
                    ));
                } else {
                    error_log('[top-instal-generator] os_event emit transport: ' . $response->get_error_message());
                }
            }
        }

        /**
         * @return string
         */
        private static function base_url() {
            $config = class_exists('TopInstal_Generator_Config_Wp') ? new TopInstal_Generator_Config_Wp() : null;
            if ($config instanceof TopInstal_Generator_Config_Wp) {
                $from_config = $config->get_string(
                    'topinstal_node_b_registry_base_url',
                    'TOPINSTAL_NODE_B_REGISTRY_BASE_URL',
                    ''
                );
                if ($from_config !== '') {
                    return rtrim($from_config, '/');
                }
            }

            if (function_exists('get_option')) {
                $from_widget = get_option('topinstal_lead_widget_node_b_registry_url', '');
                if (is_string($from_widget) && trim($from_widget) !== '') {
                    return rtrim(trim($from_widget), '/');
                }
            }

            return 'http://127.0.0.1:8766';
        }

        /**
         * @return string
         */
        private static function registry_token() {
            $config = class_exists('TopInstal_Generator_Config_Wp') ? new TopInstal_Generator_Config_Wp() : null;
            if ($config instanceof TopInstal_Generator_Config_Wp) {
                $from_config = $config->get_string(
                    'topinstal_node_b_registry_token',
                    'TOPINSTAL_NODE_B_REGISTRY_TOKEN',
                    ''
                );
                if ($from_config !== '') {
                    return $from_config;
                }
            }

            if (function_exists('get_option')) {
                $from_widget = get_option('topinstal_lead_widget_node_b_registry_token', '');
                if (is_string($from_widget) && trim($from_widget) !== '') {
                    return trim($from_widget);
                }
            }

            return '';
        }
    }
}
