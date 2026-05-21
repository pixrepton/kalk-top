<?php

if (!defined('ABSPATH')) {
    exit;
}

if (!function_exists('topinstal_create_trace_id')) {
    /**
     * Create UUID-like trace id.
     *
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
        } catch (Exception $e) {
            return uniqid('trace_', true);
        }
    }
}

if (!function_exists('topinstal_ensure_trace_id')) {
    /**
     * Return provided trace id or create a new one.
     *
     * @param mixed $trace_id
     * @return string
     */
    function topinstal_ensure_trace_id($trace_id = null) {
        if (is_string($trace_id)) {
            $trimmed = trim($trace_id);
            if ($trimmed !== '') {
                return $trimmed;
            }
        }
        return topinstal_create_trace_id();
    }
}

