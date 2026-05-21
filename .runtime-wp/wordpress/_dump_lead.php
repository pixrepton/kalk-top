<?php
require 'C:/Users/compg/Desktop/kalk-top/.runtime-wp/wordpress/wp-load.php';
global $wpdb;
$table = $wpdb->prefix . 'topinstal_leads';
$lead_id = 'b65be661-0b54-f44b-9627-06f5f3ed9622';
$row = $wpdb->get_row($wpdb->prepare("SELECT lead_id,status,payload_json FROM {$table} WHERE lead_id=%s", $lead_id), ARRAY_A);
echo wp_json_encode($row, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . PHP_EOL;
?>
