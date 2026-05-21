<?php

if (!class_exists('TopInstal_CwuEngine')) {
    /**
     * Canonical backend engine for DHW demand, recommendation, and explainability.
     */
    class TopInstal_CwuEngine {
        /**
         * @param array<string,mixed> $input
         * @param array<string,mixed> $rules
         * @param array<string,mixed> $price_book
         * @return array<string,mixed>
         */
        public function compute($input, $rules = array(), $price_book = array())
        {
            $input = is_array($input) ? $input : array();
            $rules = is_array($rules) ? $rules : array();
            $price_book = is_array($price_book) ? $price_book : array();

            $building = isset($input['building']) && is_array($input['building']) ? $input['building'] : array();
            $preferences = isset($input['preferences']) && is_array($input['preferences']) ? $input['preferences'] : array();
            $selection = isset($input['selection']) && is_array($input['selection']) ? $input['selection'] : array();

            $include_hot_water = $this->resolve_demand_enabled($preferences, $building);
            $persons_raw = $this->resolve_persons_raw($preferences, $building);
            $persons_valid_for_capacity = $this->resolve_valid_capacity_persons($persons_raw);
            $profile_meta = $this->resolve_usage_profile($preferences, $building);
            $usage_profile = $profile_meta['value'];
            $usage_profile_label = $profile_meta['label'];
            $usage_defaulted = !empty($profile_meta['defaulted']);
            $usage_invalid = !empty($profile_meta['invalid']);
            $usage_raw = isset($profile_meta['raw']) && is_string($profile_meta['raw']) ? $profile_meta['raw'] : null;

            $pump_option_id = $this->resolve_option_id($preferences, 'pumpOptionId');
            $is_aio = $this->is_aio_selection($selection, $pump_option_id);

            $enabled = $include_hot_water && $persons_raw > 0.0 && !$is_aio;
            $required = $enabled;
            $skip = !$enabled;

            $reason_codes = array();
            $warnings = array();
            $assumptions = array();
            $fallback_reasons = array();

            if (!$include_hot_water || $persons_raw <= 0.0) {
                $reason_codes[] = 'CWU_NOT_REQUIRED';
            }
            if ($is_aio) {
                $reason_codes[] = 'CWU_INTEGRATED_AIO';
            }
            if ($include_hot_water && $persons_raw > 0.0 && $persons_valid_for_capacity === 0) {
                $reason_codes[] = 'CWU_PERSONS_OUTSIDE_CAPACITY_RANGE';
                $assumptions[] = array(
                    'code' => 'CWU_CAPACITY_FALLBACK_DEFAULT',
                    'params' => array(
                        'persons_raw' => $persons_raw,
                        'fallback_capacity_l' => 200,
                    ),
                );
                $fallback_reasons[] = 'CWU_CAPACITY_FALLBACK_DEFAULT';
            }
            if ($usage_defaulted) {
                $reason_codes[] = 'CWU_USAGE_PROFILE_DEFAULTED';
                $assumptions[] = array(
                    'code' => 'CWU_USAGE_PROFILE_DEFAULTED',
                    'params' => array(
                        'usage_profile' => $usage_profile,
                        'usage_profile_label' => $usage_profile_label,
                    ),
                );
            }
            if ($usage_invalid) {
                $reason_codes[] = 'CWU_USAGE_PROFILE_INVALID';
                $warnings[] = array(
                    'code' => 'CWU_USAGE_PROFILE_INVALID',
                    'params' => array(
                        'raw' => $usage_raw,
                        'fallback_usage_profile' => $usage_profile,
                        'fallback_usage_profile_label' => $usage_profile_label,
                    ),
                );
                $assumptions[] = array(
                    'code' => 'CWU_USAGE_PROFILE_INVALID',
                    'params' => array(
                        'raw' => $usage_raw,
                        'fallback_usage_profile' => $usage_profile,
                        'fallback_usage_profile_label' => $usage_profile_label,
                    ),
                );
                $fallback_reasons[] = 'CWU_USAGE_PROFILE_INVALID';
            }

            $skip_reason = null;
            if ($skip) {
                if (!$include_hot_water || $persons_raw <= 0.0) {
                    $skip_reason = 'Nie dotyczy';
                } elseif ($is_aio) {
                    $skip_reason = $this->resolve_integrated_cwu_label($selection);
                }
            }

            $recommended_capacity_l = null;
            if ($enabled) {
                $recommended_capacity_l = $this->recommend_capacity_liters(
                    $persons_valid_for_capacity,
                    $usage_profile,
                    $rules,
                    $reason_codes,
                    $assumptions,
                    $fallback_reasons
                );
            }

            $resolved_option_id = $this->resolve_option_id($preferences, 'dhwOptionId');
            $resolved_capacity_l = $this->resolve_capacity_from_inputs(
                $resolved_option_id,
                $recommended_capacity_l,
                $persons_valid_for_capacity,
                $price_book
            );
            $resolved_material = $this->resolve_material(
                $resolved_option_id,
                $preferences,
                $building,
                $price_book
            );

            $hot_water_power_policy = $this->resolve_hot_water_power_policy($rules);
            $hot_water_power_kw = $this->estimate_hot_water_power_kw(
                $include_hot_water,
                $persons_raw,
                $usage_profile,
                $hot_water_power_policy
            );
            $annual_cwu_energy_kwh = $this->estimate_annual_cwu_energy_kwh($include_hot_water, $persons_raw, $usage_profile);

            $explanation = $this->build_explanation(
                $include_hot_water,
                $enabled,
                $skip,
                $skip_reason,
                $persons_raw,
                $usage_profile_label,
                $recommended_capacity_l,
                $is_aio
            );

            return array(
                'demandEnabled' => $include_hot_water,
                'enabled' => $enabled,
                'required' => $required,
                'skip' => $skip,
                'skipReason' => $skip_reason,
                'persons' => $persons_raw > 0.0 ? (int) round($persons_raw) : 0,
                'personsRaw' => $persons_raw,
                'personsForCapacity' => $persons_valid_for_capacity,
                'usageProfile' => $usage_profile,
                'usageProfileLabel' => $usage_profile_label,
                'isAio' => $is_aio,
                'recommendedCapacityL' => $recommended_capacity_l,
                'hotWaterPower_kW' => $hot_water_power_kw,
                'annualCwuEnergy_kWh' => $annual_cwu_energy_kwh,
                'resolvedOptionId' => $resolved_option_id !== '' ? $resolved_option_id : null,
                'resolvedCapacityL' => $resolved_capacity_l,
                'resolvedMaterial' => $resolved_material,
                'pricingHint' => array(
                    'capacityL' => $resolved_capacity_l,
                    'material' => $resolved_material,
                ),
                'reasonCodes' => array_values(array_unique($reason_codes)),
                'warnings' => $warnings,
                'assumptions' => $assumptions,
                'explanation' => $explanation,
                'fallback' => array(
                    'used' => !empty($fallback_reasons),
                    'reasons' => array_values(array_unique($fallback_reasons)),
                ),
            );
        }

        /**
         * @param array<string,mixed> $payload
         * @return float
         */
        public function estimateHotWaterPowerKwFromPayload($payload)
        {
            $payload = is_array($payload) ? $payload : array();
            $include_hot_water = $this->to_bool(isset($payload['include_hot_water']) ? $payload['include_hot_water'] : null, false);
            $persons_raw = $this->to_float(isset($payload['hot_water_persons']) ? $payload['hot_water_persons'] : null, 0.0);
            $usage_profile_meta = $this->normalize_usage_profile_meta(
                isset($payload['hot_water_usage']) ? $payload['hot_water_usage'] : null,
                'shower_bath'
            );
            $usage_profile = $usage_profile_meta['value'];
            return $this->estimate_hot_water_power_kw($include_hot_water, $persons_raw, $usage_profile);
        }

        /**
         * @param array<string,mixed> $payload
         * @return int
         */
        public function estimateAnnualCwuEnergyKWhFromPayload($payload)
        {
            $payload = is_array($payload) ? $payload : array();
            $include_hot_water = $this->to_bool(isset($payload['include_hot_water']) ? $payload['include_hot_water'] : null, false);
            $persons_raw = $this->to_float(isset($payload['hot_water_persons']) ? $payload['hot_water_persons'] : null, 0.0);
            $usage_profile_meta = $this->normalize_usage_profile_meta(
                isset($payload['hot_water_usage']) ? $payload['hot_water_usage'] : null,
                'shower_bath'
            );
            $usage_profile = $usage_profile_meta['value'];
            return $this->estimate_annual_cwu_energy_kwh($include_hot_water, $persons_raw, $usage_profile);
        }

        /**
         * @return string
         */
        public function version()
        {
            return 'php-cwu-1';
        }

        /**
         * @param array<string,mixed> $preferences
         * @param array<string,mixed> $building
         * @return bool
         */
        private function resolve_demand_enabled($preferences, $building)
        {
            $enabled = $this->to_bool($this->dig($preferences, array('dhw', 'enabled')), null);
            if ($enabled === null) {
                $enabled = $this->to_bool(isset($building['include_hot_water']) ? $building['include_hot_water'] : null, false);
            }
            return $enabled === true;
        }

        /**
         * @param array<string,mixed> $preferences
         * @param array<string,mixed> $building
         * @return float
         */
        private function resolve_persons_raw($preferences, $building)
        {
            $persons = $this->to_float($this->dig($preferences, array('dhw', 'persons')), null);
            if ($persons === null) {
                $persons = $this->to_float(isset($building['hot_water_persons']) ? $building['hot_water_persons'] : null, 0.0);
            }
            return $persons !== null && $persons > 0.0 ? $persons : 0.0;
        }

        /**
         * @param float $persons_raw
         * @return int
         */
        private function resolve_valid_capacity_persons($persons_raw)
        {
            if (!is_numeric($persons_raw)) {
                return 0;
            }
            $persons = (float) $persons_raw;
            if ($persons <= 0.0 || $persons >= 20.0) {
                return 0;
            }
            return (int) round($persons);
        }

        /**
         * @param array<string,mixed> $preferences
         * @param array<string,mixed> $building
         * @return array{value:string,label:string,defaulted:bool,invalid:bool,aliased:bool,raw:?string}
         */
        private function resolve_usage_profile($preferences, $building)
        {
            $raw = $this->pick_first(array(
                $this->dig($preferences, array('dhw', 'usageProfile')),
                isset($building['hot_water_usage']) ? $building['hot_water_usage'] : null,
            ));
            return $this->normalize_usage_profile_meta($raw, 'shower_bath');
        }

        /**
         * @param mixed $raw
         * @param string $default
         * @return string
         */
        private function normalize_usage_profile($raw, $default)
        {
            $meta = $this->normalize_usage_profile_meta($raw, $default);
            return $meta['value'];
        }

        /**
         * @param mixed $raw
         * @param string $default
         * @return array{value:string,label:string,defaulted:bool,invalid:bool,aliased:bool,raw:?string}
         */
        private function normalize_usage_profile_meta($raw, $default)
        {
            $raw_string = is_scalar($raw) ? trim((string) $raw) : '';
            $value = strtolower($raw_string);
            $canonical = array('shower', 'shower_bath', 'bath');
            $aliases = array(
                'standard' => 'shower_bath',
                'comfort' => 'bath',
                'eco' => 'shower',
            );

            if ($raw_string === '') {
                return array(
                    'value' => $default,
                    'label' => $this->resolve_usage_profile_label($default),
                    'defaulted' => true,
                    'invalid' => false,
                    'aliased' => false,
                    'raw' => null,
                );
            }

            if (in_array($value, $canonical, true)) {
                return array(
                    'value' => $value,
                    'label' => $this->resolve_usage_profile_label($value),
                    'defaulted' => false,
                    'invalid' => false,
                    'aliased' => false,
                    'raw' => $raw_string,
                );
            }

            if (isset($aliases[$value])) {
                return array(
                    'value' => $aliases[$value],
                    'label' => $this->resolve_usage_profile_label($aliases[$value]),
                    'defaulted' => false,
                    'invalid' => false,
                    'aliased' => true,
                    'raw' => $raw_string,
                );
            }

            return array(
                'value' => $default,
                'label' => $this->resolve_usage_profile_label($default),
                'defaulted' => false,
                'invalid' => true,
                'aliased' => false,
                'raw' => $raw_string,
            );
        }

        /**
         * @param string $value
         * @return string
         */
        private function resolve_usage_profile_label($value)
        {
            if ($value === 'shower') {
                return 'prysznic';
            }
            if ($value === 'bath') {
                return 'czeste korzystanie z wanny';
            }
            return 'prysznic + okazjonalna wanna';
        }

        /**
         * @param array<string,mixed> $selection
         * @param string $pump_option_id
         * @return bool
         */
        private function is_aio_selection($selection, $pump_option_id)
        {
            $type = strtolower(trim((string) $this->pick_first(array(
                isset($selection['type']) ? $selection['type'] : null,
                $this->dig($selection, array('pumpSelection', 'aio', 'type')),
            ))));
            if ($type === 'aio' || $type === 'all-in-one') {
                return true;
            }
            return strpos(strtolower($pump_option_id), 'aio') !== false;
        }

        /**
         * @param array<string,mixed> $selection
         * @return string
         */
        private function resolve_integrated_cwu_label($selection)
        {
            $tank_liters = $this->to_int($this->pick_first(array(
                isset($selection['cwu_tank']) ? $selection['cwu_tank'] : null,
                $this->dig($selection, array('pumpSelection', 'aio', 'cwu_tank')),
            )), 0);
            if ($tank_liters > 0) {
                return 'Zintegrowany ' . $tank_liters . ' l';
            }
            return 'Zintegrowany zbiornik CWU (w zestawie)';
        }

        /**
         * @param int $persons
         * @param string $usage_profile_label
         * @param array<string,mixed> $rules
         * @param array<int,string> &$reason_codes
         * @param array<int,array<string,mixed>> &$assumptions
         * @param array<int,string> &$fallback_reasons
         * @return int
         */
        private function recommend_capacity_liters($persons, $usage_profile, $rules, &$reason_codes, &$assumptions, &$fallback_reasons)
        {
            $cwu_rules = isset($rules['cwuRules']) && is_array($rules['cwuRules'])
                ? $rules['cwuRules']
                : array();

            $base_capacity_map = isset($cwu_rules['baseCapacity']) && is_array($cwu_rules['baseCapacity'])
                ? $cwu_rules['baseCapacity']
                : array('1' => 150, '2' => 150, '3' => 200, '4' => 200, '5+' => 300);
            $usage_adjustments = isset($cwu_rules['usageAdjustments']) && is_array($cwu_rules['usageAdjustments'])
                ? $cwu_rules['usageAdjustments']
                : array('shower' => 0, 'shower_bath' => 50, 'bath' => 100);
            $available_capacities = isset($cwu_rules['availableCapacities']) && is_array($cwu_rules['availableCapacities'])
                ? $cwu_rules['availableCapacities']
                : array(150, 200, 250, 300, 400, 500);
            $safety_rule = isset($cwu_rules['safetyRule']) && is_array($cwu_rules['safetyRule'])
                ? $cwu_rules['safetyRule']
                : array('usage' => 'bath', 'persons_min' => 2, 'minimumCapacity' => 200);

            if ($persons > 0) {
                if ($persons <= 2) {
                    $recommended = $this->to_int(isset($base_capacity_map['2']) ? $base_capacity_map['2'] : null, 150);
                } elseif ($persons <= 4) {
                    $recommended = $this->to_int(isset($base_capacity_map['4']) ? $base_capacity_map['4'] : null, 200);
                } elseif ($persons <= 6) {
                    $recommended = $this->to_int(isset($base_capacity_map['5+']) ? $base_capacity_map['5+'] : null, 250);
                } else {
                    $recommended = $this->to_int(isset($base_capacity_map['5+']) ? $base_capacity_map['5+'] : null, 300);
                }
            } else {
                $recommended = 200;
            }

            $extra = 0;
            if ($usage_profile === 'shower_bath') {
                $extra = $this->to_int(isset($usage_adjustments['shower_bath']) ? $usage_adjustments['shower_bath'] : null, 50);
            } elseif ($usage_profile === 'bath') {
                $extra = $this->to_int(isset($usage_adjustments['bath']) ? $usage_adjustments['bath'] : null, 100);
            } else {
                $extra = $this->to_int(isset($usage_adjustments['shower']) ? $usage_adjustments['shower'] : null, 0);
            }

            $recommended += $extra;
            $recommended = $this->find_closest_capacity($available_capacities, $recommended, 200);

            $safety_usage = isset($safety_rule['usage']) ? (string) $safety_rule['usage'] : 'bath';
            $safety_persons_min = $this->to_int(isset($safety_rule['persons_min']) ? $safety_rule['persons_min'] : null, 2);
            $safety_min_capacity = $this->to_int(isset($safety_rule['minimumCapacity']) ? $safety_rule['minimumCapacity'] : null, 200);
            if ($usage_profile === $safety_usage && $persons >= $safety_persons_min && $recommended < $safety_min_capacity) {
                $recommended = $safety_min_capacity;
                $reason_codes[] = 'CWU_SAFETY_MINIMUM_APPLIED';
                $assumptions[] = array(
                    'code' => 'CWU_SAFETY_MINIMUM_APPLIED',
                    'params' => array(
                        'minimum_capacity_l' => $safety_min_capacity,
                        'usage_profile' => $usage_profile,
                        'persons' => $persons,
                    ),
                );
            }

            if ($recommended <= 0) {
                $recommended = 200;
                $fallback_reasons[] = 'CWU_CAPACITY_FALLBACK_DEFAULT';
            }

            return $recommended;
        }

        /**
         * @param string $dhw_option_id
         * @param int|null $recommended_capacity_l
         * @param int $persons_for_capacity
         * @param array<string,mixed> $price_book
         * @return int|null
         */
        private function resolve_capacity_from_inputs($dhw_option_id, $recommended_capacity_l, $persons_for_capacity, $price_book)
        {
            $option_capacity = $this->extract_first_number($dhw_option_id, 0);
            if ($option_capacity > 0) {
                return $option_capacity;
            }
            if ($recommended_capacity_l !== null && $recommended_capacity_l > 0) {
                return $recommended_capacity_l;
            }
            return $this->resolve_pricing_fallback_capacity($persons_for_capacity, $price_book);
        }

        /**
         * @param string $dhw_option_id
         * @param array<string,mixed> $preferences
         * @param array<string,mixed> $building
         * @param array<string,mixed> $price_book
         * @return string
         */
        private function resolve_material($dhw_option_id, $preferences, $building, $price_book)
        {
            if ($this->contains($dhw_option_id, 'inox')) {
                return 'inox';
            }
            if ($this->contains($dhw_option_id, 'emalia')) {
                return 'emalia';
            }

            $material = strtolower(trim((string) $this->pick_first(array(
                $this->dig($preferences, array('dhw', 'material')),
                isset($building['hot_water_material']) ? $building['hot_water_material'] : null,
                $this->dig($price_book, array('pricing_policy', 'cwu', 'default_material')),
                'emalia',
            ))));
            if ($this->contains($material, 'inox')) {
                return 'inox';
            }
            return 'emalia';
        }

        /**
         * @param bool $include_hot_water
         * @param float $persons_raw
         * @param string $usage_profile_label
         * @return float
         */
        private function estimate_hot_water_power_kw($include_hot_water, $persons_raw, $usage_profile, $policy = array())
        {
            if (!$include_hot_water || $persons_raw <= 0.0) {
                return 0.0;
            }

            if (is_array($policy) && !empty($policy)) {
                $defaults = isset($policy['defaults']) && is_array($policy['defaults'])
                    ? $policy['defaults']
                    : array();
                $usage_factor_map = isset($policy['usage_factor']) && is_array($policy['usage_factor'])
                    ? $policy['usage_factor']
                    : array();
                $per_person_kw = $this->to_float(isset($defaults['per_person_kw']) ? $defaults['per_person_kw'] : null, 0.35);
                $min_power_kw = $this->to_float(isset($defaults['min_power_kw']) ? $defaults['min_power_kw'] : null, 0.8);
                $max_power_kw = $this->to_float(isset($defaults['max_power_kw']) ? $defaults['max_power_kw'] : null, 1.5);
                $usage_factor = $this->to_float(
                    isset($usage_factor_map[$usage_profile]) ? $usage_factor_map[$usage_profile] : null,
                    $this->to_float(isset($usage_factor_map['default']) ? $usage_factor_map['default'] : null, 1.0)
                );

                $base_power = $persons_raw * max(0.0, $per_person_kw) * max(0.0, $usage_factor);
                $power_kw = max($min_power_kw, $base_power);
                if ($max_power_kw !== null && $max_power_kw > 0.0) {
                    $power_kw = min($max_power_kw, $power_kw);
                }
                return round($power_kw, 2);
            }

            $power_per_person = array(
                'shower' => 0.15,
                'shower_bath' => 0.17,
                'bath' => 0.175,
            );
            $per_person = isset($power_per_person[$usage_profile]) ? (float) $power_per_person[$usage_profile] : 0.17;
            $base_power = $persons_raw * $per_person;
            return round(max(0.3, min(1.5, $base_power)), 2);
        }

        /**
         * @param bool $include_hot_water
         * @param float $persons_raw
         * @param string $usage_profile
         * @return int
         */
        private function estimate_annual_cwu_energy_kwh($include_hot_water, $persons_raw, $usage_profile)
        {
            if (!$include_hot_water || $persons_raw <= 0.0) {
                return 0;
            }

            $liters_per_person_per_day = array(
                'shower' => 35,
                'shower_bath' => 50,
                'bath' => 65,
            );
            $liters = isset($liters_per_person_per_day[$usage_profile]) ? $liters_per_person_per_day[$usage_profile] : 50;
            $delta_t = 35.0;
            $kwh_per_liter = (4.186 * $delta_t) / 3600.0;
            return (int) round($persons_raw * $liters * 365 * $kwh_per_liter);
        }

        /**
         * @param bool $include_hot_water
         * @param bool $enabled
         * @param bool $skip
         * @param string|null $skip_reason
         * @param float $persons_raw
         * @param string $usage_profile
         * @param int|null $recommended_capacity_l
         * @param bool $is_aio
         * @return array<string,string>
         */
        private function build_explanation($include_hot_water, $enabled, $skip, $skip_reason, $persons_raw, $usage_profile_label, $recommended_capacity_l, $is_aio)
        {
            if ($skip) {
                if ($is_aio) {
                    return array(
                        'short' => 'Osobny zasobnik CWU nie jest wymagany.',
                        'long' => $skip_reason !== null && $skip_reason !== ''
                            ? $skip_reason . '. Konfiguracja wykorzystuje zintegrowany zasobnik CWU.'
                            : 'Konfiguracja wykorzystuje zintegrowany zasobnik CWU.',
                    );
                }

                return array(
                    'short' => 'Zasobnik CWU nie dotyczy tego wariantu.',
                    'long' => 'Dla tej konfiguracji nie ma potrzeby doboru osobnego zasobnika CWU.',
                );
            }

            $persons_text = $persons_raw > 0.0 ? (string) ((int) round($persons_raw)) : '0';
            return array(
                'short' => $recommended_capacity_l !== null
                    ? 'Rekomendowany zasobnik CWU: ' . $recommended_capacity_l . ' l.'
                    : 'Rekomendacja zasobnika CWU zostala wyznaczona.',
                'long' => $recommended_capacity_l !== null
                    ? 'Dobor zasobnika CWU wynika z liczby uzytkownikow (' . $persons_text . ') i profilu zuzycia: ' . $usage_profile_label . '. Zalecana pojemnosc to ' . $recommended_capacity_l . ' l.'
                    : 'Dobor zasobnika CWU wymaga potwierdzenia danych wejsciowych.',
            );
        }

        /**
         * @param string $dhw_option_id
         * @return string
         */
        private function resolve_option_id($preferences, $field)
        {
            $value = $this->pick_first(array(
                isset($preferences[$field]) ? $preferences[$field] : null,
                $this->dig($preferences, array('options', $field)),
            ));
            return is_string($value) ? trim($value) : '';
        }

        /**
         * @param int $persons
         * @param array<string,mixed> $price_book
         * @return int
         */
        private function resolve_pricing_fallback_capacity($persons, $price_book)
        {
            $cwu_policy = $this->dig($price_book, array('pricing_policy', 'cwu', 'capacity_by_persons'));
            $le_2 = $this->to_int(is_array($cwu_policy) && isset($cwu_policy['le_2']) ? $cwu_policy['le_2'] : null, 150);
            $le_4 = $this->to_int(is_array($cwu_policy) && isset($cwu_policy['le_4']) ? $cwu_policy['le_4'] : null, 200);
            $gt_4 = $this->to_int(is_array($cwu_policy) && isset($cwu_policy['gt_4']) ? $cwu_policy['gt_4'] : null, 300);
            if ($persons <= 2) {
                return $le_2;
            }
            if ($persons <= 4) {
                return $le_4;
            }
            return $gt_4;
        }

        /**
         * @param array<string,mixed> $rules
         * @return array<string,mixed>
         */
        private function resolve_hot_water_power_policy($rules)
        {
            if (isset($rules['hotWaterPowerPolicy']) && is_array($rules['hotWaterPowerPolicy'])) {
                return $rules['hotWaterPowerPolicy'];
            }
            return array();
        }

        /**
         * @param array<int,mixed> $available
         * @param int $target
         * @param int $default
         * @return int
         */
        private function find_closest_capacity($available, $target, $default)
        {
            if (!is_array($available) || empty($available)) {
                return $default;
            }

            $best = null;
            foreach ($available as $candidate) {
                if (!is_numeric($candidate)) {
                    continue;
                }
                $candidate = (int) round((float) $candidate);
                if ($candidate <= 0) {
                    continue;
                }
                if ($best === null || abs($candidate - $target) < abs($best - $target)) {
                    $best = $candidate;
                }
            }

            return $best !== null ? (int) $best : $default;
        }

        /**
         * @param mixed $value
         * @param bool|null $default
         * @return bool|null
         */
        private function to_bool($value, $default = false)
        {
            if ($value === null || $value === '') {
                return $default;
            }
            if (is_bool($value)) {
                return $value;
            }
            if (is_numeric($value)) {
                return ((float) $value) !== 0.0;
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
         * @param float|null $default
         * @return float|null
         */
        private function to_float($value, $default = 0.0)
        {
            if ($value === null || $value === '') {
                return $default;
            }
            if (!is_numeric($value)) {
                return $default;
            }
            return (float) $value;
        }

        /**
         * @param mixed $value
         * @param int|null $default
         * @return int|null
         */
        private function to_int($value, $default = 0)
        {
            if ($value === null || $value === '') {
                return $default;
            }
            if (!is_numeric($value)) {
                return $default;
            }
            return (int) round((float) $value);
        }

        /**
         * @param array<string,mixed> $source
         * @param array<int,string> $path
         * @return mixed|null
         */
        private function dig($source, $path)
        {
            $cursor = $source;
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
        private function pick_first($values)
        {
            foreach ($values as $value) {
                if ($value === null) {
                    continue;
                }
                if (is_string($value) && trim($value) === '') {
                    continue;
                }
                return $value;
            }
            return null;
        }

        /**
         * @param string $haystack
         * @param string $needle
         * @return bool
         */
        private function contains($haystack, $needle)
        {
            if ($haystack === '' || $needle === '') {
                return false;
            }
            return strpos(strtolower($haystack), strtolower($needle)) !== false;
        }

        /**
         * @param string $value
         * @param int $default
         * @return int
         */
        private function extract_first_number($value, $default = 0)
        {
            if (!is_string($value) || trim($value) === '') {
                return $default;
            }
            if (!preg_match('/(\d+)/', $value, $matches)) {
                return $default;
            }
            return $this->to_int($matches[1], $default);
        }
    }
}
