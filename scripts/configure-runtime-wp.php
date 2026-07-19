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
$wp_root_override = getenv('KALK_TOP_WP_ROOT');
$wp_root = is_string($wp_root_override) && trim($wp_root_override) !== ''
    ? rtrim(trim($wp_root_override), "/\\")
    : $repo_root . DIRECTORY_SEPARATOR . '.runtime-wp' . DIRECTORY_SEPARATOR . 'wordpress';

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

if (!is_plugin_active('topinstal-heatpump-calculator/heatpump-calculator.php')) {
    activate_plugin('topinstal-heatpump-calculator/heatpump-calculator.php');
}
if (!is_plugin_active('top-instal-generator/top-instal-generator.php')) {
    activate_plugin('top-instal-generator/top-instal-generator.php');
}
if (!is_plugin_active('sqlite-database-integration/load.php')) {
    activate_plugin('sqlite-database-integration/load.php');
}

update_option('siteurl', $base_url);
update_option('home', $base_url);
// Agent key must match cieplo-orchestrator KALKTOP_AGENT_KEY
$agent_key = getenv('KALKTOP_AGENT_KEY') ?: 'dsfgjhw38974huhsefnkjdnfnj873ujhw3';
update_option('topinstal_calc_agent_api_key', $agent_key);
update_option('top_instal_agent_api_key', $agent_key);
update_option('top_instal_pdf_debug_log', 1);
// Gotenberg runs on host port 3000; inside Docker containers use host.docker.internal
$gotenberg_url = getenv('GOTENBERG_URL') ?: 'http://host.docker.internal:3000';
update_option('top_instal_pdf_converter_url', $gotenberg_url);
update_option('top_instal_pdf_converter_token', '');

$gmail_env_paths = array(
    dirname($repo_root) . DIRECTORY_SEPARATOR . 'gmail-agent' . DIRECTORY_SEPARATOR . '.env.local-vps',
    dirname($repo_root) . DIRECTORY_SEPARATOR . 'gmail-agent' . DIRECTORY_SEPARATOR . '.env.vps',
);
$node_b_base = 'http://127.0.0.1:8766';
$node_b_token = '';
foreach ($gmail_env_paths as $gmail_env_path) {
    if (!is_readable($gmail_env_path)) {
        continue;
    }
    foreach (file($gmail_env_path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim((string) $line);
        if ($line === '' || $line[0] === '#') {
            continue;
        }
        $eq = strpos($line, '=');
        if ($eq === false) {
            continue;
        }
        $key = trim(substr($line, 0, $eq));
        $value = trim(substr($line, $eq + 1));
        if ($key === 'GMAIL_AGENT_NODEB_PORT' && $value !== '') {
            $node_b_base = 'http://127.0.0.1:' . $value;
        }
        if ($key === 'NODE_B_REGISTRY_TOKEN' && $value !== '') {
            $node_b_token = $value;
        }
        if ($key === 'GMAIL_AGENT_INTERNAL_API_TOKEN' && $node_b_token === '') {
            $node_b_token = $value;
        }
        if ($key === 'DASZEK_NODE_B_API_TOKEN' && $node_b_token === '') {
            $node_b_token = $value;
        }
    }
    if ($node_b_token !== '') {
        break;
    }
}
update_option('topinstal_lead_widget_node_b_registry_url', $node_b_base);
update_option('topinstal_lead_widget_node_b_registry_token', $node_b_token);
update_option('topinstal_node_b_registry_base_url', $node_b_base);
update_option('topinstal_node_b_registry_token', $node_b_token);

$generator_repo = dirname($repo_root) . DIRECTORY_SEPARATOR . 'top-instal-generator';
$generator_link = $wp_root . DIRECTORY_SEPARATOR . 'wp-content' . DIRECTORY_SEPARATOR . 'plugins' . DIRECTORY_SEPARATOR . 'top-instal-generator';
if (is_dir($generator_repo)) {
    $generator_repo_real = realpath($generator_repo);
    $generator_link_real = (is_dir($generator_link) || is_link($generator_link)) ? realpath($generator_link) : false;
    if ($generator_link_real !== false && $generator_repo_real !== false && $generator_link_real !== $generator_repo_real) {
        if (PHP_OS_FAMILY === 'Windows') {
            exec('cmd /c rmdir /S /Q "' . str_replace('/', '\\', $generator_link) . '"');
        } else {
            exec('rm -rf ' . escapeshellarg($generator_link));
        }
    }
    if (!is_dir($generator_link) && !is_link($generator_link) && $generator_repo_real !== false) {
        if (PHP_OS_FAMILY === 'Windows') {
            exec('cmd /c mklink /J "' . str_replace('/', '\\', $generator_link) . '" "' . str_replace('/', '\\', $generator_repo_real) . '"');
        } else {
            symlink($generator_repo_real, $generator_link);
        }
    }
}

flush_rewrite_rules();

echo 'SITEURL=' . get_option('siteurl') . PHP_EOL;
echo 'KALK_ACTIVE=' . (is_plugin_active('topinstal-heatpump-calculator/heatpump-calculator.php') ? '1' : '0') . PHP_EOL;
echo 'GEN_ACTIVE=' . (is_plugin_active('top-instal-generator/top-instal-generator.php') ? '1' : '0') . PHP_EOL;
echo 'NONCE=' . wp_create_nonce('top_instal_nonce') . PHP_EOL;
