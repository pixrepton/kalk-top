<?php

if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists('TopInstal_SelectionRulesRepository_Wp')) {
    /**
     * WP adapter repository exposing selection rules built from master-data.
     */
    class TopInstal_SelectionRulesRepository_Wp {
        const TRANSIENT_KEY_PREFIX = 'topinstal_selection_rules_v3_';
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
            $catalog = $this->call_master_repository('get_equipment_catalog');
            $source_version = isset($catalog['source_version']) ? (string) $catalog['source_version'] : 'master-defaults-v1';
            $cache_key = self::TRANSIENT_KEY_PREFIX . md5($source_version);

            $cached = function_exists('get_transient') ? get_transient($cache_key) : false;
            if (is_array($cached)) {
                return $cached;
            }

            $rules = $this->build_rules_from_catalog(is_array($catalog) ? $catalog : array());
            $rules = $this->sanitize_rules($rules);
            $rules['data_version'] = $source_version;

            if (function_exists('set_transient')) {
                set_transient($cache_key, $rules, self::TTL_SECONDS);
            }

            return $rules;
        }

        /**
         * @param array<string,mixed> $catalog
         * @return array<string,mixed>
         */
        private function build_rules_from_catalog($catalog) {
            $defaults = $this->default_rules();
            $pumps = isset($catalog['pumps']) && is_array($catalog['pumps']) ? $catalog['pumps'] : array();
            $selection_policy = isset($catalog['selection_policy']) && is_array($catalog['selection_policy'])
                ? $catalog['selection_policy']
                : array();

            $table = array();
            $aio_map = array();
            $aio_large_map = array();

            foreach ($pumps as $pump) {
                if (!is_array($pump)) {
                    continue;
                }
                $model = isset($pump['model']) ? (string) $pump['model'] : '';
                if ($model === '') {
                    continue;
                }
                $range = isset($pump['selection_range_kw']) && is_array($pump['selection_range_kw'])
                    ? $pump['selection_range_kw']
                    : array();

                $table[$model] = array(
                    'min' => array(
                        'surface' => $this->to_float($this->dig($range, array('surface', 'min')), 0.0),
                        'mixed' => $this->to_float($this->dig($range, array('mixed', 'min')), 0.0),
                        'radiators' => $this->to_float($this->dig($range, array('radiators', 'min')), 0.0),
                    ),
                    'max' => array(
                        'surface' => $this->to_float($this->dig($range, array('surface', 'max')), 0.0),
                        'mixed' => $this->to_float($this->dig($range, array('mixed', 'max')), 0.0),
                        'radiators' => $this->to_float($this->dig($range, array('radiators', 'max')), 0.0),
                    ),
                    'power' => $this->to_float(isset($pump['power_kw']) ? $pump['power_kw'] : null, 0.0),
                    'series' => isset($pump['series']) ? (string) $pump['series'] : null,
                    'type' => isset($pump['type']) ? (string) $pump['type'] : 'split',
                    'phase' => $this->to_int(isset($pump['phase']) ? $pump['phase'] : null, 1),
                    'cwu_tank' => $this->to_int(isset($pump['cwu_tank']) ? $pump['cwu_tank'] : null, 0),
                );

                $aio_model = (string) $this->dig($pump, array('pair', 'aio_model'));
                if ($aio_model !== '') {
                    $aio_map[$model] = $aio_model;
                }
                $aio_model_large = (string) $this->dig($pump, array('pair', 'aio_model_large_cwu'));
                if ($aio_model_large !== '') {
                    $aio_large_map[$model] = $aio_model_large;
                }
            }

            return array(
                'schema_version' => 'selection_rules_v3',
                'pumpMatchingTable' => !empty($table) ? $table : $defaults['pumpMatchingTable'],
                'aioMap' => !empty($aio_map) ? $aio_map : $defaults['aioMap'],
                'aioLargeCwuMap' => !empty($aio_large_map) ? $aio_large_map : $defaults['aioLargeCwuMap'],
                'selectionPolicy' => !empty($selection_policy) ? $selection_policy : $defaults['selectionPolicy'],
            );
        }

        /**
         * @param array<string,mixed> $rules
         * @return array<string,mixed>
         */
        private function sanitize_rules($rules) {
            $defaults = $this->default_rules();
            $out = array_merge($defaults, $rules);

            if (!isset($out['pumpMatchingTable']) || !is_array($out['pumpMatchingTable'])) {
                $out['pumpMatchingTable'] = $defaults['pumpMatchingTable'];
            }
            if (!isset($out['aioMap']) || !is_array($out['aioMap'])) {
                $out['aioMap'] = $defaults['aioMap'];
            }
            if (!isset($out['aioLargeCwuMap']) || !is_array($out['aioLargeCwuMap'])) {
                $out['aioLargeCwuMap'] = $defaults['aioLargeCwuMap'];
            }
            if (!isset($out['selectionPolicy']) || !is_array($out['selectionPolicy'])) {
                $out['selectionPolicy'] = $defaults['selectionPolicy'];
            }

            return $out;
        }

        /**
         * @return array<string,mixed>
         */
        private function default_rules() {
            return array(
                'schema_version' => 'selection_rules_v3',
                'pumpMatchingTable' => array(
                    'KIT-WC03K3E5' => array(
                        'min' => array('surface' => 3.0, 'mixed' => 3.0, 'radiators' => 2.5),
                        'max' => array('surface' => 4.2, 'mixed' => 4.2, 'radiators' => 3.5),
                        'power' => 3.0,
                        'series' => 'K',
                        'type' => 'split',
                        'phase' => 1,
                        'cwu_tank' => 0,
                    ),
                    'KIT-WC16K9E8' => array(
                        'min' => array('surface' => 12.5, 'mixed' => 11.0, 'radiators' => 10.0),
                        'max' => array('surface' => 17.5, 'mixed' => 16.0, 'radiators' => 14.5),
                        'power' => 16.0,
                        'series' => 'K',
                        'type' => 'split',
                        'phase' => 3,
                        'cwu_tank' => 0,
                    ),
                ),
                'aioMap' => array(
                    'KIT-WC03K3E5' => 'KIT-ADC03K3E5',
                    'KIT-WC16K9E8' => 'KIT-ADC16K9E8',
                ),
                'aioLargeCwuMap' => array(
                    'KIT-WC16K9E8' => 'KIT-ADC16K9E83',
                ),
                'selectionPolicy' => array(
                    'preferred_type' => 'split',
                    'special_cases' => array(
                        'low_power_building' => array(
                            'enabled' => true,
                            'demand_max_kw' => 1.8,
                            'construction_types' => array('canadian', 'skeleton', 'szkieletowy'),
                            'heated_area_max_m2' => 80,
                            'indoor_temp_max_c' => 21,
                            'force_model' => 'KIT-WC03K3E5',
                        ),
                        'high_power_catalog_limit' => array(
                            'enabled' => true,
                            'demand_min_kw' => 15.9,
                            'demand_max_kw' => 25,
                            'force_model' => 'KIT-WC16K9E8',
                        ),
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

        /**
         * @param mixed $value
         * @param float $default
         * @return float
         */
        private function to_float($value, $default = 0.0) {
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
         * @param array<string,mixed> $data
         * @param array<int,string> $path
         * @return mixed
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
