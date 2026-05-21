<?php

if (!class_exists('TopInstal_PricingEngine')) {
    /**
     * Transitional pricing engine for backend MVP.
     * Pure calculation based on selected components + pricebook.
     */
    class TopInstal_PricingEngine {
        /**
         * @param array<string,mixed> $input
         * @param array<string,mixed> $price_book
         * @return array<string,mixed>
         */
        public function price($input, $price_book) {
            $selection = isset($input['selection']) && is_array($input['selection']) ? $input['selection'] : array();
            $buffer = isset($input['buffer']) && is_array($input['buffer']) ? $input['buffer'] : array();
            $cwu = isset($input['cwu']) && is_array($input['cwu']) ? $input['cwu'] : array();
            $preferences = isset($input['preferences']) && is_array($input['preferences']) ? $input['preferences'] : array();
            $building = isset($input['building']) && is_array($input['building']) ? $input['building'] : array();
            $ozc = isset($input['ozc']) && is_array($input['ozc']) ? $input['ozc'] : array();

            $code_pricebook_missing = class_exists('TopInstal_ReasonCodes')
                ? TopInstal_ReasonCodes::PRICING_PRICEBOOK_MISSING
                : 'PRICING_PRICEBOOK_MISSING';
            $code_pump_fallback = class_exists('TopInstal_ReasonCodes')
                ? TopInstal_ReasonCodes::PRICING_PUMP_FALLBACK
                : 'PRICING_PUMP_FALLBACK';
            $code_cwu_fallback = class_exists('TopInstal_ReasonCodes')
                ? TopInstal_ReasonCodes::PRICING_CWU_FALLBACK
                : 'PRICING_CWU_FALLBACK';
            $code_buffer_fallback = class_exists('TopInstal_ReasonCodes')
                ? TopInstal_ReasonCodes::PRICING_BUFFER_FALLBACK
                : 'PRICING_BUFFER_FALLBACK';

            $warnings = array();
            $pricing_mode = $this->resolve_pricing_mode($price_book);
            $allow_nearest_fallback = $pricing_mode !== 'master';
            $fallback_reasons = array();
            if ($pricing_mode === 'fallback') {
                $this->add_warning(
                    $warnings,
                    $code_pricebook_missing,
                    'Price book unavailable/incomplete; pricing fallback mode is active.'
                );
                $fallback_reasons[] = $code_pricebook_missing;
            }

            $currency = isset($price_book['currency']) ? (string) $price_book['currency'] : 'PLN';
            $vat_rate = $this->to_float(isset($price_book['vat_rate']) ? $price_book['vat_rate'] : null, 0.08);
            if ($vat_rate < 0.0) {
                $vat_rate = 0.08;
            }

            $items = array();
            $options = $this->resolve_option_ids($preferences);
            $pump_option_id = $this->pick_option_id($options, 'pumpOptionId');
            $resolved_selection = $this->resolve_effective_pump_selection($selection, $pump_option_id);
            $selected_model = isset($resolved_selection['model']) ? $resolved_selection['model'] : null;
            $selected_type = isset($resolved_selection['type']) ? $resolved_selection['type'] : null;
            $selected_phase = isset($resolved_selection['phase']) ? $resolved_selection['phase'] : null;
            $has_pump_selection = $selected_model !== null && $selected_model !== '';
            $has_pump_item = false;

            $selected_power = $this->to_float(isset($selection['capacity_kW']) ? $selection['capacity_kW'] : null, null);
            if ($selected_power === null || $selected_power <= 0.0) {
                $selected_power = $this->to_float(isset($resolved_selection['power']) ? $resolved_selection['power'] : null, null);
            }
            if ($selected_power === null || $selected_power <= 0.0) {
                $selected_power = $this->to_float(isset($ozc['recommendedPower_kW']) ? $ozc['recommendedPower_kW'] : null, null);
            }
            if ($selected_power === null || $selected_power <= 0.0) {
                $selected_power = $this->to_float(isset($ozc['designHeatLoss_kW']) ? $ozc['designHeatLoss_kW'] : null, null);
            }

            if ($has_pump_selection) {
                $pump_fallback_used = false;
                $pump_price = $this->resolve_pump_price(
                    $price_book,
                    $selected_power,
                    $selected_type !== null ? $selected_type : 'split',
                    $selected_phase !== null ? $selected_phase : 1,
                    $pump_option_id,
                    $pump_fallback_used,
                    $allow_nearest_fallback
                );
                if ($pump_fallback_used) {
                    $this->add_warning(
                        $warnings,
                        $code_pump_fallback,
                        'Pump price resolved using nearest/fallback pricing key.'
                    );
                    $fallback_reasons[] = $code_pump_fallback;
                }
                if ($pump_price > 0.0) {
                    $items[] = $this->build_item(
                        'PUMP',
                        'Pompa ciepla ' . $selected_model,
                        1,
                        $pump_price,
                        $vat_rate
                    );
                    $has_pump_item = true;
                }

                $hydraulic_key = $selected_type === 'all-in-one'
                    ? 'hydraulic_components_aio'
                    : 'hydraulic_components_split';
                $hydraulic_price = $this->to_float(
                    isset($price_book[$hydraulic_key]) ? $price_book[$hydraulic_key] : null,
                    0.0
                );
                if ($hydraulic_price > 0.0) {
                    $items[] = $this->build_item(
                        'HYDRAULIC',
                        'Komponenty hydrauliczne',
                        1,
                        $hydraulic_price,
                        $vat_rate
                    );
                }
            }

            $buffer_option_id = $this->pick_option_id($options, 'bufferOptionId');
            $buffer_selected = is_string($buffer_option_id)
                && trim($buffer_option_id) !== ''
                && $buffer_option_id !== 'buffer-0'
                && $buffer_option_id !== 'bufor-nie';
            $buffer_liters = ($has_pump_selection && $buffer_selected)
                ? $this->resolve_buffer_liters($buffer, $buffer_option_id)
                : 0;
            if ($has_pump_selection && $buffer_selected && $buffer_liters > 0) {
                $mount_type = $this->resolve_buffer_mount_type($buffer);
                $buffer_fallback_used = false;
                $buffer_price = $this->resolve_buffer_price(
                    $price_book,
                    $buffer_liters,
                    $mount_type,
                    $buffer_fallback_used,
                    $allow_nearest_fallback
                );
                if ($buffer_fallback_used) {
                    $this->add_warning(
                        $warnings,
                        $code_buffer_fallback,
                        'Buffer price resolved using nearest/fallback pricing key.'
                    );
                    $fallback_reasons[] = $code_buffer_fallback;
                }
                if ($buffer_price > 0.0) {
                    $items[] = $this->build_item(
                        'BUFFER',
                        'Bufor CO ' . $buffer_liters . ' l',
                        1,
                        $buffer_price,
                        $vat_rate
                    );
                }
            }

            $dhw_option_id = $this->pick_option_id($options, 'dhwOptionId');
            $dhw_enabled = $has_pump_selection && $this->resolve_dhw_enabled_with_cwu($preferences, $building, $dhw_option_id, $cwu);
            if ($dhw_enabled && $selected_type !== 'all-in-one') {
                $persons = $this->to_int($this->dig($preferences, array('dhw', 'persons')), 0);
                if ($persons <= 0) {
                    $persons = $this->to_int(isset($building['hot_water_persons']) ? $building['hot_water_persons'] : null, 0);
                }

                $capacity = $this->resolve_cwu_capacity_with_result($persons, $dhw_option_id, $price_book, $cwu);
                $material = $this->resolve_cwu_material_with_result($dhw_option_id, $preferences, $building, $cwu);
                $cwu_fallback_used = false;
                $cwu_price = $this->resolve_cwu_price(
                    $price_book,
                    $material,
                    $capacity,
                    $cwu_fallback_used,
                    $allow_nearest_fallback
                );
                if ($cwu_fallback_used) {
                    $this->add_warning(
                        $warnings,
                        $code_cwu_fallback,
                        'CWU price resolved using nearest/fallback pricing key.'
                    );
                    $fallback_reasons[] = $code_cwu_fallback;
                }
                if ($cwu_price > 0.0) {
                    $items[] = $this->build_item(
                        'CWU',
                        'Zasobnik CWU ' . $capacity . ' l',
                        1,
                        $cwu_price,
                        $vat_rate
                    );
                }
            }

            if ($has_pump_selection) {
                $this->append_accessory_items($items, $price_book, $options, $vat_rate);
            }

            $installation_net = $this->to_float(
                isset($price_book['installation_net']) ? $price_book['installation_net'] : null,
                0.0
            );
            if ($has_pump_selection && $installation_net > 0.0) {
                $items[] = $this->build_item(
                    'INSTALLATION',
                    'Montaz instalacji',
                    1,
                    $installation_net,
                    $vat_rate
                );
            }

            $total_net = 0.0;
            $total_gross = 0.0;
            foreach ($items as $item) {
                $total_net += isset($item['totalNet']) ? (float) $item['totalNet'] : 0.0;
                $total_gross += isset($item['totalGross']) ? (float) $item['totalGross'] : 0.0;
            }
            $total_net = round($total_net, 2);
            $total_gross = round($total_gross, 2);
            $total_vat = round($total_gross - $total_net, 2);

            return array(
                'currency' => $currency,
                'items' => $items,
                'totals' => array(
                    'net' => $total_net,
                    'vat' => $total_vat,
                    'gross' => $total_gross,
                ),
                'warnings' => $warnings,
                'fallback' => array(
                    'used' => !empty($fallback_reasons),
                    'reasons' => array_values(array_unique($fallback_reasons)),
                    'mode' => $pricing_mode,
                ),
            );
        }

        /**
         * @param array<string,mixed> &$items
         * @param array<string,mixed> $price_book
         * @param array<string,string> $options
         * @param float $vat_rate
         * @return void
         */
        private function append_accessory_items(&$items, $price_book, $options, $vat_rate) {
            $circulation_option = $this->pick_option_id($options, 'circulationOptionId');
            if ($circulation_option === 'cyrkulacja-tak') {
                $price = $this->to_float($this->dig($price_book, array('options', 'cyrkulacja-tak')), 0.0);
                if ($price > 0.0) {
                    $items[] = $this->build_item('ACCESSORY_CIRCULATION', 'Pompa cyrkulacyjna', 1, $price, $vat_rate);
                }
            }

            $pressure_option = $this->pick_option_id($options, 'pressureReducerOptionId');
            if ($pressure_option === 'reduktor-tak') {
                $price = $this->to_float(
                    $this->dig($price_book, array('water', 'pressure', 'z-reduktorem-cisnienia')),
                    0.0
                );
                if ($price > 0.0) {
                    $items[] = $this->build_item('ACCESSORY_PRESSURE', 'Reduktor cisnienia', 1, $price, $vat_rate);
                }
            }

            $water_option = $this->pick_option_id($options, 'waterTreatmentOptionId');
            if ($water_option === 'woda-tak') {
                $price = $this->to_float(
                    $this->dig($price_book, array('water', 'filters', 'filtry-zmiekczacz')),
                    0.0
                );
                if ($price > 0.0) {
                    $items[] = $this->build_item('ACCESSORY_WATER_SOFTENER', 'Stacja uzdatniania wody', 1, $price, $vat_rate);
                }
            } elseif ($water_option === 'woda-filtr') {
                $price = $this->to_float(
                    $this->dig($price_book, array('water', 'filters', 'filtry-podstawowe')),
                    0.0
                );
                if ($price > 0.0) {
                    $items[] = $this->build_item('ACCESSORY_WATER_FILTER', 'Filtry wody', 1, $price, $vat_rate);
                }
            }

            $foundation_option = $this->pick_option_id($options, 'foundationOptionId');
            if ($foundation_option === 'posadowienie-sciana') {
                $price = $this->to_float($this->dig($price_book, array('foundation', 'fundament-nasz')), 0.0);
                if ($price > 0.0) {
                    $items[] = $this->build_item('ACCESSORY_FOUNDATION_WALL', 'Posadowienie scienne', 1, $price, $vat_rate);
                }
            } elseif ($foundation_option === 'posadowienie-eko') {
                $price = $this->to_float($this->dig($price_book, array('foundation', 'stojak')), 0.0);
                if ($price > 0.0) {
                    $items[] = $this->build_item('ACCESSORY_FOUNDATION_ECO', 'Posadowienie eco', 1, $price, $vat_rate);
                }
            } elseif ($foundation_option === 'posadowienie-grunt') {
                $price = $this->to_float($this->dig($price_book, array('foundation', 'fundament-klienta')), 0.0);
                if ($price > 0.0) {
                    $items[] = $this->build_item('ACCESSORY_FOUNDATION_GROUND', 'Posadowienie gruntowe', 1, $price, $vat_rate);
                }
            }

            $service_option = $this->pick_option_id($options, 'serviceOptionId');
            if ($service_option === 'service-cloud') {
                $price = $this->to_float($this->dig($price_book, array('options', 'service-cloud')), 0.0);
                if ($price > 0.0) {
                    $items[] = $this->build_item('ACCESSORY_SERVICE_CLOUD', 'Service Cloud', 1, $price, $vat_rate);
                }
            }
        }

        /**
         * @param array<string,mixed> $preferences
         * @return array<string,string>
         */
        private function resolve_option_ids($preferences) {
            $options = $this->dig($preferences, array('options'));
            if (!is_array($options)) {
                return array();
            }

            $resolved = array();
            foreach ($options as $key => $value) {
                if (!is_string($key)) {
                    continue;
                }
                if (!is_scalar($value)) {
                    continue;
                }
                $normalized = strtolower(trim((string) $value));
                if ($normalized === '') {
                    continue;
                }
                $resolved[$key] = $normalized;
            }
            return $resolved;
        }

        /**
         * @param array<string,string> $options
         * @param string $key
         * @return string
         */
        private function pick_option_id($options, $key) {
            if (!is_array($options) || !isset($options[$key])) {
                return '';
            }
            $value = strtolower(trim((string) $options[$key]));
            return $value === '' ? '' : $value;
        }

        /**
         * @param array<string,mixed> $price_book
         * @return string
         */
        private function resolve_pricing_mode($price_book) {
            if (!is_array($price_book) || empty($price_book)) {
                return 'fallback';
            }

            $version = isset($price_book['pricing_version']) ? strtolower(trim((string) $price_book['pricing_version'])) : '';
            if ($version === 'fallback') {
                return 'fallback';
            }

            return $this->has_required_master_price_book_sections($price_book) ? 'master' : 'fallback';
        }

        /**
         * @param array<string,mixed> $price_book
         * @return bool
         */
        private function has_required_master_price_book_sections($price_book) {
            if (!is_array($price_book)) {
                return false;
            }
            if (!is_array($this->dig($price_book, array('pump', 'by_power_kw')))) {
                return false;
            }
            if (!is_array($this->dig($price_book, array('cwu')))) {
                return false;
            }
            if (!is_array($this->dig($price_book, array('buffer')))) {
                return false;
            }
            if (!is_array($this->dig($price_book, array('options')))) {
                return false;
            }
            return true;
        }

        /**
         * @param array<string,mixed> $price_book
         * @param float|null $power_kw
         * @param string $type
         * @param int $phase
         * @param string $pump_option_id
         * @param bool &$fallback_used
         * @param bool $allow_nearest_fallback
         * @return float
         */
        private function resolve_pump_price($price_book, $power_kw, $type, $phase, $pump_option_id, &$fallback_used, $allow_nearest_fallback = true) {
            $fallback_used = false;
            if ($power_kw === null) {
                return 0.0;
            }

            $by_power = $this->dig($price_book, array('pump', 'by_power_kw'));
            if (!is_array($by_power) || empty($by_power)) {
                return 0.0;
            }

            $row = null;
            if (!$allow_nearest_fallback) {
                $key = (string) round((float) $power_kw);
                if (isset($by_power[$key]) && is_array($by_power[$key])) {
                    $row = $by_power[$key];
                }
            } else {
                $catalog_powers = $this->resolve_catalog_powers($price_book, $by_power);
                $nearest_catalog_power = $this->find_nearest_from_list($catalog_powers, $power_kw);
                if ($nearest_catalog_power !== null) {
                    $key = (string) $nearest_catalog_power;
                    if (isset($by_power[$key]) && is_array($by_power[$key])) {
                        $row = $by_power[$key];
                    }
                }
            }

            if ($allow_nearest_fallback && !is_array($row)) {
                $closest_key = $this->find_closest_numeric_key($by_power, $power_kw);
                if ($closest_key !== null && isset($by_power[$closest_key]) && is_array($by_power[$closest_key])) {
                    $row = $by_power[$closest_key];
                    $fallback_used = true;
                }
            }

            if (!is_array($row)) {
                return 0.0;
            }

            $candidate_keys = $this->resolve_pump_candidate_keys($price_book, $pump_option_id, $type, $phase);
            foreach ($candidate_keys as $candidate_key) {
                $price = $this->to_float(isset($row[$candidate_key]) ? $row[$candidate_key] : null, null);
                if ($price !== null && $price > 0.0) {
                    return $price;
                }
            }

            if (!$allow_nearest_fallback) {
                return 0.0;
            }

            foreach ($row as $value) {
                $price = $this->to_float($value, null);
                if ($price !== null && $price > 0.0) {
                    $fallback_used = true;
                    return $price;
                }
            }

            return 0.0;
        }

        /**
         * @param string $pump_option_id
         * @param string $type
         * @param int $phase
         * @return array<int,string>
         */
        private function resolve_pump_candidate_keys($price_book, $pump_option_id, $type, $phase) {
            $policy = isset($price_book['pricing_policy']) && is_array($price_book['pricing_policy'])
                ? $price_book['pricing_policy']
                : array();
            $pump_policy = isset($policy['pump']) && is_array($policy['pump'])
                ? $policy['pump']
                : array();
            $option_candidates = isset($pump_policy['option_to_price_key_candidates']) && is_array($pump_policy['option_to_price_key_candidates'])
                ? $pump_policy['option_to_price_key_candidates']
                : array();
            $default_candidates = isset($pump_policy['default_candidates']) && is_array($pump_policy['default_candidates'])
                ? $pump_policy['default_candidates']
                : array();

            if ($this->contains($pump_option_id, 'aio_premium400')) {
                $mapped = $this->normalize_candidate_key_list(isset($option_candidates['aio_premium400']) ? $option_candidates['aio_premium400'] : null);
                if (!empty($mapped)) {
                    return $mapped;
                }
            }
            if ($this->contains($pump_option_id, 'split400')) {
                $mapped = $this->normalize_candidate_key_list(isset($option_candidates['split400']) ? $option_candidates['split400'] : null);
                if (!empty($mapped)) {
                    return $mapped;
                }
            }
            if ($this->contains_any($pump_option_id, array('aio', 'premium'))) {
                return array('aio_premium_net', 'split_net');
            }
            $default_key = $type === 'all-in-one'
                ? ($phase === 3 ? 'aio_3ph' : 'aio_1ph')
                : ($phase === 3 ? 'split_3ph' : 'split_1ph');
            $mapped_defaults = $this->normalize_candidate_key_list(
                isset($default_candidates[$default_key]) ? $default_candidates[$default_key] : null
            );
            $fallback_candidates = $type === 'all-in-one'
                ? ($phase === 3
                    ? array('aio_premium400_net', 'aio_premium_net', 'split400_net', 'split_net')
                    : array('aio_premium_net', 'aio_premium400_net', 'split_net', 'split400_net'))
                : ($phase === 3
                    ? array('split400_net', 'split_net', 'aio_premium400_net', 'aio_premium_net')
                    : array('split_net', 'split400_net', 'aio_premium_net', 'aio_premium400_net'));
            if (!empty($mapped_defaults)) {
                return array_values(array_unique(array_merge($mapped_defaults, $fallback_candidates)));
            }

            if (trim((string) $pump_option_id) !== '') {
                return $fallback_candidates;
            }

            return $fallback_candidates;
        }

        /**
         * @param array<string,mixed> $buffer
         * @param string $buffer_option_id
         * @return int
         */
        private function resolve_buffer_liters($buffer, $buffer_option_id) {
            if ($buffer_option_id === 'buffer-0' || $buffer_option_id === 'bufor-nie') {
                return 0;
            }

            $option_liters = $this->extract_first_number($buffer_option_id, 0);
            if ($option_liters > 0) {
                return $option_liters;
            }

            return $this->to_int(isset($buffer['liters']) ? $buffer['liters'] : null, 0);
        }

        /**
         * @param array<string,mixed> $buffer
         * @return string
         */
        private function resolve_buffer_mount_type($buffer) {
            $recommendation = isset($buffer['recommendation']) && is_string($buffer['recommendation'])
                ? strtoupper(trim((string) $buffer['recommendation']))
                : '';
            if ($recommendation !== '') {
                if (strpos($recommendation, 'RÓWNOLEGLE') !== false || strpos($recommendation, 'ROWNOLEGLE') !== false) {
                    return 'sprzeglo';
                }
            }
            return 'na_powrocie';
        }

        /**
         * @param array<string,mixed> $price_book
         * @param int $liters
         * @param string $mount_type
         * @param bool &$fallback_used
         * @param bool $allow_nearest_fallback
         * @return float
         */
        private function resolve_buffer_price($price_book, $liters, $mount_type, &$fallback_used, $allow_nearest_fallback = true) {
            $fallback_used = false;
            $buffer = isset($price_book['buffer']) && is_array($price_book['buffer'])
                ? $price_book['buffer']
                : array();
            if (empty($buffer)) {
                return 0.0;
            }

            $key = (string) $liters;
            if (isset($buffer[$key]) && is_array($buffer[$key])) {
                $direct = $this->to_float(isset($buffer[$key][$mount_type]) ? $buffer[$key][$mount_type] : null, null);
                if ($direct !== null) {
                    return $direct;
                }
            }

            if ($allow_nearest_fallback) {
                $closest_key = $this->find_closest_numeric_key($buffer, $liters);
                if ($closest_key !== null && isset($buffer[$closest_key]) && is_array($buffer[$closest_key])) {
                    $fallback_used = true;
                    return $this->to_float(
                        isset($buffer[$closest_key][$mount_type]) ? $buffer[$closest_key][$mount_type] : null,
                        0.0
                    );
                }
            }

            return 0.0;
        }

        /**
         * @param array<string,mixed> $preferences
         * @param array<string,mixed> $building
         * @param string $dhw_option_id
         * @return bool
         */
        private function resolve_dhw_enabled($preferences, $building, $dhw_option_id) {
            if ($dhw_option_id === 'cwu-none' || $dhw_option_id === 'none') {
                return false;
            }
            if ($this->contains($dhw_option_id, 'cwu-')) {
                return true;
            }
            $enabled = $this->to_bool($this->dig($preferences, array('dhw', 'enabled')), null);
            if ($enabled === null) {
                $enabled = $this->to_bool(isset($building['include_hot_water']) ? $building['include_hot_water'] : null, false);
            }
            return $enabled === true;
        }

        /**
         * @param array<string,mixed> $preferences
         * @param array<string,mixed> $building
         * @param string $dhw_option_id
         * @param array<string,mixed> $cwu
         * @return bool
         */
        private function resolve_dhw_enabled_with_cwu($preferences, $building, $dhw_option_id, $cwu) {
            if (is_array($cwu) && array_key_exists('enabled', $cwu)) {
                return $this->to_bool(isset($cwu['enabled']) ? $cwu['enabled'] : null, false);
            }
            return $this->resolve_dhw_enabled($preferences, $building, $dhw_option_id);
        }

        /**
         * @param int $persons
         * @param string $dhw_option_id
         * @return int
         */
        private function resolve_cwu_capacity_from_inputs($persons, $dhw_option_id, $price_book) {
            $option_capacity = $this->extract_first_number($dhw_option_id, 0);
            if ($option_capacity > 0) {
                return $option_capacity;
            }
            return $this->resolve_cwu_capacity($persons, $price_book);
        }

        /**
         * @param int $persons
         * @param string $dhw_option_id
         * @param array<string,mixed> $price_book
         * @param array<string,mixed> $cwu
         * @return int
         */
        private function resolve_cwu_capacity_with_result($persons, $dhw_option_id, $price_book, $cwu) {
            $option_capacity = $this->extract_first_number($dhw_option_id, 0);
            if ($option_capacity > 0) {
                return $option_capacity;
            }

            $hint_capacity = $this->to_int($this->dig($cwu, array('pricingHint', 'capacityL')), 0);
            if ($hint_capacity > 0) {
                return $hint_capacity;
            }

            $recommended_capacity = $this->to_int(isset($cwu['recommendedCapacityL']) ? $cwu['recommendedCapacityL'] : null, 0);
            if ($recommended_capacity > 0) {
                return $recommended_capacity;
            }

            return $this->resolve_cwu_capacity_from_inputs($persons, $dhw_option_id, $price_book);
        }

        /**
         * @param string $dhw_option_id
         * @param array<string,mixed> $preferences
         * @param array<string,mixed> $building
         * @return string
         */
        private function resolve_cwu_material($dhw_option_id, $preferences, $building) {
            if ($this->contains($dhw_option_id, 'inox')) {
                return 'inox';
            }
            if ($this->contains($dhw_option_id, 'emalia')) {
                return 'emalia';
            }

            $material = (string) $this->pick_first(array(
                $this->dig($preferences, array('dhw', 'material')),
                isset($building['hot_water_material']) ? $building['hot_water_material'] : null,
            ));
            $material = strtolower(trim($material));
            if ($this->contains($material, 'inox')) {
                return 'inox';
            }
            return 'emalia';
        }

        /**
         * @param string $dhw_option_id
         * @param array<string,mixed> $preferences
         * @param array<string,mixed> $building
         * @param array<string,mixed> $cwu
         * @return string
         */
        private function resolve_cwu_material_with_result($dhw_option_id, $preferences, $building, $cwu) {
            if ($this->contains($dhw_option_id, 'inox') || $this->contains($dhw_option_id, 'emalia')) {
                return $this->resolve_cwu_material($dhw_option_id, $preferences, $building);
            }

            $hint_material = isset($cwu['resolvedMaterial']) ? (string) $cwu['resolvedMaterial'] : '';
            if ($hint_material !== '') {
                return $hint_material;
            }

            $pricing_hint_material = (string) $this->dig($cwu, array('pricingHint', 'material'));
            if ($pricing_hint_material !== '') {
                return $pricing_hint_material;
            }

            return $this->resolve_cwu_material($dhw_option_id, $preferences, $building);
        }

        /**
         * @param array<string,mixed> $price_book
         * @param string $material
         * @param int $capacity
         * @param bool &$fallback_used
         * @param bool $allow_nearest_fallback
         * @return float
         */
        private function resolve_cwu_price($price_book, $material, $capacity, &$fallback_used, $allow_nearest_fallback = true) {
            $fallback_used = false;
            $catalog = $this->dig($price_book, array('cwu', $material));
            if (!is_array($catalog)) {
                $catalog = $this->dig($price_book, array('cwu', 'emalia'));
                if (is_array($catalog)) {
                    $fallback_used = true;
                }
            }
            if (!is_array($catalog)) {
                return 0.0;
            }

            $key = (string) $capacity;
            if (isset($catalog[$key])) {
                return $this->to_float($catalog[$key], 0.0);
            }

            if ($allow_nearest_fallback) {
                $closest_key = $this->find_closest_numeric_key($catalog, $capacity);
                if ($closest_key !== null && isset($catalog[$closest_key])) {
                    $fallback_used = true;
                    return $this->to_float($catalog[$closest_key], 0.0);
                }
            }

            return 0.0;
        }

        /**
         * @param int $persons
         * @return int
         */
        private function resolve_cwu_capacity($persons, $price_book = array()) {
            $cwu_policy = $this->dig($price_book, array('pricing_policy', 'cwu', 'capacity_by_persons'));
            $le_2 = $this->to_int(is_array($cwu_policy) && isset($cwu_policy['le_2']) ? $cwu_policy['le_2'] : null, 150);
            $le_4 = $this->to_int(is_array($cwu_policy) && isset($cwu_policy['le_4']) ? $cwu_policy['le_4'] : null, 200);
            $gt_4 = $this->to_int(is_array($cwu_policy) && isset($cwu_policy['gt_4']) ? $cwu_policy['gt_4'] : null, 300);
            if ($persons <= 2) return $le_2;
            if ($persons <= 4) return $le_4;
            return $gt_4;
        }

        /**
         * @param array<string,mixed> $selection
         * @param string $pump_option_id
         * @return array<string,mixed>
         */
        private function resolve_effective_pump_selection($selection, $pump_option_id) {
            $model = isset($selection['pumpModel']) && is_string($selection['pumpModel']) && trim($selection['pumpModel']) !== ''
                ? trim($selection['pumpModel'])
                : null;
            $type = isset($selection['type']) && is_string($selection['type']) && trim($selection['type']) !== ''
                ? trim($selection['type'])
                : null;
            $phase = $this->to_int(isset($selection['phase']) ? $selection['phase'] : null, null);
            $power = $this->to_float(isset($selection['capacity_kW']) ? $selection['capacity_kW'] : null, null);

            if ($model !== null) {
                return array(
                    'model' => $model,
                    'type' => $type,
                    'phase' => $phase,
                    'power' => $power,
                );
            }

            $prefer_aio = $this->contains_any($pump_option_id, array('aio', 'premium'));
            $candidate = $prefer_aio
                ? $this->dig($selection, array('pumpSelection', 'aio'))
                : $this->dig($selection, array('pumpSelection', 'hp'));

            if (!is_array($candidate) && $prefer_aio) {
                $candidate = $this->dig($selection, array('pumpSelection', 'hp'));
            }
            if (!is_array($candidate) && !$prefer_aio) {
                $candidate = $this->dig($selection, array('pumpSelection', 'aio'));
            }
            if (!is_array($candidate)) {
                return array(
                    'model' => null,
                    'type' => null,
                    'phase' => null,
                    'power' => $power,
                );
            }

            return array(
                'model' => isset($candidate['model']) ? (string) $candidate['model'] : null,
                'type' => isset($candidate['type']) ? (string) $candidate['type'] : null,
                'phase' => $this->to_int(isset($candidate['phase']) ? $candidate['phase'] : null, null),
                'power' => $this->to_float(isset($candidate['power']) ? $candidate['power'] : null, $power),
            );
        }

        /**
         * @param array<string,mixed> $price_book
         * @param array<string,mixed> $by_power
         * @return array<int,int|float>
         */
        private function resolve_catalog_powers($price_book, $by_power) {
            $powers = $this->dig($price_book, array('pricing_policy', 'pump', 'catalog_powers_kw'));
            if (is_array($powers) && !empty($powers)) {
                return $powers;
            }

            $resolved = array();
            if (is_array($by_power)) {
                foreach ($by_power as $key => $value) {
                    if (!is_numeric($key)) {
                        continue;
                    }
                    $resolved[] = (int) round((float) $key);
                }
            }

            return !empty($resolved) ? $resolved : array(3, 5, 7, 9, 12, 16);
        }

        /**
         * @param mixed $values
         * @return array<int,string>
         */
        private function normalize_candidate_key_list($values) {
            if (!is_array($values)) {
                return array();
            }

            $normalized = array();
            foreach ($values as $value) {
                if (!is_string($value)) {
                    continue;
                }
                $trimmed = trim($value);
                if ($trimmed === '') {
                    continue;
                }
                $normalized[] = $trimmed;
            }

            return array_values(array_unique($normalized));
        }

        /**
         * @param string $sku
         * @param string $name
         * @param int $qty
         * @param float $unit_price_net
         * @param float $vat_rate
         * @return array<string,mixed>
         */
        private function build_item($sku, $name, $qty, $unit_price_net, $vat_rate) {
            $total_net = round($qty * $unit_price_net, 2);
            $total_gross = round($total_net * (1.0 + $vat_rate), 2);

            return array(
                'sku' => $sku,
                'name' => $name,
                'qty' => $qty,
                'unitPriceNet' => round($unit_price_net, 2),
                'vatRate' => $vat_rate,
                'totalNet' => $total_net,
                'totalGross' => $total_gross,
            );
        }

        /**
         * @param array<string,mixed> $map
         * @param float $target
         * @return string|null
         */
        private function find_closest_numeric_key($map, $target) {
            $best_key = null;
            $best_distance = null;
            foreach ($map as $key => $value) {
                if (!is_numeric($key)) {
                    continue;
                }
                $distance = abs((float) $target - (float) $key);
                if ($best_distance === null || $distance < $best_distance) {
                    $best_distance = $distance;
                    $best_key = (string) $key;
                }
            }
            return $best_key;
        }

        /**
         * @param array<int,int|float> $values
         * @param float $target
         * @return int|null
         */
        private function find_nearest_from_list($values, $target) {
            $best = null;
            $best_distance = null;
            foreach ($values as $candidate) {
                $distance = abs((float) $target - (float) $candidate);
                if ($best_distance === null || $distance < $best_distance) {
                    $best_distance = $distance;
                    $best = (int) $candidate;
                }
            }
            return $best;
        }

        /**
         * @param string $value
         * @param string $needle
         * @return bool
         */
        private function contains($value, $needle) {
            if ($value === '' || $needle === '') {
                return false;
            }
            return strpos(strtolower($value), strtolower($needle)) !== false;
        }

        /**
         * @param string $value
         * @param array<int,string> $needles
         * @return bool
         */
        private function contains_any($value, $needles) {
            foreach ($needles as $needle) {
                if ($this->contains($value, $needle)) {
                    return true;
                }
            }
            return false;
        }

        /**
         * @param string $value
         * @param int $default
         * @return int
         */
        private function extract_first_number($value, $default = 0) {
            if (!is_string($value) || trim($value) === '') {
                return $default;
            }
            if (preg_match('/(\d+)/', $value, $matches)) {
                return (int) $matches[1];
            }
            return $default;
        }

        /**
         * @param array<int,array<string,mixed>> &$warnings
         * @param string $code
         * @param string $message
         * @return void
         */
        private function add_warning(&$warnings, $code, $message) {
            foreach ($warnings as $warning) {
                if (!is_array($warning)) {
                    continue;
                }
                if (
                    isset($warning['code']) &&
                    isset($warning['message']) &&
                    (string) $warning['code'] === $code &&
                    (string) $warning['message'] === $message
                ) {
                    return;
                }
            }
            $warnings[] = array(
                'code' => $code,
                'message' => $message,
            );
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

if (!class_exists('TopInstal_PricingEngine_Mvp')) {
    class TopInstal_PricingEngine_Mvp extends TopInstal_PricingEngine {
    }
}

