<?php
require_once __DIR__ . '/wp-load.php';
require_once ABSPATH . 'wp-admin/includes/plugin.php';
echo 'BLOG_INSTALLED=' . (is_blog_installed() ? '1' : '0') . "\n";
echo 'SQLITE_ACTIVE=' . (is_plugin_active('sqlite-database-integration/load.php') ? '1' : '0') . "\n";
echo 'GEN_ACTIVE=' . (is_plugin_active('top-instal-generator/top-instal-generator.php') ? '1' : '0') . "\n";
echo 'AGENT_KEY=' . (string)get_option('top_instal_agent_api_key','') . "\n";
echo 'HOME=' . get_option('home') . "\n";
echo 'SITEURL=' . get_option('siteurl') . "\n";
?>
