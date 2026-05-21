<?php

if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists('TopInstal_LeadEnergyProfilePresenter')) {
    /**
     * Human-readable "Profil Energetyczny Budynku" for WP Admin lead detail view.
     */
    class TopInstal_LeadEnergyProfilePresenter {
        /**
         * @param mixed $building_profile_json
         * @return array<int,array{label:string,value:string}>
         */
        public static function build_rows($building_profile_json) {
            $state = self::decode_profile($building_profile_json);
            if ($state === null) {
                return array();
            }

            $rows = array();
            $peak_kw = self::read_scalar($state, array('ozc_peak_kw', 'max_heating_power', 'recommended_power_kw'));
            if ($peak_kw === null && isset($state['engineering']['ozc']['designHeatLoss_kW'])) {
                $peak_kw = $state['engineering']['ozc']['designHeatLoss_kW'];
            }

            $rows[] = self::row('Metraż', self::format_area($state));
            $rows[] = self::row('Rok budowy', self::read_scalar($state, array('construction_year')));
            $rows[] = self::row('Typ budynku', self::label_map('building_type', self::read_scalar($state, array('building_type'))));
            $rows[] = self::row('Rodzaj konstrukcji', self::label_map('construction_type', self::read_scalar($state, array('construction_type'))));
            $rows[] = self::row('Izolacja ścian', self::label_map('insulation_level', self::read_scalar($state, array('walls_insulation_level'))));
            $rows[] = self::row('Izolacja dachu', self::label_map('insulation_level', self::read_scalar($state, array('roof_insulation_level'))));
            $rows[] = self::row('Izolacja podłogi', self::label_map('insulation_level', self::read_scalar($state, array('floor_insulation_level'))));
            $rows[] = self::row('Typ okien', self::label_map('windows_type', self::read_scalar($state, array('windows_type'))));
            $rows[] = self::row('Typ drzwi', self::label_map('doors_type', self::read_scalar($state, array('doors_type'))));
            $rows[] = self::row('Wentylacja / rekuperacja', self::label_map('ventilation_type', self::read_scalar($state, array('ventilation_type'))));
            $rows[] = self::row('Ogrzewanie', self::label_map('heating_type', self::read_scalar($state, array('heating_type'))));
            $rows[] = self::row('CWU', self::label_map('include_hot_water', self::read_scalar($state, array('include_hot_water'))));
            $rows[] = self::row('Moc szczytowa (kW)', self::format_kw($peak_kw));

            return array_values(array_filter($rows, function ($row) {
                return isset($row['value']) && $row['value'] !== '' && $row['value'] !== '—';
            }));
        }

        /**
         * @param mixed $building_profile_json
         * @return array<string,mixed>|null
         */
        private static function decode_profile($building_profile_json) {
            if (is_array($building_profile_json)) {
                return $building_profile_json;
            }
            if (!is_string($building_profile_json) || trim($building_profile_json) === '') {
                return null;
            }
            try {
                $decoded = json_decode($building_profile_json, true, 512, JSON_THROW_ON_ERROR);
            } catch (Throwable $exception) {
                return null;
            }
            if (!is_array($decoded)) {
                return null;
            }
            if (isset($decoded['form_state']) && is_array($decoded['form_state'])) {
                return $decoded['form_state'];
            }
            return $decoded;
        }

        /**
         * @param array<string,mixed> $state
         * @return string
         */
        private static function format_area($state) {
            $floor_area = self::read_scalar($state, array('floor_area'));
            if ($floor_area !== null) {
                return $floor_area . ' m²';
            }
            $length = self::read_scalar($state, array('building_length'));
            $width = self::read_scalar($state, array('building_width'));
            if ($length !== null && $width !== null && is_numeric($length) && is_numeric($width)) {
                $area = (float) $length * (float) $width;
                if ($area > 0) {
                    return number_format($area, 1, ',', ' ') . ' m² (L × W)';
                }
            }
            return '';
        }

        /**
         * @param mixed $kw
         * @return string
         */
        private static function format_kw($kw) {
            if ($kw === null || $kw === '') {
                return '';
            }
            if (!is_numeric($kw)) {
                return (string) $kw;
            }
            return number_format((float) $kw, 2, ',', ' ') . ' kW';
        }

        /**
         * @param array<string,mixed> $state
         * @param string[] $keys
         * @return string|null
         */
        private static function read_scalar($state, $keys) {
            foreach ($keys as $key) {
                if (!isset($state[$key])) {
                    continue;
                }
                $value = $state[$key];
                if (is_array($value)) {
                    continue;
                }
                $string = trim((string) $value);
                if ($string !== '' && $string !== 'undefined' && $string !== 'null') {
                    return $string;
                }
            }
            return null;
        }

        /**
         * @param string $label
         * @param string|null $value
         * @return array{label:string,value:string}
         */
        private static function row($label, $value) {
            return array(
                'label' => $label,
                'value' => $value !== null && $value !== '' ? (string) $value : '—',
            );
        }

        /**
         * @param string $field
         * @param string|null $raw
         * @return string
         */
        private static function label_map($field, $raw) {
            if ($raw === null || $raw === '') {
                return '';
            }
            $key = strtolower(trim((string) $raw));

            $maps = array(
                'building_type' => array(
                    'single_house' => 'Dom jednorodzinny',
                    'apartment' => 'Mieszkanie',
                    'row_house' => 'Szeregowiec',
                ),
                'construction_type' => array(
                    'traditional' => 'Tradycyjna',
                    'canadian' => 'Kanadyjska (szkieletowa)',
                ),
                'insulation_level' => array(
                    'none' => 'Brak / słaba',
                    'weak' => 'Słaba',
                    'medium' => 'Średnia',
                    'good' => 'Dobra',
                    'very_good' => 'Bardzo dobra',
                ),
                'windows_type' => array(
                    'old_single_glass' => 'Stare pojedyncze',
                    'old_double_glass' => 'Stare podwójne',
                    'new_double_glass' => 'Nowe podwójne',
                    'new_triple_glass' => 'Nowe potrójne',
                ),
                'doors_type' => array(
                    'old_wood' => 'Stare drewniane',
                    'old_pvc' => 'Stare PVC',
                    'new_pvc' => 'Nowe PVC',
                    'new_aluminium' => 'Nowe aluminiowe',
                ),
                'ventilation_type' => array(
                    'natural' => 'Naturalna',
                    'mechanical' => 'Mechaniczna',
                    'mechanical_recovery' => 'Rekuperacja',
                ),
                'heating_type' => array(
                    'underfloor' => 'Podłogowe',
                    'radiators' => 'Grzejniki',
                    'radiators_ht' => 'Grzejniki HT',
                    'radiators_lt' => 'Grzejniki LT',
                    'mixed' => 'Mieszane',
                ),
                'include_hot_water' => array(
                    'yes' => 'Tak',
                    'no' => 'Nie',
                ),
            );

            if (isset($maps[$field][$key])) {
                return $maps[$field][$key];
            }
            return (string) $raw;
        }
    }
}
