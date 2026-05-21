<?php

if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists('TopInstal_MasterDataRepository_Wp')) {
    /**
     * Shared WP adapter for master-data JSON files.
     */
    class TopInstal_MasterDataRepository_Wp {
        const TRANSIENT_KEY_PREFIX = 'topinstal_master_data_v1_';
        const TTL_SECONDS = 600;

        /**
         * @return array<string,mixed>
         */
        public function get_equipment_catalog() {
            $defaults = $this->default_equipment_catalog();
            $data = $this->load_master_data('equipment-catalog.json', $defaults);
            if (!isset($data['pumps']) || !is_array($data['pumps'])) {
                $data['pumps'] = $defaults['pumps'];
            }
            if (!isset($data['pricing_sections']) || !is_array($data['pricing_sections'])) {
                $data['pricing_sections'] = $defaults['pricing_sections'];
            }
            if (!isset($data['pricing_policy']) || !is_array($data['pricing_policy'])) {
                $data['pricing_policy'] = $defaults['pricing_policy'];
            }
            if (!isset($data['selection_policy']) || !is_array($data['selection_policy'])) {
                $data['selection_policy'] = $defaults['selection_policy'];
            }
            return $data;
        }

        /**
         * @return array<string,mixed>
         */
        public function get_engineering_policy() {
            $defaults = $this->default_engineering_policy();
            $data = $this->load_master_data('engineering-policy.json', $defaults);
            if (!isset($data['ozc']) || !is_array($data['ozc'])) {
                $data['ozc'] = $defaults['ozc'];
            }
            if (!isset($data['buffer']) || !is_array($data['buffer'])) {
                $data['buffer'] = $defaults['buffer'];
            }
            if (!isset($data['buffer_engine_policy']) || !is_array($data['buffer_engine_policy'])) {
                $data['buffer_engine_policy'] = $defaults['buffer_engine_policy'];
            }
            if (!isset($data['hot_water_power']) || !is_array($data['hot_water_power'])) {
                $data['hot_water_power'] = $defaults['hot_water_power'];
            }
            return $data;
        }

        /**
         * @return array<string,mixed>
         */
        public function get_system_dictionary() {
            $defaults = $this->default_system_dictionary();
            $data = $this->load_master_data('system-dictionary.json', $defaults);
            if (!isset($data['reasonCodes']) || !is_array($data['reasonCodes'])) {
                $data['reasonCodes'] = $defaults['reasonCodes'];
            }
            return $data;
        }

        /**
         * @param string $file_name
         * @param array<string,mixed> $defaults
         * @return array<string,mixed>
         */
        private function load_master_data($file_name, $defaults) {
            $path = $this->resolve_path($file_name);
            $source_version = $this->build_source_version($path);
            $cache_key = self::TRANSIENT_KEY_PREFIX . md5($file_name . ':' . $source_version);

            $cached = function_exists('get_transient') ? get_transient($cache_key) : false;
            if (is_array($cached)) {
                return $cached;
            }

            $loaded = $this->load_json_file($path);
            $data = empty($loaded) ? $defaults : $this->deep_merge($defaults, $loaded);
            if (!isset($data['data_version']) || !is_scalar($data['data_version'])) {
                $data['data_version'] = $source_version;
            }
            $data['source_version'] = $source_version;

            if (function_exists('set_transient')) {
                set_transient($cache_key, $data, self::TTL_SECONDS);
            }

            return $data;
        }

        /**
         * @param string $file_name
         * @return string
         */
        private function resolve_path($file_name) {
            return dirname(__DIR__, 2) . '/core/infrastructure/master-data/' . ltrim($file_name, '/');
        }

        /**
         * @param string $path
         * @return string
         */
        private function build_source_version($path) {
            if (!is_string($path) || !file_exists($path)) {
                return 'defaults-v1';
            }

            $size = @filesize($path);
            $mtime = @filemtime($path);
            if (!is_numeric($size)) $size = 0;
            if (!is_numeric($mtime)) $mtime = 0;

            return 'file-' . ((int) $mtime) . '-' . ((int) $size);
        }

        /**
         * @param string $path
         * @return array<string,mixed>
         */
        private function load_json_file($path) {
            if (!is_string($path) || !file_exists($path)) {
                return array();
            }

            $raw = @file_get_contents($path);
            if (!is_string($raw) || trim($raw) === '') {
                return array();
            }

            if (substr($raw, 0, 3) === "\xEF\xBB\xBF") {
                $raw = substr($raw, 3);
            }

            $decoded = json_decode($raw, true);
            if (!is_array($decoded)) {
                return array();
            }
            return $decoded;
        }

        /**
         * Recursive merge where values from $override replace $base.
         *
         * @param array<string,mixed> $base
         * @param array<string,mixed> $override
         * @return array<string,mixed>
         */
        private function deep_merge($base, $override) {
            $out = $base;
            foreach ($override as $key => $value) {
                if (
                    isset($out[$key]) &&
                    is_array($out[$key]) &&
                    is_array($value) &&
                    $this->is_assoc_array($out[$key]) &&
                    $this->is_assoc_array($value)
                ) {
                    $out[$key] = $this->deep_merge($out[$key], $value);
                    continue;
                }
                $out[$key] = $value;
            }
            return $out;
        }

        /**
         * @param array<mixed> $value
         * @return bool
         */
        private function is_assoc_array($value) {
            if (!is_array($value)) {
                return false;
            }
            return array_keys($value) !== range(0, count($value) - 1);
        }

        /**
         * @return array<string,mixed>
         */
        private function default_equipment_catalog() {
            return array(
                'schema_version' => 'equipment_catalog_v1',
                'data_version' => 'fallback',
                'currency' => 'PLN',
                'vat_rate' => 0.08,
                'pumps' => array(),
                'selection_policy' => array(
                    'preferred_type' => 'split',
                    'special_cases' => array(),
                ),
                'pricing_sections' => array(
                    'cwu' => array(),
                    'buffer' => array(),
                    'foundation' => array(),
                    'drainage' => array(),
                    'water' => array(),
                    'options' => array(),
                    'hydraulic_components_aio' => 2700,
                    'hydraulic_components_split' => 3700,
                    'installation_net' => 11000,
                ),
                'pricing_policy' => array(
                    'pump' => array(
                        'catalog_powers_kw' => array(3, 5, 7, 9, 12, 16),
                    ),
                    'cwu' => array(
                        'capacity_by_persons' => array(
                            'le_2' => 150,
                            'le_4' => 200,
                            'gt_4' => 300,
                        ),
                        'default_material' => 'emalia',
                    ),
                    'defaults' => array(
                        'currency' => 'PLN',
                        'vat_rate' => 0.08,
                    ),
                ),
            );
        }

        /**
         * @return array<string,mixed>
         */
        private function default_engineering_policy() {
            return array(
                'schema_version' => 'engineering_policy_v1',
                'data_version' => 'fallback',
                'ozc' => array(
                    'area' => array(
                        'default_heated_area_m2' => 100.0,
                        'min_valid_m2' => 1.0,
                    ),
                    'base_w_per_m2_by_construction_year' => array(
                        array('min_year' => 2021, 'value' => 45.0),
                        array('min_year' => 2011, 'value' => 55.0),
                        array('min_year' => 2000, 'value' => 70.0),
                        array('min_year' => 1990, 'value' => 85.0),
                        array('min_year' => 1980, 'value' => 100.0),
                        array('min_year' => 0, 'value' => 120.0),
                    ),
                    'ventilation_multipliers' => array(
                        'mechanical_recovery' => 0.75,
                        'mechanical' => 0.90,
                        'gravity' => 1.05,
                        'natural' => 1.00,
                    ),
                    'emitter_multipliers' => array(
                        'surface' => 0.95,
                        'underfloor' => 0.95,
                        'mixed' => 1.00,
                        'radiators' => 1.05,
                    ),
                    'climate' => array(
                        'default_multiplier' => 1.00,
                        'default_design_outdoor_temp_c' => -20.0,
                        'zones' => array(),
                    ),
                    'construction_multipliers' => array(
                        'default' => 1.00,
                        'by_keyword' => array(),
                    ),
                    'windows_multipliers' => array(
                        'default' => 1.00,
                        'by_keyword' => array(),
                    ),
                    'thermal' => array(
                        'indoor_temperature_default_c' => 21.0,
                        'delta_t_reference_k' => 41.0,
                        'delta_t_min_k' => 5.0,
                        'delta_t_multiplier_min' => 0.60,
                        'delta_t_multiplier_max' => 1.40,
                        'min_design_heat_loss_kw' => 1.50,
                    ),
                ),
                'buffer' => array(
                    'capacityPerKw' => array(
                        'underfloor' => 10,
                        'radiators_lt' => 20,
                        'radiators_ht' => 25,
                        'radiators' => 20,
                        'mixed' => 15,
                    ),
                    'availableCapacities' => array(
                        'buffer' => array(50, 80, 100, 120, 150, 200, 300, 400, 500, 800, 1000),
                    ),
                    'minimumCapacities' => array(
                        'seriesBuffer' => 50,
                        'parallelBuffer' => 100,
                        'flowProtection' => 50,
                    ),
                ),
                'buffer_engine_policy' => array(
                    'fallback_capacity_per_kw' => 20,
                    'oversized_warning_liters' => 500,
                ),
                'hot_water_power' => array(
                    'defaults' => array(
                        'persons' => 3,
                        'min_power_kw' => 0.8,
                        'per_person_kw' => 0.35,
                    ),
                    'usage_factor' => array(
                        'shower' => 0.8,
                        'shower_bath' => 1.0,
                        'bath' => 1.2,
                        'default' => 1.0,
                    ),
                ),
            );
        }

        /**
         * @return array<string,mixed>
         */
        private function default_system_dictionary() {
            return array(
                'schema_version' => 'system_dictionary_v1',
                'data_version' => 'fallback',
                'reasonCodes' => array(
                    'BUFFER_RULE_MISSING' => array('description' => 'Fallback: buffer rule missing.'),
                    'BUFFER_OVERSIZED_WARNING' => array('description' => 'Fallback: oversized buffer warning.'),
                    'BUFFER_DISABLED_BY_PREFERENCE' => array('description' => 'Fallback: buffer disabled by preference.'),
                    'BUFFER_MVP_MODEL' => array('description' => 'Fallback: buffer MVP model.'),
                    'OZC_INCOMPLETE_INPUT' => array('description' => 'Fallback: incomplete OZC input.'),
                    'OZC_MVP_MODEL' => array('description' => 'Fallback: OZC MVP model.'),
                    'SELECTION_NO_EXACT_MATCH' => array('description' => 'Fallback: nearest selection used.'),
                    'SELECTION_SPECIAL_LOW_POWER' => array('description' => 'Fallback: low-power special case.'),
                    'SELECTION_HIGH_POWER_LIMITED' => array('description' => 'Fallback: high-power capped to catalog.'),
                    'PRICING_PRICEBOOK_MISSING' => array('description' => 'Pricebook unavailable/incomplete; backend pricing fallback mode is active.'),
                    'PRICING_PUMP_FALLBACK' => array('description' => 'Fallback: pump pricing nearest.'),
                    'PRICING_CWU_FALLBACK' => array('description' => 'Fallback: CWU pricing nearest.'),
                    'PRICING_BUFFER_FALLBACK' => array('description' => 'Fallback: buffer pricing nearest.'),
                ),
            );
        }
    }
}
