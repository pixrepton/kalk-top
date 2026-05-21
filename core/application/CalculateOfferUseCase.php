<?php

if (!class_exists('TopInstal_CalculateOffer_UseCase')) {
    /**
     * Application layer use-case for backend offer calculation.
     */
    class TopInstal_CalculateOffer_UseCase {
        /** @var object */
        private $price_book_repository;
        /** @var object */
        private $buffer_rules_repository;
        /** @var object */
        private $selection_rules_repository;
        /** @var object|null */
        private $logger;
        /** @var object */
        private $ozc_engine;
        /** @var object */
        private $selection_engine;
        /** @var object */
        private $buffer_engine;
        /** @var object */
        private $pricing_engine;
        /** @var object|null */
        private $cwu_engine;

        /**
         * @param object $price_book_repository
         * @param object $buffer_rules_repository
         * @param object $selection_rules_repository
         * @param object|null $logger
         * @param object|null $ozc_engine
         * @param object|null $selection_engine
         * @param object|null $buffer_engine
         * @param object|null $pricing_engine
         * @param object|null $cwu_engine
         */
        public function __construct(
            $price_book_repository,
            $buffer_rules_repository,
            $selection_rules_repository,
            $logger = null,
            $ozc_engine = null,
            $selection_engine = null,
            $buffer_engine = null,
            $pricing_engine = null,
            $cwu_engine = null
        ) {
            $this->price_book_repository = $price_book_repository;
            $this->buffer_rules_repository = $buffer_rules_repository;
            $this->selection_rules_repository = $selection_rules_repository;
            $this->logger = $logger;
            $this->ozc_engine = $ozc_engine ?: $this->resolve_default_ozc_engine();
            $this->selection_engine = $selection_engine ?: $this->resolve_default_selection_engine();
            $this->buffer_engine = $buffer_engine ?: $this->resolve_default_buffer_engine();
            $this->pricing_engine = $pricing_engine ?: $this->resolve_default_pricing_engine();
            $this->cwu_engine = $cwu_engine ?: $this->resolve_default_cwu_engine();
        }

        /**
         * @param array<string,mixed> $calc_request
         * @return array<string,mixed>
         */
        public function execute($calc_request) {
            $code_invariant_pricing_fallback_master = class_exists('TopInstal_ReasonCodes')
                ? TopInstal_ReasonCodes::INVARIANT_BROKEN_PRICING_FALLBACK_MASTER
                : 'INVARIANT_BROKEN_PRICING_FALLBACK_MASTER';
            $trace_id = $this->ensure_trace_id(isset($calc_request['traceId']) ? $calc_request['traceId'] : null);
            $price_book = $this->call_repository($this->price_book_repository, 'get_price_book', array());
            $buffer_rules = $this->call_repository($this->buffer_rules_repository, 'get_rules', array());
            $selection_rules = $this->call_repository($this->selection_rules_repository, 'get_rules', array());
            $calc_request = $this->canonicalize_calc_request($calc_request, $selection_rules);
            $building = isset($calc_request['building']) && is_array($calc_request['building'])
                ? $calc_request['building']
                : array();
            $preferences = isset($calc_request['preferences']) && is_array($calc_request['preferences'])
                ? $calc_request['preferences']
                : array();

            list($ozc_result, $used_external_ozc) = $this->resolve_ozc_result($calc_request, $building, $preferences);
            $design_heat_loss_kw = $this->to_float(
                isset($ozc_result['designHeatLoss_kW']) ? $ozc_result['designHeatLoss_kW'] : null,
                0.0
            );

            $selection_cwu_context = $this->resolve_selection_cwu_context(
                $calc_request,
                $building,
                $preferences,
                is_array($buffer_rules) ? $buffer_rules : array(),
                is_array($price_book) ? $price_book : array()
            );

            $selection_result = $this->selection_engine->select(
                $design_heat_loss_kw,
                $building,
                $preferences,
                is_array($selection_rules) ? $selection_rules : array(),
                $selection_cwu_context
            );

            $cwu_result = $this->resolve_cwu_result(
                $calc_request,
                $building,
                $preferences,
                $selection_result,
                is_array($buffer_rules) ? $buffer_rules : array(),
                is_array($price_book) ? $price_book : array()
            );

            $buffer_result = $this->buffer_engine->computeBuffer(
                array(
                    'designHeatLoss_kW' => $design_heat_loss_kw,
                    'building' => $building,
                    'preferences' => $preferences,
                    'selection' => $selection_result,
                    'ozc' => $ozc_result,
                    'context' => isset($calc_request['context']) && is_array($calc_request['context'])
                        ? $calc_request['context']
                        : array(),
                ),
                is_array($buffer_rules) ? $buffer_rules : array()
            );

            $hot_water_power_kw = $this->resolve_hot_water_power_kw($calc_request, $ozc_result, $cwu_result);
            $ozc_result['hotWaterPower_kW'] = $hot_water_power_kw;

            $pricing_result = $this->pricing_engine->price(
                array(
                    'ozc' => $ozc_result,
                    'selection' => $selection_result,
                    'buffer' => $buffer_result,
                    'cwu' => $cwu_result,
                    'preferences' => $preferences,
                    'building' => $building,
                    'context' => isset($calc_request['context']) && is_array($calc_request['context'])
                        ? $calc_request['context']
                        : array(),
                ),
                is_array($price_book) ? $price_book : array()
            );

            $warnings = $this->merge_records(array(
                isset($ozc_result['warnings']) && is_array($ozc_result['warnings']) ? $ozc_result['warnings'] : array(),
                isset($selection_result['warnings']) && is_array($selection_result['warnings']) ? $selection_result['warnings'] : array(),
                isset($buffer_result['warnings']) && is_array($buffer_result['warnings']) ? $buffer_result['warnings'] : array(),
                isset($cwu_result['warnings']) && is_array($cwu_result['warnings']) ? $cwu_result['warnings'] : array(),
                isset($pricing_result['warnings']) && is_array($pricing_result['warnings']) ? $pricing_result['warnings'] : array(),
            ));

            $assumptions = $this->merge_records(array(
                isset($ozc_result['assumptions']) && is_array($ozc_result['assumptions']) ? $ozc_result['assumptions'] : array(),
                isset($buffer_result['assumptions']) && is_array($buffer_result['assumptions']) ? $buffer_result['assumptions'] : array(),
                isset($cwu_result['assumptions']) && is_array($cwu_result['assumptions']) ? $cwu_result['assumptions'] : array(),
            ));
            $fallback_meta = $this->collect_fallback_meta(array(
                $ozc_result,
                $selection_result,
                $buffer_result,
                $cwu_result,
                $pricing_result,
            ));
            if (!$this->has_required_ozc_policy($buffer_rules)) {
                $warnings[] = array(
                    'code' => 'OZC_POLICY_MISSING',
                    'message' => 'OZC policy master-data unavailable or incomplete; engine used internal safety defaults.',
                );
                $fallback_meta['used'] = true;
                $fallback_meta['reasons'][] = 'OZC_POLICY_MISSING';
                $fallback_meta['reasons'] = array_values(array_unique($fallback_meta['reasons']));
            }
            $pricing_mode = isset($pricing_result['fallback']) && is_array($pricing_result['fallback']) && isset($pricing_result['fallback']['mode'])
                ? (string) $pricing_result['fallback']['mode']
                : 'unknown';
            if ($pricing_mode === 'master' && !empty($fallback_meta['used'])) {
                $warnings[] = array(
                    'code' => $code_invariant_pricing_fallback_master,
                    'message' => 'Invariant broken: pricing_mode=master with fallbackUsed=true.',
                );
                $this->log_info('invariant warning: pricing master mode with fallbackUsed=true', array(
                    'traceId' => $trace_id,
                    'code' => $code_invariant_pricing_fallback_master,
                ));
            }

            $offer = array(
                'schemaVersion' => '1.0',
                'traceId' => $trace_id,
                'engineering' => array(
                    'ozc' => array(
                        'designHeatLoss_kW' => round($design_heat_loss_kw, 2),
                        'recommendedPower_kW' => $this->to_float(
                            isset($ozc_result['recommendedPower_kW']) ? $ozc_result['recommendedPower_kW'] : $design_heat_loss_kw,
                            $design_heat_loss_kw
                        ),
                        'hotWaterPower_kW' => $hot_water_power_kw,
                        'heatedArea_m2' => $this->to_float(
                            isset($ozc_result['heatedArea_m2']) ? $ozc_result['heatedArea_m2'] : $this->resolve_area($building),
                            0.0
                        ),
                        'source' => isset($ozc_result['source']) ? (string) $ozc_result['source'] : 'php-engine',
                        'assumptions' => isset($ozc_result['assumptions']) && is_array($ozc_result['assumptions']) ? $ozc_result['assumptions'] : array(),
                        'warnings' => isset($ozc_result['warnings']) && is_array($ozc_result['warnings']) ? $ozc_result['warnings'] : array(),
                        'audit' => isset($ozc_result['audit']) && is_array($ozc_result['audit']) ? $ozc_result['audit'] : null,
                        'metrics' => isset($ozc_result['metrics']) && is_array($ozc_result['metrics']) ? $ozc_result['metrics'] : null,
                        'extended' => isset($ozc_result['extended']) && is_array($ozc_result['extended']) ? $ozc_result['extended'] : null,
                    ),
                    'selection' => array(
                        'pumpModel' => isset($selection_result['pumpModel']) ? $selection_result['pumpModel'] : null,
                        'capacity_kW' => isset($selection_result['capacity_kW']) ? $selection_result['capacity_kW'] : null,
                        'type' => isset($selection_result['type']) ? $selection_result['type'] : null,
                        'phase' => isset($selection_result['phase']) ? $selection_result['phase'] : null,
                        'recommendedModels' => isset($selection_result['recommendedModels']) ? $selection_result['recommendedModels'] : array(),
                        'notes' => isset($selection_result['notes']) ? $selection_result['notes'] : array(),
                        'warnings' => isset($selection_result['warnings']) ? $selection_result['warnings'] : array(),
                        'reasonCodes' => isset($selection_result['reasonCodes']) ? $selection_result['reasonCodes'] : array(),
                        'pumpSelection' => isset($selection_result['pumpSelection']) ? $selection_result['pumpSelection'] : null,
                    ),
                    'buffer' => array(
                        'liters' => isset($buffer_result['liters']) ? $buffer_result['liters'] : null,
                        'setupType' => isset($buffer_result['setupType']) ? $buffer_result['setupType'] : 'NONE',
                        'reasonCodes' => isset($buffer_result['reasonCodes']) ? $buffer_result['reasonCodes'] : array(),
                        'warnings' => isset($buffer_result['warnings']) ? $buffer_result['warnings'] : array(),
                        'assumptions' => isset($buffer_result['assumptions']) ? $buffer_result['assumptions'] : array(),
                        'buffer_liters' => isset($buffer_result['buffer_liters']) ? $buffer_result['buffer_liters'] : null,
                        'severity' => isset($buffer_result['severity']) ? $buffer_result['severity'] : null,
                        'dominantReason' => isset($buffer_result['dominantReason']) ? $buffer_result['dominantReason'] : null,
                        'explanation' => isset($buffer_result['explanation']) && is_array($buffer_result['explanation']) ? $buffer_result['explanation'] : null,
                        'inputs_used' => isset($buffer_result['inputs_used']) && is_array($buffer_result['inputs_used']) ? $buffer_result['inputs_used'] : null,
                        'type' => isset($buffer_result['type']) ? $buffer_result['type'] : null,
                        'hydraulicSeparationRequired' => isset($buffer_result['hydraulicSeparationRequired']) ? $buffer_result['hydraulicSeparationRequired'] : null,
                        'estimatedSystemVolume' => isset($buffer_result['estimatedSystemVolume']) ? $buffer_result['estimatedSystemVolume'] : null,
                        'requiredSystemVolume' => isset($buffer_result['requiredSystemVolume']) ? $buffer_result['requiredSystemVolume'] : null,
                        'systemVolumeSufficient' => isset($buffer_result['systemVolumeSufficient']) ? $buffer_result['systemVolumeSufficient'] : null,
                        'sizingComponents' => isset($buffer_result['sizingComponents']) && is_array($buffer_result['sizingComponents']) ? $buffer_result['sizingComponents'] : null,
                        'computedLiters' => isset($buffer_result['computedLiters']) ? $buffer_result['computedLiters'] : null,
                        'roundedTo' => isset($buffer_result['roundedTo']) ? $buffer_result['roundedTo'] : null,
                        'dominant' => isset($buffer_result['dominant']) ? $buffer_result['dominant'] : null,
                        'marketCapacityLiters' => isset($buffer_result['marketCapacityLiters']) ? $buffer_result['marketCapacityLiters'] : null,
                        'manufacturerPolicyApplied' => isset($buffer_result['manufacturerPolicyApplied']) ? $buffer_result['manufacturerPolicyApplied'] : null,
                        'manufacturerPolicyMinimumLiters' => isset($buffer_result['manufacturerPolicyMinimumLiters']) ? $buffer_result['manufacturerPolicyMinimumLiters'] : null,
                        'sizing' => isset($buffer_result['sizing']) && is_array($buffer_result['sizing']) ? $buffer_result['sizing'] : null,
                        'recommendation' => isset($buffer_result['recommendation']) && is_array($buffer_result['recommendation']) ? $buffer_result['recommendation'] : null,
                    ),
                    'cwu' => array(
                        'demandEnabled' => isset($cwu_result['demandEnabled']) ? $cwu_result['demandEnabled'] : null,
                        'enabled' => isset($cwu_result['enabled']) ? $cwu_result['enabled'] : null,
                        'required' => isset($cwu_result['required']) ? $cwu_result['required'] : null,
                        'skip' => isset($cwu_result['skip']) ? $cwu_result['skip'] : null,
                        'skipReason' => isset($cwu_result['skipReason']) ? $cwu_result['skipReason'] : null,
                        'persons' => isset($cwu_result['persons']) ? $cwu_result['persons'] : null,
                        'personsRaw' => isset($cwu_result['personsRaw']) ? $cwu_result['personsRaw'] : null,
                        'personsForCapacity' => isset($cwu_result['personsForCapacity']) ? $cwu_result['personsForCapacity'] : null,
                        'usageProfile' => isset($cwu_result['usageProfile']) ? $cwu_result['usageProfile'] : null,
                        'isAio' => isset($cwu_result['isAio']) ? $cwu_result['isAio'] : null,
                        'recommendedCapacityL' => isset($cwu_result['recommendedCapacityL']) ? $cwu_result['recommendedCapacityL'] : null,
                        'hotWaterPower_kW' => isset($cwu_result['hotWaterPower_kW']) ? $cwu_result['hotWaterPower_kW'] : null,
                        'annualCwuEnergy_kWh' => isset($cwu_result['annualCwuEnergy_kWh']) ? $cwu_result['annualCwuEnergy_kWh'] : null,
                        'resolvedOptionId' => isset($cwu_result['resolvedOptionId']) ? $cwu_result['resolvedOptionId'] : null,
                        'resolvedCapacityL' => isset($cwu_result['resolvedCapacityL']) ? $cwu_result['resolvedCapacityL'] : null,
                        'resolvedMaterial' => isset($cwu_result['resolvedMaterial']) ? $cwu_result['resolvedMaterial'] : null,
                        'pricingHint' => isset($cwu_result['pricingHint']) && is_array($cwu_result['pricingHint']) ? $cwu_result['pricingHint'] : null,
                        'reasonCodes' => isset($cwu_result['reasonCodes']) && is_array($cwu_result['reasonCodes']) ? $cwu_result['reasonCodes'] : array(),
                        'warnings' => isset($cwu_result['warnings']) && is_array($cwu_result['warnings']) ? $cwu_result['warnings'] : array(),
                        'assumptions' => isset($cwu_result['assumptions']) && is_array($cwu_result['assumptions']) ? $cwu_result['assumptions'] : array(),
                        'explanation' => isset($cwu_result['explanation']) && is_array($cwu_result['explanation']) ? $cwu_result['explanation'] : null,
                    ),
                ),
                'pricing' => array(
                    'currency' => isset($pricing_result['currency']) ? $pricing_result['currency'] : 'PLN',
                    'items' => isset($pricing_result['items']) ? $pricing_result['items'] : array(),
                    'totals' => isset($pricing_result['totals']) ? $pricing_result['totals'] : array(
                        'net' => 0.0,
                        'vat' => 0.0,
                        'gross' => 0.0,
                    ),
                    'source' => 'backend_pricebook',
                    'catalogVersion' => $this->resolve_master_data_version($price_book),
                ),
                'warnings' => $warnings,
                'assumptions' => $assumptions,
                'engineMeta' => array(
                    'ozcVersion' => $used_external_ozc
                        ? (isset($ozc_result['source']) ? (string) $ozc_result['source'] : 'external')
                        : $this->resolve_ozc_engine_version(),
                    'selectionVersion' => $this->resolve_selection_engine_version(),
                    'bufferVersion' => $this->resolve_buffer_engine_version(),
                    'cwuVersion' => $this->resolve_cwu_engine_version(),
                    'pricingVersion' => $this->resolve_pricing_engine_version($price_book),
                    'masterDataVersion' => $this->resolve_master_data_version($price_book),
                    'ozcConstantsSource' => $used_external_ozc ? 'external' : 'coded',
                    'fallbackUsed' => $fallback_meta['used'],
                    'fallbackReasons' => $fallback_meta['reasons'],
                    'timestamp' => gmdate('c'),
                ),
            );

            $ozc_codes = $this->extract_record_codes(array_merge(
                isset($ozc_result['warnings']) && is_array($ozc_result['warnings']) ? $ozc_result['warnings'] : array(),
                isset($ozc_result['assumptions']) && is_array($ozc_result['assumptions']) ? $ozc_result['assumptions'] : array()
            ));

            if ($fallback_meta['used']) {
                $this->log_info('backend_fallback_used', array(
                    'traceId' => $trace_id,
                    'reasons' => $fallback_meta['reasons'],
                ));
            }

            if (in_array('OZC_PARITY_USED', $ozc_codes, true)) {
                $this->log_info('ozc_parity_used', array(
                    'traceId' => $trace_id,
                    'ozcSource' => isset($ozc_result['source']) ? $ozc_result['source'] : null,
                ));
            }

            if (in_array('DEFAULT_LOCATION_ASSUMED', $ozc_codes, true)) {
                $this->log_info('default_location_assumed', array(
                    'traceId' => $trace_id,
                    'ozcSource' => isset($ozc_result['source']) ? $ozc_result['source'] : null,
                ));
            }

            if (in_array('DEFAULT_FLOOR_AREA_ASSUMED', $ozc_codes, true)) {
                $this->log_info('default_floor_area_assumed', array(
                    'traceId' => $trace_id,
                    'ozcSource' => isset($ozc_result['source']) ? $ozc_result['source'] : null,
                ));
            }

            $this->log_info('calculate-offer use-case finished', array(
                'traceId' => $trace_id,
                'designHeatLoss_kW' => $design_heat_loss_kw,
                'pumpModel' => isset($selection_result['pumpModel']) ? $selection_result['pumpModel'] : null,
            ));

            return $offer;
        }

        /**
         * @param array<string,mixed> $calc_request
         * @param array<string,mixed> $building
         * @param array<string,mixed> $preferences
         * @return array{0:array<string,mixed>,1:bool}
         */
        private function resolve_ozc_result($calc_request, $building, $preferences) {
            $has_external_ozc = isset($calc_request['ozcResult']) && is_array($calc_request['ozcResult']) && !empty($calc_request['ozcResult']);
            if (!$has_external_ozc) {
                $computed = $this->ozc_engine->computeDesignHeatLoss($building, $preferences);
                return array(is_array($computed) ? $computed : array(), false);
            }

            $input = $calc_request['ozcResult'];
            $design_heat_loss_kw = $this->to_float(
                isset($input['designHeatLoss_kW']) ? $input['designHeatLoss_kW'] : null,
                0.0
            );

            $normalized = array(
                'designHeatLoss_kW' => $design_heat_loss_kw,
                'heatedArea_m2' => $this->to_float(
                    isset($input['heatedArea_m2']) ? $input['heatedArea_m2'] : null,
                    0.0
                ),
                'recommendedPower_kW' => $this->to_float(
                    isset($input['recommendedPower_kW']) ? $input['recommendedPower_kW'] : null,
                    $design_heat_loss_kw
                ),
                'hotWaterPower_kW' => $this->to_float(
                    isset($input['hotWaterPower_kW']) ? $input['hotWaterPower_kW'] : null,
                    null
                ),
                'assumptions' => isset($input['assumptions']) && is_array($input['assumptions']) ? $input['assumptions'] : array(),
                'warnings' => $this->normalize_ozc_warnings(isset($input['warnings']) ? $input['warnings'] : array()),
                'audit' => isset($input['audit']) && is_array($input['audit']) ? $input['audit'] : null,
                'source' => isset($input['source']) && is_string($input['source']) && trim($input['source']) !== ''
                    ? trim($input['source'])
                    : 'external',
                'metrics' => isset($input['metrics']) && is_array($input['metrics']) ? $input['metrics'] : null,
                'extended' => isset($input['extended']) && is_array($input['extended']) ? $input['extended'] : null,
            );

            return array($normalized, true);
        }

        /**
         * @param mixed $warnings
         * @return array<int,array<string,mixed>>
         */
        private function normalize_ozc_warnings($warnings) {
            if (!is_array($warnings)) {
                return array();
            }

            $normalized = array();
            foreach ($warnings as $warning) {
                if (is_string($warning) && trim($warning) !== '') {
                    $normalized[] = array(
                        'code' => 'OZC_WARNING',
                        'message' => trim($warning),
                    );
                    continue;
                }
                if (is_array($warning) && isset($warning['code']) && isset($warning['message'])) {
                    $normalized[] = $warning;
                }
            }

            return $normalized;
        }

        /**
         * @param array<int,mixed> $records
         * @return array<int,string>
         */
        private function extract_record_codes($records) {
            if (!is_array($records)) {
                return array();
            }

            $codes = array();
            foreach ($records as $record) {
                if (is_array($record) && isset($record['code']) && is_string($record['code']) && trim($record['code']) !== '') {
                    $codes[] = trim($record['code']);
                }
            }

            return array_values(array_unique($codes));
        }

        /**
         * @param array<string,mixed> $calc_request
         * @param array<string,mixed> $selection_rules
         * @return array<string,mixed>
         */
        private function canonicalize_calc_request($calc_request, $selection_rules) {
            if (!is_array($calc_request)) {
                return array();
            }

            $building = isset($calc_request['building']) && is_array($calc_request['building'])
                ? $calc_request['building']
                : array();
            $preferences = isset($calc_request['preferences']) && is_array($calc_request['preferences'])
                ? $calc_request['preferences']
                : array();
            if (!isset($preferences['heating']) || !is_array($preferences['heating'])) {
                $preferences['heating'] = array();
            }
            if (!isset($preferences['dhw']) || !is_array($preferences['dhw'])) {
                $preferences['dhw'] = array();
            }
            $preferences = $this->sanitize_supported_pricing_options($preferences);

            $normalized_building_type = $this->normalize_building_type_input(
                isset($building['building_type']) ? $building['building_type'] : null
            );
            if ($normalized_building_type !== null) {
                $building['building_type'] = $normalized_building_type;
            }

            $normalized_heating_type = $this->normalize_heating_type_input(
                $this->pick_first(array(
                    $this->dig($preferences, array('heating', 'emitterType')),
                    isset($building['heating_type']) ? $building['heating_type'] : null,
                    isset($building['installation_type']) ? $building['installation_type'] : null,
                )),
                $selection_rules
            );
            if ($normalized_heating_type !== null) {
                $building['heating_type'] = $normalized_heating_type;
                $building['installation_type'] = $normalized_heating_type;
                $preferences['heating']['emitterType'] = $normalized_heating_type;
            }

            $normalized_location_id = $this->normalize_location_id($this->pick_first(array(
                isset($building['location_id']) ? $building['location_id'] : null,
                isset($building['climate_zone']) ? $building['climate_zone'] : null,
            )));
            if ($normalized_location_id !== null) {
                $building['location_id'] = $normalized_location_id;
                if (!isset($building['climate_zone']) || trim((string) $building['climate_zone']) === '') {
                    $building['climate_zone'] = $normalized_location_id;
                }
            }

            $normalized_secondary_source = $this->normalize_secondary_source_type($this->pick_first(array(
                isset($building['secondary_source_type']) ? $building['secondary_source_type'] : null,
                isset($building['secondary_source']) ? $building['secondary_source'] : null,
                isset($building['bivalent_source_type']) ? $building['bivalent_source_type'] : null,
                $this->dig($preferences, array('bivalent', 'type')),
            )));
            if ($normalized_secondary_source !== null) {
                $building['secondary_source_type'] = $normalized_secondary_source;
                $building['secondary_source'] = $normalized_secondary_source;
                $building['bivalent_source_type'] = $normalized_secondary_source;
                if (!isset($preferences['bivalent']) || !is_array($preferences['bivalent'])) {
                    $preferences['bivalent'] = array();
                }
                $preferences['bivalent']['type'] = $normalized_secondary_source;
                if (!isset($preferences['bivalent']['enabled'])) {
                    $preferences['bivalent']['enabled'] = true;
                }
                if (!isset($building['bivalent_enabled'])) {
                    $building['bivalent_enabled'] = true;
                }
            }

            $calc_request['building'] = $building;
            $calc_request['preferences'] = $preferences;

            return $calc_request;
        }

        /**
         * @param array<string,mixed> $preferences
         * @return array<string,mixed>
         */
        private function sanitize_supported_pricing_options($preferences) {
            if (!isset($preferences['options']) || !is_array($preferences['options'])) {
                return $preferences;
            }

            $allowed_option_keys = array(
                'pumpOptionId',
                'dhwOptionId',
                'bufferOptionId',
                'circulationOptionId',
                'pressureReducerOptionId',
                'waterTreatmentOptionId',
                'foundationOptionId',
                'serviceOptionId',
            );

            $sanitized = array();
            foreach ($allowed_option_keys as $key) {
                if (isset($preferences['options'][$key])) {
                    $sanitized[$key] = $preferences['options'][$key];
                }
            }

            $preferences['options'] = $sanitized;
            return $preferences;
        }

        /**
         * @param array<int,array<int|array<string,mixed>>> $collections
         * @return array<int,array<string,mixed>>
         */
        private function merge_records($collections) {
            $merged = array();
            $seen = array();

            foreach ($collections as $records) {
                if (!is_array($records)) {
                    continue;
                }
                foreach ($records as $record) {
                    if (!is_array($record)) {
                        continue;
                    }
                    $encoded = function_exists('wp_json_encode') ? wp_json_encode($record) : json_encode($record);
                    $hash = md5((string) $encoded);
                    if (isset($seen[$hash])) {
                        continue;
                    }
                    $seen[$hash] = true;
                    $merged[] = $record;
                }
            }

            return $merged;
        }

        /**
         * @param array<int,array<string,mixed>> $engine_results
         * @return array{used:bool,reasons:array<int,string>}
         */
        private function collect_fallback_meta($engine_results) {
            $used = false;
            $reasons = array();

            foreach ($engine_results as $result) {
                if (!is_array($result)) {
                    continue;
                }
                if (!isset($result['fallback']) || !is_array($result['fallback'])) {
                    continue;
                }

                $fallback_used = isset($result['fallback']['used']) ? $this->to_bool($result['fallback']['used'], false) : false;
                if ($fallback_used) {
                    $used = true;
                }

                $fallback_reasons = $this->normalize_fallback_reasons(
                    isset($result['fallback']['reasons']) ? $result['fallback']['reasons'] : array()
                );
                foreach ($fallback_reasons as $reason) {
                    $reasons[] = $reason;
                }
            }

            return array(
                'used' => $used || !empty($reasons),
                'reasons' => array_values(array_unique($reasons)),
            );
        }

        /**
         * @param mixed $reasons
         * @return array<int,string>
         */
        private function normalize_fallback_reasons($reasons) {
            if (!is_array($reasons)) {
                return array();
            }
            $normalized = array();
            foreach ($reasons as $reason) {
                if (!is_string($reason)) {
                    continue;
                }
                $trimmed = trim($reason);
                if ($trimmed === '') {
                    continue;
                }
                $normalized[] = $trimmed;
            }
            return array_values(array_unique($normalized));
        }

        /**
         * @param array<string,mixed> $buffer_rules
         * @return bool
         */
        private function has_required_ozc_policy($buffer_rules) {
            if (!is_array($buffer_rules)) {
                return false;
            }
            $policy = isset($buffer_rules['ozcPolicy']) && is_array($buffer_rules['ozcPolicy'])
                ? $buffer_rules['ozcPolicy']
                : array();
            if (empty($policy)) {
                return false;
            }

            $area = isset($policy['area']) && is_array($policy['area']) ? $policy['area'] : array();
            $thermal = isset($policy['thermal']) && is_array($policy['thermal']) ? $policy['thermal'] : array();
            $climate = isset($policy['climate']) && is_array($policy['climate']) ? $policy['climate'] : array();

            if (empty($area) || empty($thermal) || empty($climate)) {
                return false;
            }

            return true;
        }

        /**
         * @param array<string,mixed> $request
         * @param array<string,mixed> $building
         * @param array<string,mixed> $preferences
         * @param array<string,mixed> $selection_result
         * @param array<string,mixed> $buffer_rules
         * @param array<string,mixed> $price_book
         * @return array<string,mixed>
         */
        private function resolve_cwu_result($request, $building, $preferences, $selection_result, $buffer_rules, $price_book) {
            if (!is_object($this->cwu_engine) || !method_exists($this->cwu_engine, 'compute')) {
                return array(
                    'demandEnabled' => $this->is_hot_water_enabled($request),
                    'enabled' => $this->is_hot_water_enabled($request),
                    'required' => $this->is_hot_water_enabled($request),
                    'skip' => !$this->is_hot_water_enabled($request),
                    'skipReason' => $this->is_hot_water_enabled($request) ? null : 'Nie dotyczy',
                    'persons' => $this->to_int($this->dig($preferences, array('dhw', 'persons')), 0),
                    'personsRaw' => $this->to_float($this->dig($preferences, array('dhw', 'persons')), 0.0),
                    'personsForCapacity' => $this->to_int($this->dig($preferences, array('dhw', 'persons')), 0),
                    'usageProfile' => (string) $this->pick_first(array(
                        $this->dig($preferences, array('dhw', 'usageProfile')),
                        isset($building['hot_water_usage']) ? $building['hot_water_usage'] : null,
                        'shower_bath',
                    )),
                    'isAio' => false,
                    'recommendedCapacityL' => null,
                    'hotWaterPower_kW' => $this->resolve_hot_water_power_kw($request, array()),
                    'annualCwuEnergy_kWh' => null,
                    'resolvedOptionId' => null,
                    'resolvedCapacityL' => null,
                    'resolvedMaterial' => null,
                    'pricingHint' => null,
                    'reasonCodes' => array(),
                    'warnings' => array(),
                    'assumptions' => array(),
                    'explanation' => null,
                    'fallback' => array(
                        'used' => true,
                        'reasons' => array('CWU_ENGINE_UNAVAILABLE'),
                    ),
                );
            }

            $result = $this->cwu_engine->compute(
                array(
                    'building' => $building,
                    'preferences' => $preferences,
                    'selection' => $selection_result,
                    'context' => isset($request['context']) && is_array($request['context']) ? $request['context'] : array(),
                ),
                is_array($buffer_rules) ? $buffer_rules : array(),
                is_array($price_book) ? $price_book : array()
            );

            return is_array($result) ? $result : array();
        }

        /**
         * Build a DHW sizing context for selection that ignores the currently picked pump
         * option, so split->AIO recommendation can still respect the real CWU need.
         *
         * @param array<string,mixed> $request
         * @param array<string,mixed> $building
         * @param array<string,mixed> $preferences
         * @param array<string,mixed> $buffer_rules
         * @param array<string,mixed> $price_book
         * @return array<string,mixed>
         */
        private function resolve_selection_cwu_context($request, $building, $preferences, $buffer_rules, $price_book) {
            if (!is_object($this->cwu_engine) || !method_exists($this->cwu_engine, 'compute')) {
                return array();
            }

            $selection_preferences = is_array($preferences) ? $preferences : array();
            if (isset($selection_preferences['options']) && is_array($selection_preferences['options'])) {
                unset($selection_preferences['options']['pumpOptionId']);
            }
            if (isset($selection_preferences['pumpOptionId'])) {
                unset($selection_preferences['pumpOptionId']);
            }

            $result = $this->cwu_engine->compute(
                array(
                    'building' => $building,
                    'preferences' => $selection_preferences,
                    'selection' => array(),
                    'context' => isset($request['context']) && is_array($request['context']) ? $request['context'] : array(),
                ),
                is_array($buffer_rules) ? $buffer_rules : array(),
                is_array($price_book) ? $price_book : array()
            );

            return is_array($result) ? $result : array();
        }

        /**
         * @param array<string,mixed> $request
         * @param array<string,mixed> $ozc_result
         * @param array<string,mixed> $cwu_result
         * @return float
         */
        private function resolve_hot_water_power_kw($request, $ozc_result, $cwu_result = array()) {
            $enabled = $this->is_hot_water_enabled($request);
            if (!$enabled) {
                return 0.0;
            }

            $ozc_power = $this->to_float(
                is_array($ozc_result) && isset($ozc_result['hotWaterPower_kW']) ? $ozc_result['hotWaterPower_kW'] : null,
                null
            );
            if ($ozc_power !== null && $ozc_power > 0.0) {
                return round($ozc_power, 2);
            }

            $cwu_power = $this->to_float(
                is_array($cwu_result) && isset($cwu_result['hotWaterPower_kW']) ? $cwu_result['hotWaterPower_kW'] : null,
                null
            );
            if ($cwu_power !== null && $cwu_power > 0.0) {
                return round($cwu_power, 2);
            }

            return $this->estimate_hot_water_power_kw($request);
        }

        /**
         * @param array<string,mixed> $request
         * @return float
         */
        private function estimate_hot_water_power_kw($request) {
            $preferences = isset($request['preferences']) && is_array($request['preferences'])
                ? $request['preferences']
                : array();
            $building = isset($request['building']) && is_array($request['building'])
                ? $request['building']
                : array();

            if (!$this->is_hot_water_enabled($request)) {
                return 0.0;
            }

            $persons = $this->to_int($this->dig($preferences, array('dhw', 'persons')), 0);
            if ($persons <= 0) {
                $persons = $this->to_int(isset($building['hot_water_persons']) ? $building['hot_water_persons'] : null, 0);
            }
            if ($persons <= 0) {
                return 0.0;
            }

            $usage = strtolower((string) $this->pick_first(array(
                $this->dig($preferences, array('dhw', 'usageProfile')),
                isset($building['hot_water_usage']) ? $building['hot_water_usage'] : null,
                'shower_bath',
            )));
            $power_per_person = array(
                'shower' => 0.15,
                'shower_bath' => 0.17,
                'bath' => 0.175,
            );
            $base_power = $persons * (isset($power_per_person[$usage]) ? (float) $power_per_person[$usage] : 0.17);
            return round(max(0.3, min(1.5, $base_power)), 2);
        }

        /**
         * @param array<string,mixed> $request
         * @return bool
         */
        private function is_hot_water_enabled($request) {
            $preferences = isset($request['preferences']) && is_array($request['preferences'])
                ? $request['preferences']
                : array();
            $building = isset($request['building']) && is_array($request['building'])
                ? $request['building']
                : array();

            $enabled = $this->to_bool($this->dig($preferences, array('dhw', 'enabled')), null);
            if ($enabled === null) {
                $enabled = $this->to_bool(isset($building['include_hot_water']) ? $building['include_hot_water'] : null, false);
            }
            return $enabled === true;
        }

        /**
         * @param array<string,mixed> $building
         * @return float
         */
        private function resolve_area($building) {
            foreach (array('heated_area', 'total_area', 'floor_area') as $field) {
                $value = $this->to_float(isset($building[$field]) ? $building[$field] : null, null);
                if ($value !== null && $value > 0.0) {
                    return $value;
                }
            }
            return 0.0;
        }

        /**
         * @param object $repository
         * @param string $method
         * @param array<int,mixed> $args
         * @return mixed
         */
        private function call_repository($repository, $method, $args) {
            if (!is_object($repository) || !method_exists($repository, $method)) {
                return array();
            }
            return call_user_func_array(array($repository, $method), $args);
        }

        /**
         * @return object
         */
        private function resolve_default_ozc_engine() {
            $enabled = true;
            if (defined('USE_FULL_OZC_ENGINE')) {
                $enabled = (bool) USE_FULL_OZC_ENGINE;
            }
            if (function_exists('apply_filters')) {
                $enabled = (bool) apply_filters('topinstal_use_full_ozc_engine', $enabled);
            }

            if ($enabled && class_exists('TopInstal_OzcEngine_Full')) {
                return new TopInstal_OzcEngine_Full();
            }

            if (class_exists('TopInstal_OzcEngine')) {
                return new TopInstal_OzcEngine();
            }

            return new TopInstal_OzcEngine_Mvp();
        }

        /**
         * @return string|null
         */
        private function resolve_ozc_node_binary() {
            $binary = null;
            if (defined('TOPINSTAL_NODE_BIN') && is_string(TOPINSTAL_NODE_BIN) && trim(TOPINSTAL_NODE_BIN) !== '') {
                $binary = trim(TOPINSTAL_NODE_BIN);
            }
            if (function_exists('apply_filters')) {
                $filtered = (string) apply_filters('topinstal_ozc_node_binary', $binary !== null ? $binary : 'node');
                if (trim($filtered) !== '') {
                    $binary = trim($filtered);
                }
            }
            return $binary;
        }

        /**
         * @param mixed $raw
         * @param array<string,mixed> $selection_rules
         * @return string|null
         */
        private function normalize_heating_type_input($raw, $selection_rules) {
            if (!is_string($raw)) {
                return null;
            }
            $value = strtolower(trim($raw));
            if ($value === '') {
                return null;
            }

            $alias_map = $this->build_heating_alias_map($selection_rules);
            if (isset($alias_map[$value])) {
                return $alias_map[$value];
            }

            if (strpos($value, 'podl') !== false || strpos($value, 'floor') !== false || strpos($value, 'underfloor') !== false || $value === 'surface') {
                return 'underfloor';
            }
            if (strpos($value, 'mix') !== false || strpos($value, 'miesz') !== false) {
                return 'mixed';
            }
            if (strpos($value, 'ht') !== false) {
                return 'radiators_ht';
            }
            if (strpos($value, 'lt') !== false) {
                return 'radiators_lt';
            }
            if (strpos($value, 'grzej') !== false || strpos($value, 'radiator') !== false) {
                return 'radiators';
            }

            return null;
        }

        /**
         * @param array<string,mixed> $selection_rules
         * @return array<string,string>
         */
        private function build_heating_alias_map($selection_rules) {
            $map = array(
                'surface' => 'underfloor',
                'underfloor' => 'underfloor',
                'floor_heating' => 'underfloor',
                'podlogowe' => 'underfloor',
                'podłogowe' => 'underfloor',
                'mixed' => 'mixed',
                'mieszane' => 'mixed',
                'radiators' => 'radiators',
                'grzejniki' => 'radiators',
                'radiators_ht' => 'radiators_ht',
                'grzejniki_ht' => 'radiators_ht',
                'radiators_lt' => 'radiators_lt',
                'grzejniki_lt' => 'radiators_lt',
            );

            $aliases = $this->dig($selection_rules, array('selectionPolicy', 'heating_type_aliases'));
            if (!is_array($aliases)) {
                return $map;
            }

            foreach ($aliases as $alias => $normalized) {
                if (!is_string($alias) || !is_string($normalized)) {
                    continue;
                }
                $normalized = strtolower(trim($normalized));
                if ($normalized === 'surface') {
                    $normalized = 'underfloor';
                }
                $normalized = trim($normalized);
                if ($normalized === '') {
                    continue;
                }
                $map[strtolower(trim($alias))] = $normalized;
            }

            return $map;
        }

        /**
         * @param mixed $raw
         * @return string|null
         */
        private function normalize_location_id($raw) {
            if (!is_string($raw)) {
                return null;
            }
            $value = strtoupper(trim($raw));
            if ($value === '') {
                return null;
            }

            $zone_aliases = array(
                'PL_I' => 'PL_STREFA_I',
                'PL_II' => 'PL_STREFA_II',
                'PL_III' => 'PL_STREFA_III',
                'PL_IV' => 'PL_STREFA_IV',
                'PL_V' => 'PL_STREFA_V',
            );
            if (isset($zone_aliases[$value])) {
                return $zone_aliases[$value];
            }

            return $value;
        }

        /**
         * @param mixed $raw
         * @return string|null
         */
        private function normalize_secondary_source_type($raw) {
            if (!is_string($raw)) {
                return null;
            }
            $value = strtolower(trim($raw));
            if ($value === '') {
                return null;
            }

            if (in_array($value, array('gas', 'gas_boiler', 'boiler_gas'), true)) {
                return 'gas';
            }
            if (in_array($value, array('solid_fuel', 'solid_fuel_boiler', 'boiler_solid_fuel', 'pellet', 'coal', 'wood'), true)) {
                return 'solid_fuel';
            }
            if (in_array($value, array('fireplace_water_jacket', 'fireplace_back_boiler', 'kominek', 'kominek_plaszcz'), true)) {
                return 'fireplace_water_jacket';
            }

            return $value;
        }

        /**
         * @param mixed $raw
         * @return string|null
         */
        private function normalize_building_type_input($raw) {
            if (!is_string($raw)) {
                return null;
            }
            $value = strtolower(trim($raw));
            if ($value === '') {
                return null;
            }

            $aliases = array(
                'single_house' => 'single_house',
                'single_family' => 'single_house',
                'single-family' => 'single_house',
                'detached_house' => 'single_house',
                'detached-house' => 'single_house',
                'detached' => 'single_house',
                'dom_jednorodzinny' => 'single_house',
                'double_house' => 'double_house',
                'semi_detached' => 'double_house',
                'semi-detached' => 'double_house',
                'bliźniak' => 'double_house',
                'blizniak' => 'double_house',
                'row_house' => 'row_house',
                'terraced_house' => 'row_house',
                'terraced-house' => 'row_house',
                'terrace' => 'row_house',
                'szeregowiec' => 'row_house',
                'apartment' => 'apartment',
                'flat' => 'apartment',
                'mieszkanie' => 'apartment',
                'multifamily' => 'multifamily',
                'multi_family' => 'multifamily',
                'multi-family' => 'multifamily',
                'budynek_wielorodzinny' => 'multifamily',
            );

            return isset($aliases[$value]) ? $aliases[$value] : null;
        }

        /**
         * @return object
         */
        private function resolve_default_selection_engine() {
            $use_legacy = false;
            if (defined('USE_LEGACY_SELECTION_ENGINE')) {
                $use_legacy = (bool) USE_LEGACY_SELECTION_ENGINE;
            }
            if (function_exists('apply_filters')) {
                $use_legacy = (bool) apply_filters('topinstal_use_legacy_selection_engine', $use_legacy);
            }

            if (!$use_legacy && class_exists('TopInstal_SelectionEngine')) {
                return new TopInstal_SelectionEngine();
            }

            return new TopInstal_SelectionEngine_Mvp();
        }

        /**
         * @return object
         */
        private function resolve_default_buffer_engine() {
            $enabled = false;
            if (defined('USE_FULL_BUFFER_ENGINE')) {
                $enabled = (bool) USE_FULL_BUFFER_ENGINE;
            }
            if (function_exists('apply_filters')) {
                $enabled = (bool) apply_filters('topinstal_use_full_buffer_engine', $enabled);
            }

            if ($enabled && class_exists('TopInstal_BufferEngine_Full')) {
                return new TopInstal_BufferEngine_Full();
            }

            if (class_exists('TopInstal_BufferEngine')) {
                return new TopInstal_BufferEngine();
            }

            return new TopInstal_BufferEngine_Mvp();
        }

        /**
         * @return object
         */
        private function resolve_default_pricing_engine() {
            $use_legacy = false;
            if (defined('USE_LEGACY_PRICING_ENGINE')) {
                $use_legacy = (bool) USE_LEGACY_PRICING_ENGINE;
            }
            if (function_exists('apply_filters')) {
                $use_legacy = (bool) apply_filters('topinstal_use_legacy_pricing_engine', $use_legacy);
            }

            if (!$use_legacy && class_exists('TopInstal_PricingEngine')) {
                return new TopInstal_PricingEngine();
            }

            return new TopInstal_PricingEngine_Mvp();
        }

        /**
         * @return object|null
         */
        private function resolve_default_cwu_engine() {
            if (class_exists('TopInstal_CwuEngine')) {
                return new TopInstal_CwuEngine();
            }
            return null;
        }

        /**
         * @return string
         */
        private function resolve_buffer_engine_version() {
            if (is_object($this->buffer_engine) && get_class($this->buffer_engine) === 'TopInstal_BufferEngine_Full') {
                return 'php-full-1';
            }
            if (is_object($this->buffer_engine) && get_class($this->buffer_engine) === 'TopInstal_BufferEngine') {
                return 'php-parity-1';
            }
            return 'php-mvp-1';
        }

        /**
         * @return string
         */
        private function resolve_ozc_engine_version() {
            if (is_object($this->ozc_engine) && get_class($this->ozc_engine) === 'TopInstal_OzcEngine_Full') {
                return 'php-full-1';
            }
            if (is_object($this->ozc_engine) && get_class($this->ozc_engine) === 'TopInstal_OzcEngine') {
                return 'php-parity-1';
            }
            return 'php-mvp-1';
        }

        /**
         * @return string
         */
        private function resolve_selection_engine_version() {
            if (is_object($this->selection_engine) && get_class($this->selection_engine) === 'TopInstal_SelectionEngine') {
                return 'php-parity-1';
            }
            return 'php-mvp-1';
        }

        /**
         * @return string|null
         */
        private function resolve_cwu_engine_version() {
            if (is_object($this->cwu_engine) && method_exists($this->cwu_engine, 'version')) {
                return (string) $this->cwu_engine->version();
            }
            return null;
        }

        /**
         * @param array<string,mixed> $price_book
         * @return string
         */
        private function resolve_pricing_engine_version($price_book) {
            if (is_object($this->pricing_engine) && get_class($this->pricing_engine) === 'TopInstal_PricingEngine') {
                if (is_array($price_book) && isset($price_book['pricing_version']) && is_string($price_book['pricing_version']) && trim($price_book['pricing_version']) !== '') {
                    return $price_book['pricing_version'];
                }
                return 'php-parity-1';
            }
            if (is_array($price_book) && isset($price_book['pricing_version']) && is_string($price_book['pricing_version']) && trim($price_book['pricing_version']) !== '') {
                return $price_book['pricing_version'];
            }
            return 'php-mvp-1';
        }

        /**
         * @param array<string,mixed> $price_book
         * @return string|null
         */
        private function resolve_master_data_version($price_book) {
            if (is_array($price_book) && isset($price_book['data_version']) && is_string($price_book['data_version']) && trim($price_book['data_version']) !== '') {
                return trim($price_book['data_version']);
            }
            if (is_array($price_book) && isset($price_book['source_version']) && is_string($price_book['source_version']) && trim($price_book['source_version']) !== '') {
                return trim($price_book['source_version']);
            }
            return null;
        }

        /**
         * @param mixed $trace_id
         * @return string
         */
        private function ensure_trace_id($trace_id) {
            if (function_exists('topinstal_ensure_trace_id')) {
                return topinstal_ensure_trace_id($trace_id);
            }
            if (is_string($trace_id) && trim($trace_id) !== '') {
                return trim($trace_id);
            }
            return uniqid('trace_', true);
        }

        /**
         * @param string $message
         * @param array<string,mixed> $context
         * @return void
         */
        private function log_info($message, $context = array()) {
            if (is_object($this->logger) && method_exists($this->logger, 'info')) {
                $this->logger->info($message, $context);
                return;
            }
            if (class_exists('TopInstal_Logger_Wp')) {
                TopInstal_Logger_Wp::info($message, $context);
            }
        }

        /**
         * @param array<int,mixed> $values
         * @return mixed|null
         */
        private function pick_first($values) {
            foreach ($values as $value) {
                if ($value !== null && $value !== '') {
                    return $value;
                }
            }
            return null;
        }

        /**
         * @param mixed $value
         * @param float|null $default
         * @return float|null
         */
        private function to_float($value, $default = null) {
            if ($value === null || $value === '') {
                return $default;
            }
            if (is_numeric($value)) {
                return (float) $value;
            }
            return $default;
        }

        /**
         * @param mixed $value
         * @param int $default
         * @return int
         */
        private function to_int($value, $default = 0) {
            if ($value === null || $value === '') {
                return $default;
            }
            if (is_numeric($value)) {
                return (int) $value;
            }
            return $default;
        }

        /**
         * @param mixed $value
         * @param bool|null $default
         * @return bool|null
         */
        private function to_bool($value, $default = false) {
            if ($value === null || $value === '') return $default;
            if (is_bool($value)) return $value;
            if (is_numeric($value)) return ((int) $value) === 1;
            if (is_string($value)) {
                $v = strtolower(trim($value));
                if ($v === '1' || $v === 'true' || $v === 'yes') return true;
                if ($v === '0' || $v === 'false' || $v === 'no') return false;
            }
            return $default;
        }

        /**
         * @param array<string,mixed> $data
         * @param array<int,string> $path
         * @return mixed|null
         */
        private function dig($data, $path) {
            $cursor = $data;
            foreach ($path as $part) {
                if (!is_array($cursor) || !array_key_exists($part, $cursor)) {
                    return null;
                }
                $cursor = $cursor[$part];
            }
            return $cursor;
        }
    }
}
