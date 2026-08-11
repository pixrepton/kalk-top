<?php
declare(strict_types=1);

$wp_root = getenv('KALK_TOP_WP_ROOT') ?: '/opt/topinstal-runtime/wordpress';
require $wp_root . '/wp-load.php';
require_once ABSPATH . 'wp-admin/includes/plugin.php';

$plugin = 'topinstal-heatpump-calculator/heatpump-calculator.php';
if (!is_plugin_active($plugin)) {
    $result = activate_plugin($plugin);
    if (is_wp_error($result)) {
        fwrite(STDERR, 'ACTIVATE_FAIL=' . $result->get_error_message() . PHP_EOL);
    }
}

$page = get_post(5);
if (!$page || $page->post_type !== 'page') {
    $id = wp_insert_post([
        'post_title' => 'Kalkulator pompy ciepla',
        'post_content' => '[heatpump_calc]',
        'post_status' => 'publish',
        'post_type' => 'page',
        'post_name' => 'kalkulator',
        'import_id' => 5,
    ], true);
    if (is_wp_error($id)) {
        fwrite(STDERR, 'CREATE_FAIL=' . $id->get_error_message() . PHP_EOL);
        exit(1);
    }
    echo 'created=' . $id . PHP_EOL;
} else {
    wp_update_post([
        'ID' => 5,
        'post_content' => '[heatpump_calc]',
        'post_status' => 'publish',
        'post_title' => 'Kalkulator pompy ciepla',
    ]);
    echo 'updated=5' . PHP_EOL;
}

update_option('siteurl', 'http://127.0.0.1:8091');
update_option('home', 'http://127.0.0.1:8091');

echo 'permalink=' . get_permalink(5) . PHP_EOL;
echo 'active=' . (is_plugin_active($plugin) ? '1' : '0') . PHP_EOL;
echo 'plugin_linked=' . (file_exists(WP_PLUGIN_DIR . '/topinstal-heatpump-calculator/heatpump-calculator.php') ? '1' : '0') . PHP_EOL;
echo 'content=' . get_post_field('post_content', 5) . PHP_EOL;
