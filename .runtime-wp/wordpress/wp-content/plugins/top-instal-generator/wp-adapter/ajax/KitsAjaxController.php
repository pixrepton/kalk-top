<?php

if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists('TopInstal_Ajax_Kits_Controller')) {
    class TopInstal_Ajax_Kits_Controller {
        /**
         * @return void
         */
        public static function register_hooks() {
            add_action('wp_ajax_get_kits', array(__CLASS__, 'handle_get_kits'));
            add_action('wp_ajax_nopriv_get_kits', array(__CLASS__, 'handle_get_kits'));
        }

        /**
         * @return void
         */
        public static function handle_get_kits() {
            if (function_exists('error_log')) {
                error_log('Deprecated: get_kits AJAX. Use REST /wp-json/topinstal/v1/offer-documents/generate or kits repository.');
            }
            check_ajax_referer('top_instal_nonce', 'nonce');

            $power_type = sanitize_text_field(isset($_POST['power_type']) ? (string) wp_unslash($_POST['power_type']) : '1fazowe');
            $tank_capacity = sanitize_text_field(isset($_POST['tank_capacity']) ? (string) wp_unslash($_POST['tank_capacity']) : '200');
            $power_kw_raw = isset($_POST['power_kw']) ? wp_unslash($_POST['power_kw']) : null;
            $power_kw = is_numeric($power_kw_raw) ? (int) $power_kw_raw : null;

            $repository = new TopInstal_KitsRepository_Wp();
            $result = $repository->get_for_filters($power_type, $tank_capacity, $power_kw);
            if (empty($result)) {
                wp_send_json_error('Nie znaleziono zestawow dla podanych filtrow.');
            }

            wp_send_json_success($result);
        }
    }
}
