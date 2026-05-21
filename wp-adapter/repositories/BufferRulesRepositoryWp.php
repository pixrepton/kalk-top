<?php

if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists('TopInstal_BufferRulesRepository_Wp')) {
    /**
     * WP adapter repository exposing buffer and engineering policy from master-data.
     */
    class TopInstal_BufferRulesRepository_Wp {
        const TRANSIENT_KEY_PREFIX = 'topinstal_buffer_rules_v3_';
        const TTL_SECONDS = 600;

        /** @var object */
        private $master_data_repository;

        /**
         * @param object|null $master_data_repository
         */
        public function __construct($master_data_repository = null) {
            $this->master_data_repository = $master_data_repository ?: new TopInstal_MasterDataRepository_Wp();
        }

        /**
         * @return array<string,mixed>
         */
        public function get_rules() {
            $policy = $this->call_master_repository('get_engineering_policy');
            $source_version = isset($policy['source_version']) ? (string) $policy['source_version'] : 'master-defaults-v1';
            $cache_key = self::TRANSIENT_KEY_PREFIX . md5($source_version);

            $cached = function_exists('get_transient') ? get_transient($cache_key) : false;
            if (is_array($cached)) {
                return $cached;
            }

            $rules = $this->build_rules_from_policy(is_array($policy) ? $policy : array());
            $rules = $this->sanitize_rules($rules);
            $rules['data_version'] = $source_version;

            if (function_exists('set_transient')) {
                set_transient($cache_key, $rules, self::TTL_SECONDS);
            }

            return $rules;
        }

        /**
         * @return array<string,mixed>
         */
        public function get_engineering_policy() {
            $policy = $this->call_master_repository('get_engineering_policy');
            if (!is_array($policy) || empty($policy)) {
                return $this->default_engineering_policy();
            }
            return $policy;
        }

        /**
         * @param array<string,mixed> $policy
         * @return array<string,mixed>
         */
        private function build_rules_from_policy($policy) {
            $defaults = $this->default_rules();
            $buffer_rules = isset($policy['buffer']) && is_array($policy['buffer']) ? $policy['buffer'] : array();
            $buffer_engine_policy = isset($policy['buffer_engine_policy']) && is_array($policy['buffer_engine_policy'])
                ? $policy['buffer_engine_policy']
                : array();
            $nested_cwu_rules = isset($buffer_rules['cwuRules']) && is_array($buffer_rules['cwuRules'])
                ? $buffer_rules['cwuRules']
                : array();
            $legacy_top_level_cwu_rules = isset($policy['cwuRules']) && is_array($policy['cwuRules'])
                ? $policy['cwuRules']
                : array();

            $rules = array_merge($defaults, $buffer_rules);
            $rules['bufferEnginePolicy'] = !empty($buffer_engine_policy)
                ? $buffer_engine_policy
                : $defaults['bufferEnginePolicy'];
            $rules['cwuRules'] = !empty($nested_cwu_rules)
                ? $nested_cwu_rules
                : (!empty($legacy_top_level_cwu_rules) ? $legacy_top_level_cwu_rules : $defaults['cwuRules']);
            $rules['ozcPolicy'] = isset($policy['ozc']) && is_array($policy['ozc'])
                ? $policy['ozc']
                : $this->default_engineering_policy()['ozc'];
            $rules['hotWaterPowerPolicy'] = isset($policy['hot_water_power']) && is_array($policy['hot_water_power'])
                ? $policy['hot_water_power']
                : $this->default_engineering_policy()['hot_water_power'];

            return $rules;
        }

        /**
         * @param array<string,mixed> $rules
         * @return array<string,mixed>
         */
        private function sanitize_rules($rules) {
            $defaults = $this->default_rules();
            $out = array_merge($defaults, $rules);

            if (!isset($out['capacityPerKw']) || !is_array($out['capacityPerKw'])) {
                $out['capacityPerKw'] = $defaults['capacityPerKw'];
            }
            if (!isset($out['availableCapacities']) || !is_array($out['availableCapacities'])) {
                $out['availableCapacities'] = $defaults['availableCapacities'];
            }
            if (!isset($out['availableCapacities']['buffer']) || !is_array($out['availableCapacities']['buffer'])) {
                $out['availableCapacities']['buffer'] = $defaults['availableCapacities']['buffer'];
            }
            if (!isset($out['minimumCapacities']) || !is_array($out['minimumCapacities'])) {
                $out['minimumCapacities'] = $defaults['minimumCapacities'];
            }
            if (!isset($out['bufferEnginePolicy']) || !is_array($out['bufferEnginePolicy'])) {
                $out['bufferEnginePolicy'] = $defaults['bufferEnginePolicy'];
            }
            if (!isset($out['cwuRules']) || !is_array($out['cwuRules'])) {
                $out['cwuRules'] = $defaults['cwuRules'];
            }
            if (!isset($out['hotWaterPowerPolicy']) || !is_array($out['hotWaterPowerPolicy'])) {
                $out['hotWaterPowerPolicy'] = $this->default_engineering_policy()['hot_water_power'];
            }

            return $out;
        }

        /**
         * @return array<string,mixed>
         */
        private function default_rules() {
            return array(
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
                'bufferEnginePolicy' => array(
                    'fallback_capacity_per_kw' => 20,
                    'oversized_warning_liters' => 500,
                    'setup_type_threshold_key' => 'parallelBuffer',
                    'setup_types' => array(
                        'none' => 'NONE',
                        'series' => 'BUFOR_SZEREGOWO',
                        'parallel' => 'BUFOR_ROWNOLEGLE',
                    ),
                ),
                'cwuRules' => array(
                    'baseCapacity' => array('1' => 150, '2' => 150, '3' => 200, '4' => 200, '5+' => 300),
                    'usageAdjustments' => array('shower' => 0, 'shower_bath' => 50, 'bath' => 100),
                    'materialAdjustments' => array('inox' => 50, 'emalia' => 100),
                    'safetyRule' => array('usage' => 'bath', 'persons_min' => 2, 'minimumCapacity' => 200),
                    'availableCapacities' => array(150, 200, 250, 300, 400, 500),
                ),
            );
        }

        /**
         * @return array<string,mixed>
         */
        private function default_engineering_policy() {
            return array(
                'ozc' => array(),
                'hot_water_power' => array(
                    'defaults' => array(
                        'persons' => 3,
                        'min_power_kw' => 0.8,
                        'per_person_kw' => 0.35,
                        'max_power_kw' => 1.5,
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
         * @param string $method
         * @return array<string,mixed>
         */
        private function call_master_repository($method) {
            if (!is_object($this->master_data_repository) || !method_exists($this->master_data_repository, $method)) {
                return array();
            }
            $result = call_user_func(array($this->master_data_repository, $method));
            return is_array($result) ? $result : array();
        }
    }
}
