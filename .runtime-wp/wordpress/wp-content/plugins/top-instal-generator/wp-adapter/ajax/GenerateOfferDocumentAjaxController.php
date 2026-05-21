<?php

if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists('TopInstal_Ajax_GenerateOfferDocument_Controller')) {
    class TopInstal_Ajax_GenerateOfferDocument_Controller {
        /**
         * @return void
         */
        public static function register_hooks() {
            add_action('wp_ajax_simple_generate', array(__CLASS__, 'handle_simple_generate'));
            add_action('wp_ajax_nopriv_simple_generate', array(__CLASS__, 'handle_simple_generate'));
            add_action('wp_ajax_topinstal_generate_offer_document', array(__CLASS__, 'handle_structured_generate'));
            add_action('wp_ajax_nopriv_topinstal_generate_offer_document', array(__CLASS__, 'handle_structured_generate'));
        }

        /**
         * Legacy endpoint compatibility.
         *
         * @return void
         */
        public static function handle_simple_generate() {
            check_ajax_referer('top_instal_nonce', 'nonce');

            $input = self::extract_legacy_payload();
            if (!is_array($input)) {
                wp_send_json_error(array(
                    'traceId' => topinstal_ensure_trace_id(null),
                    'errorCode' => TopInstal_DocumentReasonCodes::VALIDATION_ERROR,
                    'message' => 'Invalid JSON input.',
                ), 400);
            }

            $trace_id = topinstal_ensure_trace_id(isset($input['traceId']) ? $input['traceId'] : null);
            $request_dto = self::build_request_from_legacy($input, $trace_id);
            self::execute_and_respond($request_dto, true);
        }

        /**
         * Structured AJAX endpoint for internal tools.
         *
         * @return void
         */
        public static function handle_structured_generate() {
            check_ajax_referer('top_instal_nonce', 'nonce');
            $raw = isset($_POST['request']) ? (string) wp_unslash($_POST['request']) : '';
            $request = $raw !== '' ? json_decode($raw, true) : null;
            if (!is_array($request)) {
                wp_send_json_error(array(
                    'traceId' => topinstal_ensure_trace_id(null),
                    'errorCode' => TopInstal_DocumentReasonCodes::VALIDATION_ERROR,
                    'message' => 'request must be a JSON object.',
                ), 400);
            }
            self::execute_and_respond($request, false);
        }

        /**
         * @param array<string,mixed> $request_dto
         * @param bool $legacy_shape
         * @return void
         */
        private static function execute_and_respond($request_dto, $legacy_shape) {
            $trace_id = topinstal_ensure_trace_id(isset($request_dto['traceId']) ? $request_dto['traceId'] : null);
            $request_dto['traceId'] = $trace_id;

            $errors = TopInstal_OfferDocumentRequest_Validator::validate($request_dto);
            if (!empty($errors)) {
                wp_send_json_error(array(
                    'traceId' => $trace_id,
                    'errorCode' => TopInstal_DocumentReasonCodes::VALIDATION_ERROR,
                    'message' => 'Invalid OfferDocumentRequestDTO payload.',
                    'details' => array('errors' => $errors),
                ), 400);
            }

            try {
                $use_case = new TopInstal_GenerateOfferDocument_UseCase();
                $result = $use_case->execute($request_dto);
            } catch (TopInstal_OfferDocument_Exception $e) {
                wp_send_json_error(array(
                    'traceId' => $trace_id,
                    'errorCode' => $e->get_error_code(),
                    'message' => $e->getMessage(),
                    'details' => $e->get_details(),
                ), $e->get_status());
            } catch (Throwable $e) {
                TopInstal_Logger_Wp::error('ajax simple_generate failed', array(
                    'traceId' => $trace_id,
                    'message' => $e->getMessage(),
                ));
                wp_send_json_error(array(
                    'traceId' => $trace_id,
                    'errorCode' => 'DOCUMENT_GENERATION_FAILED',
                    'message' => 'Offer document generation failed on server.',
                ), 500);
            }

            if ($legacy_shape) {
                wp_send_json_success(array(
                    'filename' => isset($result['document']['filename']) ? $result['document']['filename'] : '',
                    'download_url' => isset($result['document']['downloadUrl']) ? $result['document']['downloadUrl'] : '',
                    'traceId' => isset($result['traceId']) ? $result['traceId'] : $trace_id,
                    'document' => isset($result['document']) ? $result['document'] : array(),
                    'meta' => isset($result['meta']) ? $result['meta'] : array(),
                    'warnings' => isset($result['warnings']) ? $result['warnings'] : array(),
                ));
            }

            wp_send_json_success($result);
        }

        /**
         * @return array<string,mixed>|null
         */
        private static function extract_legacy_payload() {
            $raw = isset($_POST['data']) ? (string) wp_unslash($_POST['data']) : '';
            if ($raw === '') {
                return null;
            }
            $decoded = json_decode($raw, true);
            if (!is_array($decoded)) {
                return null;
            }
            return $decoded;
        }

        /**
         * @param array<string,mixed> $input
         * @param string $trace_id
         * @return array<string,mixed>
         */
        private static function build_request_from_legacy($input, $trace_id) {
            return array(
                'schemaVersion' => '1.0',
                'traceId' => $trace_id,
                'mode' => 'direct-config',
                'documentType' => 'offer_document',
                'outputFormat' => isset($input['output_format']) ? (string) $input['output_format'] : 'pdf',
                'payload' => array(
                    'installationType' => isset($input['installation_type']) ? (string) $input['installation_type'] : 'heat_pump',
                    'kitModel' => isset($input['kit_model']) ? (string) $input['kit_model'] : '',
                    'powerKw' => isset($input['power_kw']) && is_numeric($input['power_kw']) ? (int) $input['power_kw'] : null,
                    'tank' => array(
                        'enabled' => isset($input['has_cwu']) ? self::to_bool($input['has_cwu']) : true,
                        'capacity' => isset($input['tank_capacity']) ? (string) $input['tank_capacity'] : '200',
                        'manufacturer' => isset($input['tank_manufacturer']) ? (string) $input['tank_manufacturer'] : '',
                    ),
                    'buffer' => array(
                        'enabled' => isset($input['has_buffer']) ? self::to_bool($input['has_buffer']) : false,
                        'capacity' => isset($input['buffer_capacity']) ? (string) $input['buffer_capacity'] : 'none',
                    ),
                    'pricing' => array(
                        'customPriceGross' => isset($input['custom_price']) && is_numeric($input['custom_price'])
                            ? (int) $input['custom_price']
                            : null,
                    ),
                    'floor_area' => isset($input['floor_area']) && is_numeric($input['floor_area']) ? (int) $input['floor_area'] : 100,
                    'heating_type' => isset($input['heating_type']) ? (string) $input['heating_type'] : 'water',
                    'building_type' => isset($input['building_type']) ? (string) $input['building_type'] : 'house',
                    'custom_price_floor' => isset($input['custom_price_floor']) && is_numeric($input['custom_price_floor'])
                        ? (int) $input['custom_price_floor']
                        : 15000,
                ),
                'context' => array(
                    'source' => 'generator_ui',
                    'channel' => 'admin_ajax',
                    'legacyAction' => 'simple_generate',
                ),
            );
        }

        /**
         * @param mixed $value
         * @return bool
         */
        private static function to_bool($value) {
            if (is_bool($value)) {
                return $value;
            }
            if (is_numeric($value)) {
                return ((int) $value) === 1;
            }
            $normalized = strtolower(trim((string) $value));
            return in_array($normalized, array('1', 'true', 'yes', 'on'), true);
        }
    }
}

