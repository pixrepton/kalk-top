<?php
require_once __DIR__ . '/wp-load.php';
require_once ABSPATH . 'wp-admin/includes/plugin.php';
$res = activate_plugin('top-instal-generator/top-instal-generator.php');
if (is_wp_error($res)) {
  echo 'ACTIVATE_ERROR=' . $res->get_error_code() . "\n";
  echo 'ACTIVATE_MSG=' . $res->get_error_message() . "\n";
  print_r($res->get_error_data());
} else {
  echo "ACTIVATE_OK\n";
}
echo 'GEN_ACTIVE=' . (is_plugin_active('top-instal-generator/top-instal-generator.php') ? '1' : '0') . "\n";
?>
