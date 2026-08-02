<?php

declare(strict_types=1);

if (!defined('ABSPATH')) {
    define('ABSPATH', __DIR__ . '/');
}
if (!defined('TOP_INSTAL_PLUGIN_PATH')) {
    define('TOP_INSTAL_PLUGIN_PATH', rtrim(sys_get_temp_dir(), '/\\') . '/topinstal-readiness-harness/');
}
if (!is_dir(TOP_INSTAL_PLUGIN_PATH)) {
    @mkdir(TOP_INSTAL_PLUGIN_PATH, 0777, true);
}

require_once dirname(__DIR__, 2) . '/contracts/DocumentReasonCodes.php';
require_once dirname(__DIR__, 3) . '/wp-adapter/bootstrap/trace.php';
require_once dirname(__DIR__) . '/OfferDocumentException.php';
require_once dirname(__DIR__) . '/OfferDocumentInputMapper.php';
require_once dirname(__DIR__) . '/GenerateOfferDocumentUseCase.php';

class ReadinessHarnessKitsRepo {
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

class ReadinessHarnessTemplateSelector {
    public function select($input, $kit_info, $kit_group) {
        return array(
            'templateName' => 'dummy-template.docx',
            'templateKey' => 'dummy-template',
        );
    }
}

class ReadinessHarnessPlaceholderBuilder {
    public function build($input, $kit_info) {
        return array('KIT' => 'KIT-WC07');
    }
}

class ReadinessHarnessDocxRenderer {
    public function render($template_path, $output_path, $placeholders) {
        file_put_contents($output_path, 'DOCX-CONTENT');
    }
}

class ReadinessHarnessPdfConverterOk {
    public function convert_docx_to_pdf($docx_path, $pdf_output_path) {
        file_put_contents($pdf_output_path, 'PDF-CONTENT');
        return array('ok' => true, 'httpCode' => 200);
    }
}

class ReadinessHarnessPdfConverterFallback {
    public function convert_docx_to_pdf($docx_path, $pdf_output_path) {
        return array(
            'ok' => false,
            'errorCode' => TopInstal_DocumentReasonCodes::PDF_CONVERSION_FAILED,
            'httpCode' => 503,
        );
    }
}

class ReadinessHarnessPdfConverterNoArtifact {
    public function convert_docx_to_pdf($docx_path, $pdf_output_path) {
        return array('ok' => true, 'httpCode' => 200);
    }
}

class ReadinessHarnessStorage {
    private $dir;
    private $verify_docx;
    private $verify_pdf;

    public function __construct($dir, $verify_docx = true, $verify_pdf = true) {
        $this->dir = $dir;
        $this->verify_docx = (bool) $verify_docx;
        $this->verify_pdf = (bool) $verify_pdf;
    }

    public function create_docx_paths($installation_type, $trace_id) {
        if (!is_dir($this->dir)) {
            @mkdir($this->dir, 0777, true);
        }
        $docx_path = $this->dir . '/harness.docx';
        if (!$this->verify_docx && is_file($docx_path)) {
            @unlink($docx_path);
        }
        return array(
            'outputDir' => $this->dir,
            'docxFilename' => 'harness.docx',
            'docxPath' => $docx_path,
            'docxUrl' => 'https://example.local/harness.docx',
        );
    }

    public function to_pdf_paths($paths) {
        $pdf_path = dirname($paths['docxPath']) . '/harness.pdf';
        if (!$this->verify_pdf && is_file($pdf_path)) {
            @unlink($pdf_path);
        }
        return array(
            'pdfFilename' => 'harness.pdf',
            'pdfPath' => $pdf_path,
            'pdfUrl' => 'https://example.local/harness.pdf',
        );
    }

    public function cleanup_old_files($output_dir) {
    }
}

function readiness_request($trace_id = 'readiness-trace-001') {
    return array(
        'schemaVersion' => '1.0',
        'traceId' => $trace_id,
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
}

function assert_ready_pdf($response) {
    if (($response['status'] ?? '') !== 'success') {
        throw new RuntimeException('expected success status for ready pdf');
    }
    if (($response['document']['format'] ?? '') !== 'pdf') {
        throw new RuntimeException('expected pdf document format');
    }
    if (($response['readiness']['status'] ?? '') !== 'READY') {
        throw new RuntimeException('expected READY readiness status');
    }
    if (empty($response['document']['verified']) || empty($response['readiness']['artifactVerified'])) {
        throw new RuntimeException('expected verified artifact flags');
    }
}

function assert_degraded_docx($response) {
    if (($response['status'] ?? '') !== 'degraded') {
        throw new RuntimeException('expected degraded status');
    }
    if (($response['document']['format'] ?? '') !== 'docx') {
        throw new RuntimeException('expected docx document format');
    }
    if (($response['readiness']['status'] ?? '') !== 'DEGRADED') {
        throw new RuntimeException('expected DEGRADED readiness status');
    }
    if (($response['readiness']['degradedCode'] ?? '') !== TopInstal_DocumentReasonCodes::FALLBACK_DOCX_RETURNED) {
        throw new RuntimeException('expected FALLBACK_DOCX_RETURNED degraded code');
    }
    if (empty($response['readiness']['retryable'])) {
        throw new RuntimeException('expected degraded docx retryable flag');
    }
}

$dummy_template = TOP_INSTAL_PLUGIN_PATH . '/dummy-template.docx';
@file_put_contents($dummy_template, 'dummy-template');

$tmp_dir = rtrim(sys_get_temp_dir(), '/\\') . '/topinstal-readiness-contract';
if (!is_dir($tmp_dir)) {
    @mkdir($tmp_dir, 0777, true);
}

$ready_pdf = new TopInstal_GenerateOfferDocument_UseCase(
    new ReadinessHarnessKitsRepo(),
    new ReadinessHarnessTemplateSelector(),
    new ReadinessHarnessPlaceholderBuilder(),
    new ReadinessHarnessDocxRenderer(),
    new ReadinessHarnessPdfConverterOk(),
    new ReadinessHarnessStorage($tmp_dir . '/ready')
);
$ready_pdf_response = $ready_pdf->execute(readiness_request('readiness-pdf-ok'));
assert_ready_pdf($ready_pdf_response);

$fallback_docx = new TopInstal_GenerateOfferDocument_UseCase(
    new ReadinessHarnessKitsRepo(),
    new ReadinessHarnessTemplateSelector(),
    new ReadinessHarnessPlaceholderBuilder(),
    new ReadinessHarnessDocxRenderer(),
    new ReadinessHarnessPdfConverterFallback(),
    new ReadinessHarnessStorage($tmp_dir . '/fallback')
);
$fallback_docx_response = $fallback_docx->execute(readiness_request('readiness-docx-fallback'));
assert_degraded_docx($fallback_docx_response);

$missing_pdf = new TopInstal_GenerateOfferDocument_UseCase(
    new ReadinessHarnessKitsRepo(),
    new ReadinessHarnessTemplateSelector(),
    new ReadinessHarnessPlaceholderBuilder(),
    new ReadinessHarnessDocxRenderer(),
    new ReadinessHarnessPdfConverterNoArtifact(),
    new ReadinessHarnessStorage($tmp_dir . '/missing')
);

try {
    $missing_pdf->execute(readiness_request('readiness-missing-pdf'));
    throw new RuntimeException('expected storage error for missing pdf artifact');
} catch (TopInstal_OfferDocument_Exception $e) {
    if ($e->get_error_code() !== TopInstal_DocumentReasonCodes::STORAGE_ERROR) {
        throw $e;
    }
}

echo "[PASS] document readiness contract harness\n";
