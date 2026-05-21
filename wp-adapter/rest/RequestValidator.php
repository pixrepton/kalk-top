<?php

if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists('TopInstal_CalcRequest_Validator')) {
    /**
     * CalcRequestDTO validator (contract v1.0).
     */
    class TopInstal_CalcRequest_Validator {
        const SUPPORTED_SCHEMA_VERSION = '1.0';

        /**
         * Validate request payload.
         *
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

            self::require_object($body, 'lead', $errors);
            self::require_object($body, 'building', $errors);
            self::require_object($body, 'preferences', $errors);

            if (isset($body['traceId']) && !is_string($body['traceId'])) {
                $errors[] = array(
                    'field' => 'traceId',
                    'code' => 'INVALID_TYPE',
                    'message' => 'traceId must be a string when provided.',
                );
            }
            if (isset($body['traceId']) && is_string($body['traceId']) && strlen(trim($body['traceId'])) > 128) {
                $errors[] = array(
                    'field' => 'traceId',
                    'code' => 'INVALID_VALUE',
                    'message' => 'traceId must be <= 128 characters.',
                );
            }

            if (isset($body['context']) && !is_array($body['context'])) {
                $errors[] = array(
                    'field' => 'context',
                    'code' => 'INVALID_TYPE',
                    'message' => 'context must be an object when provided.',
                );
            }

            if (isset($body['building']) && is_array($body['building'])) {
                self::validate_building($body['building'], $errors);
            }
            if (isset($body['preferences']) && is_array($body['preferences'])) {
                self::validate_preferences($body['preferences'], $errors);
            }

            // ozcResult is optional; when provided, validate structure
            if (isset($body['ozcResult']) && $body['ozcResult'] !== null) {
                $ozc_errors = self::validate_ozc_result($body['ozcResult']);
                foreach ($ozc_errors as $err) {
                    $errors[] = $err;
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

        /**
         * @param array<string,mixed> $data
         * @param string $field
         * @param array<int,array<string,string>> &$errors
         * @return void
         */
        private static function require_object($data, $field, &$errors) {
            if (!isset($data[$field]) || !is_array($data[$field])) {
                $errors[] = array(
                    'field' => $field,
                    'code' => 'REQUIRED',
                    'message' => $field . ' object is required.',
                );
            }
        }

        /**
         * @param array<string,mixed> $building
         * @param array<int,array<string,string>> &$errors
         * @return void
         */
        private static function validate_building($building, &$errors) {
            $area_fields = array('heated_area', 'floor_area', 'total_area');
            $has_positive_area = false;
            foreach ($area_fields as $field) {
                if (!array_key_exists($field, $building)) {
                    continue;
                }
                if (!self::is_numeric_like($building[$field])) {
                    $errors[] = array(
                        'field' => 'building.' . $field,
                        'code' => 'INVALID_TYPE',
                        'message' => 'building.' . $field . ' must be numeric when provided.',
                    );
                    continue;
                }
                if ((float) $building[$field] > 0.0) {
                    $has_positive_area = true;
                }
            }

            $has_positive_dimensions =
                self::has_positive_numeric_field($building, 'building_length') &&
                self::has_positive_numeric_field($building, 'building_width');

            foreach (array('building_length', 'building_width') as $field) {
                if (!array_key_exists($field, $building)) {
                    continue;
                }
                if (!self::is_numeric_like($building[$field])) {
                    $errors[] = array(
                        'field' => 'building.' . $field,
                        'code' => 'INVALID_TYPE',
                        'message' => 'building.' . $field . ' must be numeric when provided.',
                    );
                    continue;
                }
                if ((float) $building[$field] <= 0.0) {
                    $errors[] = array(
                        'field' => 'building.' . $field,
                        'code' => 'INVALID_VALUE',
                        'message' => 'building.' . $field . ' must be > 0 when provided.',
                    );
                }
            }

            if (!$has_positive_area && !$has_positive_dimensions) {
                $errors[] = array(
                    'field' => 'building.geometry',
                    'code' => 'REQUIRED_ONE_OF',
                    'message' => 'Provide positive area in one of: building.heated_area, building.floor_area, building.total_area, or provide both building.building_length and building.building_width.',
                );
            }

            if (isset($building['construction_year'])) {
                if (!self::is_numeric_like($building['construction_year'])) {
                    $errors[] = array(
                        'field' => 'building.construction_year',
                        'code' => 'INVALID_TYPE',
                        'message' => 'building.construction_year must be numeric.',
                    );
                } else {
                    $year = (int) $building['construction_year'];
                    if ($year < 1800 || $year > 2100) {
                        $errors[] = array(
                            'field' => 'building.construction_year',
                            'code' => 'INVALID_VALUE',
                            'message' => 'building.construction_year is out of expected range (1800-2100).',
                        );
                    }
                }
            }

            if (isset($building['include_hot_water']) && !self::is_bool_like($building['include_hot_water'])) {
                $errors[] = array(
                    'field' => 'building.include_hot_water',
                    'code' => 'INVALID_TYPE',
                    'message' => 'building.include_hot_water must be boolean-like.',
                );
            }
        }

        /**
         * @param array<string,mixed> $preferences
         * @param array<int,array<string,string>> &$errors
         * @return void
         */
        private static function validate_preferences($preferences, &$errors) {
            if (!isset($preferences['heating']) || !is_array($preferences['heating'])) {
                $errors[] = array(
                    'field' => 'preferences.heating',
                    'code' => 'REQUIRED',
                    'message' => 'preferences.heating object is required.',
                );
            }

            if (!isset($preferences['dhw']) || !is_array($preferences['dhw'])) {
                $errors[] = array(
                    'field' => 'preferences.dhw',
                    'code' => 'REQUIRED',
                    'message' => 'preferences.dhw object is required.',
                );
            }

            if (isset($preferences['hasBuffer']) && !self::is_bool_like($preferences['hasBuffer'])) {
                $errors[] = array(
                    'field' => 'preferences.hasBuffer',
                    'code' => 'INVALID_TYPE',
                    'message' => 'preferences.hasBuffer must be boolean-like.',
                );
            }

            if (isset($preferences['dhw']) && is_array($preferences['dhw'])) {
                $enabled_raw = array_key_exists('enabled', $preferences['dhw']) ? $preferences['dhw']['enabled'] : null;
                if ($enabled_raw !== null && !self::is_bool_like($enabled_raw)) {
                    $errors[] = array(
                        'field' => 'preferences.dhw.enabled',
                        'code' => 'INVALID_TYPE',
                        'message' => 'preferences.dhw.enabled must be boolean-like.',
                    );
                }

                $enabled = self::to_bool_or_null($enabled_raw);
                if ($enabled === true) {
                    $persons = isset($preferences['dhw']['persons']) ? $preferences['dhw']['persons'] : null;
                    if (!self::is_numeric_like($persons) || (float) $persons <= 0.0) {
                        $errors[] = array(
                            'field' => 'preferences.dhw.persons',
                            'code' => 'REQUIRED',
                            'message' => 'preferences.dhw.persons must be > 0 when DHW is enabled.',
                        );
                    }
                }
            }
        }

        /**
         * @param mixed $ozc_result
         * @return array<int,array<string,string>>
         */
        private static function validate_ozc_result($ozc_result) {
            if (!is_array($ozc_result)) {
                return array(
                    array(
                        'field' => 'ozcResult',
                        'code' => 'INVALID_TYPE',
                        'message' => 'ozcResult must be an object when provided.',
                    ),
                );
            }

            if (empty($ozc_result)) {
                return array();
            }

            $errors = array();

            $design_heat_loss = isset($ozc_result['designHeatLoss_kW']) ? $ozc_result['designHeatLoss_kW'] : null;
            if (!self::is_numeric_like($design_heat_loss) || (float) $design_heat_loss <= 0.0 || (float) $design_heat_loss > 500.0) {
                $errors[] = array(
                    'field' => 'ozcResult',
                    'code' => 'OZC_RESULT_INVALID',
                    'message' => 'ozcResult.designHeatLoss_kW must be numeric and in range (0, 500].',
                );
            }

            $heated_area = isset($ozc_result['heatedArea_m2']) ? $ozc_result['heatedArea_m2'] : null;
            if (!self::is_numeric_like($heated_area) || (float) $heated_area <= 0.0 || (float) $heated_area > 10000.0) {
                $errors[] = array(
                    'field' => 'ozcResult',
                    'code' => 'OZC_RESULT_INVALID',
                    'message' => 'ozcResult.heatedArea_m2 must be numeric and in range (0, 10000].',
                );
            }

            return $errors;
        }

        /**
         * @param mixed $value
         * @return bool
         */
        private static function is_numeric_like($value) {
            return $value !== null && $value !== '' && is_numeric($value);
        }

        /**
         * @param array<string,mixed> $building
         * @param string $field
         * @return bool
         */
        private static function has_positive_numeric_field($building, $field) {
            return array_key_exists($field, $building)
                && self::is_numeric_like($building[$field])
                && (float) $building[$field] > 0.0;
        }

        /**
         * @param mixed $value
         * @return bool
         */
        private static function is_bool_like($value) {
            if (is_bool($value)) return true;
            if (is_int($value) || is_float($value)) {
                return ((int) $value) === 0 || ((int) $value) === 1;
            }
            if (is_string($value)) {
                $normalized = strtolower(trim($value));
                return in_array($normalized, array('0', '1', 'true', 'false', 'yes', 'no'), true);
            }
            return false;
        }

        /**
         * @param mixed $value
         * @return bool|null
         */
        private static function to_bool_or_null($value) {
            if (!self::is_bool_like($value)) {
                return null;
            }
            if (is_bool($value)) return $value;
            if (is_int($value) || is_float($value)) return ((int) $value) === 1;
            $normalized = strtolower(trim((string) $value));
            return in_array($normalized, array('1', 'true', 'yes'), true);
        }
    }
}
