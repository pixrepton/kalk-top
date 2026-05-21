<?php

if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists('TopInstal_PriceBookRepository_Wp')) {
    /**
     * WP adapter repository exposing pricing view built from master-data.
     */
    class TopInstal_PriceBookRepository_Wp {
        const TRANSIENT_KEY_PREFIX = 'topinstal_pricebook_v3_';
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
        public function get_price_book() {
            $catalog = $this->call_master_repository('get_equipment_catalog');
            $source_version = isset($catalog['source_version']) ? (string) $catalog['source_version'] : 'master-defaults-v1';
            $cache_key = self::TRANSIENT_KEY_PREFIX . md5($source_version);

            $cached = function_exists('get_transient') ? get_transient($cache_key) : false;
            if (is_array($cached)) {
                return $cached;
            }

            $book = $this->build_price_book_from_catalog(is_array($catalog) ? $catalog : array());
            $book = $this->sanitize_price_book($book);
            $book['data_version'] = $source_version;

            if (function_exists('set_transient')) {
                set_transient($cache_key, $book, self::TTL_SECONDS);
            }

            return $book;
        }

        /**
         * @param array<string,mixed> $catalog
         * @return array<string,mixed>
         */
        private function build_price_book_from_catalog($catalog) {
            $defaults = $this->default_price_book();
            $pumps = isset($catalog['pumps']) && is_array($catalog['pumps']) ? $catalog['pumps'] : array();
            $sections = isset($catalog['pricing_sections']) && is_array($catalog['pricing_sections'])
                ? $catalog['pricing_sections']
                : array();
            $policy = isset($catalog['pricing_policy']) && is_array($catalog['pricing_policy'])
                ? $catalog['pricing_policy']
                : array();

            $by_power = array();
            foreach ($pumps as $pump) {
                if (!is_array($pump)) {
                    continue;
                }
                $power = $this->to_int(isset($pump['power_kw']) ? $pump['power_kw'] : null, 0);
                if ($power <= 0) {
                    continue;
                }
                $price_row = isset($pump['pricing']) && is_array($pump['pricing']) ? $pump['pricing'] : array();
                if (empty($price_row)) {
                    continue;
                }
                $key = (string) $power;
                $base = isset($by_power[$key]) && is_array($by_power[$key]) ? $by_power[$key] : array();
                $by_power[$key] = array_merge($base, $price_row);
            }

            $book = array(
                'schema_version' => isset($catalog['schema_version']) ? (string) $catalog['schema_version'] : $defaults['schema_version'],
                'pricing_version' => isset($catalog['data_version']) ? (string) $catalog['data_version'] : $defaults['pricing_version'],
                'currency' => isset($catalog['currency']) ? (string) $catalog['currency'] : $defaults['currency'],
                'vat_rate' => $this->to_float(isset($catalog['vat_rate']) ? $catalog['vat_rate'] : null, (float) $defaults['vat_rate']),
                'pump' => array(
                    'by_power_kw' => !empty($by_power) ? $by_power : $defaults['pump']['by_power_kw'],
                ),
                'cwu' => isset($sections['cwu']) && is_array($sections['cwu']) ? $sections['cwu'] : $defaults['cwu'],
                'buffer' => isset($sections['buffer']) && is_array($sections['buffer']) ? $sections['buffer'] : $defaults['buffer'],
                'foundation' => isset($sections['foundation']) && is_array($sections['foundation']) ? $sections['foundation'] : $defaults['foundation'],
                'drainage' => isset($sections['drainage']) && is_array($sections['drainage']) ? $sections['drainage'] : $defaults['drainage'],
                'water' => isset($sections['water']) && is_array($sections['water']) ? $sections['water'] : $defaults['water'],
                'options' => isset($sections['options']) && is_array($sections['options']) ? $sections['options'] : $defaults['options'],
                'hydraulic_components_aio' => $this->to_float(
                    isset($sections['hydraulic_components_aio']) ? $sections['hydraulic_components_aio'] : null,
                    (float) $defaults['hydraulic_components_aio']
                ),
                'hydraulic_components_split' => $this->to_float(
                    isset($sections['hydraulic_components_split']) ? $sections['hydraulic_components_split'] : null,
                    (float) $defaults['hydraulic_components_split']
                ),
                'installation_net' => $this->to_float(
                    isset($sections['installation_net']) ? $sections['installation_net'] : null,
                    (float) $defaults['installation_net']
                ),
                'pricing_policy' => !empty($policy) ? $policy : $defaults['pricing_policy'],
            );

            return $book;
        }

        /**
         * @param array<string,mixed> $book
         * @return array<string,mixed>
         */
        private function sanitize_price_book($book) {
            $defaults = $this->default_price_book();
            $out = array_merge($defaults, $book);

            if (!isset($out['pump']) || !is_array($out['pump'])) {
                $out['pump'] = $defaults['pump'];
            }
            if (!isset($out['pump']['by_power_kw']) || !is_array($out['pump']['by_power_kw'])) {
                $out['pump']['by_power_kw'] = $defaults['pump']['by_power_kw'];
            }
            if (!isset($out['pricing_policy']) || !is_array($out['pricing_policy'])) {
                $out['pricing_policy'] = $defaults['pricing_policy'];
            }

            $merged_by_power = $defaults['pump']['by_power_kw'];
            foreach ($out['pump']['by_power_kw'] as $power_key => $power_row) {
                if (!is_array($power_row)) {
                    continue;
                }
                $base = isset($merged_by_power[$power_key]) && is_array($merged_by_power[$power_key])
                    ? $merged_by_power[$power_key]
                    : array();
                $merged_by_power[$power_key] = array_merge($base, $power_row);
            }
            $out['pump']['by_power_kw'] = $merged_by_power;

            foreach (array('buffer', 'cwu', 'foundation', 'drainage', 'water', 'options') as $section_key) {
                if (!isset($out[$section_key]) || !is_array($out[$section_key])) {
                    $out[$section_key] = $defaults[$section_key];
                }
            }

            return $out;
        }

        /**
         * @return array<string,mixed>
         */
        private function default_price_book() {
            return array(
                'schema_version' => 'prices_v3',
                'pricing_version' => 'fallback',
                'currency' => 'PLN',
                'vat_rate' => 0.08,
                'pump' => array(
                    'by_power_kw' => array(
                        '3' => array('split_net' => 12200, 'aio_premium_net' => 17500),
                        '5' => array('split_net' => 12700, 'aio_premium_net' => 18000),
                        '7' => array('split_net' => 13500, 'aio_premium_net' => 18900),
                        '9' => array('split_net' => 14700, 'split400_net' => 15500, 'aio_premium_net' => 20000, 'aio_premium400_net' => 22800),
                        '12' => array('split400_net' => 17650, 'aio_premium400_net' => 24100),
                        '16' => array('split400_net' => 21000, 'aio_premium400_net' => 25750),
                    ),
                ),
                'cwu' => array(
                    'emalia' => array('150' => 2250, '200' => 2750, '300' => 3000),
                    'inox' => array('150' => 0, '200' => 3200, '250' => 3600, '300' => 4100),
                ),
                'buffer' => array(
                    '50' => array('sprzeglo' => 1250, 'na_powrocie' => 650),
                    '80' => array('sprzeglo' => 1300, 'na_powrocie' => 700),
                    '100' => array('sprzeglo' => 1750, 'na_powrocie' => 1150),
                    '120' => array('sprzeglo' => 1900, 'na_powrocie' => 1250),
                    '150' => array('sprzeglo' => 2050, 'na_powrocie' => 1400),
                    '200' => array('sprzeglo' => 2150, 'na_powrocie' => 1500),
                    '300' => array('sprzeglo' => 2450, 'na_powrocie' => 1800),
                    '400' => array('sprzeglo' => 2850, 'na_powrocie' => 2200),
                    '500' => array('sprzeglo' => 3050, 'na_powrocie' => 2400),
                ),
                'foundation' => array(
                    'fundament-nasz' => 300,
                    'fundament-klienta' => 0,
                    'stojak' => 600,
                ),
                'drainage' => array(
                    'skropliny-z-grzalka' => 1000,
                    'bez' => 0,
                ),
                'water' => array(
                    'filters' => array(
                        'filtry-zmiekczacz' => 4500,
                        'filtry-podstawowe' => 200,
                        'bez-filtrow' => 0,
                    ),
                    'pressure' => array(
                        'z-reduktorem-cisnienia' => 400,
                        'bez-reduktora' => 0,
                    ),
                ),
                'options' => array(
                    'service-cloud' => 0,
                    'cyrkulacja-tak' => 350,
                    'cyrkulacja-nie' => 0,
                    'magnetic_filter_standard' => 0,
                    'magnetic_filter_premium' => 1200,
                    'hydro_safety_standard' => 0,
                    'hydro_safety_extended' => 1500,
                    'flushing_standard' => 800,
                    'flushing_premium' => 1200,
                    'electrical_standard' => 0,
                ),
                'hydraulic_components_aio' => 2700,
                'hydraulic_components_split' => 3700,
                'installation_net' => 11000,
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
    }
}
