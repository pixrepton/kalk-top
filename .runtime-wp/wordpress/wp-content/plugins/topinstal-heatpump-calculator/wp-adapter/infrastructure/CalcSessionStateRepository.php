<?php

if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists('TopInstal_CalcSessionStateRepository')) {
    /**
     * UPSERT formEngine.state snapshots keyed by calculator session_id.
     */
    class TopInstal_CalcSessionStateRepository {
        /**
         * @return string
         */
        public static function get_table_name() {
            global $wpdb;
            return $wpdb->prefix . 'topinstal_calc_sessions';
        }

        /**
         * @return string
         */
        public static function get_create_table_sql() {
            global $wpdb;
            $table = self::get_table_name();
            $charset_collate = $wpdb->get_charset_collate();

            return "CREATE TABLE {$table} (
                id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
                session_id VARCHAR(36) NOT NULL,
                trace_id VARCHAR(64) NULL,
                form_state_json LONGTEXT NULL,
                ozc_peak_kw DECIMAL(10,3) NULL,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                PRIMARY KEY  (id),
                UNIQUE KEY session_id (session_id),
                KEY trace_id (trace_id),
                KEY updated_at (updated_at)
            ) {$charset_collate};";
        }

        /**
         * @param string $session_id
         * @param string $trace_id
         * @param array<string,mixed>|null $form_state
         * @param float|null $ozc_peak_kw
         * @return bool
         */
        public static function upsert($session_id, $trace_id, $form_state, $ozc_peak_kw = null) {
            global $wpdb;
            if (!isset($wpdb) || !is_object($wpdb)) {
                return false;
            }

            $session_id = sanitize_text_field((string) $session_id);
            if ($session_id === '') {
                return false;
            }

            $table = self::get_table_name();
            $now = current_time('mysql', true);
            $trace_id = sanitize_text_field((string) $trace_id);
            $encoded_state = self::encode_form_state($form_state);
            $peak = null;
            if ($ozc_peak_kw !== null && is_numeric($ozc_peak_kw)) {
                $peak = round((float) $ozc_peak_kw, 3);
            }

            $existing_id = $wpdb->get_var(
                $wpdb->prepare("SELECT id FROM {$table} WHERE session_id = %s LIMIT 1", $session_id)
            );

            if ($existing_id) {
                $updated = $wpdb->update(
                    $table,
                    array(
                        'trace_id' => $trace_id !== '' ? $trace_id : null,
                        'form_state_json' => $encoded_state,
                        'ozc_peak_kw' => $peak,
                        'updated_at' => $now,
                    ),
                    array('id' => (int) $existing_id),
                    array('%s', '%s', '%f', '%s'),
                    array('%d')
                );
                return $updated !== false;
            }

            $inserted = $wpdb->insert(
                $table,
                array(
                    'session_id' => $session_id,
                    'trace_id' => $trace_id !== '' ? $trace_id : null,
                    'form_state_json' => $encoded_state,
                    'ozc_peak_kw' => $peak,
                    'created_at' => $now,
                    'updated_at' => $now,
                ),
                array('%s', '%s', '%s', '%f', '%s', '%s')
            );

            return $inserted !== false;
        }

        /**
         * @param string $session_id
         * @return array<string,mixed>|null
         */
        public static function get_by_session_id($session_id) {
            global $wpdb;
            if (!isset($wpdb) || !is_object($wpdb)) {
                return null;
            }

            $session_id = sanitize_text_field((string) $session_id);
            if ($session_id === '') {
                return null;
            }

            $table = self::get_table_name();
            $row = $wpdb->get_row(
                $wpdb->prepare(
                    "SELECT session_id, trace_id, form_state_json, ozc_peak_kw, updated_at
                     FROM {$table}
                     WHERE session_id = %s
                     LIMIT 1",
                    $session_id
                ),
                ARRAY_A
            );

            if (!is_array($row)) {
                return null;
            }

            $decoded = self::decode_form_state(isset($row['form_state_json']) ? $row['form_state_json'] : null);
            $row['form_state'] = $decoded;
            return $row;
        }

        /**
         * @param array<string,mixed>|null $form_state
         * @return string|null
         */
        private static function encode_form_state($form_state) {
            if (!is_array($form_state) || empty($form_state)) {
                return null;
            }
            $encoded = wp_json_encode($form_state);
            if (!is_string($encoded) || $encoded === '') {
                return null;
            }
            return $encoded;
        }

        /**
         * @param mixed $raw_json
         * @return array<string,mixed>|null
         */
        private static function decode_form_state($raw_json) {
            if (!is_string($raw_json) || trim($raw_json) === '') {
                return null;
            }
            try {
                $decoded = json_decode($raw_json, true, 512, JSON_THROW_ON_ERROR);
            } catch (Throwable $exception) {
                return null;
            }
            return is_array($decoded) ? $decoded : null;
        }

        /**
         * @param array<string,mixed> $offer
         * @return float|null
         */
        public static function extract_peak_kw_from_offer($offer) {
            if (!is_array($offer)) {
                return null;
            }

            $candidates = array();
            if (isset($offer['engineering']['ozc']['designHeatLoss_kW'])) {
                $candidates[] = $offer['engineering']['ozc']['designHeatLoss_kW'];
            }
            if (isset($offer['engineering']['ozc']['max_heating_power'])) {
                $candidates[] = $offer['engineering']['ozc']['max_heating_power'];
            }
            if (isset($offer['meta']['max_heating_power'])) {
                $candidates[] = $offer['meta']['max_heating_power'];
            }
            if (isset($offer['meta']['recommended_power_kw'])) {
                $candidates[] = $offer['meta']['recommended_power_kw'];
            }

            foreach ($candidates as $value) {
                if (is_numeric($value)) {
                    $numeric = (float) $value;
                    if ($numeric > 0) {
                        return $numeric;
                    }
                }
            }

            return null;
        }
    }
}
