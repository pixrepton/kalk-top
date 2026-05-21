<?php

if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists('TopInstal_OfferDocumentRequest_Validator')) {
    class TopInstal_OfferDocumentRequest_Validator {
        const SUPPORTED_SCHEMA_VERSION = '1.0';

        /**
         * @param mixed $body
         * @return array<int,array<string,string>>
         */
        public static function validate($body) {
            $errors = array();
            if (!is_array($body)) {
                $errors[] = array(
                    'field' => 'body',
                    'code' => 'INVALID_TYPE',
                    'message' => 'Request body must be a JSON object.',
                );
                return $errors;
            }

            self::require_non_empty_string($body, 'schemaVersion', $errors);
            if (
                isset($body['schemaVersion']) &&
                is_string($body['schemaVersion']) &&
                trim($body['schemaVersion']) !== self::SUPPORTED_SCHEMA_VERSION
            ) {
                $errors[] = array(
                    'field' => 'schemaVersion',
                    'code' => 'UNSUPPORTED_VERSION',
                    'message' => 'Unsupported schemaVersion. Supported: ' . self::SUPPORTED_SCHEMA_VERSION . '.',
                );
            }

            if (isset($body['traceId']) && (!is_string($body['traceId']) || strlen(trim($body['traceId'])) > 128)) {
                $errors[] = array(
                    'field' => 'traceId',
                    'code' => 'INVALID_VALUE',
                    'message' => 'traceId must be a string up to 128 chars.',
                );
            }

            if (isset($body['mode']) && !in_array((string) $body['mode'], array('direct-config', 'from-offer-dto'), true)) {
                $errors[] = array(
                    'field' => 'mode',
                    'code' => 'INVALID_VALUE',
                    'message' => 'mode must be direct-config or from-offer-dto.',
                );
            }

            if (isset($body['outputFormat']) && !in_array((string) $body['outputFormat'], array('pdf', 'docx'), true)) {
                $errors[] = array(
                    'field' => 'outputFormat',
                    'code' => 'INVALID_VALUE',
                    'message' => 'outputFormat must be pdf or docx.',
                );
            }

            if (isset($body['context']) && !is_array($body['context'])) {
                $errors[] = array(
                    'field' => 'context',
                    'code' => 'INVALID_TYPE',
                    'message' => 'context must be an object when provided.',
                );
            }

            $mode = isset($body['mode']) ? (string) $body['mode'] : '';
            if ($mode === '') {
                $mode = (isset($body['offerDto']) || isset($body['payload']['offerDto'])) ? 'from-offer-dto' : 'direct-config';
            }

            if ($mode === 'direct-config') {
                if (!isset($body['payload']) || !is_array($body['payload'])) {
                    $errors[] = array(
                        'field' => 'payload',
                        'code' => 'REQUIRED',
                        'message' => 'payload object is required in direct-config mode.',
                    );
                }
            } elseif ($mode === 'from-offer-dto') {
                $has_offer = (isset($body['offerDto']) && is_array($body['offerDto']))
                    || (isset($body['payload']['offerDto']) && is_array($body['payload']['offerDto']))
                    || (isset($body['payload']['offer']) && is_array($body['payload']['offer']));
                if (!$has_offer) {
                    $errors[] = array(
                        'field' => 'offerDto',
                        'code' => 'REQUIRED',
                        'message' => 'offerDto object is required in from-offer-dto mode.',
                    );
                }
            }

            return $errors;
        }

        /**
         * @param array<string,mixed> $data
         * @param string $field
         * @param array<int,array<string,string>> &$errors
         * @return void
         */
        private static function require_non_empty_string($data, $field, &$errors) {
            if (!isset($data[$field]) || !is_string($data[$field]) || trim($data[$field]) === '') {
                $errors[] = array(
                    'field' => $field,
                    'code' => 'REQUIRED',
                    'message' => $field . ' is required and must be a non-empty string.',
                );
            }
        }
    }
}

