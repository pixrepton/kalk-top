<?php

define('ABSPATH', __DIR__ . DIRECTORY_SEPARATOR);

if (!function_exists('add_action')) { function add_action() {} }
if (!function_exists('add_shortcode')) { function add_shortcode() {} }
if (!function_exists('register_activation_hook')) { function register_activation_hook() {} }
if (!function_exists('register_deactivation_hook')) { function register_deactivation_hook() {} }
if (!function_exists('wp_create_nonce')) { function wp_create_nonce() { return 'probe'; } }
if (!function_exists('plugins_url')) { function plugins_url() { return ''; } }
if (!function_exists('plugin_dir_path')) { function plugin_dir_path() { return __DIR__ . DIRECTORY_SEPARATOR; } }
if (!function_exists('plugin_dir_url')) { function plugin_dir_url() { return ''; } }
if (!function_exists('admin_url')) { function admin_url() { return '/wp-admin/admin-ajax.php'; } }
if (!function_exists('rest_url')) { function rest_url() { return '/wp-json/topinstal/v1/calculate-offer'; } }
if (!function_exists('get_option')) { function get_option($key, $default = '') { return $default; } }

require_once dirname(__DIR__, 2) . '/heatpump-calculator.php';

$client_available = class_exists('TopInstal_OfferDocumentsGeneratorClient');
$config_available = class_exists('TopInstal_MailIngressWorkflowConfig');

echo 'TopInstal_OfferDocumentsGeneratorClient=' . ($client_available ? 'yes' : 'no') . PHP_EOL;
echo 'TopInstal_MailIngressWorkflowConfig=' . ($config_available ? 'yes' : 'no') . PHP_EOL;

if (!$client_available || !$config_available) {
    exit(1);
}
