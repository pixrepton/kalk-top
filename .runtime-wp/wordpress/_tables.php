<?php
require 'C:/Users/compg/Desktop/kalk-top/.runtime-wp/wordpress/wp-load.php';
global $wpdb;
$tables = $wpdb->get_col('SHOW TABLES');
echo wp_json_encode($tables, JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE) . PHP_EOL;
?>
