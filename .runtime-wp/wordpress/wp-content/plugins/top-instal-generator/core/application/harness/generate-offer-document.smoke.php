<?php

declare(strict_types=1);

if (!defined('ABSPATH')) {
    define('ABSPATH', __DIR__ . '/');
}
if (!defined('TOP_INSTAL_PLUGIN_PATH')) {
    define('TOP_INSTAL_PLUGIN_PATH', rtrim(sys_get_temp_dir(), '/\\') . '/topinstal-harness-plugin/');
}
if (!is_dir(TOP_INSTAL_PLUGIN_PATH)) {
    @mkdir(TOP_INSTAL_PLUGIN_PATH, 0777, true);
}

require_once dirname(__DIR__, 2) . '/contracts/DocumentReasonCodes.php';
require_once dirname(__DIR__, 3) . '/wp-adapter/bootstrap/trace.php';
require_once dirname(__DIR__) . '/OfferDocumentException.php';
require_once dirname(__DIR__) . '/OfferDocumentInputMapper.php';
require_once dirname(__DIR__) . '/GenerateOfferDocumentUseCase.php';

class HarnessKitsRepo {
    public function find_kit($kit_model) {
        return array(
            'kit' => array(
                'power' => '7 kW',
                'voltage' => '230V',
                'indoor_unit' => 'INDOOR-X',
                'outdoor_unit' => 'OUTDOOR-Y',
            ),
            'group' => '1fazowe',
        );
    }
}

class HarnessTemplateSelector {
    public function select($input, $kit_info, $kit_group) {
        return array(
            'templateName' => 'dummy-template.docx',
            'templateKey' => 'dummy-template',
        );
    }
}

class HarnessPlaceholderBuilder {
    public function build($input, $kit_info) {
        return array('KIT' => 'KIT-WC07');
    }
}

class HarnessDocxRenderer {
    public function render($template_path, $output_path, $placeholders) {
        file_put_contents($output_path, 'DOCX');
    }
}

class HarnessPdfConverter {
    public function convert_docx_to_pdf($docx_path, $pdf_output_path) {
        file_put_contents($pdf_output_path, 'PDF');
        return array('ok' => true, 'httpCode' => 200);
    }
}

class HarnessStorage {
    public function create_docx_paths($installation_type, $trace_id) {
        $dir = sys_get_temp_dir() . '/topinstal-doc-harness';
        if (!is_dir($dir)) {
            @mkdir($dir, 0777, true);
        }
        return array(
            'outputDir' => $dir,
            'docxFilename' => 'harness.docx',
            'docxPath' => $dir . '/harness.docx',
            'docxUrl' => 'https://example.local/harness.docx',
        );
    }

    public function to_pdf_paths($paths) {
        return array(
            'pdfFilename' => 'harness.pdf',
            'pdfPath' => dirname($paths['docxPath']) . '/harness.pdf',
            'pdfUrl' => 'https://example.local/harness.pdf',
        );
    }

    public function cleanup_old_files($output_dir) {
    }
}

$dummy_template = TOP_INSTAL_PLUGIN_PATH . '/dummy-template.docx';
@file_put_contents($dummy_template, 'dummy');

$use_case = new TopInstal_GenerateOfferDocument_UseCase(
    new HarnessKitsRepo(),
    new HarnessTemplateSelector(),
    new HarnessPlaceholderBuilder(),
    new HarnessDocxRenderer(),
    new HarnessPdfConverter(),
    new HarnessStorage()
);

$request = array(
    'schemaVersion' => '1.0',
    'traceId' => 'smoke-trace-001',
    'mode' => 'direct-config',
    'documentType' => 'offer_document',
    'outputFormat' => 'pdf',
    'payload' => array(
        'installationType' => 'heat_pump',
        'kitModel' => 'KIT-WC07',
        'has_cwu' => 1,
        'tank_capacity' => '200',
        'has_buffer' => 0,
        'buffer_capacity' => 'none',
        'custom_price' => 41000,
    ),
);

$response = $use_case->execute($request);
$required = array('schemaVersion', 'traceId', 'status', 'document', 'meta', 'warnings');
foreach ($required as $key) {
    if (!array_key_exists($key, $response)) {
        fwrite(STDERR, '[FAIL] missing key: ' . $key . PHP_EOL);
        exit(1);
    }
}
if (!isset($response['document']['format']) || $response['document']['format'] !== 'pdf') {
    fwrite(STDERR, '[FAIL] expected PDF document format' . PHP_EOL);
    exit(1);
}

echo '[PASS] generate-offer-document smoke: trace=' . $response['traceId'] . ', file=' . $response['document']['filename'] . PHP_EOL;
