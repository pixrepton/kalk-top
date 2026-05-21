<?php
require_once 'C:/Users/compg/Desktop/kalk-top/.runtime-wp/wordpress/wp-load.php';
require_once ABSPATH . 'wp-admin/includes/plugin.php';
if (!is_plugin_active('topinstal-heatpump-calculator/heatpump-calculator.php')) {
    $res = activate_plugin('topinstal-heatpump-calculator/heatpump-calculator.php');
}
if (!is_plugin_active('top-instal-generator/top-instal-generator.php')) {
    $res = activate_plugin('top-instal-generator/top-instal-generator.php');
}
update_option('topinstal_agent_offer_documents_endpoint', 'http://127.0.0.1:8090/wp-json/topinstal/v1/offer-documents/generate');
update_option('topinstal_agent_offer_documents_agent_key', 'doc-agent-key-xyz');
update_option('top_instal_agent_api_key', 'doc-agent-key-xyz');
update_option('top_instal_pdf_converter_url', 'http://127.0.0.1:8091/forms/libreoffice/convert');
update_option('top_instal_pdf_converter_token', 'runtime-converter-token');

if (!function_exists('topinstal_get_cieplo_agent_orchestrator')) {
    require_once 'C:/Users/compg/Desktop/kalk-top/heatpump-calculator.php';
}
$fixture = 'C:/Users/compg/Desktop/kalk-top/core/infrastructure/agents/test_station/fixtures/cieplo_sample.html';
$mock_body = "Nowe zapytanie cieplo.app\nAdres e-mail: klient.runtime@example.com\nTelefon: +48 600 700 800\nLokalizacja: Trzebinia\nLink do wyniku: https://cieplo.app/wynik/runtime123\n";
$orchestrator = topinstal_get_cieplo_agent_orchestrator();
$result = $orchestrator->processRawEmail($mock_body, array(
  'skipGmail' => true,
  'fixtureHtmlPath' => $fixture,
  'skipPdf' => false,
));
echo wp_json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . PHP_EOL;
?>
