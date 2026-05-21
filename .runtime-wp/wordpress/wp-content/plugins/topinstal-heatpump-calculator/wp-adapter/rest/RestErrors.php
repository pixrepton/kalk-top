<?php

if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists('TopInstal_RestErrors')) {
    /**
     * Consistent REST error response formatter.
     */
    class TopInstal_RestErrors {
        /**
         * @param int $status
         * @param string $trace_id
         * @param string $error_code
         * @param string $message
         * @param array<string,mixed> $details
         * @return WP_REST_Response
         */
        public static function response($status, $trace_id, $error_code, $message, $details = array()) {
            $payload = array(
                'traceId' => (string) $trace_id,
                'errorCode' => (string) $error_code,
                'message' => (string) $message,
            );
            if (is_array($details) && !empty($details)) {
                $payload['details'] = $details;
            }
            return new WP_REST_Response($payload, (int) $status);
        }
    }
}

