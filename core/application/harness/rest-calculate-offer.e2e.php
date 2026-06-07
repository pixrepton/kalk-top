<?php


require_once __DIR__ . '/harness-lib.php';

/**
 * @param string $base_url
 * @return array<int,string>
 */
function topinstal_rest_resolve_endpoints(string $base_url): array
{
    $normalized = rtrim(trim($base_url), '/');
    if ($normalized === '') {
        return array();
    }

    if (preg_match('#/wp-json/topinstal/v1/calculate-offer/?$#', $normalized)) {
        return array($normalized);
    }

    if (preg_match('#(?:\?|&)rest_route=/topinstal/v1/calculate-offer(?:&|$)#', $normalized)) {
        return array($normalized);
    }

    $candidates = array(
        $normalized . '/wp-json/topinstal/v1/calculate-offer',
        $normalized . '/index.php?rest_route=/topinstal/v1/calculate-offer',
        $normalized . '/?rest_route=/topinstal/v1/calculate-offer',
    );

    return array_values(array_unique($candidates));
}

/**
 * @param string $message
 * @return never
 */
function topinstal_rest_skip(string $message): void
{
    echo '[SKIP] ' . $message . PHP_EOL;
    exit(0);
}

/**
 * @param string $message
 * @return never
 */
function topinstal_rest_fail(string $message): void
{
    fwrite(STDERR, '[FAIL] ' . $message . PHP_EOL);
    exit(1);
}

/**
 * @param string $endpoint
 * @param array<int,string> $headers
 * @param string $body
 * @return array{status:int,body:string|null,error:string|null}
 */
function topinstal_rest_post(string $endpoint, array $headers, string $body): array
{
    $status_code = 0;
    $response_body = null;
    $error_message = null;

    if (function_exists('curl_init')) {
        $ch = curl_init($endpoint);
        if ($ch === false) {
            return array(
                'status' => 0,
                'body' => null,
                'error' => 'curl_init failed.',
            );
        }

        curl_setopt_array($ch, array(
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_TIMEOUT => 20,
        ));

        $response_body = curl_exec($ch);
        if ($response_body === false) {
            $error_message = curl_error($ch);
        }
        $status_code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);

        return array(
            'status' => $status_code,
            'body' => $response_body === false ? null : (string) $response_body,
            'error' => $error_message,
        );
    }

    $context = stream_context_create(array(
        'http' => array(
            'method' => 'POST',
            'header' => implode("\r\n", $headers),
            'content' => $body,
            'ignore_errors' => true,
            'timeout' => 20,
        ),
    ));

    $response_body = @file_get_contents($endpoint, false, $context);
    if ($response_body === false) {
        $error_message = 'HTTP request failed (file_get_contents).';
    }

    if (isset($http_response_header) && is_array($http_response_header) && isset($http_response_header[0])) {
        if (preg_match('/\s(\d{3})\s/', $http_response_header[0], $matches)) {
            $status_code = (int) $matches[1];
        }
    }

    return array(
        'status' => $status_code,
        'body' => $response_body === false ? null : (string) $response_body,
        'error' => $error_message,
    );
}

$base_url = getenv('TOPINSTAL_REST_BASE_URL');
if (!is_string($base_url) || trim($base_url) === '') {
    topinstal_rest_skip('TOPINSTAL_REST_BASE_URL is not set. Skipping REST e2e (no WP environment configured).');
}

$endpoints = topinstal_rest_resolve_endpoints($base_url);
if ($endpoints === array()) {
    topinstal_rest_fail('Unable to resolve REST endpoint from TOPINSTAL_REST_BASE_URL.');
}

$custom_nonce = getenv('TOPINSTAL_REST_NONCE');
$wp_rest_nonce = getenv('TOPINSTAL_REST_WP_NONCE');
$agent_key = getenv('TOPINSTAL_REST_AGENT_KEY');
$headers = array(
    'Content-Type: application/json',
    'Accept: application/json',
);
if (is_string($custom_nonce) && trim($custom_nonce) !== '') {
    $headers[] = 'X-Topinstal-Nonce: ' . trim($custom_nonce);
}
if (is_string($wp_rest_nonce) && trim($wp_rest_nonce) !== '') {
    $headers[] = 'X-WP-Nonce: ' . trim($wp_rest_nonce);
}
if (is_string($agent_key) && trim($agent_key) !== '') {
    $headers[] = 'X-Top-Instal-Agent-Key: ' . trim($agent_key);
}
if (count($headers) === 2) {
    topinstal_rest_fail(
        'Missing auth material. Set TOPINSTAL_REST_NONCE (public/custom UI nonce) or TOPINSTAL_REST_AGENT_KEY. ' .
        'If you need logged-in cookie auth parity, also set TOPINSTAL_REST_WP_NONCE.'
    );
}

$request = topinstal_harness_load_fixture('baseline-floor-heating.json');
$body = json_encode($request);
if ($body === false) {
    topinstal_rest_fail('Unable to encode request fixture.');
}

$failures = array();

foreach ($endpoints as $endpoint) {
    $result = topinstal_rest_post($endpoint, $headers, $body);
    $status_code = $result['status'];
    $response_body = $result['body'];
    $error_message = $result['error'];

    if ($response_body === null) {
        if ($error_message !== null && preg_match('/timed? ?out|resolve|could not|failed to connect/i', $error_message)) {
            topinstal_rest_skip('Cannot reach REST endpoint (' . $endpoint . '): ' . $error_message);
        }
        $failures[] = $endpoint . ' -> no response body' . ($error_message !== null ? ' (' . $error_message . ')' : '');
        continue;
    }

    if ($status_code < 200 || $status_code >= 300) {
        $failures[] = $endpoint . ' -> HTTP ' . $status_code . ' body=' . substr($response_body, 0, 220);
        continue;
    }

    $decoded = topinstal_harness_decode_json($response_body);
    if ($decoded === null) {
        $failures[] = $endpoint . ' -> invalid JSON body=' . substr($response_body, 0, 220);
        continue;
    }

    $offer = $decoded;
    if (isset($decoded['data']) && is_array($decoded['data'])) {
        $offer = $decoded['data'];
    }

    if (isset($decoded['success']) && $decoded['success'] === true && isset($decoded['data']) && is_array($decoded['data'])) {
        $offer = $decoded['data'];
    }

    if (!is_array($offer)) {
        $failures[] = $endpoint . ' -> response missing offer payload';
        continue;
    }

    try {
        topinstal_harness_assert_offer_shape($offer, 'rest-e2e');
    } catch (RuntimeException $exception) {
        $failures[] = $endpoint . ' -> ' . $exception->getMessage();
        continue;
    }

    echo '[PASS] REST calculate-offer e2e: ' . $endpoint . PHP_EOL;
    exit(0);
}

topinstal_rest_fail(
    'All candidate REST endpoints failed. ' .
    implode(' | ', $failures)
);
