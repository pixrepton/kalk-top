<?php

if (!class_exists('TopInstal_BufferEngine')) {
    /**
     * Buffer engine with JS-aligned three-component sizing model.
     */
    class TopInstal_BufferEngine {
        /**
         * @param array<string,mixed> $input
         * @param array<string,mixed> $rules
         * @return array<string,mixed>
         */
        public function computeBuffer($input, $rules) {
            $code_buffer_disabled = class_exists('TopInstal_ReasonCodes')
                ? TopInstal_ReasonCodes::BUFFER_DISABLED_BY_PREFERENCE
                : 'BUFFER_DISABLED_BY_PREFERENCE';
            $code_buffer_rule_missing = class_exists('TopInstal_ReasonCodes')
                ? TopInstal_ReasonCodes::BUFFER_RULE_MISSING
                : 'BUFFER_RULE_MISSING';
            $code_buffer_oversized = class_exists('TopInstal_ReasonCodes')
                ? TopInstal_ReasonCodes::BUFFER_OVERSIZED_WARNING
                : 'BUFFER_OVERSIZED_WARNING';
            $code_mixed_separation = class_exists('TopInstal_ReasonCodes')
                ? TopInstal_ReasonCodes::MIXED_CIRCUITS_SEPARATION
                : 'MIXED_CIRCUITS_SEPARATION';
            $code_bivalent_solid = class_exists('TopInstal_ReasonCodes')
                ? TopInstal_ReasonCodes::BIVALENT_SOLID_FUEL
                : 'BIVALENT_SOLID_FUEL';
            $code_bivalent_fireplace = class_exists('TopInstal_ReasonCodes')
                ? TopInstal_ReasonCodes::BIVALENT_FIREPLACE_WATER_JACKET
                : 'BIVALENT_FIREPLACE_WATER_JACKET';
            $code_anti_cycling = class_exists('TopInstal_ReasonCodes')
                ? TopInstal_ReasonCodes::ANTI_CYCLING_STORAGE_REQUIRED
                : 'ANTI_CYCLING_STORAGE_REQUIRED';
            $code_manufacturer_3ph = class_exists('TopInstal_ReasonCodes')
                ? TopInstal_ReasonCodes::MANUFACTURER_3PH_K_200L
                : 'MANUFACTURER_3PH_K_200L';
            $code_insufficient_system = class_exists('TopInstal_ReasonCodes')
                ? TopInstal_ReasonCodes::INSUFFICIENT_SYSTEM_VOLUME
                : 'INSUFFICIENT_SYSTEM_VOLUME';
            $code_killer_case = class_exists('TopInstal_ReasonCodes')
                ? TopInstal_ReasonCodes::LOW_LOAD_HT_RADIATORS_KILLER
                : 'LOW_LOAD_HT_RADIATORS_KILLER';

            $design_heat_loss = $this->to_float(isset($input['designHeatLoss_kW']) ? $input['designHeatLoss_kW'] : null, 0.0);
            $building = isset($input['building']) && is_array($input['building']) ? $input['building'] : array();
            $preferences = isset($input['preferences']) && is_array($input['preferences']) ? $input['preferences'] : array();
            $selection = isset($input['selection']) && is_array($input['selection']) ? $input['selection'] : array();
            $ozc = isset($input['ozc']) && is_array($input['ozc']) ? $input['ozc'] : array();
            $context = isset($input['context']) && is_array($input['context']) ? $input['context'] : array();
            $configurator_context = $this->dig($context, array('configurator'));
            if (!is_array($configurator_context)) {
                $configurator_context = array();
            }
            $configurator_meta = isset($configurator_context['meta']) && is_array($configurator_context['meta'])
                ? $configurator_context['meta']
                : array();
            $selected_pump_context = isset($configurator_context['selectedPump']) && is_array($configurator_context['selectedPump'])
                ? $configurator_context['selectedPump']
                : array();
            $hydraulics_inputs = $this->normalize_hydraulics_inputs(
                isset($configurator_context['hydraulics_inputs']) ? $configurator_context['hydraulics_inputs'] : null,
                $building,
                $preferences
            );

            $wants_buffer = $this->to_bool($this->dig($preferences, array('hasBuffer')), true);

            $rules_missing = false;
            if (!$this->has_required_rules($rules)) {
                $rules = $this->default_rules_snapshot();
                $rules_missing = true;
            }
            $heating_type = $this->normalize_heating_type($this->pick_first_string(array(
                $this->dig($preferences, array('heating', 'emitterType')),
                isset($building['heating_type']) ? $building['heating_type'] : null,
                isset($building['installation_type']) ? $building['installation_type'] : null,
            )));
            $has_underfloor_actuators = ($heating_type === 'underfloor' || $heating_type === 'mixed')
                ? $this->to_bool(isset($hydraulics_inputs['has_underfloor_actuators']) ? $hydraulics_inputs['has_underfloor_actuators'] : null, false)
                : false;
            $radiators_is_ht = ($heating_type === 'radiators' || $heating_type === 'mixed')
                ? $this->resolve_radiators_is_ht($hydraulics_inputs, $building, $preferences, $heating_type)
                : false;
            $emitter_type = $this->resolve_emitter_type($heating_type, $radiators_is_ht);

            $pump_power = $this->to_float(
                $this->pick_first(array(
                    isset($selected_pump_context['power_kw']) ? $selected_pump_context['power_kw'] : null,
                    isset($selection['capacity_kW']) ? $selection['capacity_kW'] : null,
                    $this->dig($selection, array('pumpSelection', 'hp', 'power')),
                    $this->dig($selection, array('pumpSelection', 'aio', 'power')),
                    isset($selection['capacityKw']) ? $selection['capacityKw'] : null,
                    isset($configurator_meta['recommended_power_kw']) ? $configurator_meta['recommended_power_kw'] : null,
                    isset($configurator_meta['max_heating_power']) ? $configurator_meta['max_heating_power'] : null,
                )),
                0.0
            );
            if ($pump_power <= 0.0) {
                $pump_power = max(0.0, $design_heat_loss);
            }

            $pump_phase = $this->to_int(
                $this->pick_first(array(
                    isset($selected_pump_context['phase']) ? $selected_pump_context['phase'] : null,
                    isset($selection['phase']) ? $selection['phase'] : null,
                    $this->dig($selection, array('pumpSelection', 'hp', 'phase')),
                    $this->dig($selection, array('pumpSelection', 'aio', 'phase')),
                )),
                null
            );
            $pump_model = $this->pick_first_string(array(
                isset($selected_pump_context['model']) ? $selected_pump_context['model'] : null,
                isset($selection['pumpModel']) ? $selection['pumpModel'] : null,
                $this->dig($selection, array('pumpSelection', 'hp', 'model')),
                $this->dig($selection, array('pumpSelection', 'aio', 'model')),
            ));
            $generation = $this->resolve_generation(array(
                isset($selected_pump_context['series']) ? $selected_pump_context['series'] : null,
                isset($configurator_meta['generation']) ? $configurator_meta['generation'] : null,
                $pump_model,
            ));

            $heated_area = $this->to_float(
                $this->pick_first(array(
                    isset($configurator_meta['heated_area']) ? $configurator_meta['heated_area'] : null,
                    isset($ozc['heatedArea_m2']) ? $ozc['heatedArea_m2'] : null,
                    isset($building['heated_area']) ? $building['heated_area'] : null,
                    isset($building['floor_area']) ? $building['floor_area'] : null,
                    isset($building['total_area']) ? $building['total_area'] : null,
                    isset($configurator_meta['total_area']) ? $configurator_meta['total_area'] : null,
                )),
                100.0
            );
            if ($heated_area <= 0.0) {
                $heated_area = 100.0;
                $rules_missing = true;
            }

            $raw_bivalent_enabled = $this->pick_first(array(
                isset($hydraulics_inputs['bivalent_enabled']) ? $hydraulics_inputs['bivalent_enabled'] : null,
                isset($building['bivalent_enabled']) ? $building['bivalent_enabled'] : null,
                $this->dig($preferences, array('bivalent', 'enabled')),
            ));
            $secondary_type = $this->map_secondary_type($this->pick_first_string(array(
                isset($hydraulics_inputs['bivalent_source_type']) ? $hydraulics_inputs['bivalent_source_type'] : null,
                isset($building['secondary_source_type']) ? $building['secondary_source_type'] : null,
                isset($building['secondary_source']) ? $building['secondary_source'] : null,
                isset($building['bivalent_source_type']) ? $building['bivalent_source_type'] : null,
                $this->dig($preferences, array('bivalent', 'type')),
            )));
            $has_secondary = $this->to_bool($raw_bivalent_enabled, false) && $secondary_type !== null;
            if (!$has_secondary) {
                $secondary_type = null;
            }
            $secondary_power = $this->to_float($this->pick_first(array(
                isset($hydraulics_inputs['bivalent_source_power_kw']) ? $hydraulics_inputs['bivalent_source_power_kw'] : null,
                isset($building['secondary_power_kw']) ? $building['secondary_power_kw'] : null,
                $this->dig($preferences, array('bivalent', 'secondaryPowerKw')),
            )), null);

            $capacity_per_kw = $this->dig($rules, array('capacityPerKw'));
            if (!is_array($capacity_per_kw) || empty($capacity_per_kw)) {
                $capacity_per_kw = array('underfloor' => 10, 'radiators_lt' => 20, 'radiators_ht' => 25, 'radiators' => 20, 'mixed' => 15);
                $rules_missing = true;
            }
            $system_volume_per_m2 = $this->dig($rules, array('systemVolumePerM2'));
            if (!is_array($system_volume_per_m2) || empty($system_volume_per_m2)) {
                $system_volume_per_m2 = array('underfloor' => 0.95, 'radiators_lt' => 0.6, 'radiators_ht' => 0.9, 'radiators' => 0.6, 'mixed' => 0.9);
                $rules_missing = true;
            }
            $anti = $this->dig($rules, array('antiCyclingDefaults'));
            if (!is_array($anti)) {
                $anti = array();
                $rules_missing = true;
            }

            $t_min_minutes = $this->to_float(isset($anti['t_min_minutes']) ? $anti['t_min_minutes'] : null, 12.0);
            if ($t_min_minutes <= 0.0) {
                $t_min_minutes = 12.0;
                $rules_missing = true;
            }
            $delta_t_by_type = isset($anti['deltaT_by_type']) && is_array($anti['deltaT_by_type'])
                ? $anti['deltaT_by_type']
                : array();
            $delta_t_k = $this->to_float(isset($delta_t_by_type[$emitter_type]) ? $delta_t_by_type[$emitter_type] : null, null);
            if ($delta_t_k === null || $delta_t_k <= 0.0) {
                $delta_t_k = $this->to_float(isset($anti['deltaT_K']) ? $anti['deltaT_K'] : null, 7.0);
            }
            if ($delta_t_k <= 0.0) {
                $delta_t_k = 7.0;
                $rules_missing = true;
            }
            $min_modulation = $this->to_float(isset($anti['minModulationPercent']) ? $anti['minModulationPercent'] : null, 0.35);
            if ($min_modulation <= 0.0 || $min_modulation > 1.0) {
                $min_modulation = 0.35;
                $rules_missing = true;
            }
            $water_specific_heat = $this->to_float(isset($anti['waterSpecificHeat']) ? $anti['waterSpecificHeat'] : null, 1.16);
            if ($water_specific_heat <= 0.0) {
                $water_specific_heat = 1.16;
                $rules_missing = true;
            }

            $p_min = max(0.0, $pump_power) * $min_modulation;
            $t_hours = $t_min_minutes / 60.0;
            $denominator = $water_specific_heat * $delta_t_k;
            $v_anti = $denominator > 0.0 ? (($p_min * $t_hours) / $denominator) * 1000.0 : 0.0;
            if (!is_finite($v_anti) || $v_anti < 0.0) {
                $v_anti = 0.0;
                $rules_missing = true;
            }

            $v_bivalent = 0.0;
            $bivalent_rationale = 'No secondary heat source';
            if ($has_secondary && $secondary_type !== null) {
                if ($secondary_type === 'gas_boiler') {
                    $v_bivalent = 0.0;
                    $bivalent_rationale = 'Gas boiler can modulate, no storage needed';
                } elseif ($secondary_type === 'solid_fuel_boiler') {
                    $solid_rule = $this->dig($rules, array('bivalentStorage', 'solid_fuel_boiler'));
                    $liters_per_kw = $this->to_float($this->dig($solid_rule, array('litersPerKw')), 60.0);
                    $power_used = $secondary_power !== null && $secondary_power > 0.0
                        ? $secondary_power
                        : $this->calculate_fallback_power('solid_fuel_boiler', $design_heat_loss, $pump_power, $rules);
                    $v_bivalent = max(0.0, $power_used * $liters_per_kw);
                    $bivalent_rationale = 'Solid fuel boiler storage model';
                } elseif ($secondary_type === 'fireplace_back_boiler') {
                    $fire_rule = $this->dig($rules, array('bivalentStorage', 'fireplace_back_boiler'));
                    $minimum = $this->to_float($this->dig($fire_rule, array('minimum')), 500.0);
                    $liters_per_kw = $this->to_float($this->dig($fire_rule, array('litersPerKw')), 50.0);
                    $power_used = $secondary_power !== null && $secondary_power > 0.0
                        ? $secondary_power
                        : $this->calculate_fallback_power('fireplace_back_boiler', $design_heat_loss, $pump_power, $rules);
                    $v_bivalent = max($minimum, $power_used * $liters_per_kw);
                    $bivalent_rationale = 'Fireplace back boiler storage model';
                }
            }

            $cap_value = $this->to_float(isset($capacity_per_kw[$emitter_type]) ? $capacity_per_kw[$emitter_type] : null, null);
            if ($cap_value === null || $cap_value <= 0.0) {
                $cap_value = $this->to_float(isset($capacity_per_kw['radiators']) ? $capacity_per_kw['radiators'] : null, 20.0);
                $rules_missing = true;
            }
            $required_water_volume = max(0.0, $pump_power) * $cap_value;

            if ($emitter_type === 'mixed') {
                $underfloor_v = $this->to_float(isset($system_volume_per_m2['underfloor']) ? $system_volume_per_m2['underfloor'] : null, 0.95);
                $radiators_v = $radiators_is_ht
                    ? $this->to_float(isset($system_volume_per_m2['radiators_ht']) ? $system_volume_per_m2['radiators_ht'] : null, 0.9)
                    : $this->to_float(isset($system_volume_per_m2['radiators_lt']) ? $system_volume_per_m2['radiators_lt'] : null, 0.6);
                $estimated_system_volume = $heated_area * (($underfloor_v + $radiators_v) / 2.0);
            } else {
                $per_m2 = $this->to_float(isset($system_volume_per_m2[$emitter_type]) ? $system_volume_per_m2[$emitter_type] : null, null);
                if ($per_m2 === null || $per_m2 <= 0.0) {
                    $per_m2 = $this->to_float(isset($system_volume_per_m2['radiators']) ? $system_volume_per_m2['radiators'] : null, 0.6);
                    $rules_missing = true;
                }
                $estimated_system_volume = $heated_area * $per_m2;
            }

            $required_min_system_volume = max($required_water_volume, $v_anti);
            $hydraulic_deficit = max(0.0, $required_min_system_volume - $estimated_system_volume);
            $system_volume_sufficient = $hydraulic_deficit <= 0.0001;

            $minimum_capacities = $this->dig($rules, array('minimumCapacities'));
            if (!is_array($minimum_capacities)) {
                $minimum_capacities = array('seriesBuffer' => 50, 'parallelBuffer' => 100, 'flowProtection' => 50);
                $rules_missing = true;
            }
            $series_min = $this->to_int(isset($minimum_capacities['seriesBuffer']) ? $minimum_capacities['seriesBuffer'] : null, 50);
            $parallel_min = $this->to_int(isset($minimum_capacities['parallelBuffer']) ? $minimum_capacities['parallelBuffer'] : null, 100);
            if ($series_min <= 0) {
                $series_min = 50;
                $rules_missing = true;
            }
            if ($parallel_min <= 0) {
                $parallel_min = 100;
                $rules_missing = true;
            }

            $available_sizes = $this->extract_available_sizes($rules);
            if (empty($available_sizes)) {
                $available_sizes = array(50, 80, 100, 120, 150, 200, 300, 400, 500, 800, 1000);
                $rules_missing = true;
            }

            $flow_protection = 'NONE';
            if (($heating_type === 'underfloor' || $heating_type === 'mixed') && $has_underfloor_actuators) {
                $flow_protection = 'REQUIRED';
            }

            $hydraulic_separation = $heating_type === 'mixed' ? 'REQUIRED' : 'NONE';
            $energy_storage = 'NONE';
            $reason_codes = array();
            $manufacturer_required_capacity = 0;

            if ($has_secondary && $secondary_type !== null) {
                if ($secondary_type === 'solid_fuel_boiler') {
                    $hydraulic_separation = 'REQUIRED';
                    $energy_storage = 'MANDATORY';
                    $reason_codes[] = $code_bivalent_solid;
                } elseif ($secondary_type === 'fireplace_back_boiler') {
                    $hydraulic_separation = 'REQUIRED';
                    $energy_storage = 'MANDATORY';
                    $reason_codes[] = $code_bivalent_fireplace;
                } elseif ($secondary_type === 'gas_boiler') {
                    $hydraulic_separation = 'REQUIRED';
                    $energy_storage = 'MANDATORY';
                }
            }

            $is_low_load = $design_heat_loss > 0.0 && $p_min > $design_heat_loss;
            $is_radiator_family = ($heating_type === 'radiators' || $heating_type === 'mixed');
            if ($is_radiator_family && $radiators_is_ht && $is_low_load) {
                $energy_storage = 'MANDATORY';
                $reason_codes[] = $code_killer_case;
            } elseif ($is_radiator_family && $radiators_is_ht) {
                $energy_storage = 'MANDATORY';
                $reason_codes[] = $code_killer_case;
            } elseif ($energy_storage === 'NONE' && $is_low_load) {
                $energy_storage = 'OPTIONAL';
                $reason_codes[] = $code_anti_cycling;
            }

            $absolute = $this->dig($rules, array('absoluteRules', 'threePhaseKSeries'));
            if (is_array($absolute) && $this->to_bool(isset($absolute['enabled']) ? $absolute['enabled'] : null, false)) {
                $required_phase = $this->to_int(isset($absolute['phase']) ? $absolute['phase'] : null, 3);
                $powers = isset($absolute['powers']) && is_array($absolute['powers']) ? $absolute['powers'] : array(9, 12, 16);
                $required_series = strtoupper((string) $this->pick_first(array(
                    isset($absolute['series']) ? $absolute['series'] : null,
                    'K',
                )));
                $selected_phase = $pump_phase;
                $selected_power = $this->to_int(round($pump_power), 0);
                if (
                    $selected_phase === $required_phase &&
                    in_array($selected_power, $powers, true) &&
                    $generation !== null &&
                    strtoupper((string) $generation) === $required_series
                ) {
                    $energy_storage = 'MANDATORY';
                    $manufacturer_required_capacity = max(
                        0,
                        $this->to_int(isset($absolute['requiredCapacity']) ? $absolute['requiredCapacity'] : null, 200)
                    );
                    $reason_codes[] = $code_manufacturer_3ph;
                }
            }

            if ($flow_protection !== 'NONE') {
                $reason_codes[] = class_exists('TopInstal_ReasonCodes')
                    ? TopInstal_ReasonCodes::FLOW_RISK_UNDERFLOOR_ACTUATORS
                    : 'FLOW_RISK_UNDERFLOOR_ACTUATORS';
            }
            if ($hydraulic_separation === 'REQUIRED' && $heating_type === 'mixed') {
                $reason_codes[] = $code_mixed_separation;
            }

            $internal_recommendation = 'NONE';
            if ($energy_storage === 'MANDATORY') {
                $internal_recommendation =
                    $hydraulic_separation === 'REQUIRED' ? 'SEPARATOR + BUFFER_STORAGE' : 'BUFFER_STORAGE';
            } elseif ($hydraulic_separation === 'REQUIRED' && $energy_storage === 'NONE') {
                $internal_recommendation = 'SEPARATOR';
            } elseif ($flow_protection !== 'NONE' && $hydraulic_separation === 'NONE' && $energy_storage === 'NONE') {
                $internal_recommendation = 'FLOW_PROTECTION_DEVICE';
            } elseif ($energy_storage === 'OPTIONAL') {
                $internal_recommendation = $hydraulic_separation === 'REQUIRED' ? 'SEPARATOR' : 'NONE';
            }

            if ($system_volume_sufficient === false) {
                $energy_storage = 'MANDATORY';
                $reason_codes[] = $code_insufficient_system;
            }

            $sizing_components = array(
                'antiCycling' => array(
                    'liters' => (int) round($v_anti),
                    'rationale' => 'Anti-cycling minimum water volume',
                ),
                'bivalent' => array(
                    'liters' => (int) round($v_bivalent),
                    'rationale' => $bivalent_rationale,
                ),
                'hydraulic' => array(
                    'liters' => (int) round($hydraulic_deficit),
                    'rationale' => $hydraulic_deficit > 0.0
                        ? 'Hydraulic volume deficit'
                        : 'Hydraulic volume sufficient',
                ),
                'systemVolume' => array(
                    'required' => (int) round($required_min_system_volume),
                    'requiredWaterVolumeRuleOfThumb' => (int) round($required_water_volume),
                    'vAnti' => (int) round($v_anti),
                    'estimated' => (int) round($estimated_system_volume),
                    'sufficient' => $system_volume_sufficient,
                ),
            );

            $setup_type = 'NONE';
            $calculated_liters = 0.0;
            $recommended_liters = 0;
            $dominant = 'none';
            $market_capacity_liters = null;
            $manufacturer_policy_applied = false;
            $manufacturer_policy_minimum_liters = null;
            $computed_liters = null;
            $rounded_to = null;
            if (strpos($internal_recommendation, 'BUFFER_STORAGE') !== false) {
                $sizing_result = $this->calculate_final_buffer_recommendation(
                    $sizing_components,
                    $heating_type,
                    $hydraulic_separation === 'REQUIRED',
                    array(
                        'radiatorsIsHt' => $radiators_is_ht,
                        'hasSecondary' => $has_secondary,
                        'secondaryType' => $secondary_type,
                        'energyStorageMandatory' => $energy_storage === 'MANDATORY',
                    ),
                    $rules,
                    $available_sizes
                );
                $setup_type = isset($sizing_result['setupType']) ? (string) $sizing_result['setupType'] : 'NONE';
                $calculated_liters = $this->to_float(isset($sizing_result['calculatedCapacity']) ? $sizing_result['calculatedCapacity'] : null, 0.0);
                $recommended_liters = $this->to_int(isset($sizing_result['recommendedCapacity']) ? $sizing_result['recommendedCapacity'] : null, 0);
                $market_capacity_liters = $recommended_liters > 0 ? (int) $recommended_liters : null;
                if ($manufacturer_required_capacity > 0 && in_array($code_manufacturer_3ph, $reason_codes, true)) {
                    $manufacturer_policy_applied = true;
                    $manufacturer_policy_minimum_liters = $manufacturer_required_capacity;
                    $recommended_liters = max($recommended_liters, $manufacturer_required_capacity);
                    $recommended_liters = $this->round_nearest_size((float) $recommended_liters, $available_sizes);
                }
                $dominant = isset($sizing_result['dominantComponent']) ? (string) $sizing_result['dominantComponent'] : 'hydraulic';
            } elseif ($internal_recommendation === 'SEPARATOR') {
                $setup_type = 'PARALLEL_CLUTCH';
                $separator_size = $this->calculate_final_buffer_recommendation(
                    $sizing_components,
                    $heating_type,
                    true,
                    array(
                        'radiatorsIsHt' => $radiators_is_ht,
                        'hasSecondary' => $has_secondary,
                        'secondaryType' => $secondary_type,
                        'energyStorageMandatory' => false,
                    ),
                    $rules,
                    $available_sizes
                );
                $calculated_liters = $this->to_float(isset($separator_size['calculatedCapacity']) ? $separator_size['calculatedCapacity'] : null, (float) $parallel_min);
                $recommended_liters = max(
                    $parallel_min,
                    $this->to_int(isset($separator_size['recommendedCapacity']) ? $separator_size['recommendedCapacity'] : null, $parallel_min)
                );
                $recommended_liters = $this->round_nearest_size((float) $recommended_liters, $available_sizes);
                $dominant = isset($separator_size['dominantComponent']) ? (string) $separator_size['dominantComponent'] : 'hydraulic';
            } elseif ($internal_recommendation === 'FLOW_PROTECTION_DEVICE') {
                $setup_type = 'SERIES_BYPASS';
                $calculated_liters = (float) $series_min;
                $recommended_liters = $series_min;
                $dominant = 'hydraulic';
            }
            if ($setup_type !== 'NONE') {
                $computed_liters = (int) round($calculated_liters);
                $rounded_to = (int) $recommended_liters;
            }

            $warnings = array();
            if ($rules_missing) {
                $reason_codes[] = $code_buffer_rule_missing;
            }

            $oversized_threshold = $this->to_int($this->dig($rules, array('bufferEnginePolicy', 'oversized_warning_liters')), 500);
            if ($recommended_liters >= $oversized_threshold && $setup_type !== 'NONE') {
                $warnings[] = array(
                    'code' => $code_buffer_oversized,
                    'message' => 'Calculated buffer capacity is high; verify installation assumptions.',
                );
                $reason_codes[] = $code_buffer_oversized;
            }
            $flow_axis = $flow_protection;
            $separation_axis = $hydraulic_separation;
            $storage_axis = $energy_storage;

            $recommendation_label = 'NONE';
            if ($setup_type === 'SERIES_BYPASS') {
                $recommendation_label = 'BUFOR_SZEREGOWO';
            } elseif ($setup_type === 'PARALLEL_CLUTCH') {
                $recommendation_label = 'BUFOR_ROWNOLEGLE';
            }
            $recommendation_type = $setup_type === 'NONE'
                ? 'none'
                : 'storage';

            $assumptions = array(
                array(
                    'code' => 'BUFFER_FULL_MODEL',
                    'params' => array(
                        'heating_type' => $heating_type,
                        'emitter_type' => $emitter_type,
                        'pump_power_kw' => round($pump_power, 2),
                        'pump_phase' => $pump_phase,
                        'generation' => $generation,
                        'design_heat_loss_kw' => round($design_heat_loss, 2),
                        'heated_area_m2' => round($heated_area, 2),
                        'secondary_type' => $secondary_type,
                        'has_underfloor_actuators' => $has_underfloor_actuators,
                        'radiators_is_ht' => $radiators_is_ht,
                        'buffer_user_disabled' => !$wants_buffer,
                        'system_volume_sufficient' => $system_volume_sufficient,
                        'dominant_component' => $dominant,
                    ),
                ),
            );
            if (!$wants_buffer) {
                $assumptions[] = array(
                    'code' => $code_buffer_disabled,
                    'params' => array(),
                );
            }

            $reason_codes = array_values(array_unique($reason_codes));
            $buffer_liters = $setup_type === 'NONE' ? null : (int) $recommended_liters;
            $severity = 'INFO';
            if ($energy_storage === 'MANDATORY' || $hydraulic_separation === 'REQUIRED') {
                $severity = 'MANDATORY';
            } elseif ($flow_protection !== 'NONE') {
                $severity = 'RECOMMENDED';
            }

            $explanation_short_parts = array();
            if ($recommendation_label === 'NONE') {
                $explanation_short_parts[] = 'Nie potrzebujesz bufora ani sprzęgła.';
            } elseif ($recommendation_label === 'BUFOR_SZEREGOWO') {
                if ($internal_recommendation === 'FLOW_PROTECTION_DEVICE') {
                    $explanation_short_parts[] = 'Ryzyko zamknięcia obiegu -> bufor szeregowo (' . $buffer_liters . ' l) z zaworem różnicowym na by-passie.';
                } else {
                    $explanation_short_parts[] = 'Bufor szeregowo (' . ($buffer_liters !== null ? $buffer_liters : '-') . ' l) z zaworem różnicowym na by-passie dla stabilnej pracy sprężarki.';
                }
            } elseif ($recommendation_label === 'BUFOR_ROWNOLEGLE') {
                if ($internal_recommendation === 'SEPARATOR') {
                    $explanation_short_parts[] = 'Bufor równolegle jako sprzęgło hydrauliczne (' . ($buffer_liters !== null ? $buffer_liters : '-') . ' l) - separacja obiegów.';
                } else {
                    $explanation_short_parts[] = 'Bufor równolegle jako sprzęgło hydrauliczne (' . ($buffer_liters !== null ? $buffer_liters : '-') . ' l) - separacja + magazyn energii.';
                }
            }

            if ($manufacturer_policy_applied && $manufacturer_policy_minimum_liters !== null && $buffer_liters !== null) {
                $sizing_only = $market_capacity_liters !== null ? $market_capacity_liters : $buffer_liters;
                if ($buffer_liters > $sizing_only) {
                    $explanation_short_parts[] = 'Pojemność końcowa ' . $buffer_liters . ' l wynika z polityki producenta (seria K, 3 fazy: minimum ' . $manufacturer_policy_minimum_liters . ' l) - wyżej niż sama nominacja z obliczeń hydraulicznych (' . $sizing_only . ' l).';
                } else {
                    $explanation_short_parts[] = 'Obowiązuje wymóg producenta dla serii K (3 fazy): bufor co najmniej ' . $manufacturer_policy_minimum_liters . ' l.';
                }
            }

            $explanation_short = trim(implode(' ', $explanation_short_parts));
            $explanation_long_parts = array(
                'Oś przepływu: ' . $flow_axis . '.',
                'Oś separacji: ' . $separation_axis . '.',
                'Oś magazynowania: ' . $storage_axis . '.',
            );
            if ($buffer_liters !== null) {
                $explanation_long_parts[] = 'Pojemność bufora liczona jako max(V_antiCycling, V_bivalent, V_hydraulic) i zaokrąglona do pojemności rynkowych: ' . $buffer_liters . ' l.';
            } elseif ($recommendation_label === 'NONE') {
                $explanation_long_parts[] = 'Zład własny instalacji jest wystarczający do stabilnej pracy pompy.';
            } else {
                $explanation_long_parts[] = 'Bufor wymagany dla stabilnej pracy układu.';
            }

            $explanation = array(
                'short' => $explanation_short,
                'long' => implode(' ', $explanation_long_parts),
            );
            $inputs_used = array(
                'heating_type' => $heating_type,
                'has_underfloor_actuators' => $has_underfloor_actuators,
                'radiators_is_ht' => $radiators_is_ht,
                'bivalent_enabled' => $has_secondary,
                'bivalent_source_type' => $secondary_type,
                'designHeatLoss_kW' => round($design_heat_loss, 2),
                'heating_power' => round($pump_power, 2),
                'pump_min_modulation_kw' => round($p_min, 1),
            );
            $explainability = array(
                'buffer_liters' => $buffer_liters,
                'severity' => $severity,
                'dominantReason' => $explanation_short !== '' ? $explanation_short : (isset($reason_codes[0]) ? $reason_codes[0] : 'Standard calculation'),
                'explanation' => $explanation,
                'inputs_used' => $inputs_used,
                'type' => $recommendation_type,
                'hydraulicSeparationRequired' => $hydraulic_separation === 'REQUIRED',
                'estimatedSystemVolume' => (int) round($estimated_system_volume),
                'requiredSystemVolume' => (int) round($required_min_system_volume),
                'systemVolumeSufficient' => $system_volume_sufficient,
                'sizingComponents' => $setup_type === 'NONE' ? null : $sizing_components,
                'computedLiters' => $computed_liters,
                'roundedTo' => $rounded_to,
                'dominant' => $dominant,
                'marketCapacityLiters' => $setup_type === 'NONE' ? null : $market_capacity_liters,
                'manufacturerPolicyApplied' => $manufacturer_policy_applied,
                'manufacturerPolicyMinimumLiters' => $manufacturer_policy_applied ? $manufacturer_policy_minimum_liters : null,
            );
            $recommendation_payload = array(
                'type' => $recommendation_type,
                'recommendation' => $recommendation_label,
                'internalRecommendation' => $internal_recommendation,
                'buffer_liters' => $buffer_liters,
                'setupType' => $setup_type,
                'axes' => array(
                    'flow_protection' => $flow_axis,
                    'hydraulic_separation' => $separation_axis,
                    'energy_storage' => $storage_axis,
                ),
                'reason_codes' => $reason_codes,
                'dominant' => $dominant,
                'severity' => $severity,
                'explanation' => $explanation,
                'inputs_used' => $inputs_used,
                'hydraulicSeparationRequired' => $hydraulic_separation === 'REQUIRED',
                'estimatedSystemVolume' => (int) round($estimated_system_volume),
                'requiredSystemVolume' => (int) round($required_min_system_volume),
                'systemVolumeSufficient' => $system_volume_sufficient,
                'sizingComponents' => $setup_type === 'NONE' ? null : $sizing_components,
                'computedLiters' => $computed_liters,
                'roundedTo' => $rounded_to,
                'marketCapacityLiters' => $setup_type === 'NONE' ? null : $market_capacity_liters,
                'manufacturerPolicyApplied' => $manufacturer_policy_applied,
                'manufacturerPolicyMinimumLiters' => $manufacturer_policy_applied ? $manufacturer_policy_minimum_liters : null,
            );

            return array(
                'liters' => $buffer_liters,
                'setupType' => $setup_type,
                'reasonCodes' => $reason_codes,
                'warnings' => $warnings,
                'assumptions' => $assumptions,
                'buffer_liters' => $buffer_liters,
                'severity' => $severity,
                'dominantReason' => $explainability['dominantReason'],
                'explanation' => $explanation,
                'inputs_used' => $inputs_used,
                'type' => $recommendation_type,
                'hydraulicSeparationRequired' => $hydraulic_separation === 'REQUIRED',
                'estimatedSystemVolume' => (int) round($estimated_system_volume),
                'requiredSystemVolume' => (int) round($required_min_system_volume),
                'systemVolumeSufficient' => $system_volume_sufficient,
                'sizingComponents' => $setup_type === 'NONE' ? null : $sizing_components,
                'computedLiters' => $computed_liters,
                'roundedTo' => $rounded_to,
                'dominant' => $dominant,
                'marketCapacityLiters' => $setup_type === 'NONE' ? null : $market_capacity_liters,
                'manufacturerPolicyApplied' => $manufacturer_policy_applied,
                'manufacturerPolicyMinimumLiters' => $manufacturer_policy_applied ? $manufacturer_policy_minimum_liters : null,
                'recommendation' => $recommendation_payload,
                'sizing' => array(
                    'antiCycling' => array('liters' => (int) round($v_anti)),
                    'bivalent' => array('liters' => (int) round($v_bivalent), 'rationale' => $bivalent_rationale),
                    'hydraulic' => array('liters' => (int) round($hydraulic_deficit)),
                    'systemVolume' => array(
                        'required_liters' => (int) round($required_min_system_volume),
                        'estimated_liters' => (int) round($estimated_system_volume),
                        'sufficient' => $system_volume_sufficient,
                    ),
                    'calculatedCapacity_liters' => (int) round($calculated_liters),
                ),
                'fallback' => array(
                    'used' => $rules_missing,
                    'reasons' => $rules_missing ? array($code_buffer_rule_missing) : array(),
                ),
            );
        }

        /**
         * @param mixed $raw
         * @param array<string,mixed> $building
         * @param array<string,mixed> $preferences
         * @return array<string,mixed>
         */
        private function normalize_hydraulics_inputs($raw, $building, $preferences) {
            $inputs = is_array($raw) ? $raw : array();

            return array(
                'has_underfloor_actuators' => $this->to_bool(
                    array_key_exists('has_underfloor_actuators', $inputs) ? $inputs['has_underfloor_actuators'] : null,
                    false
                ),
                'radiators_is_ht' => $this->to_bool(
                    array_key_exists('radiators_is_ht', $inputs) ? $inputs['radiators_is_ht'] : null,
                    false
                ),
                'bivalent_enabled' => $this->to_bool(
                    array_key_exists('bivalent_enabled', $inputs) ? $inputs['bivalent_enabled'] : null,
                    $this->to_bool($this->pick_first(array(
                        isset($building['bivalent_enabled']) ? $building['bivalent_enabled'] : null,
                        $this->dig($preferences, array('bivalent', 'enabled')),
                    )), false)
                ),
                'bivalent_source_type' => $this->pick_first_string(array(
                    array_key_exists('bivalent_source_type', $inputs) ? $inputs['bivalent_source_type'] : null,
                    isset($building['secondary_source_type']) ? $building['secondary_source_type'] : null,
                    isset($building['secondary_source']) ? $building['secondary_source'] : null,
                    isset($building['bivalent_source_type']) ? $building['bivalent_source_type'] : null,
                    $this->dig($preferences, array('bivalent', 'type')),
                )),
                'bivalent_source_power_kw' => $this->to_float($this->pick_first(array(
                    array_key_exists('bivalent_source_power_kw', $inputs) ? $inputs['bivalent_source_power_kw'] : null,
                    isset($building['secondary_power_kw']) ? $building['secondary_power_kw'] : null,
                    $this->dig($preferences, array('bivalent', 'secondaryPowerKw')),
                )), null),
            );
        }

        /**
         * @param array<string,mixed> $hydraulics_inputs
         * @param array<string,mixed> $building
         * @param array<string,mixed> $preferences
         * @param string $heating_type
         * @return bool
         */
        private function resolve_radiators_is_ht($hydraulics_inputs, $building, $preferences, $heating_type) {
            if (is_array($hydraulics_inputs) && array_key_exists('radiators_is_ht', $hydraulics_inputs)) {
                return $this->to_bool($hydraulics_inputs['radiators_is_ht'], false);
            }
            return $this->is_radiators_ht($building, $preferences, $heating_type);
        }

        /**
         * @param array<int,mixed> $candidates
         * @return string|null
         */
        private function resolve_generation($candidates) {
            foreach ($candidates as $candidate) {
                if (!is_string($candidate) || trim($candidate) === '') {
                    continue;
                }
                $value = trim($candidate);
                if (strlen($value) === 1) {
                    return strtoupper($value);
                }
                if (preg_match('/\d([A-Z])\d/i', $value, $matches)) {
                    return strtoupper($matches[1]);
                }
            }
            return null;
        }

        /**
         * @param array<string,mixed> $components
         * @param string $heating_type
         * @param bool $hydraulic_separation_required
         * @param array<string,mixed> $options
         * @param array<string,mixed> $rules
         * @param array<int,int> $available_sizes
         * @return array<string,mixed>
         */
        private function calculate_final_buffer_recommendation($components, $heating_type, $hydraulic_separation_required, $options, $rules, $available_sizes) {
            $v_anti = $this->to_float($this->dig($components, array('antiCycling', 'liters')), 0.0);
            $v_bivalent = $this->to_float($this->dig($components, array('bivalent', 'liters')), 0.0);
            $v_hydraulic = $this->to_float($this->dig($components, array('hydraulic', 'liters')), 0.0);
            $system_volume_sufficient = $this->to_bool($this->dig($components, array('systemVolume', 'sufficient')), false);

            $radiators_is_ht = $this->to_bool(isset($options['radiatorsIsHt']) ? $options['radiatorsIsHt'] : null, false);
            $has_secondary = $this->to_bool(isset($options['hasSecondary']) ? $options['hasSecondary'] : null, false);
            $secondary_type = isset($options['secondaryType']) ? (string) $options['secondaryType'] : null;
            $energy_storage_mandatory = $this->to_bool(isset($options['energyStorageMandatory']) ? $options['energyStorageMandatory'] : null, false);

            $requires_buffer_for_ht_radiators = ($heating_type === 'radiators' || $heating_type === 'mixed') && $radiators_is_ht;
            $requires_buffer_for_gas = $has_secondary && $secondary_type === 'gas_boiler';
            $requires_buffer_mandatory = $energy_storage_mandatory || $requires_buffer_for_ht_radiators || $requires_buffer_for_gas;
            $is_simple_system = $heating_type !== 'mixed' && !$hydraulic_separation_required;

            if ($system_volume_sufficient && $is_simple_system && $v_bivalent <= 0.0 && !$requires_buffer_mandatory) {
                return array(
                    'setupType' => 'NONE',
                    'recommendedCapacity' => 0,
                    'calculatedCapacity' => 0,
                    'dominantComponent' => 'none',
                );
            }

            $series_min = $this->to_int($this->dig($rules, array('minimumCapacities', 'seriesBuffer')), 50);
            $parallel_min = $this->to_int($this->dig($rules, array('minimumCapacities', 'parallelBuffer')), 100);

            if ($is_simple_system && !$system_volume_sufficient) {
                $recommended = max($v_hydraulic, (float) $series_min, $v_bivalent);
                return array(
                    'setupType' => 'SERIES_BYPASS',
                    'recommendedCapacity' => $this->round_nearest_size($recommended, $available_sizes),
                    'calculatedCapacity' => (int) round($recommended),
                    'dominantComponent' => $v_bivalent > $v_hydraulic ? 'bivalent' : 'hydraulic',
                );
            }

            $parallel_recommended = max($v_hydraulic, $v_bivalent);
            $parallel_final = max($parallel_recommended, (float) $parallel_min);

            return array(
                'setupType' => 'PARALLEL_CLUTCH',
                'recommendedCapacity' => $this->round_nearest_size($parallel_final, $available_sizes),
                'calculatedCapacity' => (int) round($parallel_final),
                'dominantComponent' => $v_bivalent > $v_hydraulic ? 'bivalent' : 'hydraulic',
            );
        }

        /**
         * @param array<string,mixed> $rules
         * @return bool
         */
        private function has_required_rules($rules) {
            if (!is_array($rules)) {
                return false;
            }
            if (!is_array($this->dig($rules, array('capacityPerKw')))) {
                return false;
            }
            if (!is_array($this->dig($rules, array('systemVolumePerM2')))) {
                return false;
            }
            if (!is_array($this->dig($rules, array('antiCyclingDefaults')))) {
                return false;
            }
            if (!is_array($this->dig($rules, array('minimumCapacities')))) {
                return false;
            }
            if (!is_array($this->dig($rules, array('availableCapacities', 'buffer')))) {
                return false;
            }
            return true;
        }

        /**
         * @return array<string,mixed>
         */
        private function default_rules_snapshot() {
            return array(
                'capacityPerKw' => array(
                    'underfloor' => 10,
                    'radiators_lt' => 20,
                    'radiators_ht' => 25,
                    'radiators' => 20,
                    'mixed' => 15,
                ),
                'systemVolumePerM2' => array(
                    'underfloor' => 0.95,
                    'radiators_lt' => 0.6,
                    'radiators_ht' => 0.9,
                    'radiators' => 0.6,
                    'mixed' => 0.9,
                ),
                'antiCyclingDefaults' => array(
                    't_min_minutes' => 12,
                    'deltaT_K' => 7,
                    'deltaT_by_type' => array(
                        'underfloor' => 5,
                        'radiators_lt' => 7,
                        'radiators_ht' => 7,
                        'radiators' => 7,
                        'mixed' => 5,
                    ),
                    'minModulationPercent' => 0.35,
                    'waterSpecificHeat' => 1.16,
                ),
                'minimumCapacities' => array(
                    'seriesBuffer' => 50,
                    'parallelBuffer' => 100,
                    'flowProtection' => 50,
                ),
                'availableCapacities' => array(
                    'buffer' => array(50, 80, 100, 120, 150, 200, 300, 400, 500, 800, 1000),
                ),
                'bufferEnginePolicy' => array(
                    'oversized_warning_liters' => 500,
                ),
            );
        }

        /**
         * @param string $secondary_type
         * @param float $design_heat_loss
         * @param float $pump_power
         * @param array<string,mixed> $rules
         * @return float
         */
        private function calculate_fallback_power($secondary_type, $design_heat_loss, $pump_power, $rules) {
            $rule_key = $secondary_type === 'solid_fuel_boiler' ? 'solid_fuel_boiler' : 'fireplace_back_boiler';
            $rule = $this->dig($rules, array('bivalentStorage', $rule_key));
            if (!is_array($rule)) {
                return $secondary_type === 'fireplace_back_boiler' ? 15.0 : 20.0;
            }

            $factor = $this->to_float(isset($rule['defaultPowerFactor']) ? $rule['defaultPowerFactor'] : null, 1.0);
            $clamp = isset($rule['defaultPowerClamp']) && is_array($rule['defaultPowerClamp']) ? $rule['defaultPowerClamp'] : array(6, 20);
            $min = isset($clamp[0]) ? $this->to_float($clamp[0], 6.0) : 6.0;
            $max = isset($clamp[1]) ? $this->to_float($clamp[1], 20.0) : 20.0;

            $base = $design_heat_loss > 0.0 ? $design_heat_loss : $pump_power;
            if ($base <= 0.0) {
                return ($min + $max) / 2.0;
            }
            $value = $base * $factor;
            return max($min, min($max, $value));
        }

        /**
         * @param string|null $raw
         * @return string
         */
        private function normalize_heating_type($raw) {
            $value = is_string($raw) ? strtolower(trim($raw)) : '';
            if ($value === 'surface' || $value === 'underfloor' || $value === 'floor_heating' || $value === 'podlogowe' || $value === 'podłogowe') return 'underfloor';
            if ($value === 'mixed' || $value === 'mieszane') return 'mixed';
            if ($value === 'radiators_ht') return 'radiators_ht';
            if ($value === 'radiators_lt') return 'radiators_lt';
            if ($value === 'grzejniki') return 'radiators';
            return 'radiators';
        }

        /**
         * @param string $heating_type
         * @param bool $radiators_is_ht
         * @return string
         */
        private function resolve_emitter_type($heating_type, $radiators_is_ht) {
            if ($heating_type === 'underfloor') return 'underfloor';
            if ($heating_type === 'mixed') return 'mixed';
            if ($heating_type === 'radiators_ht') return 'radiators_ht';
            if ($heating_type === 'radiators_lt') return 'radiators_lt';
            return $radiators_is_ht ? 'radiators_ht' : 'radiators';
        }

        /**
         * @param array<string,mixed> $building
         * @param array<string,mixed> $preferences
         * @param string $heating_type
         * @return bool
         */
        private function is_radiators_ht($building, $preferences, $heating_type) {
            if ($heating_type === 'radiators_ht') return true;
            if ($heating_type === 'radiators_lt' || $heating_type === 'underfloor') return false;

            $explicit = $this->pick_first(array(
                isset($building['radiators_is_ht']) ? $building['radiators_is_ht'] : null,
                isset($building['radiators_ht']) ? $building['radiators_ht'] : null,
                $this->dig($preferences, array('heating', 'radiatorsIsHt')),
            ));
            if ($explicit !== null) {
                return $this->to_bool($explicit, false);
            }
            return false;
        }

        /**
         * @param string|null $raw
         * @return string|null
         */
        private function map_secondary_type($raw) {
            if (!is_string($raw)) {
                return null;
            }
            $value = strtolower(trim($raw));
            if ($value === '') {
                return null;
            }
            if (in_array($value, array('gas', 'gas_boiler', 'boiler_gas'), true)) {
                return 'gas_boiler';
            }
            if (in_array($value, array('solid_fuel', 'solid_fuel_boiler', 'boiler_solid_fuel', 'pellet', 'coal', 'wood'), true)) {
                return 'solid_fuel_boiler';
            }
            if (in_array($value, array('fireplace_water_jacket', 'fireplace_back_boiler', 'kominek', 'kominek_plaszcz'), true)) {
                return 'fireplace_back_boiler';
            }
            return null;
        }

        /**
         * @param array<string,mixed> $rules
         * @return array<int,int>
         */
        private function extract_available_sizes($rules) {
            $sizes = $this->dig($rules, array('availableCapacities', 'buffer'));
            if (!is_array($sizes) || empty($sizes)) {
                return array(50, 80, 100, 120, 150, 200, 300, 400, 500, 800, 1000);
            }
            $normalized = array();
            foreach ($sizes as $size) {
                if (!is_numeric($size)) {
                    continue;
                }
                $normalized[] = (int) round((float) $size);
            }
            $normalized = array_values(array_unique($normalized));
            sort($normalized);
            return $normalized;
        }

        /**
         * @param float $liters
         * @param array<int,int> $sizes
         * @return int
         */
        private function round_nearest_size($liters, $sizes) {
            if ($liters <= 0.0) {
                return 0;
            }
            if (empty($sizes)) {
                return (int) round($liters);
            }
            $closest = $sizes[0];
            $min_diff = abs((float) $sizes[0] - $liters);
            foreach ($sizes as $size) {
                $diff = abs((float) $size - $liters);
                if ($diff < $min_diff) {
                    $min_diff = $diff;
                    $closest = $size;
                }
            }
            return (int) $closest;
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
         * @param array<int,mixed> $values
         * @return string|null
         */
        private function pick_first_string($values) {
            foreach ($values as $value) {
                if (is_string($value) && trim($value) !== '') {
                    return trim($value);
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
         * @param int|null $default
         * @return int|null
         */
        private function to_int($value, $default = null) {
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
         * @param bool $default
         * @return bool
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

if (!class_exists('TopInstal_BufferEngine_Mvp')) {
    class TopInstal_BufferEngine_Mvp extends TopInstal_BufferEngine {
    }
}

if (!class_exists('TopInstal_BufferEngine_Full')) {
    class TopInstal_BufferEngine_Full extends TopInstal_BufferEngine {
    }
}

