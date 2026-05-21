<?php

if (!class_exists('TopInstal_SelectionEngine')) {
    /**
     * Transitional selection engine for backend MVP.
     * Pure computation over input data + rules table.
     */
    class TopInstal_SelectionEngine {
        /**
         * @param float $design_heat_loss_kw
         * @param array<string,mixed> $building
         * @param array<string,mixed> $preferences
         * @param array<string,mixed> $rules
         * @param array<string,mixed> $cwu_context
         * @return array<string,mixed>
         */
        public function select($design_heat_loss_kw, $building, $preferences, $rules, $cwu_context = array()) {
            $code_no_exact_match = class_exists('TopInstal_ReasonCodes')
                ? TopInstal_ReasonCodes::SELECTION_NO_EXACT_MATCH
                : 'SELECTION_NO_EXACT_MATCH';
            $code_special_low_power = class_exists('TopInstal_ReasonCodes')
                ? TopInstal_ReasonCodes::SELECTION_SPECIAL_LOW_POWER
                : 'SELECTION_SPECIAL_LOW_POWER';
            $code_high_power_limited = class_exists('TopInstal_ReasonCodes')
                ? TopInstal_ReasonCodes::SELECTION_HIGH_POWER_LIMITED
                : 'SELECTION_HIGH_POWER_LIMITED';
            $table = isset($rules['pumpMatchingTable']) && is_array($rules['pumpMatchingTable'])
                ? $rules['pumpMatchingTable']
                : array();
            $aio_map = isset($rules['aioMap']) && is_array($rules['aioMap'])
                ? $rules['aioMap']
                : array();
            $aio_large_map = isset($rules['aioLargeCwuMap']) && is_array($rules['aioLargeCwuMap'])
                ? $rules['aioLargeCwuMap']
                : array();
            $selection_policy = isset($rules['selectionPolicy']) && is_array($rules['selectionPolicy'])
                ? $rules['selectionPolicy']
                : array();
            $aio_requirement = $this->resolve_aio_requirement($cwu_context);
            $default_preferred_type = strtolower((string) $this->pick_first_string(array(
                isset($selection_policy['preferred_type']) ? $selection_policy['preferred_type'] : null,
                'split',
            )));
            $preferred = $this->resolve_preferred_pump_variant($preferences, $default_preferred_type);
            $preferred_type = isset($preferred['type']) ? (string) $preferred['type'] : $default_preferred_type;
            $preferred_phase = isset($preferred['phase']) ? $this->to_int($preferred['phase'], null) : null;
            $fallback_strategy = isset($selection_policy['fallback_strategy']) && is_array($selection_policy['fallback_strategy'])
                ? $selection_policy['fallback_strategy']
                : array();
            $fallback_mode = strtolower((string) $this->pick_first_string(array(
                isset($fallback_strategy['mode']) ? $fallback_strategy['mode'] : null,
                'none',
            )));
            // Canonical configurator JS uses exact-range matches only; nearest fallback is
            // a dormant policy seam in master-data, not active runtime behavior.
            $use_nearest_fallback = false;

            $heating_type = $this->normalize_heating_type(
                $this->pick_first_string(array(
                    $this->dig($preferences, array('heating', 'emitterType')),
                    isset($building['heating_type']) ? $building['heating_type'] : null,
                    isset($building['installation_type']) ? $building['installation_type'] : null,
                )),
                isset($selection_policy['heating_type_aliases']) && is_array($selection_policy['heating_type_aliases'])
                    ? $selection_policy['heating_type_aliases']
                    : array()
            );

            $demand_kw = $this->to_float($design_heat_loss_kw, 0.0);
            if ($demand_kw < 0.0) {
                $demand_kw = 0.0;
            }

            $matches = array();
            foreach ($table as $model => $data) {
                if (!is_array($data)) {
                    continue;
                }
                $range_min = $this->resolve_range_value($data, 'min', $heating_type);
                $range_max = $this->resolve_range_value($data, 'max', $heating_type);
                if ($range_min === null || $range_max === null) {
                    continue;
                }
                if ($demand_kw >= $range_min && $demand_kw <= $range_max) {
                    $matches[] = array(
                        'model' => (string) $model,
                        'power' => $this->to_float($this->pick_first_value(array(
                            isset($data['power']) ? $data['power'] : null,
                            isset($data['power_kw']) ? $data['power_kw'] : null,
                        )), 0.0),
                        'type' => isset($data['type']) ? (string) $data['type'] : 'split',
                        'phase' => $this->to_int(isset($data['phase']) ? $data['phase'] : null, 1),
                        'series' => isset($data['series']) ? (string) $data['series'] : null,
                        'cwu_tank' => $this->to_int(isset($data['cwu_tank']) ? $data['cwu_tank'] : null, null),
                        'min' => $range_min,
                        'max' => $range_max,
                    );
                }
            }

            $matches = $this->filter_matches_for_cwu_requirement($matches, $aio_requirement);

            usort($matches, function ($a, $b) {
                $pa = isset($a['power']) ? (float) $a['power'] : 0.0;
                $pb = isset($b['power']) ? (float) $b['power'] : 0.0;
                if ($pa === $pb) {
                    return strcmp((string) $a['model'], (string) $b['model']);
                }
                return $pa < $pb ? -1 : 1;
            });

            $selected = null;
            $warnings = array();
            $reason_codes = array();
            $low_power_policy = $this->dig($selection_policy, array('special_cases', 'low_power_building'));
            $high_power_policy = $this->dig($selection_policy, array('special_cases', 'high_power_catalog_limit'));

            $low_power_enabled = $this->to_bool($this->dig($low_power_policy, array('enabled')), true);
            $low_power_demand_max = $this->to_float($this->dig($low_power_policy, array('demand_max_kw')), 1.8);
            $low_power_area_max = $this->to_float($this->dig($low_power_policy, array('heated_area_max_m2')), 80.0);
            $low_power_temp_max = $this->to_float($this->dig($low_power_policy, array('indoor_temp_max_c')), 21.0);
            $low_power_construction_types = $this->normalize_string_list(
                $this->dig($low_power_policy, array('construction_types'))
            );
            $low_power_force_model = $this->pick_first_string(array(
                $this->dig($low_power_policy, array('force_model')),
                'KIT-WC03K3E5',
            ));

            $high_power_enabled = $this->to_bool($this->dig($high_power_policy, array('enabled')), true);
            $high_power_demand_min = $this->to_float($this->dig($high_power_policy, array('demand_min_kw')), 16.0);
            $high_power_demand_max = $this->to_float($this->dig($high_power_policy, array('demand_max_kw')), 25.0);
            $high_power_force_model = $this->pick_first_string(array(
                $this->dig($high_power_policy, array('force_model')),
                'KIT-WC16K9E8',
            ));
            $catalog_cutoff_kw = max(0.0, $high_power_demand_max);
            $exceeds_catalog_limit = $demand_kw >= $catalog_cutoff_kw;

            $construction_type = strtolower((string) $this->pick_first_string(array(
                isset($building['construction_type']) ? $building['construction_type'] : null,
                isset($building['building_construction_type']) ? $building['building_construction_type'] : null,
            )));
            $heated_area = $this->to_float(
                $this->pick_first_value(array(
                    isset($building['heated_area']) ? $building['heated_area'] : null,
                    isset($building['floor_area']) ? $building['floor_area'] : null,
                    isset($building['total_area']) ? $building['total_area'] : null,
                )),
                0.0
            );
            $indoor_temp = $this->to_float(
                $this->pick_first_value(array(
                    isset($building['indoor_temperature']) ? $building['indoor_temperature'] : null,
                    $this->dig($preferences, array('heating', 'indoorTemperatureC')),
                )),
                21.0
            );
            $is_special_low_power =
                $low_power_enabled &&
                $demand_kw < $low_power_demand_max &&
                in_array($construction_type, !empty($low_power_construction_types) ? $low_power_construction_types : array('canadian', 'skeleton', 'szkieletowy'), true) &&
                $heated_area > 0 &&
                $heated_area < $low_power_area_max &&
                $indoor_temp < $low_power_temp_max;
            if ($is_special_low_power) {
                $special = $this->build_model_from_table($low_power_force_model, $table, $heating_type);
                if (is_array($special)) {
                    $special['specialCase'] = 'very_low_power';
                    $special['adjustedPowerDisplay'] = number_format($demand_kw, 2, '.', '') . ' ± 2 kW';
                    $selected = $special;
                    $matches = array($special);
                    $warnings[] = array(
                        'code' => $code_special_low_power,
                        'message' => 'Very low-power special-case applied (3 kW split model).',
                    );
                    $reason_codes[] = $code_special_low_power;
                }
            }

            if (
                $selected === null &&
                $high_power_enabled &&
                $demand_kw >= $high_power_demand_min &&
                $demand_kw < $high_power_demand_max
            ) {
                $high_power = $this->build_model_from_table($high_power_force_model, $table, $heating_type);
                if (is_array($high_power)) {
                    $high_power['specialCase'] = 'high_power_termomodernization';
                    $high_power['warningMessage'] = 'System detected power-hungry configuration; building likely requires thermomodernization.';
                    $selected = $high_power;
                    $matches = array($high_power);
                    $warnings[] = array(
                        'code' => $code_high_power_limited,
                        'message' => 'Power demand is in high range; 16 kW catalog limit applied.',
                    );
                    $reason_codes[] = $code_high_power_limited;
                }
            }

            if ($selected === null && $exceeds_catalog_limit) {
                $warnings[] = array(
                    'code' => $code_high_power_limited,
                    'message' => 'Power demand is outside configurator catalog range.',
                );
                $reason_codes[] = $code_high_power_limited;
                $matches = array();
            } elseif ($selected === null && !empty($matches)) {
                $selected = $this->choose_preferred_candidate($matches, $preferred_type, $preferred_phase);
            } elseif ($selected === null) {
                if ($selected === null) {
                    $warnings[] = array(
                        'code' => $code_no_exact_match,
                        'message' => 'No exact pump range match for demand and emitter type.',
                    );
                    $reason_codes[] = $code_no_exact_match;
                } else {
                    $warnings[] = array(
                        'code' => $code_no_exact_match,
                        'message' => 'Exact match unavailable; nearest catalog model selected.',
                    );
                    $reason_codes[] = $code_no_exact_match;
                }
            }

            $pump_model = is_array($selected) ? (string) $selected['model'] : null;
            $capacity_kw = is_array($selected) ? $this->to_float($selected['power'], null) : null;
            $phase = is_array($selected) ? $this->to_int($selected['phase'], 1) : null;
            $type = is_array($selected) ? (string) $selected['type'] : null;
            $special_case = is_array($selected) && isset($selected['specialCase']) && is_string($selected['specialCase'])
                ? (string) $selected['specialCase']
                : null;
            $adjusted_power_display = is_array($selected) && isset($selected['adjustedPowerDisplay']) && is_string($selected['adjustedPowerDisplay'])
                ? (string) $selected['adjustedPowerDisplay']
                : null;
            $warning_message = is_array($selected) && isset($selected['warningMessage']) && is_string($selected['warningMessage'])
                ? (string) $selected['warningMessage']
                : null;
            $selected_cwu_tank = is_array($selected)
                ? $this->to_int(isset($selected['cwu_tank']) ? $selected['cwu_tank'] : null, null)
                : null;
            $reverse_aio_map = array();
            foreach ($aio_map as $split_model => $mapped_aio_model) {
                if (is_string($split_model) && is_string($mapped_aio_model) && $mapped_aio_model !== '') {
                    $reverse_aio_map[$mapped_aio_model] = $split_model;
                }
            }
            foreach ($aio_large_map as $split_model => $mapped_aio_model) {
                if (is_string($split_model) && is_string($mapped_aio_model) && $mapped_aio_model !== '') {
                    $reverse_aio_map[$mapped_aio_model] = $split_model;
                }
            }

            $hp_model = null;
            $aio_model = null;
            if ($pump_model !== null && $type === 'all-in-one') {
                $aio_model = $pump_model;
                if ($special_case === null && isset($reverse_aio_map[$pump_model])) {
                    $hp_model = (string) $reverse_aio_map[$pump_model];
                }
            } elseif ($pump_model !== null) {
                $hp_model = $pump_model;
                if ($special_case === null) {
                    if ($aio_requirement === 'large' && isset($aio_large_map[$pump_model])) {
                        $aio_model = (string) $aio_large_map[$pump_model];
                    } elseif ($aio_requirement === 'standard' && isset($aio_map[$pump_model])) {
                        $aio_model = (string) $aio_map[$pump_model];
                    }
                }
            }

            $all_options = array();
            foreach ($matches as $match) {
                $all_options[] = array(
                    'model' => isset($match['model']) ? (string) $match['model'] : null,
                    'power_kw' => isset($match['power']) ? $this->to_float($match['power'], null) : null,
                    'type' => isset($match['type']) ? (string) $match['type'] : null,
                    'phase' => isset($match['phase']) ? $this->to_int($match['phase'], null) : null,
                    'cwu_tank' => isset($match['cwu_tank']) ? $this->to_int($match['cwu_tank'], null) : null,
                );
            }

            $recommended_models = array();
            foreach ($matches as $match) {
                if (isset($match['model'])) {
                    $recommended_models[] = (string) $match['model'];
                }
            }
            $recommended_models = array_values(array_unique($recommended_models));

            return array(
                'pumpModel' => $pump_model,
                'capacity_kW' => $capacity_kw,
                'type' => $type,
                'phase' => $phase,
                'recommendedModels' => $recommended_models,
                'notes' => array(),
                'warnings' => $warnings,
                'reasonCodes' => $reason_codes,
                'specialCase' => $special_case,
                'adjustedPowerDisplay' => $adjusted_power_display,
                'warningMessage' => $warning_message,
                'pumpSelection' => array(
                    'hp' => $hp_model !== null ? array(
                        'model' => $hp_model,
                        'power' => $capacity_kw,
                        'phase' => $phase,
                        'type' => 'split',
                        'cwu_tank' => null,
                        'specialCase' => $special_case,
                        'adjustedPowerDisplay' => $adjusted_power_display,
                        'warningMessage' => $warning_message,
                    ) : null,
                    'aio' => $aio_model !== null ? array(
                        'model' => $aio_model,
                        'power' => $capacity_kw,
                        'phase' => $phase,
                        'type' => 'all-in-one',
                        'cwu_tank' => $type === 'all-in-one'
                            ? $selected_cwu_tank
                            : $this->resolve_aio_tank_from_maps($aio_model, $aio_map, $aio_large_map, $table),
                    ) : null,
                    'all_options' => $all_options,
                ),
            );
        }

        /**
         * @param string $model
         * @param array<string,mixed> $table
         * @param string $heating_type
         * @return array<string,mixed>|null
         */
        private function build_model_from_table($model, $table, $heating_type) {
            if (!isset($table[$model]) || !is_array($table[$model])) {
                return null;
            }
            $data = $table[$model];
            $range_min = $this->resolve_range_value($data, 'min', $heating_type);
            $range_max = $this->resolve_range_value($data, 'max', $heating_type);

            return array(
                'model' => (string) $model,
                'power' => $this->to_float($this->pick_first_value(array(
                    isset($data['power']) ? $data['power'] : null,
                    isset($data['power_kw']) ? $data['power_kw'] : null,
                )), 0.0),
                'type' => isset($data['type']) ? (string) $data['type'] : 'split',
                'phase' => $this->to_int(isset($data['phase']) ? $data['phase'] : null, 1),
                'series' => isset($data['series']) ? (string) $data['series'] : null,
                'cwu_tank' => $this->to_int(isset($data['cwu_tank']) ? $data['cwu_tank'] : null, null),
                'min' => $range_min,
                'max' => $range_max,
            );
        }

        /**
         * @param float $demand_kw
         * @param string $heating_type
         * @param array<string,mixed> $table
         * @return array<string,mixed>|null
         */
        private function find_nearest_model($demand_kw, $heating_type, $table, $preferred_type = null, $preferred_phase = null) {
            $best = null;
            $best_distance = null;
            $best_score = null;

            foreach ($table as $model => $data) {
                if (!is_array($data)) {
                    continue;
                }
                $range_min = $this->resolve_range_value($data, 'min', $heating_type);
                $range_max = $this->resolve_range_value($data, 'max', $heating_type);
                if ($range_min === null || $range_max === null) {
                    continue;
                }
                $distance = 0.0;
                if ($demand_kw < $range_min) {
                    $distance = $range_min - $demand_kw;
                } elseif ($demand_kw > $range_max) {
                    $distance = $demand_kw - $range_max;
                }

                if ($best_distance === null || $distance < $best_distance) {
                    $candidate = array(
                        'model' => (string) $model,
                        'power' => $this->to_float($this->pick_first_value(array(
                            isset($data['power']) ? $data['power'] : null,
                            isset($data['power_kw']) ? $data['power_kw'] : null,
                        )), 0.0),
                        'type' => isset($data['type']) ? (string) $data['type'] : 'split',
                        'phase' => $this->to_int(isset($data['phase']) ? $data['phase'] : null, 1),
                        'series' => isset($data['series']) ? (string) $data['series'] : null,
                        'cwu_tank' => $this->to_int(isset($data['cwu_tank']) ? $data['cwu_tank'] : null, null),
                        'min' => $range_min,
                        'max' => $range_max,
                    );
                    $candidate_score = $this->candidate_preference_score($candidate, $preferred_type, $preferred_phase);
                    $best_distance = $distance;
                    $best_score = $candidate_score;
                    $best = $candidate;
                } elseif ($best_distance !== null && abs($distance - $best_distance) < 0.0001) {
                    $candidate = array(
                        'model' => (string) $model,
                        'power' => $this->to_float($this->pick_first_value(array(
                            isset($data['power']) ? $data['power'] : null,
                            isset($data['power_kw']) ? $data['power_kw'] : null,
                        )), 0.0),
                        'type' => isset($data['type']) ? (string) $data['type'] : 'split',
                        'phase' => $this->to_int(isset($data['phase']) ? $data['phase'] : null, 1),
                        'series' => isset($data['series']) ? (string) $data['series'] : null,
                        'cwu_tank' => $this->to_int(isset($data['cwu_tank']) ? $data['cwu_tank'] : null, null),
                        'min' => $range_min,
                        'max' => $range_max,
                    );
                    $candidate_score = $this->candidate_preference_score($candidate, $preferred_type, $preferred_phase);
                    if ($best_score === null || $candidate_score > $best_score) {
                        $best_score = $candidate_score;
                        $best = $candidate;
                    }
                }
            }

            return $best;
        }

        /**
         * @param string|null $raw
         * @return string
         */
        private function normalize_heating_type($raw, $aliases = array()) {
            $value = is_string($raw) ? strtolower(trim($raw)) : '';
            if ($value === '') {
                return 'radiators';
            }
            if (is_array($aliases) && isset($aliases[$value]) && is_string($aliases[$value])) {
                $value = strtolower(trim($aliases[$value]));
            }
            if ($value === 'surface' || $value === 'underfloor' || $value === 'floor_heating' || $value === 'podlogowe' || $value === 'podłogowe') {
                return 'surface';
            }
            if ($value === 'mixed' || $value === 'mieszane') {
                return 'mixed';
            }
            if ($value === 'radiators_ht' || $value === 'radiators_lt') {
                return 'radiators';
            }
            return 'radiators';
        }

        /**
         * @param array<string,mixed> $data
         * @param string $bound
         * @param string $heating_type
         * @return float|null
         */
        private function resolve_range_value($data, $bound, $heating_type) {
            $keys = array($heating_type);
            if ($heating_type === 'surface') {
                $keys[] = 'underfloor';
                $keys[] = 'floor_heating';
            }
            if ($heating_type === 'radiators') {
                $keys[] = 'radiators_ht';
                $keys[] = 'radiators_lt';
            }

            foreach ($keys as $key) {
                $value = $this->to_float($this->dig($data, array($bound, $key)), null);
                if ($value !== null) {
                    return $value;
                }
            }

            return null;
        }

        /**
         * @param array<int,array<string,mixed>> $candidates
         * @param string $preferred_type
         * @param int|null $preferred_phase
         * @return array<string,mixed>|null
         */
        private function choose_preferred_candidate($candidates, $preferred_type, $preferred_phase) {
            if (!is_array($candidates) || empty($candidates)) {
                return null;
            }

            $best = null;
            $best_score = null;
            foreach ($candidates as $candidate) {
                if (!is_array($candidate)) {
                    continue;
                }
                $score = $this->candidate_preference_score($candidate, $preferred_type, $preferred_phase);
                if ($best_score === null || $score > $best_score) {
                    $best = $candidate;
                    $best_score = $score;
                }
            }

            return $best !== null ? $best : $candidates[0];
        }

        /**
         * @param array<string,mixed> $cwu_context
         * @return string one of: standard, large, none
         */
        private function resolve_aio_requirement($cwu_context) {
            if (!is_array($cwu_context)) {
                return 'standard';
            }

            $required_capacity = $this->to_int($this->pick_first_value(array(
                isset($cwu_context['resolvedCapacityL']) ? $cwu_context['resolvedCapacityL'] : null,
                isset($cwu_context['recommendedCapacityL']) ? $cwu_context['recommendedCapacityL'] : null,
            )), null);

            if ($required_capacity === null || $required_capacity <= 0) {
                return 'standard';
            }
            if ($required_capacity >= 400) {
                return 'none';
            }
            if ($required_capacity > 200) {
                return 'large';
            }

            return 'standard';
        }

        /**
         * @param array<int,array<string,mixed>> $matches
         * @param string $aio_requirement
         * @return array<int,array<string,mixed>>
         */
        private function filter_matches_for_cwu_requirement($matches, $aio_requirement) {
            if (!is_array($matches) || empty($matches)) {
                return array();
            }
            if ($aio_requirement === 'standard') {
                return $matches;
            }

            $filtered = array();
            foreach ($matches as $match) {
                if (!is_array($match)) {
                    continue;
                }
                $type = strtolower((string) (isset($match['type']) ? $match['type'] : 'split'));
                if ($type !== 'all-in-one') {
                    $filtered[] = $match;
                    continue;
                }

                $tank_liters = $this->to_int(isset($match['cwu_tank']) ? $match['cwu_tank'] : null, 0);
                if ($aio_requirement === 'large' && $tank_liters >= 250) {
                    $filtered[] = $match;
                }
            }

            return $filtered;
        }

        /**
         * @param string $aio_model
         * @param array<string,string> $aio_map
         * @param array<string,string> $aio_large_map
         * @param array<string,mixed> $table
         * @return int|null
         */
        private function resolve_aio_tank_from_maps($aio_model, $aio_map, $aio_large_map, $table) {
            if (!is_string($aio_model) || trim($aio_model) === '') {
                return null;
            }
            if (isset($table[$aio_model]) && is_array($table[$aio_model])) {
                return $this->to_int(isset($table[$aio_model]['cwu_tank']) ? $table[$aio_model]['cwu_tank'] : null, null);
            }
            if (in_array($aio_model, $aio_large_map, true)) {
                return 260;
            }
            if (in_array($aio_model, $aio_map, true)) {
                return 185;
            }
            return null;
        }

        /**
         * @param array<string,mixed> $candidate
         * @param string $preferred_type
         * @param int|null $preferred_phase
         * @return int
         */
        private function candidate_preference_score($candidate, $preferred_type, $preferred_phase) {
            $score = 0;
            $type = strtolower((string) (isset($candidate['type']) ? $candidate['type'] : ''));
            $phase = $this->to_int(isset($candidate['phase']) ? $candidate['phase'] : null, null);

            if ($type === strtolower((string) $preferred_type)) {
                $score += 4;
            }
            if ($preferred_phase !== null && $phase === $preferred_phase) {
                $score += 2;
            }
            if ($preferred_phase === null && $phase === 1) {
                $score += 1;
            }

            return $score;
        }

        /**
         * @param array<string,mixed> $preferences
         * @param string $default_type
         * @return array<string,mixed>
         */
        private function resolve_preferred_pump_variant($preferences, $default_type) {
            $pump_option_id = strtolower((string) $this->pick_first_string(array(
                $this->dig($preferences, array('options', 'pumpOptionId')),
                $this->dig($preferences, array('pumpOptionId')),
            )));

            $type = $default_type;
            $phase = null;
            if ($pump_option_id !== '') {
                if (strpos($pump_option_id, 'aio') !== false || strpos($pump_option_id, 'premium') !== false) {
                    $type = 'all-in-one';
                } elseif (strpos($pump_option_id, 'split') !== false) {
                    $type = 'split';
                }
                if (strpos($pump_option_id, '400') !== false) {
                    $phase = 3;
                }
            }

            return array(
                'type' => $type,
                'phase' => $phase,
            );
        }

        /**
         * @param mixed $values
         * @return array<int,string>
         */
        private function normalize_string_list($values) {
            if (!is_array($values)) {
                return array();
            }

            $normalized = array();
            foreach ($values as $value) {
                if (!is_string($value)) {
                    continue;
                }
                $trimmed = strtolower(trim($value));
                if ($trimmed === '') {
                    continue;
                }
                $normalized[] = $trimmed;
            }

            return array_values(array_unique($normalized));
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
         * @param array<int,mixed> $values
         * @return mixed|null
         */
        private function pick_first_value($values) {
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

if (!class_exists('TopInstal_SelectionEngine_Mvp')) {
    class TopInstal_SelectionEngine_Mvp extends TopInstal_SelectionEngine {
    }
}

