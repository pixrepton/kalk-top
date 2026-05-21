<?php

if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists('TopInstal_Agent_SecretStore')) {
    /**
     * Secret rotation helper (active + previous + audit metadata).
     */
    class TopInstal_Agent_SecretStore {
        const PREVIOUS_SUFFIX = '__previous';
        const PREVIOUS_VALID_UNTIL_SUFFIX = '__previous_valid_until';
        const CHANGED_AT_SUFFIX = '__changed_at';
        const CHANGED_BY_SUFFIX = '__changed_by';

        /**
         * @param mixed $default
         * @return bool
         */
        public static function is_rotation_enabled($default = true) {
            return self::get_bool_config('topinstal_agent_secret_rotation_enabled', 'TOPINSTAL_AGENT_SECRET_ROTATION_ENABLED', $default);
        }

        /**
         * @param string $option_name
         * @param string $const_name
         * @param string $default
         * @param string $legacy_option_name
         * @param string $legacy_const_name
         * @return array<string,mixed>
         */
        public static function get_bundle($option_name, $const_name = '', $default = '', $legacy_option_name = '', $legacy_const_name = '') {
            $resolved = self::resolve_active_value($option_name, $const_name, $default, $legacy_option_name, $legacy_const_name);
            $active = isset($resolved['value']) ? (string) $resolved['value'] : '';
            $source = isset($resolved['source']) ? (string) $resolved['source'] : 'default';

            $previous = '';
            $previous_valid_until = 0;
            if (self::is_rotation_enabled() && $source === 'option') {
                $previous = trim((string) get_option($option_name . self::PREVIOUS_SUFFIX, ''));
                $previous_valid_until = self::parse_unix_timestamp(get_option($option_name . self::PREVIOUS_VALID_UNTIL_SUFFIX, 0));
                if ($previous !== '' && $previous_valid_until > 0 && $previous_valid_until <= time()) {
                    self::clear_previous($option_name);
                    $previous = '';
                    $previous_valid_until = 0;
                }
            }

            return array(
                'active' => $active,
                'previous' => $previous,
                'previousValidUntil' => $previous_valid_until,
                'source' => $source,
                'lastChangedAt' => (string) get_option($option_name . self::CHANGED_AT_SUFFIX, ''),
                'lastChangedBy' => (string) get_option($option_name . self::CHANGED_BY_SUFFIX, ''),
            );
        }

        /**
         * @param string $option_name
         * @param string $value
         * @param int $previous_ttl_seconds
         * @param int $user_id
         * @param array<int,string> $alias_options
         * @return array<string,mixed>
         */
        public static function rotate_option_secret($option_name, $value, $previous_ttl_seconds = 86400, $user_id = 0, $alias_options = array()) {
            $new_value = trim((string) $value);
            if ($new_value === '') {
                return array('ok' => false, 'errorCode' => 'EMPTY_SECRET');
            }

            $previous_ttl_seconds = max(60, (int) $previous_ttl_seconds);
            $current_value = trim((string) get_option($option_name, ''));

            if ($current_value !== '' && $current_value !== $new_value && self::is_rotation_enabled()) {
                update_option($option_name . self::PREVIOUS_SUFFIX, $current_value, false);
                update_option($option_name . self::PREVIOUS_VALID_UNTIL_SUFFIX, (string) (time() + $previous_ttl_seconds), false);
            }

            update_option($option_name, $new_value, false);
            if (is_array($alias_options)) {
                foreach ($alias_options as $alias_option) {
                    if (!is_string($alias_option) || trim($alias_option) === '') {
                        continue;
                    }
                    update_option(trim($alias_option), $new_value, false);
                }
            }

            $changed_at = gmdate('c');
            $changed_by = (int) $user_id > 0 ? (string) ((int) $user_id) : 'system';
            update_option($option_name . self::CHANGED_AT_SUFFIX, $changed_at, false);
            update_option($option_name . self::CHANGED_BY_SUFFIX, $changed_by, false);

            return array(
                'ok' => true,
                'changedAt' => $changed_at,
                'changedBy' => $changed_by,
                'hasPrevious' => $current_value !== '' && $current_value !== $new_value,
            );
        }

        /**
         * @param string $option_name
         * @return void
         */
        public static function clear_previous($option_name) {
            delete_option($option_name . self::PREVIOUS_SUFFIX);
            delete_option($option_name . self::PREVIOUS_VALID_UNTIL_SUFFIX);
        }

        /**
         * @param string $candidate
         * @param array<string,mixed> $bundle
         * @return bool
         */
        public static function matches_any_active_or_previous($candidate, $bundle) {
            $candidate = trim((string) $candidate);
            if ($candidate === '') {
                return false;
            }

            $active = isset($bundle['active']) ? (string) $bundle['active'] : '';
            if ($active !== '' && hash_equals($active, $candidate)) {
                return true;
            }

            $previous = isset($bundle['previous']) ? (string) $bundle['previous'] : '';
            $valid_until = isset($bundle['previousValidUntil']) ? (int) $bundle['previousValidUntil'] : 0;
            if ($previous !== '' && $valid_until > time() && hash_equals($previous, $candidate)) {
                return true;
            }

            return false;
        }

        /**
         * @param string $option_name
         * @param string $const_name
         * @param string $default
         * @param string $legacy_option_name
         * @param string $legacy_const_name
         * @return array<string,string>
         */
        private static function resolve_active_value($option_name, $const_name, $default = '', $legacy_option_name = '', $legacy_const_name = '') {
            if ($const_name !== '' && defined($const_name)) {
                $value = constant($const_name);
                if (is_string($value) && trim($value) !== '') {
                    return array('value' => trim($value), 'source' => 'constant');
                }
            }

            if ($legacy_const_name !== '' && defined($legacy_const_name)) {
                $legacy_value = constant($legacy_const_name);
                if (is_string($legacy_value) && trim($legacy_value) !== '') {
                    return array('value' => trim($legacy_value), 'source' => 'constant');
                }
            }

            if ($const_name !== '') {
                $env = getenv($const_name);
                if (is_string($env) && trim($env) !== '') {
                    return array('value' => trim($env), 'source' => 'env');
                }
            }

            if ($legacy_const_name !== '') {
                $legacy_env = getenv($legacy_const_name);
                if (is_string($legacy_env) && trim($legacy_env) !== '') {
                    return array('value' => trim($legacy_env), 'source' => 'env');
                }
            }

            $option = get_option($option_name, '');
            if (is_string($option) && trim($option) !== '') {
                return array('value' => trim($option), 'source' => 'option');
            }

            if ($legacy_option_name !== '') {
                $legacy_option = get_option($legacy_option_name, '');
                if (is_string($legacy_option) && trim($legacy_option) !== '') {
                    return array('value' => trim($legacy_option), 'source' => 'option');
                }
            }

            return array('value' => (string) $default, 'source' => 'default');
        }

        /**
         * @param string $option_name
         * @param string $const_name
         * @param bool $default
         * @return bool
         */
        private static function get_bool_config($option_name, $const_name, $default) {
            if ($const_name !== '' && defined($const_name)) {
                return self::to_bool(constant($const_name), $default);
            }

            if ($const_name !== '') {
                $env = getenv($const_name);
                if (is_string($env) && trim($env) !== '') {
                    return self::to_bool($env, $default);
                }
            }

            $option = get_option($option_name, null);
            if ($option !== null && $option !== '') {
                return self::to_bool($option, $default);
            }

            return (bool) $default;
        }

        /**
         * @param mixed $value
         * @return int
         */
        private static function parse_unix_timestamp($value) {
            if (is_numeric($value)) {
                return max(0, (int) $value);
            }
            if (is_string($value) && trim($value) !== '') {
                $ts = strtotime($value);
                if ($ts !== false) {
                    return (int) $ts;
                }
            }
            return 0;
        }

        /**
         * @param mixed $value
         * @param bool $default
         * @return bool
         */
        private static function to_bool($value, $default) {
            if (is_bool($value)) {
                return $value;
            }
            if (is_numeric($value)) {
                return ((int) $value) === 1;
            }
            if (!is_string($value)) {
                return $default;
            }

            $normalized = strtolower(trim($value));
            if (in_array($normalized, array('1', 'true', 'yes', 'on'), true)) {
                return true;
            }
            if (in_array($normalized, array('0', 'false', 'no', 'off'), true)) {
                return false;
            }
            return $default;
        }
    }
}
