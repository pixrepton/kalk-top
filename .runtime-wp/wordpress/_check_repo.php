<?php
require 'C:/Users/compg/Desktop/kalk-top/.runtime-wp/wordpress/wp-load.php';
require_once 'C:/Users/compg/Desktop/kalk-top/.runtime-wp/wordpress/wp-content/plugins/topinstal-heatpump-calculator/wp-adapter/agents/LeadRepositoryWp.php';
$repo = new TopInstal_Agent_LeadRepository_Wp();
$ok = $repo->is_available();
echo 'AVAILABLE=' . ($ok ? '1' : '0') . PHP_EOL;
global $wpdb;
$table = $wpdb->prefix . 'topinstal_leads';
$found = $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $table));
echo 'FOUND=' . (string)$found . PHP_EOL;
?>
