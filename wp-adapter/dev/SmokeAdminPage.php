<?php

if (!defined('ABSPATH')) {
    exit;
}

if (!function_exists('topinstal_smoke_tools_enabled')) {
    /**
     * Enable smoke tools in dev environments.
     *
     * @return bool
     */
    function topinstal_smoke_tools_enabled() {
        $enabled = (defined('WP_DEBUG') && WP_DEBUG);
        if (function_exists('apply_filters')) {
            $enabled = (bool) apply_filters('topinstal_enable_smoke_tools', $enabled);
        }
        return $enabled;
    }
}

if (!function_exists('topinstal_register_smoke_admin_page')) {
    /**
     * Register admin page for REST smoke diagnostics.
     *
     * @return void
     */
    function topinstal_register_smoke_admin_page() {
        if (!topinstal_smoke_tools_enabled()) {
            return;
        }

        add_management_page(
            'TOPINSTAL Smoke',
            'TOPINSTAL Smoke',
            'manage_options',
            'topinstal-smoke',
            'topinstal_render_smoke_admin_page'
        );
    }
}

if (!function_exists('topinstal_render_smoke_admin_page')) {
    /**
     * Render smoke diagnostics page.
     *
     * @return void
     */
    function topinstal_render_smoke_admin_page() {
        if (!current_user_can('manage_options')) {
            wp_die('Insufficient permissions.');
        }

        $route_path = '/topinstal/v1/calculate-offer';
        $base_url = function_exists('rest_url') ? rest_url('topinstal/v1/calculate-offer') : '';
        $nonce = function_exists('wp_create_nonce') ? wp_create_nonce('heatpump_calc_nonce') : '';
        $rest_nonce = function_exists('wp_create_nonce') ? wp_create_nonce('wp_rest') : '';
        $logged_in = function_exists('is_user_logged_in') ? is_user_logged_in() : false;
        $backend_constant_defined = defined('USE_BACKEND_CALC');
        $backend_constant_value = $backend_constant_defined ? (USE_BACKEND_CALC ? 'true' : 'false') : '(not defined)';
        $backend_option_raw = function_exists('get_option')
            ? get_option('topinstal_use_backend_calc', '(not set)')
            : '(unavailable)';
        $site_url = function_exists('get_site_url') ? (string) get_site_url() : '';
        $email_proxy_default = $site_url !== '' ? $site_url . '/email-proxy.php' : '';
        $email_proxy_url = function_exists('apply_filters')
            ? (string) apply_filters('topinstal_email_proxy_url', $email_proxy_default)
            : $email_proxy_default;
        $cieplo_proxy_url = $site_url !== '' ? $site_url . '/cieplo-proxy.php' : '';
        $email_proxy_available = defined('ABSPATH') ? is_file(ABSPATH . 'email-proxy.php') : false;
        $cieplo_proxy_available = defined('ABSPATH') ? is_file(ABSPATH . 'cieplo-proxy.php') : false;
        $generator_summary = null;
        if (class_exists('TopInstal_MailIngressWorkflowConfig')) {
            $generator_summary = (new TopInstal_MailIngressWorkflowConfig())->get_generator_debug_summary();
        }

        $route_registered = false;
        $routes = array();
        if (function_exists('rest_get_server')) {
            $server = rest_get_server();
            if ($server && method_exists($server, 'get_routes')) {
                $routes = $server->get_routes();
                $route_registered = isset($routes[$route_path]);
            }
        }

        $last_dual_run = function_exists('get_transient')
            ? get_transient('topinstal_dual_run_last')
            : false;
        if (!is_array($last_dual_run)) {
            $last_dual_run = null;
        }

        echo '<div class="wrap">';
        echo '<h1>TOPINSTAL REST Smoke</h1>';
        echo '<table class="widefat striped" style="max-width:1200px;">';
        echo '<tbody>';
        echo '<tr><th style="width:260px;">REST base URL</th><td><code>' . esc_html($base_url) . '</code></td></tr>';
        echo '<tr><th>Fresh nonce (heatpump_calc_nonce)</th><td><code>' . esc_html($nonce) . '</code></td></tr>';
        echo '<tr><th>Fresh nonce (wp_rest)</th><td><code>' . esc_html($rest_nonce) . '</code></td></tr>';
        echo '<tr><th>Logged-in cookie auth</th><td><strong>' . ($logged_in ? 'YES' : 'NO') . '</strong></td></tr>';
        echo '<tr><th>USE_BACKEND_CALC constant</th><td><code>' . esc_html($backend_constant_value) . '</code></td></tr>';
        echo '<tr><th>topinstal_use_backend_calc option</th><td><code>' . esc_html((string) $backend_option_raw) . '</code></td></tr>';
        echo '<tr><th>emailProxyUrl (runtime)</th><td><code>' . esc_html($email_proxy_url) . '</code></td></tr>';
        echo '<tr><th>email-proxy.php available</th><td><strong>' . ($email_proxy_available ? 'YES' : 'NO') . '</strong></td></tr>';
        echo '<tr><th>cieploProxyUrl (runtime)</th><td><code>' . esc_html($cieplo_proxy_url) . '</code></td></tr>';
        echo '<tr><th>cieplo-proxy.php available</th><td><strong>' . ($cieplo_proxy_available ? 'YES' : 'NO') . '</strong></td></tr>';
        echo '<tr><th>Route registered</th><td><strong>' . ($route_registered ? 'YES' : 'NO') . '</strong></td></tr>';
        if (is_array($generator_summary)) {
            echo '<tr><th>Offer-doc generator endpoint</th><td><code>' . esc_html(isset($generator_summary['resolvedEndpoint']) ? (string) $generator_summary['resolvedEndpoint'] : '') . '</code></td></tr>';
            echo '<tr><th>Offer-doc endpoint source</th><td><code>' . esc_html(isset($generator_summary['endpointSource']) ? (string) $generator_summary['endpointSource'] : 'missing') . '</code></td></tr>';
            echo '<tr><th>Offer-doc key present</th><td><strong>' . (!empty($generator_summary['keyPresent']) ? 'YES' : 'NO') . '</strong></td></tr>';
            echo '<tr><th>Offer-doc key source</th><td><code>' . esc_html(isset($generator_summary['keySource']) ? (string) $generator_summary['keySource'] : 'missing') . '</code></td></tr>';
            echo '<tr><th>Offer-doc timeout</th><td><code>' . esc_html(isset($generator_summary['timeoutSeconds']) ? (string) ((int) $generator_summary['timeoutSeconds']) : '') . ' s</code> (' . esc_html(isset($generator_summary['timeoutSource']) ? (string) $generator_summary['timeoutSource'] : 'missing') . ')</td></tr>';
        }
        if ($last_dual_run) {
            $passed = isset($last_dual_run['passed']) && $last_dual_run['passed'] ? 'YES' : 'NO';
            $trace = isset($last_dual_run['traceId']) ? (string) $last_dual_run['traceId'] : '';
            $delta_kw = isset($last_dual_run['deltaKw']) ? (string) $last_dual_run['deltaKw'] : '';
            $delta_gross = isset($last_dual_run['deltaGross']) ? (string) $last_dual_run['deltaGross'] : '';
            echo '<tr><th>Last dual-run traceId</th><td><code>' . esc_html($trace) . '</code></td></tr>';
            echo '<tr><th>Last dual-run passed</th><td><strong>' . esc_html($passed) . '</strong></td></tr>';
            echo '<tr><th>Last dual-run deltas</th><td>kW=' . esc_html($delta_kw) . ', gross=' . esc_html($delta_gross) . '</td></tr>';
        } else {
            echo '<tr><th>Last dual-run</th><td><em>no data</em></td></tr>';
        }
        echo '</tbody>';
        echo '</table>';

        echo '<h2 style="margin-top:20px;">Route object</h2>';
        $route_obj = $route_registered ? $routes[$route_path] : array();
        $encoded = function_exists('wp_json_encode') ? wp_json_encode($route_obj, JSON_PRETTY_PRINT) : json_encode($route_obj, JSON_PRETTY_PRINT);
        echo '<pre style="background:#fff;padding:12px;border:1px solid #ccd0d4;max-width:1200px;overflow:auto;">' . esc_html((string) $encoded) . '</pre>';

        echo '<h2 style="margin-top:20px;">Runtime auth notes</h2>';
        echo '<ul style="max-width:1200px;">';
        echo '<li><code>X-Topinstal-Nonce</code> with <code>heatpump_calc_nonce</code> matches the public calculator/browser flow.</li>';
        echo '<li><code>X-WP-Nonce</code> with <code>wp_rest</code> is only needed when reproducing logged-in cookie-authenticated REST requests.</li>';
        echo '<li>Server-to-server smoke can use <code>X-Top-Instal-Agent-Key</code> instead of browser nonces.</li>';
        echo '</ul>';

        if ($last_dual_run) {
            echo '<h2 style="margin-top:20px;">Last Dual-run payload</h2>';
            $dual_run_encoded = function_exists('wp_json_encode')
                ? wp_json_encode($last_dual_run, JSON_PRETTY_PRINT)
                : json_encode($last_dual_run, JSON_PRETTY_PRINT);
            echo '<pre style="background:#fff;padding:12px;border:1px solid #ccd0d4;max-width:1200px;overflow:auto;">' . esc_html((string) $dual_run_encoded) . '</pre>';
        }

        echo '<p><em>Dev-only page. Controlled by <code>WP_DEBUG</code> or filter <code>topinstal_enable_smoke_tools</code>.</em></p>';
        echo '</div>';
    }
}
