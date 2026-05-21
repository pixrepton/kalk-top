<?php

if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists('TopInstal_Logger_Wp')) {
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
                'level' => (string) $level,
                'message' => (string) $message,
                'context' => is_array($context) ? $context : array('context' => $context),
            );
            $encoded = function_exists('wp_json_encode')
                ? wp_json_encode($payload)
                : json_encode($payload);
            error_log('[topinstal-generator] ' . $encoded);
        }
    }
}

