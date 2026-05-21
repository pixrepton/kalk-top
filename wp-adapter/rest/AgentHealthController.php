<?php

if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists('TopInstal_Agent_Healthcheck_Controller')) {
    /**
     * REST endpoints for backend-only healthchecks.
     */
    class TopInstal_Agent_Healthcheck_Controller {
        const NAMESPACE = 'topinstal/v1';

        /**
         * @return void
         */
        public static function register_routes() {
            register_rest_route(
                self::NAMESPACE,
                '/agent/healthcheck',
                array(
                    'methods' => WP_REST_Server::READABLE,
                    'callback' => array(__CLASS__, 'run_all'),
                    'permission_callback' => array(__CLASS__, 'permission_callback'),
                )
            );

            register_rest_route(
                self::NAMESPACE,
                '/agent/healthcheck/(?P<target>[a-z_]+)',
                array(
                    'methods' => WP_REST_Server::READABLE,
                    'callback' => array(__CLASS__, 'run_single'),
                    'permission_callback' => array(__CLASS__, 'permission_callback'),
                )
            );
        }

        /**
         * @param WP_REST_Request $request
         * @return bool
         */
        public static function permission_callback($request) {
            if (function_exists('current_user_can') && current_user_can('manage_options')) {
                return true;
            }

            // Fallback for API calls with calc agent key.
            $header = trim((string) $request->get_header('X-Top-Instal-Agent-Key'));
            if ($header === '') {
                $header = trim((string) $request->get_header('X-Topinstal-Agent-Key'));
            }
            if ($header === '') {
                return false;
            }

            $bundle = class_exists('TopInstal_Agent_SecretStore')
                ? TopInstal_Agent_SecretStore::get_bundle('topinstal_calc_agent_api_key', 'TOPINSTAL_CALC_AGENT_API_KEY', '')
                : array('active' => trim((string) get_option('topinstal_calc_agent_api_key', '')));

            return class_exists('TopInstal_Agent_SecretStore')
                ? TopInstal_Agent_SecretStore::matches_any_active_or_previous($header, $bundle)
                : (isset($bundle['active']) && is_string($bundle['active']) && $bundle['active'] !== '' && hash_equals((string) $bundle['active'], $header));
        }

        /**
         * @param WP_REST_Request $request
         * @return WP_REST_Response
         */
        public static function run_all($request) {
            if (!self::is_enabled()) {
                return new WP_REST_Response(array('errorCode' => 'HEALTHCHECK_DISABLED'), 503);
            }
            $service = new TopInstal_Agent_HealthcheckService();
            $result = $service->run_all();
            return new WP_REST_Response($result, 200);
        }

        /**
         * @param WP_REST_Request $request
         * @return WP_REST_Response
         */
        public static function run_single($request) {
            if (!self::is_enabled()) {
                return new WP_REST_Response(array('errorCode' => 'HEALTHCHECK_DISABLED'), 503);
            }
            $service = new TopInstal_Agent_HealthcheckService();
            $target = sanitize_key((string) $request->get_param('target'));

            if ($target === 'generator') {
                return new WP_REST_Response(array('checkedAt' => gmdate('c'), 'generator' => $service->check_generator()), 200);
            }
            if ($target === 'converter') {
                return new WP_REST_Response(array('checkedAt' => gmdate('c'), 'converter' => $service->check_converter()), 200);
            }

            return new WP_REST_Response(array('errorCode' => 'UNKNOWN_HEALTHCHECK_TARGET'), 400);
        }

        /**
         * @return bool
         */
        private static function is_enabled() {
            if (defined('TOPINSTAL_AGENT_HEALTHCHECK_ENABLED')) {
                return self::to_bool(constant('TOPINSTAL_AGENT_HEALTHCHECK_ENABLED'), true);
            }
            $env = getenv('TOPINSTAL_AGENT_HEALTHCHECK_ENABLED');
            if (is_string($env) && trim($env) !== '') {
                return self::to_bool($env, true);
            }
            return self::to_bool(get_option('topinstal_agent_healthcheck_enabled', '1'), true);
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
