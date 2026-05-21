<?php
require_once __DIR__ . '/wp-load.php';
require_once ABSPATH . 'wp-admin/includes/plugin.php';
if (!is_plugin_active('top-instal-generator/top-instal-generator.php')) {
  activate_plugin('top-instal-generator/top-instal-generator.php');
}
if (!is_plugin_active('sqlite-database-integration/load.php')) {
  activate_plugin('sqlite-database-integration/load.php');
}
update_option('siteurl', 'http://127.0.0.1:8090');
update_option('home', 'http://127.0.0.1:8090');
update_option('top_instal_agent_api_key', 'test-agent-key-123');
update_option('top_instal_pdf_debug_log', 1);
update_option('top_instal_pdf_converter_url', '');
update_option('top_instal_pdf_converter_token', '');
flush_rewrite_rules();
echo 'NONCE=' . wp_create_nonce('top_instal_nonce') . "\n";
echo 'GEN_ACTIVE=' . (is_plugin_active('top-instal-generator/top-instal-generator.php') ? '1' : '0') . "\n";
echo 'SITEURL=' . get_option('siteurl') . "\n";
?>
