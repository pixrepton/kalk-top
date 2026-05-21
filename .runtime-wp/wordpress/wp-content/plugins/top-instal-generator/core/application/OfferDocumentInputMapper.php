<?php

if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists('TopInstal_OfferDocument_InputMapper')) {
    class TopInstal_OfferDocument_InputMapper {
        /**
         * @param array<string,mixed> $request
         * @param array<int,array<string,mixed>> &$warnings
         * @return array<string,mixed>
         */
        public static function map_direct_config($request, &$warnings) {
            $payload = isset($request['payload']) && is_array($request['payload'])
                ? $request['payload']
                : $request;

            $installation_type = self::str(
                self::first_non_empty(array(
                    self::get($payload, array('installationType')),
                    self::get($payload, array('installation_type')),
                )),
                'heat_pump'
            );

            $tank_enabled = self::to_bool(
                self::first_non_null(array(
                    self::get($payload, array('tank', 'enabled')),
                    self::get($payload, array('hasCwu')),
                    self::get($payload, array('has_cwu')),
                )),
                true
            );
            $buffer_enabled = self::to_bool(
                self::first_non_null(array(
                    self::get($payload, array('buffer', 'enabled')),
                    self::get($payload, array('hasBuffer')),
                    self::get($payload, array('has_buffer')),
                )),
                false
            );

            $tank_capacity = self::str(
                self::first_non_empty(array(
                    self::get($payload, array('tank', 'capacity')),
                    self::get($payload, array('tankCapacity')),
                    self::get($payload, array('tank_capacity')),
                )),
                $tank_enabled ? '200' : 'none'
            );
            if (!$tank_enabled) {
                $tank_capacity = 'none';
            }

            $buffer_capacity = self::str(
                self::first_non_empty(array(
                    self::get($payload, array('buffer', 'capacity')),
                    self::get($payload, array('bufferCapacity')),
                    self::get($payload, array('buffer_capacity')),
                )),
                $buffer_enabled ? '100' : 'none'
            );
            if (!$buffer_enabled) {
                $buffer_capacity = 'none';
            }

            return array(
                'mode' => 'direct-config',
                'documentType' => self::str(self::get($request, array('documentType')), 'offer_document'),
                'outputFormat' => self::normalize_output_format(
                    self::str(
                        self::first_non_empty(array(
                            self::get($request, array('outputFormat')),
                            self::get($payload, array('outputFormat')),
                            self::get($payload, array('output_format')),
                        )),
                        'pdf'
                    )
                ),
                'installationType' => $installation_type,
                'kitModel' => self::str(
                    self::first_non_empty(array(
                        self::get($payload, array('kitModel')),
                        self::get($payload, array('kit_model')),
                        self::get($payload, array('heatPump', 'kitModel')),
                    )),
                    ''
                ),
                'powerKw' => self::to_int(
                    self::first_non_null(array(
                        self::get($payload, array('powerKw')),
                        self::get($payload, array('power_kw')),
                    )),
                    null
                ),
                'tankEnabled' => $tank_enabled,
                'tankCapacity' => $tank_capacity,
                'tankManufacturer' => self::str(
                    self::first_non_empty(array(
                        self::get($payload, array('tank', 'manufacturer')),
                        self::get($payload, array('tankManufacturer')),
                        self::get($payload, array('tank_manufacturer')),
                    )),
                    ''
                ),
                'bufferEnabled' => $buffer_enabled,
                'bufferCapacity' => $buffer_capacity,
                'customPriceGross' => self::to_int(
                    self::first_non_null(array(
                        self::get($payload, array('pricing', 'customPriceGross')),
                        self::get($payload, array('customPrice')),
                        self::get($payload, array('custom_price')),
                    )),
                    null
                ),
                'floorArea' => self::to_int(self::get($payload, array('floor_area')), 100),
                'heatingType' => self::str(self::get($payload, array('heating_type')), 'water'),
                'buildingType' => self::str(self::get($payload, array('building_type')), 'house'),
                'customPriceFloorGross' => self::to_int(self::get($payload, array('custom_price_floor')), 15000),
            );
        }

        /**
         * @param array<string,mixed> $request
         * @param array<int,array<string,mixed>> &$warnings
         * @return array<string,mixed>
         */
        public static function map_from_offer_dto($request, &$warnings) {
            $offer = null;
            if (isset($request['offerDto']) && is_array($request['offerDto'])) {
                $offer = $request['offerDto'];
            } elseif (isset($request['payload']['offerDto']) && is_array($request['payload']['offerDto'])) {
                $offer = $request['payload']['offerDto'];
            } elseif (isset($request['payload']['offer']) && is_array($request['payload']['offer'])) {
                $offer = $request['payload']['offer'];
            }
            if (!is_array($offer)) {
                throw new TopInstal_OfferDocument_Exception(
                    TopInstal_DocumentReasonCodes::VALIDATION_ERROR,
                    'from-offer-dto mode requires offerDto object.',
                    400,
                    array('errors' => array(
                        array(
                            'field' => 'offerDto',
                            'code' => 'REQUIRED',
                            'message' => 'offerDto object is required in from-offer-dto mode.',
                        ),
                    ))
                );
            }

            $selection = isset($offer['engineering']['selection']) && is_array($offer['engineering']['selection'])
                ? $offer['engineering']['selection']
                : array();
            $buffer = isset($offer['engineering']['buffer']) && is_array($offer['engineering']['buffer'])
                ? $offer['engineering']['buffer']
                : array();
            $totals = isset($offer['pricing']['totals']) && is_array($offer['pricing']['totals'])
                ? $offer['pricing']['totals']
                : array();
            $payload = isset($request['payload']) && is_array($request['payload']) ? $request['payload'] : array();
            $context = isset($request['context']) && is_array($request['context']) ? $request['context'] : array();
            $machine_room_snapshot = self::extract_machine_room_snapshot($context, $payload);
            $snapshot_components = isset($machine_room_snapshot['selected_components']) && is_array($machine_room_snapshot['selected_components'])
                ? $machine_room_snapshot['selected_components']
                : array();
            $snapshot_pump = isset($snapshot_components['pump']) && is_array($snapshot_components['pump'])
                ? $snapshot_components['pump']
                : array();
            $snapshot_cwu = isset($snapshot_components['cwu']) && is_array($snapshot_components['cwu'])
                ? $snapshot_components['cwu']
                : array();
            $snapshot_buffer = isset($snapshot_components['buffer']) && is_array($snapshot_components['buffer'])
                ? $snapshot_components['buffer']
                : array();

            $kit_model = self::str(
                self::first_non_empty(array(
                    self::get($snapshot_pump, array('model')),
                    self::get($snapshot_pump, array('name')),
                    self::get($selection, array('pumpModel')),
                    self::get($selection, array('pump_model')),
                )),
                ''
            );

            $tank_enabled = self::to_bool(
                self::first_non_null(array(
                    self::get($payload, array('tank', 'enabled')),
                    self::get($payload, array('hasCwu')),
                    self::get($payload, array('has_cwu')),
                    self::snapshot_has_enabled_cwu($snapshot_cwu),
                )),
                true
            );

            $tank_capacity = self::str(
                self::first_non_empty(array(
                    self::get($payload, array('tank', 'capacity')),
                    self::get($payload, array('tankCapacity')),
                    self::get($payload, array('tank_capacity')),
                    self::capacity_to_string(self::get($snapshot_cwu, array('capacity_l'))),
                    self::extract_capacity_from_option_id(self::get($snapshot_cwu, array('optionId'))),
                    self::extract_capacity_from_label(self::get($snapshot_cwu, array('label'))),
                )),
                self::guess_tank_capacity($kit_model, $tank_enabled)
            );

            $buffer_liters = self::to_int(
                self::first_non_null(array(
                    self::get($snapshot_buffer, array('capacity_l')),
                    self::get($buffer, array('liters')),
                    self::get($buffer, array('capacity_liters')),
                )),
                null
            );
            $setup_type = strtoupper(self::str(self::get($buffer, array('setupType')), 'NONE'));
            $buffer_enabled = $buffer_liters !== null && $buffer_liters > 0 && $setup_type !== 'NONE';

            $warnings[] = array(
                'code' => TopInstal_DocumentReasonCodes::MAPPED_FROM_OFFER_DTO,
                'message' => 'Payload was mapped from OfferDTO for document generation.',
            );

            return array(
                'mode' => 'from-offer-dto',
                'documentType' => self::str(self::get($request, array('documentType')), 'offer_document'),
                'outputFormat' => self::normalize_output_format(
                    self::str(
                        self::first_non_empty(array(
                            self::get($request, array('outputFormat')),
                            self::get($payload, array('outputFormat')),
                            self::get($payload, array('output_format')),
                        )),
                        'pdf'
                    )
                ),
                'installationType' => 'heat_pump',
                'kitModel' => $kit_model,
                'powerKw' => self::to_int(
                    self::first_non_null(array(
                        self::get($snapshot_pump, array('power_kw')),
                        self::get($selection, array('capacity_kW')),
                        self::get($selection, array('capacityKw')),
                    )),
                    null
                ),
                'tankEnabled' => $tank_enabled,
                'tankCapacity' => $tank_enabled ? $tank_capacity : 'none',
                'tankManufacturer' => self::str(
                    self::first_non_empty(array(
                        self::get($payload, array('tank', 'manufacturer')),
                        self::get($payload, array('tank_manufacturer')),
                        self::get($snapshot_cwu, array('name')),
                        self::extract_manufacturer_from_label(self::get($snapshot_cwu, array('label'))),
                    )),
                    'Trinnity'
                ),
                'tankLabel' => self::str(
                    self::first_non_empty(array(
                        self::get($snapshot_cwu, array('label')),
                    )),
                    ''
                ),
                'bufferEnabled' => $buffer_enabled,
                'bufferCapacity' => $buffer_enabled ? (string) $buffer_liters : 'none',
                'bufferLabel' => self::str(
                    self::first_non_empty(array(
                        self::get($snapshot_buffer, array('label')),
                    )),
                    ''
                ),
                'customPriceGross' => self::to_int(
                    self::first_non_null(array(
                        self::get($machine_room_snapshot, array('total_brutto_pln')),
                        self::get($totals, array('gross')),
                    )),
                    null
                ),
                'floorArea' => 100,
                'heatingType' => 'water',
                'buildingType' => 'house',
                'customPriceFloorGross' => 15000,
            );
        }

        /**
         * @param string $format
         * @return string
         */
        public static function normalize_output_format($format) {
            $format = strtolower(trim((string) $format));
            if ($format === 'pdf') {
                return 'pdf';
            }
            return 'docx';
        }

        /**
         * @param string $kit_model
         * @param bool $tank_enabled
         * @return string
         */
        private static function guess_tank_capacity($kit_model, $tank_enabled) {
            if (!$tank_enabled) {
                return 'none';
            }
            $kit_model = strtoupper(trim((string) $kit_model));
            if (preg_match('/^KIT-(ADC|AXC)/', $kit_model)) {
                if (strpos($kit_model, '260') !== false) {
                    return '260-aio';
                }
                return '185-aio';
            }
            return '200';
        }

        /**
         * @param mixed $value
         * @param bool $default
         * @return bool
         */
        private static function to_bool($value, $default = false) {
            if ($value === null || $value === '') {
                return $default;
            }
            if (is_bool($value)) {
                return $value;
            }
            if (is_numeric($value)) {
                return ((int) $value) === 1;
            }
            $normalized = strtolower(trim((string) $value));
            if (in_array($normalized, array('1', 'true', 'yes', 'on'), true)) {
                return true;
            }
            if (in_array($normalized, array('0', 'false', 'no', 'off'), true)) {
                return false;
            }
            return $default;
        }

        /**
         * @param mixed $value
         * @param int|null $default
         * @return int|null
         */
        private static function to_int($value, $default = null) {
            if ($value === null || $value === '') {
                return $default;
            }
            if (!is_numeric($value)) {
                return $default;
            }
            return (int) round((float) $value);
        }

        /**
         * @param mixed $value
         * @param string $default
         * @return string
         */
        private static function str($value, $default = '') {
            if (!is_scalar($value)) {
                return $default;
            }
            $value = trim((string) $value);
            return $value === '' ? $default : $value;
        }

        /**
         * @param array<string,mixed> $data
         * @param array<int,string> $path
         * @return mixed|null
         */
        private static function get($data, $path) {
            if (!is_array($data)) {
                return null;
            }
            $cursor = $data;
            foreach ($path as $segment) {
                if (!is_array($cursor) || !array_key_exists($segment, $cursor)) {
                    return null;
                }
                $cursor = $cursor[$segment];
            }
            return $cursor;
        }

        /**
         * @param array<int,mixed> $values
         * @return mixed|null
         */
        private static function first_non_null($values) {
            foreach ($values as $value) {
                if ($value !== null) {
                    return $value;
                }
            }
            return null;
        }

        /**
         * @param array<int,mixed> $values
         * @return mixed|null
         */
        private static function first_non_empty($values) {
            foreach ($values as $value) {
                if (!is_scalar($value)) {
                    continue;
                }
                if (trim((string) $value) !== '') {
                    return $value;
                }
            }
            return null;
        }

        /**
         * @param array<string,mixed> $context
         * @param array<string,mixed> $payload
         * @return array<string,mixed>
         */
        private static function extract_machine_room_snapshot($context, $payload) {
            $snapshot = self::get($context, array('machineRoomSnapshot'));
            if (!is_array($snapshot)) {
                $snapshot = self::get($context, array('machine_room_snapshot'));
            }
            if (!is_array($snapshot)) {
                $snapshot = self::get($payload, array('context', 'machineRoomSnapshot'));
            }
            if (!is_array($snapshot)) {
                $snapshot = self::get($payload, array('context', 'machine_room_snapshot'));
            }
            return is_array($snapshot) ? $snapshot : array();
        }

        /**
         * @param mixed $value
         * @return string|null
         */
        private static function capacity_to_string($value) {
            $number = self::to_int($value, null);
            return $number !== null && $number > 0 ? (string) $number : null;
        }

        /**
         * @param mixed $option_id
         * @return string|null
         */
        private static function extract_capacity_from_option_id($option_id) {
            if (!is_scalar($option_id)) {
                return null;
            }
            if (!preg_match('/(\d+)(?!.*\d)/', (string) $option_id, $match)) {
                return null;
            }
            return isset($match[1]) ? trim((string) $match[1]) : null;
        }

        /**
         * @param mixed $label
         * @return string|null
         */
        private static function extract_capacity_from_label($label) {
            if (!is_scalar($label)) {
                return null;
            }
            if (!preg_match('/(\d+)\s*(?:l|L|litr|litrow)/u', (string) $label, $match)) {
                return null;
            }
            return isset($match[1]) ? trim((string) $match[1]) : null;
        }

        /**
         * @param mixed $label
         * @return string|null
         */
        private static function extract_manufacturer_from_label($label) {
            if (!is_scalar($label)) {
                return null;
            }
            $text = trim((string) $label);
            if ($text === '') {
                return null;
            }
            $clean = preg_replace('/\s+\d+\s*(?:l|L|litr|litrow).*$/u', '', $text);
            $clean = is_string($clean) ? trim($clean) : $text;
            return $clean !== '' ? $clean : null;
        }

        /**
         * @param array<string,mixed> $snapshot_cwu
         * @return bool|null
         */
        private static function snapshot_has_enabled_cwu($snapshot_cwu) {
            if (!is_array($snapshot_cwu) || empty($snapshot_cwu)) {
                return null;
            }
            $option_id = strtolower(self::str(self::get($snapshot_cwu, array('optionId')), ''));
            if ($option_id === 'cwu-none' || $option_id === 'none') {
                return false;
            }
            $capacity = self::to_int(self::get($snapshot_cwu, array('capacity_l')), null);
            if ($capacity !== null && $capacity > 0) {
                return true;
            }
            $label = strtolower(self::str(self::get($snapshot_cwu, array('label')), ''));
            if ($label !== '') {
                return strpos($label, 'nie dotyczy') === false;
            }
            return null;
        }
    }
}
