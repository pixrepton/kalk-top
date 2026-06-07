<?php
declare(strict_types=1);

/**
 * Canonical local WordPress runtime configuration for kalk-top E2E/dev.
 *
 * Env:
 * - KALK_TOP_RUNTIME_BASE_URL (preferred), e.g. http://127.0.0.1:8091
 * - KALK_TOP_RUNTIME_PORT (fallback), e.g. 8091
 */

$repo_root = dirname(__DIR__);
$wp_root = $repo_root . DIRECTORY_SEPARATOR . '.runtime-wp' . DIRECTORY_SEPARATOR . 'wordpress';

if (!is_file($wp_root . DIRECTORY_SEPARATOR . 'wp-load.php')) {
    fwrite(STDERR, "Runtime WordPress root not found: {$wp_root}\n");
    exit(1);
}

$base_url = getenv('KALK_TOP_RUNTIME_BASE_URL');
if (!is_string($base_url) || trim($base_url) === '') {
    $port = getenv('KALK_TOP_RUNTIME_PORT');
    $port_int = is_string($port) && ctype_digit(trim($port)) ? (int) trim($port) : 8091;
    $base_url = 'http://127.0.0.1:' . $port_int;
}

$base_url = rtrim(trim($base_url), '/');

require_once $wp_root . DIRECTORY_SEPARATOR . 'wp-load.php';
require_once ABSPATH . 'wp-admin/includes/plugin.php';

if (!is_plugin_active('top-instal-generator/top-instal-generator.php')) {
    activate_plugin('top-instal-generator/top-instal-generator.php');
}
if (!is_plugin_active('sqlite-database-integration/load.php')) {
    activate_plugin('sqlite-database-integration/load.php');
}

update_option('siteurl', $base_url);
update_option('home', $base_url);
update_option('topinstal_calc_agent_api_key', 'calc-agent-key-xyz');
update_option('top_instal_agent_api_key', 'test-agent-key-123');
update_option('top_instal_pdf_debug_log', 1);
update_option('top_instal_pdf_converter_url', '');
update_option('top_instal_pdf_converter_token', '');
flush_rewrite_rules();

echo 'SITEURL=' . get_option('siteurl') . PHP_EOL;
echo 'GEN_ACTIVE=' . (is_plugin_active('top-instal-generator/top-instal-generator.php') ? '1' : '0') . PHP_EOL;
echo 'NONCE=' . wp_create_nonce('top_instal_nonce') . PHP_EOL;
