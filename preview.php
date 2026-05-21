<?php
declare(strict_types=1);

define('ABSPATH', __DIR__ . DIRECTORY_SEPARATOR);

if (!function_exists('esc_url')) {
    function esc_url($value): string {
        return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
    }
}

if (!function_exists('esc_attr')) {
    function esc_attr($value): string {
        return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
    }
}

if (!function_exists('wp_generate_uuid4')) {
    function wp_generate_uuid4(): string {
        return sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
    }
}

$kalkulator_url = './kalkulator';
$konfigurator_url = './konfigurator';
$img_url = './img';
$libraries_url = './libraries';
$instance_id = wp_generate_uuid4();

/**
 * @return array<string,mixed>
 */
function preview_get_buffer_rules(): array {
    $bootstrap = array(
        __DIR__ . '/wp-adapter/repositories/MasterDataRepositoryWp.php',
        __DIR__ . '/wp-adapter/repositories/BufferRulesRepositoryWp.php',
    );
    foreach ($bootstrap as $file) {
        if (file_exists($file)) {
            require_once $file;
        }
    }
    if (!class_exists('TopInstal_BufferRulesRepository_Wp')) {
        return array();
    }
    $repository = new TopInstal_BufferRulesRepository_Wp();
    $rules = $repository->get_rules();
    return is_array($rules) ? $rules : array();
}

$config = [
    'baseUrl' => '.',
    'pluginVersion' => 'preview',
    'uiVersion' => 'preview',
    'kalkulatorUrl' => $kalkulator_url,
    'konfiguratorUrl' => $konfigurator_url,
    'imgUrl' => $img_url,
    'librariesUrl' => $libraries_url,
    'ajaxUrl' => './admin-ajax.php',
    'nonce' => 'preview-nonce',
    'useBackendCalc' => true,
    'bufferRules' => preview_get_buffer_rules(),
    'calculateOfferEndpoint' => './wp-json/topinstal/v1/calculate-offer',
    'calculateOfferTimeoutMs' => 15000,
    'dualRunDev' => false,
    'dualRunToleranceKw' => 0.2,
    'dualRunToleranceGross' => 100,
    'dualRunDebugEnabled' => false,
    'dualRunDebugAction' => 'heatpump_dual_run_log',
    'dualRunDebugEndpoint' => './admin-ajax.php',
    'siteUrl' => '.',
    // Preview bez WordPress: brak bundlowanego proxy — wysyłka email wymaga prawdziwego HEATPUMP_CONFIG z produkcji.
    'emailProxyUrl' => '',
    'emailProxyAvailable' => false,
    'uploadsUrl' => './uploads/',
];

$styles = [
    'https://fonts.googleapis.com/css2?family=Titillium+Web:wght@300;400;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/remixicon@3.5.0/fonts/remixicon.css',
    './kalkulator/css/wordpress-integration.css',
    './kalkulator/css/main.css',
    './kalkulator/css/error-system.css',
    './kalkulator/css/onboarding-modal.css',
    './kalkulator/css/workflow-system.css',
    './kalkulator/css/mobile-redesign.css',
    './konfigurator/configurator.css',
    './konfigurator/configurator-v2-flat.css',
];

$scripts = [
    'elementor-fix.js',
    'logger.js',
    'traceId.js',
    'scopedDom.js',
    'gdpr-compliance.js',
    'tooltipSystem.js',
    'floorRenderer.js',
    'urlManager.js',
    'state.js',
    'offerPayload.js',
    'analytics.js',
    'rules.js',
    'visibility.js',
    'enablement.js',
    'render.js',
    'engine.js',
    'progressiveDisclosure.js',
    'formDataProcessor.js',
    'mapUiStateToCalcRequestDTO.js',
    'topinstalApi.js',
    'apiCaller.js',
    'downloadPDF.js',
    'pdfGenerator.js',
    'emailSender.js',
    'aiWatchers.js',
    'errorHandler.js',
    'onboardingSystem.js',
    'workflowController.js',
    'pumpMatchingTable.js',
    'offerSummary.js',
    'resultsRenderer.js',
    'tabNavigation.js',
    'calculatorUI.js',
    'motionSystem.js',
    'mobileController.js',
    'calculatorInit.js',
];

function script_src(string $script): string {
    if (strpos($script, 'engine/') === 0) {
        return './kalkulator/' . $script;
    }
    return './kalkulator/js/' . $script;
}
?>
<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>TOP-INSTAL Calculator Preview</title>
  <?php foreach ($styles as $href): ?>
    <link rel="stylesheet" href="<?php echo esc_url($href); ?>">
  <?php endforeach; ?>
  <style>
    body { margin: 0; background: #faf9f9; }
  </style>
  <script>
    window.HEATPUMP_CONFIG = <?php echo json_encode($config, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); ?>;
  </script>
</head>
<body>
  <?php include __DIR__ . '/kalkulator/calculator.php'; ?>

  <script src="https://unpkg.com/@phosphor-icons/web"></script>
  <script src="./libraries/html2pdf.bundle.min.js"></script>
  <script src="./libraries/html2canvas.min.js"></script>
  <script src="./libraries/jspdf.umd.min.js"></script>
  <?php foreach ($scripts as $script): ?>
    <?php if ($script === 'calculatorInit.js') { continue; } ?>
    <script src="<?php echo esc_url(script_src($script)); ?>"></script>
  <?php endforeach; ?>

  <script src="./konfigurator/configurator-unified.js"></script>
  <script src="./kalkulator/js/calculatorInit.js"></script>
</body>
</html>
