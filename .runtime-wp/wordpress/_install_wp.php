<?php
error_reporting(E_ALL);
define('WP_INSTALLING', true);
require_once __DIR__ . '/wp-load.php';
require_once ABSPATH . 'wp-admin/includes/upgrade.php';
require_once ABSPATH . 'wp-admin/includes/plugin.php';

$installed = function_exists('is_blog_installed') ? is_blog_installed() : false;
if (!$installed) {
  wp_install('TopInstal Runtime', 'admin', 'qa@example.local', true, '', 'admin123!');
  echo "INSTALLED\n";
} else {
  echo "ALREADY_INSTALLED\n";
}

if (!is_plugin_active('sqlite-database-integration/load.php')) {
  $res = activate_plugin('sqlite-database-integration/load.php');
  if (is_wp_error($res)) {
    echo 'SQLITE_ACTIVATE_ERR:' . $res->get_error_message() . "\n";
  } else {
    echo "SQLITE_ACTIVE\n";
  }
} else {
  echo "SQLITE_ALREADY_ACTIVE\n";
}

if (!is_plugin_active('top-instal-generator/top-instal-generator.php')) {
  $res = activate_plugin('top-instal-generator/top-instal-generator.php');
  if (is_wp_error($res)) {
    echo 'GEN_ACTIVATE_ERR:' . $res->get_error_message() . "\n";
  } else {
    echo "GEN_ACTIVE\n";
  }
} else {
  echo "GEN_ALREADY_ACTIVE\n";
}

update_option('top_instal_agent_api_key', 'test-agent-key-123');
update_option('top_instal_pdf_debug_log', 1);

// Ensure pretty permalinks not required for REST but set anyway.
update_option('permalink_structure', '/%postname%/');
flush_rewrite_rules();

$nonce = wp_create_nonce('top_instal_nonce');
echo 'NONCE=' . $nonce . "\n";
?>
