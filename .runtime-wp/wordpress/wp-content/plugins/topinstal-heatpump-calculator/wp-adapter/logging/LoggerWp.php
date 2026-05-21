<?php

if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists('TopInstal_Logger_Wp')) {
    /**
     * Minimal WordPress logger for migration phase.
     */
    class TopInstal_Logger_Wp {
        /**
         * @param string $message
         * @param array<string,mixed> $context
         * @return void
         */
        public static function info($message, $context = array()) {
            self::write('INFO', $message, $context);
        }

        /**
         * @param string $message
         * @param array<string,mixed> $context
         * @return void
         */
        public static function warn($message, $context = array()) {
            self::write('WARN', $message, $context);
        }

        /**
         * @param string $message
         * @param array<string,mixed> $context
         * @return void
         */
        public static function error($message, $context = array()) {
            self::write('ERROR', $message, $context);
        }

        /**
         * @param string $level
         * @param string $message
         * @param array<string,mixed> $context
         * @return void
         */
        private static function write($level, $message, $context = array()) {
            $payload = array(
                'level' => $level,
                'message' => (string) $message,
                'context' => self::sanitize_context(is_array($context) ? $context : array('context' => $context)),
            );
            $encoded = function_exists('wp_json_encode')
                ? wp_json_encode($payload)
                : json_encode($payload);
            error_log('[topinstal] ' . $encoded);
        }

        /**
         * @param array<string,mixed> $context
         * @return array<string,mixed>
         */
        private static function sanitize_context($context) {
            $masked = array();
            foreach ($context as $key => $value) {
                $normalized_key = sanitize_key((string) $key);
                if (is_array($value)) {
                    $masked[$normalized_key] = self::sanitize_context($value);
                    continue;
                }

                if (in_array($normalized_key, array('email', 'clientemail', 'customer_email'), true)) {
                    $masked[$normalized_key] = self::mask_email((string) $value);
                    continue;
                }
                if (in_array($normalized_key, array('phone', 'customer_phone', 'clientphone'), true)) {
                    $masked[$normalized_key] = self::mask_phone((string) $value);
                    continue;
                }
                if (is_string($value) && strlen($value) > 4096) {
                    $masked[$normalized_key] = substr($value, 0, 4096) . '...[truncated]';
                    continue;
                }
                $masked[$normalized_key] = $value;
            }
            return $masked;
        }

        /**
         * @param string $email
         * @return string
         */
        private static function mask_email($email) {
            $email = trim((string) $email);
            if ($email === '' || strpos($email, '@') === false) {
                return '-';
            }
            $parts = explode('@', $email, 2);
            $local = isset($parts[0]) ? (string) $parts[0] : '';
            $domain = isset($parts[1]) ? (string) $parts[1] : '';
            if ($local === '') {
                return '***@' . $domain;
            }
            $suffix = strlen($local) > 4 ? substr($local, -4) : substr($local, -1);
            return '***' . $suffix . '@' . $domain;
        }

        /**
         * @param string $phone
         * @return string
         */
        private static function mask_phone($phone) {
            $digits = preg_replace('/\D+/', '', (string) $phone);
            if (!is_string($digits) || $digits === '') {
                return '-';
            }
            $tail = strlen($digits) > 4 ? substr($digits, -4) : substr($digits, -2);
            return '***' . $tail;
        }
    }
}
