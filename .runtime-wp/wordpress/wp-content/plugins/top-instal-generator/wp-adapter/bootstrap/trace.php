<?php

if (!defined('ABSPATH')) {
    exit;
}

if (!function_exists('topinstal_create_trace_id')) {
    /**
     * @return string
     */
    function topinstal_create_trace_id() {
        if (function_exists('wp_generate_uuid4')) {
            return (string) wp_generate_uuid4();
        }

        try {
            $bytes = random_bytes(16);
            $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
            $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
            $hex = bin2hex($bytes);
            return sprintf(
                '%s-%s-%s-%s-%s',
                substr($hex, 0, 8),
                substr($hex, 8, 4),
                substr($hex, 12, 4),
                substr($hex, 16, 4),
                substr($hex, 20, 12)
            );
        } catch (Throwable $e) {
            return uniqid('trace_', true);
        }
    }
}

if (!function_exists('topinstal_ensure_trace_id')) {
    /**
     * @param mixed $trace_id
     * @return string
     */
    function topinstal_ensure_trace_id($trace_id = null) {
        if (is_string($trace_id)) {
            $trace_id = trim($trace_id);
            if ($trace_id !== '') {
                return $trace_id;
            }
        }
        return topinstal_create_trace_id();
    }
}

