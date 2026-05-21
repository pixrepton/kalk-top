<?php
require_once __DIR__ . '/wp-load.php';
require_once ABSPATH . 'wp-admin/includes/plugin.php';
$plugin='topinstal-heatpump-calculator/heatpump-calculator.php';
if (!is_plugin_active($plugin)) {
  $res = activate_plugin($plugin);
  if (is_wp_error($res)) { echo 'ACTIVATE_ERR=' . $res->get_error_message() . "\n"; }
}
update_option('siteurl','http://127.0.0.1:8090');
update_option('home','http://127.0.0.1:8090');
update_option('topinstal_calc_agent_api_key','calc-agent-key-xyz');
update_option('top_instal_agent_api_key','doc-agent-key-xyz');
flush_rewrite_rules();
$nonce = wp_create_nonce('heatpump_calc_nonce');
$docNonce = wp_create_nonce('top_instal_nonce');
echo 'NONCE_CALC=' . $nonce . "\n";
echo 'NONCE_DOC=' . $docNonce . "\n";
?>
