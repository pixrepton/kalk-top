<?php

if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists('TopInstal_PlaceholderBuilder_Service')) {
    class TopInstal_PlaceholderBuilder_Service {
        /**
         * @param string $tank_label
         * @param string $tank_manufacturer
         * @param string $fallback_capacity_text
         * @return string
         */
        private function build_cwu_placeholder($tank_label, $tank_manufacturer, $fallback_capacity_text) {
            $tank_label = trim((string) $tank_label);
            $tank_manufacturer = trim((string) $tank_manufacturer);
            $fallback_capacity_text = trim((string) $fallback_capacity_text);

            if ($tank_label === '') {
                return $fallback_capacity_text;
            }

            if ($tank_manufacturer !== '') {
                $quoted_manufacturer = preg_quote($tank_manufacturer, '/');
                $without_manufacturer = preg_replace(
                    '/^' . $quoted_manufacturer . '\s*/iu',
                    '',
                    $tank_label
                );
                $without_manufacturer = trim((string) $without_manufacturer);
                if ($without_manufacturer !== '') {
                    return $without_manufacturer;
                }
            }

            return $tank_label;
        }

        /**
         * @param array<string,mixed> $input
         * @param array<string,mixed>|null $kit_info
         * @return array<string,string>
         */
        public function build($input, $kit_info) {
            $installation_type = isset($input['installationType']) ? (string) $input['installationType'] : 'heat_pump';

            if ($installation_type === 'floor_heating') {
                $floor_area = isset($input['floorArea']) && is_numeric($input['floorArea']) ? (int) $input['floorArea'] : 100;
                $heating_type = isset($input['heatingType']) ? (string) $input['heatingType'] : 'water';
                $building_type = isset($input['buildingType']) ? (string) $input['buildingType'] : 'house';
                $gross = isset($input['customPriceFloorGross']) && is_numeric($input['customPriceFloorGross'])
                    ? (int) $input['customPriceFloorGross']
                    : 15000;

                return array(
                    'MOC' => 'Podlogowka',
                    'KIT' => 'Instalacja podlogowa',
                    'INDOOR' => 'System podlogowy',
                    'OUTDOOR' => 'Instalacja wodna/elektryczna',
                    'CWU' => 'Podlogowka ' . $floor_area . ' m2',
                    'TANK' => ucfirst($heating_type) . ' - ' . ucfirst($building_type),
                    'BFR' => 'System ' . $heating_type,
                    'PRC' => number_format($gross, 0, ',', ' '),
                );
            }

            $kit_info = is_array($kit_info) ? $kit_info : array();
            $kit_model = isset($input['kitModel']) ? (string) $input['kitModel'] : '';
            $power_kw = isset($input['powerKw']) && is_numeric($input['powerKw']) ? (int) $input['powerKw'] : null;
            if ($power_kw === null && isset($kit_info['power']) && preg_match('/(\d+)/', (string) $kit_info['power'], $m)) {
                $power_kw = (int) $m[1];
            }
            if ($power_kw === null) {
                $power_kw = 7;
            }

            $tank_capacity = isset($input['tankCapacity']) ? (string) $input['tankCapacity'] : 'none';
            $tank_manufacturer = isset($input['tankManufacturer']) ? trim((string) $input['tankManufacturer']) : '';
            $tank_label = isset($input['tankLabel']) ? trim((string) $input['tankLabel']) : '';
            $buffer_capacity = isset($input['bufferCapacity']) ? (string) $input['bufferCapacity'] : 'none';
            $buffer_label = isset($input['bufferLabel']) ? trim((string) $input['bufferLabel']) : '';
            $tank_enabled = !empty($input['tankEnabled']);
            $gross = isset($input['customPriceGross']) && is_numeric($input['customPriceGross'])
                ? (int) $input['customPriceGross']
                : 41000;

            $tank_map = array(
                'none' => 'BRAK - BEZ CWU',
                '150' => '150 litrow',
                '200' => '200 litrow',
                '250' => '250 litrow',
                '300' => '300 litrow',
                '400' => '400 litrow',
                '185-aio' => 'ALL-IN-ONE 185 litrow',
                '260-aio' => 'ALL-IN-ONE 260 litrow',
                '260-tcap' => 'ALL-IN-ONE 260 litrow',
            );
            $tank_capacity_text = isset($tank_map[$tank_capacity]) ? $tank_map[$tank_capacity] : 'BRAK - BEZ CWU';
            $cwu_info = $tank_enabled
                ? $this->build_cwu_placeholder($tank_label, $tank_manufacturer, $tank_capacity_text)
                : 'Bez c.w.u.';
            $buffer_info = ($buffer_capacity === 'none' || $buffer_capacity === '')
                ? 'brak - nie rekomendowany'
                : ($buffer_label !== '' ? $buffer_label : ($buffer_capacity . ' litrow'));

            return array(
                'MOC' => (string) $power_kw,
                'KIT' => $kit_model,
                'INDOOR' => isset($kit_info['indoor_unit']) ? (string) $kit_info['indoor_unit'] : 'WH-SDC09K3E8',
                'OUTDOOR' => isset($kit_info['outdoor_unit']) ? (string) $kit_info['outdoor_unit'] : 'WH-UDZ09KE8',
                'CWU' => $cwu_info,
                'TANK' => $tank_manufacturer,
                'BFR' => $buffer_info,
                'PRC' => number_format($gross, 0, ',', ' '),
            );
        }
    }
}
