<?php

if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists('TopInstal_KitsRepository_Wp')) {
    class TopInstal_KitsRepository_Wp {
        /** @var string */
        private $kits_file;

        /**
         * @param string|null $kits_file
         */
        public function __construct($kits_file = null) {
            if (is_string($kits_file) && trim($kits_file) !== '') {
                $this->kits_file = trim($kits_file);
            } else {
                $this->kits_file = rtrim((string) TOP_INSTAL_PLUGIN_PATH, '/\\') . '/kits.json';
            }
        }

        /**
         * @return array<string,mixed>
         */
        public function get_all() {
            if (!is_file($this->kits_file)) {
                return array();
            }

            $cache_key = 'top_instal_kits_' . md5($this->kits_file . '|' . (string) @filemtime($this->kits_file));
            $cached = function_exists('wp_cache_get') ? wp_cache_get($cache_key) : false;
            if (is_array($cached)) {
                return $cached;
            }

            $decoded = json_decode((string) @file_get_contents($this->kits_file), true);
            if (!is_array($decoded)) {
                return array();
            }

            if (function_exists('wp_cache_set')) {
                wp_cache_set($cache_key, $decoded, '', 3600);
            }
            return $decoded;
        }

        /**
         * @param string $kit_model
         * @return array{kit:array<string,mixed>|null,group:string}
         */
        public function find_kit($kit_model) {
            $kit_model = trim((string) $kit_model);
            if ($kit_model === '') {
                return array('kit' => null, 'group' => '');
            }

            $all = $this->get_all();
            foreach ($all as $group => $group_data) {
                if (!is_array($group_data)) {
                    continue;
                }
                if (isset($group_data[$kit_model]) && is_array($group_data[$kit_model])) {
                    return array(
                        'kit' => $group_data[$kit_model],
                        'group' => (string) $group,
                    );
                }
            }
            return array('kit' => null, 'group' => '');
        }

        /**
         * @param string $power_type
         * @param string $tank_capacity
         * @param int|null $power_kw
         * @return array<string,mixed>
         */
        public function get_for_filters($power_type, $tank_capacity, $power_kw = null) {
            $all = $this->get_all();
            if (empty($all)) {
                return array();
            }

            $data_key = '';
            $merge_aio_260 = false;
            $merge_aio_185 = false;

            if ($tank_capacity === 'none') {
                $data_key = 'all';
            } elseif ($tank_capacity === '185-aio') {
                $merge_aio_185 = true;
                $data_key = 'all_in_one_185';
            } elseif ($tank_capacity === '260-aio' || $tank_capacity === '260-tcap') {
                $merge_aio_260 = true;
                $data_key = 'all_in_one_260';
            } elseif (in_array($tank_capacity, array('150', '200', '250', '300', '400'), true)) {
                $data_key = 'all';
            } elseif ($power_type === 'all') {
                $data_key = 'all';
            } else {
                $data_key = (string) $power_type;
            }

            $result = array();
            if ($merge_aio_260) {
                $result = array_merge(
                    isset($all['all_in_one_260']) && is_array($all['all_in_one_260']) ? $all['all_in_one_260'] : array(),
                    isset($all['tcap_aio_260']) && is_array($all['tcap_aio_260']) ? $all['tcap_aio_260'] : array()
                );
            } elseif ($merge_aio_185) {
                $result = array_merge(
                    isset($all['all_in_one_185']) && is_array($all['all_in_one_185']) ? $all['all_in_one_185'] : array(),
                    isset($all['tcap_aio_185']) && is_array($all['tcap_aio_185']) ? $all['tcap_aio_185'] : array(),
                    isset($all['all_in_one_2strefowy']) && is_array($all['all_in_one_2strefowy']) ? $all['all_in_one_2strefowy'] : array()
                );
            } elseif ($data_key === 'all') {
                foreach ($all as $group_data) {
                    if (is_array($group_data)) {
                        $result = array_merge($result, $group_data);
                    }
                }
            } elseif (isset($all[$data_key]) && is_array($all[$data_key])) {
                $result = $all[$data_key];
            }

            if (is_int($power_kw) && $power_kw > 0) {
                $result = array_filter($result, function ($kit) use ($power_kw) {
                    if (!is_array($kit) || empty($kit['power'])) {
                        return true;
                    }
                    if (preg_match('/(\d+)/', (string) $kit['power'], $m)) {
                        return ((int) $m[1]) === $power_kw;
                    }
                    return true;
                });
            }

            if ($tank_capacity === 'none' || in_array($tank_capacity, array('150', '200', '250', '300', '400'), true)) {
                $result = array_filter($result, function ($key) {
                    return !preg_match('/^KIT-(ADC|AXC)/', (string) $key);
                }, ARRAY_FILTER_USE_KEY);
            } elseif (in_array($tank_capacity, array('185-aio', '260-aio', '260-tcap'), true)) {
                $result = array_filter($result, function ($key) {
                    return (bool) preg_match('/^KIT-(ADC|AXC)/', (string) $key);
                }, ARRAY_FILTER_USE_KEY);
            }

            return $result;
        }
    }
}

