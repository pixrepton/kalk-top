<?php

if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists('TopInstal_RestJsonGuard')) {
    /**
     * Prevent accidental BOM/whitespace from breaking JSON REST responses.
     */
    class TopInstal_RestJsonGuard {
        /**
         * @return void
         */
        public static function register() {
            add_filter('rest_pre_dispatch', array(__CLASS__, 'pre_dispatch'), 5, 3);
            add_filter('rest_pre_serve_request', array(__CLASS__, 'pre_serve_request'), 5, 4);
        }

        /**
         * @return void
         */
        public static function clean_accidental_output() {
            while (ob_get_level() > 0) {
                ob_end_clean();
            }
        }

        /**
         * @param mixed $result
         * @param WP_REST_Server $server
         * @param WP_REST_Request $request
         * @return mixed
         */
        public static function pre_dispatch($result, $server, $request) {
            if (!is_object($request) || !method_exists($request, 'get_route')) {
                return $result;
            }

            $route = (string) $request->get_route();
            if (strpos($route, '/topinstal/v1') !== 0) {
                return $result;
            }

            self::clean_accidental_output();
            return $result;
        }

        /**
         * Serve topinstal JSON without leading BOM when accidental output occurred.
         *
         * @param bool $served
         * @param WP_HTTP_Response $result
         * @param WP_REST_Request $request
         * @param WP_REST_Server $server
         * @return bool
         */
        public static function pre_serve_request($served, $result, $request, $server) {
            if ($served || !is_object($request) || !method_exists($request, 'get_route')) {
                return $served;
            }

            $route = (string) $request->get_route();
            if (strpos($route, '/topinstal/v1') !== 0) {
                return $served;
            }

            self::clean_accidental_output();

            if (!is_object($server) || !method_exists($server, 'response_to_data')) {
                return $served;
            }

            $data = $server->response_to_data($result, false);
            $json = function_exists('wp_json_encode') ? wp_json_encode($data) : json_encode($data);
            if (!is_string($json) || $json === '') {
                return $served;
            }

            $json = self::strip_bom($json);

            if (!headers_sent()) {
                status_header(is_object($result) && method_exists($result, 'get_status') ? (int) $result->get_status() : 200);
                header('Content-Type: application/json; charset=' . get_option('blog_charset', 'UTF-8'));
            }

            echo $json;
            return true;
        }

        /**
         * @param string $body
         * @return string
         */
        public static function strip_bom($body) {
            if (strncmp($body, "\xEF\xBB\xBF", 3) === 0) {
                return substr($body, 3);
            }
            return $body;
        }
    }
}
