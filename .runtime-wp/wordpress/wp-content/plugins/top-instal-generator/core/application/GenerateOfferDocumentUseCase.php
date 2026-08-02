<?php

if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists('TopInstal_GenerateOfferDocument_UseCase')) {
    class TopInstal_GenerateOfferDocument_UseCase {
        /** @var TopInstal_KitsRepository_Wp */
        private $kits_repository;
        /** @var TopInstal_TemplateSelector_Service */
        private $template_selector;
        /** @var TopInstal_PlaceholderBuilder_Service */
        private $placeholder_builder;
        /** @var TopInstal_DocxTemplateRenderer_Service */
        private $docx_renderer;
        /** @var TopInstal_PdfConverterClient_Wp */
        private $pdf_converter;
        /** @var TopInstal_OfferFileStorage_Wp */
        private $storage;

        /**
         * @param TopInstal_KitsRepository_Wp|null $kits_repository
         * @param TopInstal_TemplateSelector_Service|null $template_selector
         * @param TopInstal_PlaceholderBuilder_Service|null $placeholder_builder
         * @param TopInstal_DocxTemplateRenderer_Service|null $docx_renderer
         * @param TopInstal_PdfConverterClient_Wp|null $pdf_converter
         * @param TopInstal_OfferFileStorage_Wp|null $storage
         */
        public function __construct(
            $kits_repository = null,
            $template_selector = null,
            $placeholder_builder = null,
            $docx_renderer = null,
            $pdf_converter = null,
            $storage = null
        ) {
            $this->kits_repository = $kits_repository ?: new TopInstal_KitsRepository_Wp();
            $this->template_selector = $template_selector ?: new TopInstal_TemplateSelector_Service();
            $this->placeholder_builder = $placeholder_builder ?: new TopInstal_PlaceholderBuilder_Service();
            $this->docx_renderer = $docx_renderer ?: new TopInstal_DocxTemplateRenderer_Service();
            $this->pdf_converter = $pdf_converter ?: new TopInstal_PdfConverterClient_Wp();
            $this->storage = $storage ?: new TopInstal_OfferFileStorage_Wp();
        }

        /**
         * @param array<string,mixed> $request_dto
         * @return array<string,mixed>
         */
        public function execute($request_dto) {
            if (!is_array($request_dto)) {
                throw new TopInstal_OfferDocument_Exception(
                    TopInstal_DocumentReasonCodes::VALIDATION_ERROR,
                    'OfferDocumentRequestDTO must be a JSON object.',
                    400
                );
            }

            $trace_id = topinstal_ensure_trace_id(isset($request_dto['traceId']) ? $request_dto['traceId'] : null);
            $warnings = array();

            $mode = isset($request_dto['mode']) ? trim((string) $request_dto['mode']) : '';
            if ($mode === '') {
                $mode = isset($request_dto['offerDto']) || isset($request_dto['payload']['offerDto'])
                    ? 'from-offer-dto'
                    : 'direct-config';
            }

            if ($mode === 'from-offer-dto') {
                $input = TopInstal_OfferDocument_InputMapper::map_from_offer_dto($request_dto, $warnings);
            } elseif ($mode === 'direct-config') {
                $input = TopInstal_OfferDocument_InputMapper::map_direct_config($request_dto, $warnings);
            } else {
                throw new TopInstal_OfferDocument_Exception(
                    TopInstal_DocumentReasonCodes::UNSUPPORTED_MODE,
                    'Unsupported mode. Allowed: direct-config, from-offer-dto.',
                    400
                );
            }

            $document_type = isset($input['documentType']) ? trim((string) $input['documentType']) : 'offer_document';
            if (!in_array($document_type, array('offer_document', 'offer_pdf', 'offer'), true)) {
                throw new TopInstal_OfferDocument_Exception(
                    TopInstal_DocumentReasonCodes::UNSUPPORTED_DOCUMENT_TYPE,
                    'Unsupported documentType.',
                    400
                );
            }

            $output_format = TopInstal_OfferDocument_InputMapper::normalize_output_format(
                isset($input['outputFormat']) ? (string) $input['outputFormat'] : 'pdf'
            );
            if (!in_array($output_format, array('docx', 'pdf'), true)) {
                throw new TopInstal_OfferDocument_Exception(
                    TopInstal_DocumentReasonCodes::UNSUPPORTED_OUTPUT_FORMAT,
                    'Unsupported outputFormat.',
                    400
                );
            }

            $installation_type = isset($input['installationType']) ? (string) $input['installationType'] : 'heat_pump';
            if (!in_array($installation_type, array('heat_pump', 'floor_heating'), true)) {
                throw new TopInstal_OfferDocument_Exception(
                    TopInstal_DocumentReasonCodes::VALIDATION_ERROR,
                    'Unsupported installation type.',
                    400,
                    array('errors' => array(
                        array(
                            'field' => 'payload.installationType',
                            'code' => 'INVALID_VALUE',
                            'message' => 'Allowed values: heat_pump, floor_heating.',
                        ),
                    ))
                );
            }

            $kit_info = null;
            $kit_group = '';
            if ($installation_type === 'heat_pump') {
                $kit_model = isset($input['kitModel']) ? trim((string) $input['kitModel']) : '';
                if ($kit_model === '') {
                    throw new TopInstal_OfferDocument_Exception(
                        TopInstal_DocumentReasonCodes::VALIDATION_ERROR,
                        'kitModel is required for heat_pump installation.',
                        400,
                        array('errors' => array(
                            array(
                                'field' => 'payload.kitModel',
                                'code' => 'REQUIRED',
                                'message' => 'kitModel is required for heat_pump installation.',
                            ),
                        ))
                    );
                }

                $kit_resolved = $this->kits_repository->find_kit($kit_model);
                $kit_info = isset($kit_resolved['kit']) && is_array($kit_resolved['kit']) ? $kit_resolved['kit'] : null;
                $kit_group = isset($kit_resolved['group']) ? (string) $kit_resolved['group'] : '';
                if ($kit_info === null) {
                    throw new TopInstal_OfferDocument_Exception(
                        TopInstal_DocumentReasonCodes::KIT_NOT_FOUND,
                        'Selected kit model was not found.',
                        404,
                        array('kitModel' => $kit_model)
                    );
                }
            }

            $template = $this->template_selector->select($input, $kit_info, $kit_group);
            $template_name = isset($template['templateName']) ? (string) $template['templateName'] : '';
            $template_key = isset($template['templateKey']) ? (string) $template['templateKey'] : '';
            $template_path = rtrim((string) TOP_INSTAL_PLUGIN_PATH, '/\\') . '/' . $template_name;
            if ($template_name === '' || !is_file($template_path)) {
                throw new TopInstal_OfferDocument_Exception(
                    TopInstal_DocumentReasonCodes::TEMPLATE_NOT_FOUND,
                    'Document template is missing.',
                    500,
                    array('templateName' => $template_name)
                );
            }

            $placeholders = $this->placeholder_builder->build($input, $kit_info);

            $paths = $this->storage->create_docx_paths($installation_type, $trace_id);
            $this->docx_renderer->render($template_path, $paths['docxPath'], $placeholders);

            $final_format = 'docx';
            $final_filename = $paths['docxFilename'];
            $final_url = $paths['docxUrl'];
            $final_path = $paths['docxPath'];
            $converter_mode = 'none';

            if ($output_format === 'pdf') {
                $pdf_paths = $this->storage->to_pdf_paths($paths);
                $conversion = $this->pdf_converter->convert_docx_to_pdf($paths['docxPath'], $pdf_paths['pdfPath']);
                if (!empty($conversion['ok'])) {
                    $final_format = 'pdf';
                    $final_filename = $pdf_paths['pdfFilename'];
                    $final_url = $pdf_paths['pdfUrl'];
                    $final_path = $pdf_paths['pdfPath'];
                    $converter_mode = 'gotenberg';
                } else {
                    $converter_mode = 'fallback-docx';
                    $warnings[] = array(
                        'code' => TopInstal_DocumentReasonCodes::FALLBACK_DOCX_RETURNED,
                        'message' => 'PDF conversion failed; DOCX returned.',
                        'params' => array(
                            'errorCode' => isset($conversion['errorCode']) ? $conversion['errorCode'] : TopInstal_DocumentReasonCodes::PDF_CONVERSION_FAILED,
                            'httpCode' => isset($conversion['httpCode']) ? (int) $conversion['httpCode'] : 0,
                        ),
                    );
                }
            }

            $artifact_verified = self::verify_generated_artifact($final_path);
            if (!$artifact_verified) {
                throw new TopInstal_OfferDocument_Exception(
                    TopInstal_DocumentReasonCodes::STORAGE_ERROR,
                    'Generated document artifact is missing or empty.',
                    500,
                    array(
                        'requestedFormat' => $output_format,
                        'actualFormat' => $final_format,
                        'converter' => $converter_mode,
                    )
                );
            }

            $this->storage->cleanup_old_files($paths['outputDir']);

            $document_id = function_exists('topinstal_generate_document_id')
                ? topinstal_generate_document_id()
                : topinstal_create_trace_id();
            $readiness = self::build_readiness_contract(
                $output_format,
                $final_format,
                $converter_mode,
                $artifact_verified
            );

            $result = array(
                'schemaVersion' => '1.0',
                'traceId' => $trace_id,
                'documentId' => $document_id,
                'status' => $readiness['status'] === 'DEGRADED' ? 'degraded' : 'success',
                'document' => array(
                    'format' => $final_format,
                    'filename' => $final_filename,
                    'downloadUrl' => $final_url,
                    'mimeType' => $final_format === 'pdf'
                        ? 'application/pdf'
                        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'exists' => $artifact_verified,
                    'verified' => $artifact_verified,
                ),
                'readiness' => $readiness,
                'meta' => array(
                    'generatedAt' => gmdate('c'),
                    'templateKey' => $template_key,
                    'mode' => $mode,
                    'documentType' => $document_type,
                    'converter' => $converter_mode,
                ),
                'warnings' => $warnings,
            );

            self::emit_document_success($request_dto, $trace_id, $result, $converter_mode);

            return $result;
        }

        /**
         * @param array<string,mixed> $request_dto
         * @param string $trace_id
         * @param array<string,mixed> $result
         * @param string $converter_mode
         * @return void
         */
        private function emit_document_success($request_dto, $trace_id, $result, $converter_mode) {
            if (!class_exists('TopInstal_Generator_OsEvent_Client')) {
                return;
            }

            $format = isset($result['document']['format']) ? (string) $result['document']['format'] : '';
            $is_fallback = $converter_mode === 'fallback-docx';
            $event_type = $is_fallback ? 'generator.document.fallback_docx' : 'generator.document.ready';
            $summary = $is_fallback
                ? 'Generator: PDF niedostępny — zwrócono DOCX'
                : 'Generator: dokument oferty gotowy (' . ($format !== '' ? strtoupper($format) : 'DOC') . ')';

            TopInstal_Generator_OsEvent_Client::emit(
                $event_type,
                $summary,
                $is_fallback ? 'warning' : 'ok',
                self::resolve_engagement_id($request_dto),
                array(
                    'trace_id' => $trace_id,
                    'document_id' => isset($result['documentId']) ? (string) $result['documentId'] : '',
                    'format' => $format,
                    'converter' => $converter_mode,
                ),
                array(
                    'trace_id' => $trace_id,
                )
            );
        }

        /**
         * @param array<string,mixed> $request_dto
         * @return string
         */
        private static function resolve_engagement_id($request_dto) {
            if (!is_array($request_dto)) {
                return '';
            }
            if (isset($request_dto['engagementId'])) {
                return trim((string) $request_dto['engagementId']);
            }
            if (isset($request_dto['engagement_id'])) {
                return trim((string) $request_dto['engagement_id']);
            }
            $offer = isset($request_dto['offerDto']) && is_array($request_dto['offerDto'])
                ? $request_dto['offerDto']
                : array();
            if (isset($offer['engagementId'])) {
                return trim((string) $offer['engagementId']);
            }
            if (isset($offer['engagement_id'])) {
                return trim((string) $offer['engagement_id']);
            }

            return '';
        }

        /**
         * @param string $artifact_path
         * @return bool
         */
        private static function verify_generated_artifact($artifact_path) {
            if (!is_string($artifact_path) || trim($artifact_path) === '') {
                return false;
            }
            if (!is_file($artifact_path)) {
                return false;
            }
            $size = @filesize($artifact_path);
            return is_int($size) && $size > 0;
        }

        /**
         * @param string $requested_format
         * @param string $actual_format
         * @param string $converter_mode
         * @param bool $artifact_verified
         * @return array<string,mixed>
         */
        private static function build_readiness_contract($requested_format, $actual_format, $converter_mode, $artifact_verified) {
            $is_degraded = $requested_format === 'pdf' && $actual_format !== 'pdf';
            $degraded_code = $is_degraded
                ? TopInstal_DocumentReasonCodes::FALLBACK_DOCX_RETURNED
                : '';

            return array(
                'status' => $is_degraded ? 'DEGRADED' : 'READY',
                'requestedFormat' => $requested_format,
                'actualFormat' => $actual_format,
                'artifactExists' => $artifact_verified,
                'artifactVerified' => $artifact_verified,
                'retryable' => $is_degraded && $converter_mode === 'fallback-docx',
                'degradedCode' => $degraded_code,
                'failureCode' => '',
            );
        }
    }
}
