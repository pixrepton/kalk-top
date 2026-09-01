<?php

if (!class_exists('TopInstal_OzcEngine')) {
    class TopInstal_OzcEngine {
        private const DEFAULTS = array(
            'fallback' => array(
                'U_wall' => 0.70,
                'U_roof' => 0.50,
                'U_floor' => 0.60,
                'U_window' => 2.0,
                'U_door' => 2.5,
                'window_area_per_piece_m2' => 1.95,
                'huge_window_area_m2' => 9.0,
                'door_area_m2' => 1.9,
                'balcony_door_area_m2' => 2.3,
                'roof_area_factor' => array('flat' => 1.05, 'oblique' => 1.15, 'steep' => 1.25),
            ),
            'uninsulated' => array('U_roof' => 1.2, 'U_floor' => 0.9),
            'corrections' => array('thermalBridgesMultiplier' => 1.1),
            'attic' => array(
                'volumeMultiplier' => 0.72,
                'heatedAreaMultiplier' => 0.88,
                'extraTotalAreaBruttoFactor' => 0.30,
            ),
            'annualEnergy' => array(
                'utilizationFactor' => 0.72,
            ),
        );

        private const WINDOWS = array(
            'old_single_glass' => 2.8,
            'old_double_glass' => 2.5,
            'semi_new_double_glass' => 2.0,
            'new_double_glass' => 1.3,
            'new_triple_glass' => 0.9,
            '2021_double_glass' => 1.0,
            '2021_triple_glass' => 0.8,
        );

        private const DOORS = array(
            'old_wooden' => 3.0,
            'old_metal' => 3.5,
            'new_wooden' => 1.8,
            'new_metal' => 1.5,
            'new_pvc' => 1.3,
        );

        private const VENTILATION = array(
            'natural' => array('ach' => 0.8, 'eta_rec' => 0.0),
            'gravity' => array('ach' => 0.9, 'eta_rec' => 0.0),
            'mechanical' => array('ach' => 0.6, 'eta_rec' => 0.0),
            'mechanical_recovery' => array('ach' => 0.6, 'eta_rec' => 0.85),
        );

        private const MATERIALS = array(
            '57' => array('lambda' => 0.25),
            '68' => array('lambda' => 0.04),
            '88' => array('lambda' => 0.036),
            '89' => array('lambda' => 0.034),
            '90' => array('lambda' => 0.025),
            '101' => array('lambda' => 0.70),
            '102' => array('lambda' => 1.70),
        );

        private const CLIMATE_ZONES_NORM = array(
            'PL_I' => array('theta_e' => -16, 'theta_m_e' => 7.5),
            'PL_II' => array('theta_e' => -18, 'theta_m_e' => 7.0),
            'PL_III' => array('theta_e' => -20, 'theta_m_e' => 7.0),
            'PL_IV' => array('theta_e' => -22, 'theta_m_e' => 6.0),
            'PL_V' => array('theta_e' => -24, 'theta_m_e' => 5.0),
        );

        private const CLIMATE_MODEL_ENERGY = array(
            'PL_I' => array('theta_avg_season' => 2.5),
            'PL_II' => array('theta_avg_season' => 2.0),
            'PL_III' => array('theta_avg_season' => 1.9),
            'PL_IV' => array('theta_avg_season' => 1.5),
            'PL_V' => array('theta_avg_season' => 0.5),
        );

        private const CLIMATE_HDD = array('PL_I' => 2800, 'PL_II' => 3200, 'PL_III' => 3600, 'PL_IV' => 4000, 'PL_V' => 4400);

        private const CLIMATE_LOCATION_ZONE_MAP = array(
            'PL_I' => 'PL_I',
            'PL_II' => 'PL_II',
            'PL_III' => 'PL_III',
            'PL_IV' => 'PL_IV',
            'PL_V' => 'PL_V',
            'PL_STREFA_I' => 'PL_I',
            'PL_STREFA_II' => 'PL_II',
            'PL_STREFA_III' => 'PL_III',
            'PL_STREFA_IV' => 'PL_IV',
            'PL_STREFA_V' => 'PL_V',
            'PL_GDANSK' => 'PL_I',
            'PL_KUJAWSKOPOMORSKIE_BYDGOSZCZ' => 'PL_II',
            'PL_DOLNOSLASKIE_WROCLAW' => 'PL_III',
            'PL_ZAKOPANE' => 'PL_V',
        );

        private const SURFACE_RESISTANCES = array(
            'wall' => array('Rsi' => 0.13, 'Rse' => 0.04),
            'roof' => array('Rsi' => 0.10, 'Rse' => 0.04),
            'floor' => array('Rsi' => 0.17, 'Rse' => 0.04),
        );

        private const DEFAULT_INDOOR_TEMPERATURE_C = 21.0;
        private const MIN_INDOOR_TEMPERATURE_C = 10.0;
        private const MAX_INDOOR_TEMPERATURE_C = 30.0;

        public function calculate($payload) {
            if (!is_array($payload)) {
                $payload = array();
            }
            return $this->calculateOZCWithExtended($payload);
        }

        public function calculateRaw($payload) {
            if (!is_array($payload)) {
                $payload = array();
            }
            return $this->calculateOZC($payload);
        }

        private function clamp($n, $min, $max) {
            return max((float) $min, min((float) $max, (float) $n));
        }

        private function warnPush(&$arr, $msg) {
            if (!in_array($msg, $arr, true)) {
                $arr[] = $msg;
            }
        }

        private function assumePush(&$arr, $msg) {
            if (!in_array($msg, $arr, true)) {
                $arr[] = $msg;
            }
        }

        private function pushDefaultRecord(&$defaultsUsed, $code, $params = array()) {
            if (!is_array($defaultsUsed) || !is_string($code) || trim($code) === '') {
                return;
            }

            foreach ($defaultsUsed as $item) {
                if (is_array($item) && isset($item['code']) && $item['code'] === $code) {
                    return;
                }
            }

            $defaultsUsed[] = array(
                'code' => trim($code),
                'params' => is_array($params) ? $params : array(),
            );
        }

        private function normalizeWarningRecords($warnings) {
            if (!is_array($warnings)) {
                return array();
            }

            $normalized = array();
            foreach ($warnings as $warning) {
                if (is_string($warning) && trim($warning) !== '') {
                    $normalized[] = array(
                        'code' => 'OZC_WARNING',
                        'message' => trim($warning),
                    );
                } elseif (is_array($warning) && isset($warning['code']) && isset($warning['message'])) {
                    $normalized[] = $warning;
                }
            }

            return $normalized;
        }

        private function normalizeAssumptionRecords($assumptions) {
            if (!is_array($assumptions)) {
                return array();
            }

            $normalized = array();
            foreach ($assumptions as $assumption) {
                if (is_string($assumption) && trim($assumption) !== '') {
                    $normalized[] = array(
                        'code' => 'OZC_ASSUMPTION',
                        'params' => array(
                            'message' => trim($assumption),
                        ),
                    );
                } elseif (is_array($assumption) && isset($assumption['code'])) {
                    $normalized[] = $assumption;
                }
            }

            return $normalized;
        }

        private function sumEnergyLossPercent($losses) {
            if (!is_array($losses) || count($losses) === 0) {
                return null;
            }

            $sum = 0.0;
            foreach ($losses as $item) {
                if (is_array($item) && isset($item['percent']) && is_numeric($item['percent'])) {
                    $sum += (float) $item['percent'];
                }
            }

            return $sum;
        }

        private function buildOzcAudit($formatted, $defaultsUsed = array()) {
            $energyLosses = isset($formatted['extended']['energy_losses']) && is_array($formatted['extended']['energy_losses'])
                ? $formatted['extended']['energy_losses']
                : array();
            $energyLossPercentSum = $this->sumEnergyLossPercent($energyLosses);
            $sanity = array(
                'design_heat_loss_positive' => isset($formatted['max_heating_power']) && is_numeric($formatted['max_heating_power']) && (float) $formatted['max_heating_power'] > 0.0,
                'avg_heating_power_non_negative' => isset($formatted['avg_heating_power']) && is_numeric($formatted['avg_heating_power']) && (float) $formatted['avg_heating_power'] >= 0.0,
                'annual_energy_non_negative' => isset($formatted['annual_energy_consumption']) && is_numeric($formatted['annual_energy_consumption']) && (float) $formatted['annual_energy_consumption'] >= 0.0,
                'heating_power_factor_positive' => isset($formatted['heating_power_factor']) && is_numeric($formatted['heating_power_factor']) && (float) $formatted['heating_power_factor'] > 0.0,
                'energy_losses_balanced' => $energyLossPercentSum === null ? null : abs($energyLossPercentSum - 100.0) <= 0.25,
            );

            return array(
                'version' => 'ozc_audit_v1',
                'defaults_used' => is_array($defaultsUsed) ? $defaultsUsed : array(),
                'methods' => array(
                    'design_heat_loss' => array('method' => 'pn_en_12831_block_v1', 'canonical' => true),
                    'annual_energy' => array('method' => 'heuristic_hdd_v1', 'canonical' => false, 'classification' => 'estimate'),
                    'energy_losses' => array('method' => 'physical_balance_v1', 'canonical' => false, 'classification' => 'explainability'),
                    'bivalent_points' => array('method' => 'heuristic_bivalent_v1', 'canonical' => false, 'classification' => 'advisory'),
                ),
                'sanity' => $sanity,
                'energy_losses_percent_sum' => $energyLossPercentSum === null ? null : round($energyLossPercentSum, 2),
            );
        }

        private function buildValidationWarnings($formatted, $audit) {
            $warnings = array();

            if (!(isset($audit['sanity']['design_heat_loss_positive']) && $audit['sanity']['design_heat_loss_positive'] === true)) {
                $warnings[] = array(
                    'code' => 'OZC_INVALID_DESIGN_LOAD',
                    'message' => 'Formatted OZC result failed validation: design load must be positive.',
                );
            }

            if (!(isset($audit['sanity']['avg_heating_power_non_negative']) && $audit['sanity']['avg_heating_power_non_negative'] === true)) {
                $warnings[] = array(
                    'code' => 'OZC_INVALID_AVG_HEATING_POWER',
                    'message' => 'Formatted OZC result failed validation: avg_heating_power must be non-negative.',
                );
            }

            if (!(isset($audit['sanity']['annual_energy_non_negative']) && $audit['sanity']['annual_energy_non_negative'] === true)) {
                $warnings[] = array(
                    'code' => 'OZC_INVALID_ANNUAL_ENERGY',
                    'message' => 'Formatted OZC result failed validation: annual_energy_consumption must be non-negative.',
                );
            }

            if (!(isset($audit['sanity']['heating_power_factor_positive']) && $audit['sanity']['heating_power_factor_positive'] === true)) {
                $warnings[] = array(
                    'code' => 'OZC_INVALID_HEATING_POWER_FACTOR',
                    'message' => 'Formatted OZC result failed validation: heating_power_factor must be positive.',
                );
            }

            if (isset($audit['sanity']['energy_losses_balanced']) && $audit['sanity']['energy_losses_balanced'] === false) {
                $warnings[] = array(
                    'code' => 'OZC_ENERGY_LOSSES_UNBALANCED',
                    'message' => 'energy_losses sum to ' . (isset($audit['energy_losses_percent_sum']) ? $audit['energy_losses_percent_sum'] : 'n/a') . '% instead of 100%.',
                );
            }

            return $warnings;
        }

        private function normalizeIsolationField($field) {
            if (!is_array($field)) {
                return array('material' => null, 'size' => 0);
            }
            $mat = isset($field['material']) && is_numeric($field['material']) ? (float) $field['material'] : null;
            $size = isset($field['size']) && is_numeric($field['size']) ? (float) $field['size'] : null;
            if ($mat !== null && $size !== null && $size > 0) {
                return array('material' => $mat, 'size' => $size);
            }
            return array('material' => null, 'size' => 0);
        }

        private function getHeatedFloorsCount($p) {
            if (isset($p['building_heated_floors']) && is_array($p['building_heated_floors']) && count($p['building_heated_floors']) > 0) {
                return count($p['building_heated_floors']);
            }
            if (isset($p['building_floors']) && is_numeric($p['building_floors']) && (float) $p['building_floors'] > 0) {
                return (int) $p['building_floors'];
            }
            return 1;
        }

        /**
         * Poddasze: tylko dach "Skośny / Z poddaszem" (steep) + jawny checkbox Poddasze
         * lub ogrzewane ostatnie pełne piętro budynku. "Skośny niski / Bez poddasza" (oblique) — bez korekty.
         *
         * @param array<string,mixed> $p
         * @return array{applyOnLastHeatedFloor:bool,addExtraTotalArea:bool}
         */
        private function resolveAtticHeatingContext($p) {
            $roof = (isset($p['building_roof']) && is_string($p['building_roof'])) ? $p['building_roof'] : '';
            if ($roof !== 'steep') {
                return array('applyOnLastHeatedFloor' => false, 'addExtraTotalArea' => false);
            }

            $buildingFloors = (isset($p['building_floors']) && is_numeric($p['building_floors'])) ? (int) $p['building_floors'] : 1;
            $heated = array();
            if (isset($p['building_heated_floors']) && is_array($p['building_heated_floors'])) {
                foreach ($p['building_heated_floors'] as $floorValue) {
                    if (is_numeric($floorValue)) {
                        $heated[] = (int) $floorValue;
                    }
                }
            }
            if (count($heated) === 0) {
                return array('applyOnLastHeatedFloor' => false, 'addExtraTotalArea' => false);
            }

            $maxFloor = max($heated);
            $atticFloorValue = $buildingFloors + 1;
            $explicitAttic = in_array($atticFloorValue, $heated, true);
            if ($explicitAttic) {
                return array(
                    'applyOnLastHeatedFloor' => $maxFloor === $atticFloorValue,
                    'addExtraTotalArea' => true,
                );
            }

            if ($maxFloor !== $buildingFloors) {
                return array('applyOnLastHeatedFloor' => false, 'addExtraTotalArea' => false);
            }

            return array('applyOnLastHeatedFloor' => false, 'addExtraTotalArea' => false);
        }

        /**
         * @param array<string,mixed> $p
         */
        private function hasHeatedBasementFloor($p) {
            if (!isset($p['building_heated_floors']) || !is_array($p['building_heated_floors'])) {
                return false;
            }
            foreach ($p['building_heated_floors'] as $floorValue) {
                if (is_numeric($floorValue) && (int) $floorValue === 0) {
                    return true;
                }
            }
            return false;
        }

        /**
         * Piwnica w budynku, ale nieogrzewana (brak checkboxa „Piwnica” w kondygnacjach).
         *
         * @param array<string,mixed> $p
         */
        private function hasUnheatedBasementUnderHeatedFloor($p) {
            if (empty($p['has_basement'])) {
                return false;
            }
            return !$this->hasHeatedBasementFloor($p);
        }

        private function resolveClimateZoneKey($location_id) {
            if (!is_string($location_id) || trim($location_id) === '') {
                return 'PL_III';
            }

            $value = strtoupper(trim($location_id));
            if (isset(self::CLIMATE_LOCATION_ZONE_MAP[$value])) {
                return self::CLIMATE_LOCATION_ZONE_MAP[$value];
            }

            return 'PL_III';
        }

        private function resolveClimate($payload, &$assumptions = null, &$warnings = null) {
            $locationId = isset($payload['location_id']) && is_string($payload['location_id']) && trim($payload['location_id']) !== ''
                ? (string) $payload['location_id']
                : 'PL_STREFA_III';

            $zoneKey = $this->resolveClimateZoneKey($locationId);
            $normData = isset(self::CLIMATE_ZONES_NORM[$zoneKey]) ? self::CLIMATE_ZONES_NORM[$zoneKey] : self::CLIMATE_ZONES_NORM['PL_III'];
            $theta_e = (float) $normData['theta_e'];
            $theta_m_e = (float) $normData['theta_m_e'];
            $theta_ground = $this->clamp($theta_m_e + 1.0, 4.0, 9.0);

            $energyData = isset(self::CLIMATE_MODEL_ENERGY[$zoneKey]) ? self::CLIMATE_MODEL_ENERGY[$zoneKey] : self::CLIMATE_MODEL_ENERGY['PL_III'];
            $theta_avg_season = (float) $energyData['theta_avg_season'];

            if (is_array($assumptions)) {
                $this->assumePush($assumptions, 'climate zone: ' . $zoneKey . ' (from location_id=' . $locationId . '), theta_e=' . $theta_e . 'C, theta_ground=' . round($theta_ground, 1) . 'C, theta_avg_season=' . $theta_avg_season . 'C');
            }

            return array(
                'zoneKey' => $zoneKey,
                'theta_e' => $theta_e,
                'theta_m_e' => $theta_m_e,
                'theta_ground' => $theta_ground,
                'theta_avg_season' => $theta_avg_season,
            );
        }

        private function computeGeometry($p, &$warnings, &$assumptions) {
            $A_brutto = array_key_exists('floor_area', $p) ? $p['floor_area'] : null;
            $length_brutto = array_key_exists('building_length', $p) ? $p['building_length'] : null;
            $width_brutto = array_key_exists('building_width', $p) ? $p['building_width'] : null;

            if (!$A_brutto) {
                if ($length_brutto && $width_brutto) {
                    $A_brutto = (float) $length_brutto * (float) $width_brutto;
                    $this->assumePush($assumptions, 'floor_area computed from building_length * building_width (brutto)');
                } else {
                    $this->warnPush($warnings, 'Missing floor_area; fallback floor_area=100');
                    $A_brutto = 100;
                    $this->assumePush($assumptions, 'fallback floor_area=100');
                }
            } else {
                if (!$length_brutto || !$width_brutto) {
                    $this->assumePush($assumptions, 'floor_area treated as provided brutto value (no explicit length/width)');
                }
            }

            $length_netto = $length_brutto;
            $width_netto = $width_brutto;
            $A_netto = (float) $A_brutto;

            $wall_thickness_m = (isset($p['wall_size']) && $p['wall_size']) ? ((float) $p['wall_size'] / 100.0) : 0.0;

            if ($wall_thickness_m > 0 && $length_brutto && $width_brutto) {
                $length_netto = (float) $length_brutto - 2 * $wall_thickness_m;
                $width_netto = (float) $width_brutto - 2 * $wall_thickness_m;
                $A_netto = $length_netto * $width_netto;
                $this->assumePush($assumptions, 'Powierzchnia skorygowana o grubosc scian zewnetrznych (' . $p['wall_size'] . ' cm)');
            } elseif ($wall_thickness_m > 0 && $A_brutto && (!$length_brutto || !$width_brutto)) {
                $side_brutto = sqrt((float) $A_brutto);
                $length_brutto = $side_brutto;
                $width_brutto = $side_brutto;
                $length_netto = $length_brutto - 2 * $wall_thickness_m;
                $width_netto = $width_brutto - 2 * $wall_thickness_m;
                $A_netto = $length_netto * $width_netto;
                $this->assumePush($assumptions, 'Powierzchnia netto oszacowana z floor_area (brutto) i wall_size przy zalozeniu ksztaltu zblizonego do kwadratu');
            }

            $P = array_key_exists('floor_perimeter', $p) ? $p['floor_perimeter'] : null;
            if (!$P) {
                if ($length_netto && $width_netto) {
                    $P = 2 * ($length_netto + $width_netto);
                    $this->assumePush($assumptions, 'floor_perimeter computed from netto length & width');
                } elseif ((isset($p['building_shape']) ? $p['building_shape'] : null) === 'irregular' && isset($p['floor_perimeter']) && $p['floor_perimeter']) {
                    if ($wall_thickness_m > 0) {
                        $P = (float) $p['floor_perimeter'] - 8 * $wall_thickness_m;
                        $this->assumePush($assumptions, 'floor_perimeter skorygowany o grubosc scian (irregular shape)');
                    } else {
                        $P = (float) $p['floor_perimeter'];
                        $this->assumePush($assumptions, 'floor_perimeter z payloadu (irregular shape)');
                    }
                } else {
                    $ratio = 1.3;
                    $width_netto = sqrt($A_netto / $ratio);
                    $length_netto = $A_netto / $width_netto;
                    $P = 2 * ($length_netto + $width_netto);
                    $this->warnPush($warnings, 'Missing floor_perimeter; approximated rectangle');
                    $this->assumePush($assumptions, 'rectangle approximation used');
                }
            } else {
                if ($wall_thickness_m > 0) {
                    $P = (float) $P - 8 * $wall_thickness_m;
                    $this->assumePush($assumptions, 'Obwod skorygowany o grubosc scian');
                }
            }

            $heatedFloorsCount = $this->getHeatedFloorsCount($p);
            $h = isset($p['floor_height']) && is_numeric($p['floor_height']) ? (float) $p['floor_height'] : 2.6;
            $building_roof = isset($p['building_roof']) && is_string($p['building_roof']) ? $p['building_roof'] : 'oblique';

            $atticCtx = $this->resolveAtticHeatingContext($p);
            $atticVolumeMult = (float) self::DEFAULTS['attic']['volumeMultiplier'];

            $totalVolume = 0.0;
            for ($i = 0; $i < $heatedFloorsCount; $i++) {
                $isAttic = $atticCtx['applyOnLastHeatedFloor'] && $i === ($heatedFloorsCount - 1);
                $heightMultiplier = $isAttic ? $atticVolumeMult : 1.0;
                $totalVolume += $A_netto * $h * $heightMultiplier;
                if ($isAttic) {
                    $this->assumePush(
                        $assumptions,
                        'Poddasze (dach skosny z poddaszem): kubatura skorygowana wspolczynnikiem ' . $atticVolumeMult
                    );
                }
            }

            $denomB = 0.5 * (float) $P;
            $Bprime = $denomB > 0 ? ($A_netto / $denomB) : 0;
            $rf = isset(self::DEFAULTS['fallback']['roof_area_factor'][$building_roof]) ? (float) self::DEFAULTS['fallback']['roof_area_factor'][$building_roof] : 1.15;
            $roofArea = $A_netto * $rf;

            return array(
                'floorArea' => $A_netto,
                'floorAreaBrutto' => (float) $A_brutto,
                'perimeter' => (float) $P,
                'length' => $length_netto ? (float) $length_netto : (float) $length_brutto,
                'width' => $width_netto ? (float) $width_netto : (float) $width_brutto,
                'volume' => $totalVolume,
                'Bprime' => $Bprime,
                'roofArea' => $roofArea,
            );
        }

        private function computeEffectiveWallArea($p, $perimeter, $floorHeight, &$warnings, &$assumptions, $geo = null) {
            $buildingType = isset($p['building_type']) ? (string) $p['building_type'] : 'single_house';
            $heatedFloorsCount = (is_array($geo) && isset($geo['heatedFloorsCount'])) ? (int) $geo['heatedFloorsCount'] : $this->getHeatedFloorsCount($p);
            $effectivePerimeter = (is_array($geo) && isset($geo['perimeter'])) ? (float) $geo['perimeter'] : (float) $perimeter;

            $totalWallArea = $effectivePerimeter * (float) $floorHeight * $heatedFloorsCount;
            if ($buildingType === 'single_house') {
                return array('external' => $totalWallArea, 'adjacent' => 0.0);
            }

            if ($buildingType === 'apartment') {
                $verticalWallsArea = $effectivePerimeter * (float) $floorHeight * $heatedFloorsCount;
                $wallAreaPerDirection = $verticalWallsArea / 4.0;
                $externalWallsArea = $verticalWallsArea;
                $adjacentWallsArea = 0.0;

                $directions = array(
                    array('key' => 'whats_north', 'area' => $wallAreaPerDirection, 'label' => 'north'),
                    array('key' => 'whats_south', 'area' => $wallAreaPerDirection, 'label' => 'south'),
                    array('key' => 'whats_east', 'area' => $wallAreaPerDirection, 'label' => 'east'),
                    array('key' => 'whats_west', 'area' => $wallAreaPerDirection, 'label' => 'west'),
                );

                foreach ($directions as $dir) {
                    $neighbor = isset($p[$dir['key']]) ? $p[$dir['key']] : null;
                    if ($neighbor === 'heated_room') {
                        $adjacentWallsArea += $dir['area'];
                        $externalWallsArea -= $dir['area'];
                        $this->assumePush($assumptions, 'Sciana ' . $dir['label'] . ': heated_room adjacency');
                    } elseif ($neighbor === 'unheated_room') {
                        $adjacentWallsArea += $dir['area'] * 0.5;
                        $externalWallsArea -= $dir['area'] * 0.5;
                        $this->assumePush($assumptions, 'Sciana ' . $dir['label'] . ': unheated_room adjacency');
                    }
                }

                if ($adjacentWallsArea > 0) {
                    $this->assumePush($assumptions, 'Apartment: powierzchnia scian zewnetrznych zmniejszona przez sasiedztwo');
                }

                return array('external' => max(0.0, $externalWallsArea), 'adjacent' => $adjacentWallsArea);
            }

            if ($buildingType === 'row_house') {
                $isCorner = isset($p['on_corner']) && $p['on_corner'] === true;
                if ($isCorner) {
                    $externalArea = $totalWallArea * 0.75;
                    return array('external' => $externalArea, 'adjacent' => $totalWallArea - $externalArea);
                }
                $externalArea = $totalWallArea * 0.5;
                return array('external' => $externalArea, 'adjacent' => $totalWallArea - $externalArea);
            }

            if ($buildingType === 'double_house') {
                $externalArea = $totalWallArea * 0.75;
                return array('external' => $externalArea, 'adjacent' => $totalWallArea - $externalArea);
            }

            if ($buildingType === 'multifamily') {
                $externalArea = $totalWallArea * 0.5;
                return array('external' => $externalArea, 'adjacent' => $totalWallArea - $externalArea);
            }

            return array('external' => $totalWallArea, 'adjacent' => 0.0);
        }

        private function computeWallStructureThicknessCm($payload, &$warnings, &$assumptions) {
            $total = isset($payload['wall_size']) && is_numeric($payload['wall_size']) ? (float) $payload['wall_size'] : 0.0;
            $extIso = (isset($payload['external_wall_isolation']['size']) && is_numeric($payload['external_wall_isolation']['size'])) ? (float) $payload['external_wall_isolation']['size'] : 0.0;
            $intIso = (isset($payload['internal_wall_isolation']['size']) && is_numeric($payload['internal_wall_isolation']['size'])) ? (float) $payload['internal_wall_isolation']['size'] : 0.0;
            if (!$total) {
                return 0.0;
            }
            $structure = $total - $extIso - $intIso;
            $constructionType = isset($payload['construction_type']) ? (string) $payload['construction_type'] : 'traditional';
            $min = $constructionType === 'canadian' ? 10.0 : 18.0;
            if ($structure < $min) {
                $this->warnPush($warnings, 'wall_size minus isolation gives structure below minimum; clamped');
                $this->assumePush($assumptions, 'Wall structure thickness clamped to engineering minimum');
                $structure = $min;
            } else {
                $this->assumePush($assumptions, 'Wall structure thickness = total - isolation');
            }
            return $structure;
        }

        private function computeAreas($p, $floorArea, $roofArea, $floorHeight, $perimeter, &$warnings, &$assumptions, $geo = null) {
            if (isset($p['wall_size']) && is_numeric($p['wall_size']) && (float) $p['wall_size'] > 200) {
                $this->warnPush($warnings, 'wall_size looks invalid (too large). Expected cm thickness.');
            }

            $geoForWalls = is_array($geo) ? $geo : array();
            $geoForWalls['heatedFloorsCount'] = $this->getHeatedFloorsCount($p);
            $wallAreas = $this->computeEffectiveWallArea($p, (float) $perimeter, (float) $floorHeight, $warnings, $assumptions, $geoForWalls);
            $A_walls_external = (float) $wallAreas['external'];
            $A_walls_adjacent = isset($wallAreas['adjacent']) ? (float) $wallAreas['adjacent'] : 0.0;
            $A_walls = $A_walls_external;

            $A_window = ((isset($p['number_windows']) && is_numeric($p['number_windows'])) ? (float) $p['number_windows'] : 0.0) * self::DEFAULTS['fallback']['window_area_per_piece_m2'] +
                ((isset($p['number_huge_windows']) && is_numeric($p['number_huge_windows'])) ? (float) $p['number_huge_windows'] : 0.0) * self::DEFAULTS['fallback']['huge_window_area_m2'];

            $A_doors = ((isset($p['number_doors']) && is_numeric($p['number_doors'])) ? (float) $p['number_doors'] : 0.0) * self::DEFAULTS['fallback']['door_area_m2'] +
                ((isset($p['number_balcony_doors']) && is_numeric($p['number_balcony_doors'])) ? (float) $p['number_balcony_doors'] : 0.0) * self::DEFAULTS['fallback']['balcony_door_area_m2'];

            if ((float) $floorArea > 100 &&
                (!isset($p['number_windows']) || (float) $p['number_windows'] === 0.0) &&
                (!isset($p['number_huge_windows']) || (float) $p['number_huge_windows'] === 0.0)
            ) {
                $this->warnPush($warnings, 'Large building with no windows - suspicious input data');
            }

            $openings = $A_window + $A_doors;
            if ($openings > 0 && $A_walls_external > 0) {
                $before = $A_walls_external;
                $A_walls_external = max(0.0, $A_walls_external - $openings);
                $A_walls = $A_walls_external;
                $this->assumePush($assumptions, 'external walls area reduced by openings: ' . round($before, 1) . ' -> ' . round($A_walls_external, 1) . ' m2');
            }

            if (isset($p['garage_type']) && $p['garage_type'] !== 'none') {
                $garageReduction = array('single_unheated' => 0.05, 'single_heated' => 0.05, 'double_unheated' => 0.1, 'double_heated' => 0.1);
                $reduction = isset($garageReduction[$p['garage_type']]) ? (float) $garageReduction[$p['garage_type']] : 0.0;
                if ($reduction > 0) {
                    $A_walls_external *= (1 - $reduction);
                    $A_walls = $A_walls_external;
                    $this->assumePush($assumptions, 'Powierzchnia scian zewnetrznych zmniejszona dla garage_type=' . $p['garage_type']);
                }
            } elseif (isset($p['has_garage']) && $p['has_garage'] === true) {
                $A_walls_external *= 0.95;
                $A_walls = $A_walls_external;
                $this->assumePush($assumptions, 'Powierzchnia scian zewnetrznych zmniejszona o 5% dla has_garage=true');
            }

            return array(
                'walls' => $A_walls,
                'walls_external' => $A_walls_external,
                'walls_adjacent' => $A_walls_adjacent,
                'roof' => (float) $roofArea,
                'floor' => (float) $floorArea,
                'windows' => $A_window,
                'doors' => $A_doors,
            );
        }

        private function resolveRFromMaterial($materialId, $thicknessCm, &$warnings, &$assumptions, $label) {
            if (!$materialId || !$thicknessCm) {
                return null;
            }
            $matKey = (string) $materialId;
            if (!isset(self::MATERIALS[$matKey]) || !isset(self::MATERIALS[$matKey]['lambda'])) {
                return null;
            }
            $d_m = ((float) $thicknessCm) / 100.0;
            $R = $d_m / (float) self::MATERIALS[$matKey]['lambda'];
            $this->assumePush($assumptions, $label . ': R computed from material');
            return $R;
        }

        private function resolveUFromMaterial($materialId, $thicknessCm, $fallbackU, &$warnings, &$assumptions, $label, $boundaryKey = 'wall') {
            if (!$materialId || !$thicknessCm) {
                $this->warnPush($warnings, 'Missing ' . $label . ' material/thickness; fallback U=' . $fallbackU);
                $this->assumePush($assumptions, $label . ': fallback U=' . $fallbackU);
                return (float) $fallbackU;
            }
            $matKey = (string) $materialId;
            if (!isset(self::MATERIALS[$matKey]) || !isset(self::MATERIALS[$matKey]['lambda'])) {
                $this->warnPush($warnings, 'Unknown materialId=' . $materialId . ' for ' . $label . '; fallback U=' . $fallbackU);
                $this->assumePush($assumptions, $label . ': fallback U=' . $fallbackU);
                return (float) $fallbackU;
            }
            $d_m = ((float) $thicknessCm) / 100.0;
            $R_ins = $d_m / (float) self::MATERIALS[$matKey]['lambda'];
            $res = isset(self::SURFACE_RESISTANCES[$boundaryKey]) ? self::SURFACE_RESISTANCES[$boundaryKey] : self::SURFACE_RESISTANCES['wall'];
            $R_total = (float) $res['Rsi'] + $R_ins + (float) $res['Rse'];
            $U = 1.0 / $R_total;
            $Uc = $this->clamp($U, 0.08, 3.5);
            $this->assumePush($assumptions, $label . ': U computed with Rsi=' . $res['Rsi'] . ', Rse=' . $res['Rse'] . ' (' . $boundaryKey . ')');
            return $Uc;
        }

        private function resolveUFromLayers($primaryMaterialId, $primaryThicknessCm, $externalInsulationMaterialId, $externalInsulationThicknessCm, $internalInsulationMaterialId, $internalInsulationThicknessCm, $fallbackU, &$warnings, &$assumptions, $label, $boundaryKey = 'wall') {
            $res = isset(self::SURFACE_RESISTANCES[$boundaryKey]) ? self::SURFACE_RESISTANCES[$boundaryKey] : self::SURFACE_RESISTANCES['wall'];
            $R_total = (float) $res['Rsi'];

            if ($primaryMaterialId && $primaryThicknessCm) {
                $R_primary = $this->resolveRFromMaterial($primaryMaterialId, $primaryThicknessCm, $warnings, $assumptions, $label . ' (primary layer)');
                if ($R_primary !== null) {
                    $R_total += $R_primary;
                }
            }
            if ($internalInsulationMaterialId && $internalInsulationThicknessCm) {
                $R_internal = $this->resolveRFromMaterial($internalInsulationMaterialId, $internalInsulationThicknessCm, $warnings, $assumptions, $label . ' (internal insulation)');
                if ($R_internal !== null) {
                    $R_total += $R_internal;
                }
            }
            if ($externalInsulationMaterialId && $externalInsulationThicknessCm) {
                $R_external = $this->resolveRFromMaterial($externalInsulationMaterialId, $externalInsulationThicknessCm, $warnings, $assumptions, $label . ' (external insulation)');
                if ($R_external !== null) {
                    $R_total += $R_external;
                }
            }

            $R_total += (float) $res['Rse'];
            $R_layers_only = $R_total - (float) $res['Rsi'] - (float) $res['Rse'];
            if ($R_layers_only <= 0) {
                $this->warnPush($warnings, 'No valid layers for ' . $label . '; fallback U=' . $fallbackU);
                $this->assumePush($assumptions, $label . ': fallback U=' . $fallbackU);
                return (float) $fallbackU;
            }

            $U = 1.0 / $R_total;
            $Uc = $this->clamp($U, 0.08, 3.5);
            $this->assumePush($assumptions, $label . ': U computed from multi-layer structure with Rsi=' . $res['Rsi'] . ', Rse=' . $res['Rse'] . ' (' . $boundaryKey . '), R_total=' . round($R_total, 2) . ' m2K/W');
            return $Uc;
        }

        private function getIndoorTemp($payload, &$warnings = null, &$assumptions = null, &$defaultsUsed = null) {
            if (isset($payload['indoor_temperature']) && is_numeric($payload['indoor_temperature'])) {
                $indoorTemp = (float) $payload['indoor_temperature'];
                if ($indoorTemp >= self::MIN_INDOOR_TEMPERATURE_C && $indoorTemp <= self::MAX_INDOOR_TEMPERATURE_C) {
                    return $indoorTemp;
                }
            }

            if (is_array($warnings)) {
                $this->warnPush($warnings, 'indoor_temperature missing or invalid; fallback ' . self::DEFAULT_INDOOR_TEMPERATURE_C . 'C used');
            }
            if (is_array($assumptions)) {
                $this->assumePush(
                    $assumptions,
                    'indoor_temperature fallback=' . self::DEFAULT_INDOOR_TEMPERATURE_C . 'C (accepted range ' . self::MIN_INDOOR_TEMPERATURE_C . '-' . self::MAX_INDOOR_TEMPERATURE_C . 'C)'
                );
            }
            if (is_array($defaultsUsed)) {
                $this->pushDefaultRecord(
                    $defaultsUsed,
                    'DEFAULT_INDOOR_TEMPERATURE_ASSUMED',
                    array(
                        'defaultIndoorTemperatureC' => self::DEFAULT_INDOOR_TEMPERATURE_C,
                        'acceptedRangeC' => array(self::MIN_INDOOR_TEMPERATURE_C, self::MAX_INDOOR_TEMPERATURE_C),
                    )
                );
            }

            return self::DEFAULT_INDOOR_TEMPERATURE_C;
        }

        private function calculateOZC($payload) {
            if (!is_array($payload)) {
                throw new \InvalidArgumentException('calculateOZC: payload is required and must be an object');
            }
            if (!array_key_exists('floor_area', $payload) && (empty($payload['building_length']) || empty($payload['building_width']))) {
                throw new \InvalidArgumentException('calculateOZC: payload must contain floor_area or both building_length and building_width');
            }

            $warnings = array();
            $assumptions = array();
            $defaultsUsed = array();

            $payload = $this->normalizePayloadForOzc($payload);
            $geo = $this->computeGeometry($payload, $warnings, $assumptions);
            $floorHeight = (isset($payload['floor_height']) && is_numeric($payload['floor_height'])) ? (float) $payload['floor_height'] : 2.6;
            $areas = $this->computeAreas(
                $payload,
                isset($geo['floorArea']) ? (float) $geo['floorArea'] : 0.0,
                isset($geo['roofArea']) ? (float) $geo['roofArea'] : 0.0,
                $floorHeight,
                isset($geo['perimeter']) ? (float) $geo['perimeter'] : 0.0,
                $warnings,
                $assumptions,
                $geo
            );

            $climate = $this->resolveClimate($payload, $assumptions, $warnings);
            $uValues = $this->resolveUValues($payload, $warnings, $assumptions);
            $ventilation = $this->resolveVentilationParams($payload, $geo, $warnings, $assumptions);

            $thermalBridgesMultiplier = (float) self::DEFAULTS['corrections']['thermalBridgesMultiplier'];
            $this->assumePush($assumptions, 'No construction year used. No guessing beyond defaults.');

            $thetaInt = $this->getIndoorTemp($payload, $warnings, $assumptions, $defaultsUsed);
            $thetaE = (float) $climate['theta_e'];
            $thetaGround = (float) $climate['theta_ground'];
            $featureFlags = isset($payload['feature_flags']) && is_array($payload['feature_flags']) ? $payload['feature_flags'] : array();
            if (isset($featureFlags['ground_iso13370_lite']) && $featureFlags['ground_iso13370_lite'] === true) {
                $thetaGround = $this->applyGroundIsoLite($thetaGround, $geo, $climate, $assumptions);
            }

            $deltaT = $thetaInt - $thetaE;
            $deltaT_ground = $thetaInt - $thetaGround;
            if (!is_finite((float) $deltaT) || $deltaT <= 0) {
                $this->warnPush($warnings, 'Invalid deltaT; fallback 20K');
                $this->assumePush($assumptions, 'deltaT fallback=20K');
            }
            $dT = (is_finite((float) $deltaT) && $deltaT > 0) ? (float) $deltaT : 20.0;
            $dT_ground = (is_finite((float) $deltaT_ground) && $deltaT_ground > 0) ? (float) $deltaT_ground : 14.0;

            $buildingType = isset($payload['building_type']) && is_string($payload['building_type']) && $payload['building_type'] !== ''
                ? $payload['building_type']
                : 'single_house';

            $A_walls_external = isset($areas['walls_external']) ? (float) $areas['walls_external'] : (float) $areas['walls'];
            $A_walls_adjacent = isset($areas['walls_adjacent']) ? (float) $areas['walls_adjacent'] : 0.0;

            $HT_walls_external = $A_walls_external * (float) $uValues['wall'];
            $HT_walls_adjacent = $A_walls_adjacent * (float) $uValues['wall'];
            $HT_roof = ((float) $areas['roof']) * (float) $uValues['roof'];
            $HT_windows_doors = ((float) $areas['windows']) * (float) $uValues['window'] + ((float) $areas['doors']) * (float) $uValues['door'];
            $HT_floor = ((float) $areas['floor']) * (float) $uValues['floor'];

            $shapeCorrection = $this->resolveShapeCorrection($geo, $warnings, $assumptions);
            $HV = 0.34 * (float) $ventilation['V_dot_m3h'];

            $H_transmission_noBridges =
                $HT_walls_external +
                $HT_walls_adjacent +
                $HT_roof +
                $HT_windows_doors +
                $HT_floor * $shapeCorrection;
            $H_transmission = $H_transmission_noBridges * $thermalBridgesMultiplier;
            $H_ventilation = $HV;
            $H_total_W_per_K = $H_transmission + $H_ventilation;

            $H_total_for_HDD = $this->resolveHddHeatTransfer(
                $buildingType,
                $payload,
                $HT_walls_external,
                $HT_windows_doors,
                $HT_roof,
                $HT_floor,
                $shapeCorrection,
                $thermalBridgesMultiplier,
                $H_ventilation,
                (float) $ventilation['eta_rec']
            );

            $dT_adjacent = $this->resolveAdjacentDeltaT($payload, $geo, $buildingType, $A_walls_adjacent, $assumptions);
            $boundaries = $this->resolveBoundaryDeltaT($payload, $buildingType, $dT, $dT_ground, $shapeCorrection, $assumptions);

            $phiT =
                $HT_walls_external * $dT +
                $HT_walls_adjacent * $dT_adjacent +
                $HT_roof * (float) $boundaries['dT_roof_eff'] +
                $HT_windows_doors * $dT +
                $HT_floor * (float) $boundaries['dT_floor_eff'] * (float) $boundaries['floorShapeMult'];
            $this->assumePush(
                $assumptions,
                'Podloga na gruncie: uzyto dT_ground=' . number_format($dT_ground, 1, '.', '') . 'K (theta_ground=' .
                number_format($thetaGround, 1, '.', '') . 'C) zamiast dT=' . $dT . 'K'
            );

            $phiV = $HV * $dT * (1 - (float) $ventilation['eta_rec']);
            $phiPsi = $phiT * ($thermalBridgesMultiplier - 1);

            $total = $phiT + $phiV + $phiPsi;

            $heatedFloorsCount = $this->getHeatedFloorsCount($payload);
            $floorArea = isset($geo['floorArea']) ? (float) $geo['floorArea'] : 0.0;
            $areaRef = ($floorArea > 0 ? $floorArea : ((isset($areas['floor']) && (float) $areas['floor'] > 0) ? (float) $areas['floor'] : 1.0)) * $heatedFloorsCount;
            $wPerM2 = $total / $areaRef;
            if ($wPerM2 < 20 || $wPerM2 > 250) {
                $this->warnPush($warnings, 'Sanity-check: heatLossPerM2=' . round($wPerM2) . ' W/m2 looks suspicious.');
            }

            $assumptions[] = 'designHeatLoss_kW: physics-only (transmission + ventilation + bridges); no additive kW corrections';
            $assumptions[] = 'Obliczenia wykonane na kubaturze netto z uwzglednieniem skosow poddasza oraz grubosci scian zewnetrznych';
            $hdd_base = isset(self::CLIMATE_HDD[$climate['zoneKey']]) ? (float) self::CLIMATE_HDD[$climate['zoneKey']] : (float) self::CLIMATE_HDD['PL_III'];
            $assumptions[] = 'Annual energy model: HDD + H_total_for_HDD (zone=' . $climate['zoneKey'] . ', HDD=' . $hdd_base . ', H_total_for_HDD=' . number_format($H_total_for_HDD, 1, '.', '') . ' W/K)';

            $ventKeyRaw = isset($payload['ventilation_type']) ? (string) $payload['ventilation_type'] : '';
            $achRaw = isset(self::VENTILATION[$ventKeyRaw]) ? (float) self::VENTILATION[$ventKeyRaw]['ach'] : null;

            return array(
                'designHeatLoss_W' => round($total),
                'designHeatLoss_kW' => round(($total / 1000.0) * 100) / 100,
                'heatLossPerM2' => round($wPerM2 * 100) / 100,
                'breakdown' => array(
                    'transmission' => round($phiT),
                    'ventilation' => round($phiV),
                    'bridges' => round($phiPsi),
                ),
                'assumptions' => $assumptions,
                'warnings' => $warnings,
                'defaultsUsed' => $defaultsUsed,
                'geometry' => $geo,
                '_internal' => array(
                    'areas' => $areas,
                    'walls_external' => $A_walls_external,
                    'walls_adjacent' => $A_walls_adjacent,
                    'dT_adjacent' => $dT_adjacent,
                    'U_values' => $uValues,
                    'deltaT' => $dT,
                    'deltaT_ground' => $dT_ground,
                    'H_total_W_per_K' => $H_total_W_per_K,
                    'H_total_for_HDD' => $H_total_for_HDD,
                    'zoneKey' => $climate['zoneKey'],
                    'HDD_base' => $hdd_base,
                    'shapeCorrection' => $shapeCorrection,
                    'thermalBridgesMultiplier' => $thermalBridgesMultiplier,
                    'V_dot_m3h' => $ventilation['V_dot_m3h'],
                    'ach' => $achRaw,
                    'payload' => $payload,
                ),
            );
        }

        private function normalizePayloadForOzc($payload) {
            $payload['external_wall_isolation'] = $this->normalizeIsolationField(isset($payload['external_wall_isolation']) ? $payload['external_wall_isolation'] : null);
            $payload['internal_wall_isolation'] = $this->normalizeIsolationField(isset($payload['internal_wall_isolation']) ? $payload['internal_wall_isolation'] : null);
            $payload['top_isolation'] = $this->normalizeIsolationField(isset($payload['top_isolation']) ? $payload['top_isolation'] : null);
            $payload['bottom_isolation'] = $this->normalizeIsolationField(isset($payload['bottom_isolation']) ? $payload['bottom_isolation'] : null);
            return $payload;
        }

        private function resolveUValues($payload, &$warnings, &$assumptions) {
            $constructionType = isset($payload['construction_type']) && $payload['construction_type'] !== ''
                ? (string) $payload['construction_type']
                : 'traditional';
            $U_wall = 0.0;

            if ($constructionType === 'canadian') {
                if (!empty($payload['internal_wall_isolation']['material']) && !empty($payload['internal_wall_isolation']['size'])) {
                    $U_wall = $this->resolveUFromLayers(
                        null,
                        null,
                        null,
                        null,
                        $payload['internal_wall_isolation']['material'],
                        $payload['internal_wall_isolation']['size'],
                        self::DEFAULTS['fallback']['U_wall'],
                        $warnings,
                        $assumptions,
                        'U_wall',
                        'wall'
                    );
                    $this->assumePush($assumptions, 'U_wall computed for canadian construction (internal insulation)');
                } else {
                    $U_wall = (float) self::DEFAULTS['fallback']['U_wall'];
                    $this->warnPush($warnings, 'Missing internal_wall_isolation for canadian construction; fallback U_wall');
                    $this->assumePush($assumptions, 'U_wall from fallback (canadian construction, no internal isolation)');
                }
            } else {
                if (
                    !empty($payload['primary_wall_material']) &&
                    !empty($payload['wall_size']) &&
                    !empty($payload['external_wall_isolation']['material']) &&
                    !empty($payload['external_wall_isolation']['size'])
                ) {
                    $wallStructureCm = $this->computeWallStructureThicknessCm($payload, $warnings, $assumptions);
                    $U_wall = $this->resolveUFromLayers(
                        $payload['primary_wall_material'],
                        $wallStructureCm,
                        $payload['external_wall_isolation']['material'],
                        $payload['external_wall_isolation']['size'],
                        isset($payload['internal_wall_isolation']['material']) ? $payload['internal_wall_isolation']['material'] : null,
                        isset($payload['internal_wall_isolation']['size']) ? $payload['internal_wall_isolation']['size'] : null,
                        self::DEFAULTS['fallback']['U_wall'],
                        $warnings,
                        $assumptions,
                        'U_wall',
                        'wall'
                    );
                } elseif (!empty($payload['external_wall_isolation']['material']) && !empty($payload['external_wall_isolation']['size'])) {
                    $U_wall = $this->resolveUFromMaterial(
                        $payload['external_wall_isolation']['material'],
                        $payload['external_wall_isolation']['size'],
                        self::DEFAULTS['fallback']['U_wall'],
                        $warnings,
                        $assumptions,
                        'U_wall',
                        'wall'
                    );
                } elseif (!empty($payload['primary_wall_material']) && !empty($payload['wall_size'])) {
                    $wallStructureCm = $this->computeWallStructureThicknessCm($payload, $warnings, $assumptions);
                    $U_wall = $this->resolveUFromMaterial(
                        $payload['primary_wall_material'],
                        $wallStructureCm,
                        self::DEFAULTS['fallback']['U_wall'],
                        $warnings,
                        $assumptions,
                        'U_wall',
                        'wall'
                    );
                } else {
                    $U_wall = (float) self::DEFAULTS['fallback']['U_wall'];
                    $this->warnPush($warnings, 'Missing wall data; fallback U_wall=' . $U_wall);
                    $this->assumePush($assumptions, 'U_wall from fallback (no detailed data)');
                }
            }

            $topIso = isset($payload['top_isolation']) && is_array($payload['top_isolation']) ? $payload['top_isolation'] : array('material' => null, 'size' => 0);
            $hasTopInsulation =
                isset($topIso['material']) && is_numeric($topIso['material']) &&
                isset($topIso['size']) && is_numeric($topIso['size']) &&
                (float) $topIso['size'] > 0;
            if ($hasTopInsulation) {
                $U_roof = $this->resolveUFromMaterial(
                    $topIso['material'],
                    $topIso['size'],
                    self::DEFAULTS['fallback']['U_roof'],
                    $warnings,
                    $assumptions,
                    'U_roof',
                    'roof'
                );
            } else {
                $U_roof = (float) self::DEFAULTS['uninsulated']['U_roof'];
                $this->assumePush($assumptions, 'U_roof from DEFAULTS.uninsulated.U_roof=' . self::DEFAULTS['uninsulated']['U_roof'] . ' (no top insulation, 0cm)');
            }

            $bottomIso = isset($payload['bottom_isolation']) && is_array($payload['bottom_isolation']) ? $payload['bottom_isolation'] : array('material' => null, 'size' => 0);
            $hasBottomInsulation =
                isset($bottomIso['material']) && is_numeric($bottomIso['material']) &&
                isset($bottomIso['size']) && is_numeric($bottomIso['size']) &&
                (float) $bottomIso['size'] > 0;
            if ($hasBottomInsulation) {
                $U_floor = $this->resolveUFromMaterial(
                    $bottomIso['material'],
                    $bottomIso['size'],
                    self::DEFAULTS['fallback']['U_floor'],
                    $warnings,
                    $assumptions,
                    'U_floor',
                    'floor'
                );
            } else {
                $U_floor = (float) self::DEFAULTS['uninsulated']['U_floor'];
                $this->assumePush($assumptions, 'U_floor from DEFAULTS.uninsulated.U_floor=' . self::DEFAULTS['uninsulated']['U_floor'] . ' (no bottom insulation, 0cm)');
            }

            if ($this->hasUnheatedBasementUnderHeatedFloor($payload)) {
                $underType = (isset($payload['unheated_space_under_type']) && is_string($payload['unheated_space_under_type']) && $payload['unheated_space_under_type'] !== '')
                    ? (string) $payload['unheated_space_under_type']
                    : 'medium';
                $basementUFloor = array('worst' => 1.20, 'poor' => 1.00, 'medium' => 0.85, 'great' => 0.70);
                $basementU = isset($basementUFloor[$underType]) ? (float) $basementUFloor[$underType] : 0.85;
                if ($basementU > $U_floor) {
                    $U_floor = $basementU;
                    $this->assumePush(
                        $assumptions,
                        'Piwnica nieogrzewana: U_podlogi parteru=' . $basementU . ' (unheated_space_under_type=' . $underType . ')'
                    );
                }
            }

            $windowKey = isset($payload['windows_type']) ? (string) $payload['windows_type'] : '';
            $U_window = isset(self::WINDOWS[$windowKey]) ? (float) self::WINDOWS[$windowKey] : (float) self::DEFAULTS['fallback']['U_window'];
            if (!isset(self::WINDOWS[$windowKey])) {
                $this->warnPush($warnings, 'Unknown windows_type; fallback U_window');
                $this->assumePush($assumptions, 'fallback window U');
            }

            $doorKey = isset($payload['doors_type']) ? (string) $payload['doors_type'] : '';
            $U_door = ($doorKey !== '' && isset(self::DOORS[$doorKey])) ? (float) self::DOORS[$doorKey] : (float) self::DEFAULTS['fallback']['U_door'];
            if ($doorKey === '') {
                $this->warnPush($warnings, 'doors_type missing - using fallback U_door');
                $this->assumePush($assumptions, 'U_door fallback used: ' . self::DEFAULTS['fallback']['U_door']);
            } elseif (!isset(self::DOORS[$doorKey])) {
                $this->warnPush($warnings, "doors_type='" . $doorKey . "' unknown - using fallback U_door");
                $this->assumePush($assumptions, 'U_door fallback used: ' . self::DEFAULTS['fallback']['U_door']);
            } else {
                $this->assumePush($assumptions, "U_door from doors_type='" . $doorKey . "': " . $U_door);
            }

            return array(
                'wall' => $U_wall,
                'roof' => $U_roof,
                'floor' => $U_floor,
                'window' => $U_window,
                'door' => $U_door,
            );
        }

        private function resolveVentilationParams($payload, $geo, &$warnings, &$assumptions) {
            $ventKeyRaw = isset($payload['ventilation_type']) ? (string) $payload['ventilation_type'] : '';
            $ventBase = isset(self::VENTILATION[$ventKeyRaw]) ? self::VENTILATION[$ventKeyRaw] : self::VENTILATION['natural'];
            if (!isset(self::VENTILATION[$ventKeyRaw])) {
                $this->warnPush($warnings, 'Unknown ventilation_type; fallback natural');
                $this->assumePush($assumptions, 'fallback ventilation natural');
            }

            $ach = (float) $ventBase['ach'];
            $eta_rec = (float) $ventBase['eta_rec'];
            $featureFlags = isset($payload['feature_flags']) && is_array($payload['feature_flags']) ? $payload['feature_flags'] : array();
            if (isset($featureFlags['ventilation_refine']) && $featureFlags['ventilation_refine'] === true) {
                $year = (isset($payload['construction_year']) && is_numeric($payload['construction_year'])) ? (float) $payload['construction_year'] : 0.0;
                $tightnessFactor = 1.0;
                if ($year > 0) {
                    if ($year < 1980) $tightnessFactor = 1.2;
                    elseif ($year < 2000) $tightnessFactor = 1.1;
                    elseif ($year >= 2015) $tightnessFactor = 0.9;
                }

                $constructionTypeForVent = isset($payload['construction_type']) && $payload['construction_type'] !== ''
                    ? (string) $payload['construction_type']
                    : 'traditional';
                if ($constructionTypeForVent === 'canadian') {
                    $tightnessFactor *= 0.9;
                }

                if ($ventKeyRaw === 'natural' || $ventKeyRaw === 'gravity') {
                    $ach = $ach * $tightnessFactor;
                } elseif ($ventKeyRaw === 'mechanical') {
                    $ach = $ach * $this->clamp($tightnessFactor, 0.9, 1.1);
                } elseif ($ventKeyRaw === 'mechanical_recovery') {
                    $ach = $ach * $this->clamp($tightnessFactor, 0.85, 1.05);
                }

                $ach = $this->clamp($ach, 0.3, 1.5);
                $yearLabel = $year > 0 ? (string) ((int) $year) : 'n/a';
                $this->assumePush(
                    $assumptions,
                    'ventilation_refine: ACH adjusted for construction (' . $yearLabel . ', ' . $constructionTypeForVent . ') to ' . number_format($ach, 2, '.', '') . ' 1/h'
                );
            }

            return array(
                'ach' => $ach,
                'eta_rec' => $eta_rec,
                'V_dot_m3h' => $ach * (isset($geo['volume']) ? (float) $geo['volume'] : 0.0),
            );
        }

        private function applyGroundIsoLite($thetaGround, $geo, $climate, &$assumptions) {
            $zoneKey = isset($climate['zoneKey']) ? (string) $climate['zoneKey'] : 'PL_III';
            $B = (isset($geo['Bprime']) && is_numeric($geo['Bprime'])) ? (float) $geo['Bprime'] : null;
            $bucket = 'mid';
            if ($B !== null) {
                if ($B < 2) $bucket = 'slim';
                elseif ($B > 4) $bucket = 'compact';
            }
            $deltaGround = 0.0;
            if ($bucket === 'slim') $deltaGround = -1.0;
            elseif ($bucket === 'compact') $deltaGround = 1.0;

            $before = (float) $thetaGround;
            $after = $this->clamp((float) $thetaGround + $deltaGround, 2.0, 12.0);
            $bLabel = $B !== null ? number_format($B, 2, '.', '') : 'n/a';
            $this->assumePush(
                $assumptions,
                'ground_iso13370_lite: theta_ground adjusted ' .
                number_format($before, 1, '.', '') . 'C -> ' .
                number_format($after, 1, '.', '') . "C (zone=" . $zoneKey . ", B'=" . $bLabel . ')'
            );
            return $after;
        }

        private function resolveShapeCorrection($geo, &$warnings, &$assumptions) {
            $perimeter = isset($geo['perimeter']) ? (float) $geo['perimeter'] : 0.0;
            $floorArea = isset($geo['floorArea']) ? (float) $geo['floorArea'] : 0.0;
            $A_P_ratio = $perimeter > 0 ? $floorArea / $perimeter : 0.0;
            $shapeCorrection = 1.0;
            if ($perimeter <= 0 || !is_finite((float) $A_P_ratio) || $A_P_ratio <= 0) {
                $this->warnPush($warnings, 'Missing or invalid floor_perimeter; shapeCorrection set to 1.0');
                $this->assumePush($assumptions, 'shapeCorrection=1.0 (brak wiarygodnego obwodu)');
            } elseif ($A_P_ratio < 3) {
                $shapeCorrection = 1.2;
                $this->assumePush($assumptions, 'Korekta ksztaltu podlogi: A/P=' . number_format($A_P_ratio, 2, '.', '') . ' < 3, zwiekszono straty o 20%');
            } elseif ($A_P_ratio < 5) {
                $shapeCorrection = 1.1;
                $this->assumePush($assumptions, 'Korekta ksztaltu podlogi: A/P=' . number_format($A_P_ratio, 2, '.', '') . ' < 5, zwiekszono straty o 10%');
            }
            return $shapeCorrection;
        }

        private function resolveHddHeatTransfer($buildingType, $payload, $HT_walls_external, $HT_windows_doors, $HT_roof, $HT_floor, $shapeCorrection, $thermalBridgesMultiplier, $H_ventilation, $eta_rec = 0.0) {
            $H_transmission_for_HDD = $HT_walls_external + $HT_windows_doors;
            $over = isset($payload['whats_over']) ? $payload['whats_over'] : null;
            $under = isset($payload['whats_under']) ? $payload['whats_under'] : null;

            $roofToOutdoor = $buildingType !== 'apartment' || ($over !== 'heated_room' && $over !== 'unheated_room');
            if ($roofToOutdoor) {
                $H_transmission_for_HDD += $HT_roof;
            }

            $floorToOutdoor = $buildingType !== 'apartment' || ($under !== 'heated_room' && $under !== 'unheated_room');
            if ($floorToOutdoor) {
                $H_transmission_for_HDD += $HT_floor * $shapeCorrection;
            }

            $eta = $this->clamp((float) $eta_rec, 0.0, 1.0);
            $H_ventilation_for_hdd = (float) $H_ventilation * (1.0 - $eta);

            return ($H_transmission_for_HDD * $thermalBridgesMultiplier) + $H_ventilation_for_hdd;
        }

        private function resolveAdjacentDeltaT($payload, $geo, $buildingType, $A_walls_adjacent, &$assumptions) {
            $dT_adjacent = 7.0;
            if ($buildingType === 'single_house' || $A_walls_adjacent <= 0) {
                return $dT_adjacent;
            }

            if ($buildingType !== 'apartment') {
                $this->assumePush($assumptions, 'dT_adjacent=7K (domyslna wartosc dla ' . $buildingType . ')');
                return 7.0;
            }

            $heatedAreaAdjacent = 0.0;
            $unheatedAreaAdjacent = 0.0;
            $directions = array('whats_north', 'whats_south', 'whats_east', 'whats_west');
            $heatedFloorsCount =
                (isset($payload['building_heated_floors']) && is_array($payload['building_heated_floors']) && count($payload['building_heated_floors']) > 0)
                    ? (int) count($payload['building_heated_floors'])
                    : ((isset($payload['building_floors']) && is_numeric($payload['building_floors'])) ? (int) $payload['building_floors'] : 1);
            $floorHeight = (isset($payload['floor_height']) && is_numeric($payload['floor_height'])) ? (float) $payload['floor_height'] : 2.6;
            $perimeter = isset($geo['perimeter']) ? (float) $geo['perimeter'] : 0.0;
            $verticalWallsArea = $perimeter * $floorHeight * $heatedFloorsCount;
            $wallAreaPerDirection = $verticalWallsArea / 4.0;

            foreach ($directions as $key) {
                $neighbor = isset($payload[$key]) ? $payload[$key] : null;
                if ($neighbor === 'heated_room') {
                    $heatedAreaAdjacent += $wallAreaPerDirection;
                } elseif ($neighbor === 'unheated_room') {
                    $unheatedAreaAdjacent += $wallAreaPerDirection * 0.5;
                }
            }

            $totalAdjacentArea = $heatedAreaAdjacent + $unheatedAreaAdjacent;
            if ($totalAdjacentArea <= 0) {
                return 7.0;
            }

            $heatedRatio = $heatedAreaAdjacent / $totalAdjacentArea;
            $unheatedRatio = $unheatedAreaAdjacent / $totalAdjacentArea;
            $dT_adjacent = $heatedRatio * 2 + $unheatedRatio * 7;
            $this->assumePush(
                $assumptions,
                'dT_adjacent=' . number_format($dT_adjacent, 1, '.', '') . 'K (srednia wazona: ' .
                number_format($heatedRatio * 100, 0, '.', '') . '% heated_room=2K, ' .
                number_format($unheatedRatio * 100, 0, '.', '') . '% unheated_room=7K, zgodnie z computeEffectiveWallArea)'
            );
            return $dT_adjacent;
        }

        private function resolveBoundaryDeltaT($payload, $buildingType, $dT, $dT_ground, $shapeCorrection, &$assumptions) {
            $dT_roof_eff = (float) $dT;
            $dT_floor_eff = (float) $dT_ground;
            $floorShapeMult = (float) $shapeCorrection;

            if ($buildingType === 'apartment') {
                $over = isset($payload['whats_over']) ? $payload['whats_over'] : null;
                $under = isset($payload['whats_under']) ? $payload['whats_under'] : null;
                $adjDT = function ($v) {
                    if ($v === 'heated_room') return 2;
                    if ($v === 'unheated_room') return 7;
                    return null;
                };

                $overAdj = $adjDT($over);
                if ($overAdj !== null) {
                    $dT_roof_eff = (float) $overAdj;
                    $this->assumePush($assumptions, 'Apartment: dT_roof_eff=' . $dT_roof_eff . 'K (whats_over=' . (string) $over . ')');
                } else {
                    $dT_roof_eff = (float) $dT;
                }

                $underAdj = $adjDT($under);
                if ($underAdj !== null) {
                    $dT_floor_eff = (float) $underAdj;
                    $floorShapeMult = 1.0;
                    $this->assumePush($assumptions, 'Apartment: dT_floor_eff=' . $dT_floor_eff . 'K (whats_under=' . (string) $under . ')');
                } elseif ($under === 'outdoor') {
                    $dT_floor_eff = (float) $dT;
                    $floorShapeMult = 1.0;
                    $this->assumePush($assumptions, 'Apartment: dT_floor_eff=' . $dT_floor_eff . 'K (whats_under=outdoor)');
                } else {
                    $dT_floor_eff = (float) $dT_ground;
                    $floorShapeMult = (float) $shapeCorrection;
                    $this->assumePush(
                        $assumptions,
                        'Apartment: dT_floor_eff=' . number_format($dT_floor_eff, 1, '.', '') . 'K (ground model), shapeCorrection=' . $floorShapeMult
                    );
                }
            } elseif (isset($payload['unheated_space_over_type']) && $payload['unheated_space_over_type'] !== '') {
                $map = array('worst' => 12, 'poor' => 10, 'medium' => 8, 'great' => 6);
                $spaceType = (string) $payload['unheated_space_over_type'];
                if (isset($map[$spaceType])) {
                    $dT_roof_eff = (float) $map[$spaceType];
                    $this->assumePush($assumptions, 'Roof boundary adjusted by unheated_space_over_type=' . $spaceType . ' => dT_roof_eff=' . $dT_roof_eff . 'K');
                }
            }

            if ($buildingType !== 'apartment' && $this->hasUnheatedBasementUnderHeatedFloor($payload)) {
                $underType = (isset($payload['unheated_space_under_type']) && is_string($payload['unheated_space_under_type']) && $payload['unheated_space_under_type'] !== '')
                    ? (string) $payload['unheated_space_under_type']
                    : 'medium';
                $map = array('worst' => 12.0, 'poor' => 10.0, 'medium' => 8.0, 'great' => 6.0);
                if (isset($map[$underType])) {
                    $dT_floor_eff = (float) $map[$underType];
                    $floorShapeMult = 1.0;
                    $this->assumePush(
                        $assumptions,
                        'Piwnica nieogrzewana: dT_podlogi parteru=' . number_format($dT_floor_eff, 1, '.', '') .
                        'K (unheated_space_under_type=' . $underType . ')'
                    );
                }
            }

            return array(
                'dT_roof_eff' => $dT_roof_eff,
                'dT_floor_eff' => $dT_floor_eff,
                'floorShapeMult' => $floorShapeMult,
            );
        }

        private function calculateEnergyLosses($breakdown, $areas, $U_values, $dT, $dT_ground, $totalLoss, $payload, $opts) {
            $buildingType = (is_array($payload) && isset($payload['building_type']) && $payload['building_type'] !== '')
                ? (string) $payload['building_type']
                : 'single_house';

            $A_walls_external =
                (is_array($opts) && isset($opts['A_walls_external']) && is_numeric($opts['A_walls_external']))
                    ? (float) $opts['A_walls_external']
                    : (isset($areas['walls_external']) ? (float) $areas['walls_external'] : (float) $areas['walls']);

            $A_walls_adjacent =
                (is_array($opts) && isset($opts['A_walls_adjacent']) && is_numeric($opts['A_walls_adjacent']))
                    ? (float) $opts['A_walls_adjacent']
                    : (isset($areas['walls_adjacent']) ? (float) $areas['walls_adjacent'] : 0.0);

            $dT_adjacent =
                (is_array($opts) && isset($opts['dT_adjacent']) && is_numeric($opts['dT_adjacent']))
                    ? (float) $opts['dT_adjacent']
                    : 7.0;

            $shapeCorrection =
                (is_array($opts) && isset($opts['shapeCorrection']) && is_numeric($opts['shapeCorrection']))
                    ? (float) $opts['shapeCorrection']
                    : 1.0;

            $dT_roof_eff = (float) $dT;
            $dT_floor_eff = (float) $dT_ground;
            $floorShapeMult = $shapeCorrection;
            if ($buildingType === 'apartment') {
                $over = isset($payload['whats_over']) ? $payload['whats_over'] : null;
                $under = isset($payload['whats_under']) ? $payload['whats_under'] : null;
                $adjDT = function ($v) {
                    if ($v === 'heated_room') return 2;
                    if ($v === 'unheated_room') return 7;
                    return null;
                };
                $overAdj = $adjDT($over);
                $dT_roof_eff = $overAdj !== null ? (float) $overAdj : (float) $dT;

                $underAdj = $adjDT($under);
                if ($underAdj !== null) {
                    $dT_floor_eff = (float) $underAdj;
                    $floorShapeMult = 1.0;
                } elseif ($under === 'outdoor') {
                    $dT_floor_eff = (float) $dT;
                    $floorShapeMult = 1.0;
                } else {
                    $dT_floor_eff = (float) $dT_ground;
                    $floorShapeMult = 1.0;
                }
            }

            $wallsExternalLoss = max(0, $A_walls_external) * (float) $U_values['wall'] * (float) $dT;
            $wallsAdjacentLoss = $A_walls_adjacent * (float) $U_values['wall'] * $dT_adjacent;
            $wallsLoss = $wallsExternalLoss + $wallsAdjacentLoss;
            $windowsLoss = (float) $areas['windows'] * (float) $U_values['window'] * (float) $dT;
            $doorsLoss = (float) $areas['doors'] * (float) $U_values['door'] * (float) $dT;
            $roofLoss = (float) $areas['roof'] * (float) $U_values['roof'] * $dT_roof_eff;
            $floorLoss = (float) $areas['floor'] * (float) $U_values['floor'] * $dT_floor_eff * $floorShapeMult;
            $ventilationLoss = isset($breakdown['ventilation']) ? (float) $breakdown['ventilation'] : 0.0;
            $bridgesLoss = isset($breakdown['bridges']) ? (float) $breakdown['bridges'] : 0.0;

            $windowsAndDoorsLoss = $windowsLoss + $doorsLoss;
            $transmissionTotal = isset($breakdown['transmission']) ? (float) $breakdown['transmission'] : 0.0;
            $transmissionRatio = $transmissionTotal > 0 ? ($transmissionTotal + $bridgesLoss) / $transmissionTotal : 1.0;

            $losses = array(
                array('label' => 'Dach', 'loss' => $roofLoss * $transmissionRatio),
                array('label' => 'Wentylacja', 'loss' => $ventilationLoss),
                array('label' => 'Okna i drzwi', 'loss' => $windowsAndDoorsLoss * $transmissionRatio),
                array('label' => 'Podłoga', 'loss' => $floorLoss * $transmissionRatio),
                array('label' => 'Ściany zewnętrzne', 'loss' => $wallsLoss * $transmissionRatio),
            );

            $physicalLossTotal = 0.0;
            foreach ($losses as $item) {
                if (isset($item['loss']) && is_numeric($item['loss']) && (float) $item['loss'] > 0.0) {
                    $physicalLossTotal += (float) $item['loss'];
                }
            }

            if (!($physicalLossTotal > 0.0)) {
                return array();
            }

            $result = array();
            foreach ($losses as $item) {
                if ((float) $item['loss'] > 0) {
                    $result[] = array(
                        'label' => $item['label'],
                        'percent' => round(((float) $item['loss'] / $physicalLossTotal) * 1000) / 10,
                    );
                }
            }
            usort($result, function ($a, $b) {
                $av = isset($a['percent']) ? (float) $a['percent'] : 0.0;
                $bv = isset($b['percent']) ? (float) $b['percent'] : 0.0;
                if ($av === $bv) return 0;
                return ($av < $bv) ? 1 : -1;
            });

            return $result;
        }

        private function calculateImprovements($payload, &$originalResult, $areas, $U_values) {
            $improvements = array();
            $climate = $this->resolveClimate($payload);
            $dT = $this->getIndoorTemp($payload) - (float) $climate['theta_e'];
            $dT_clamped = max(10.0, min(50.0, (float) $dT));
            if (isset($originalResult['assumptions']) && is_array($originalResult['assumptions'])) {
                $originalResult['assumptions'][] = 'Improvements: using dT from indoor_temperature (clamped 10-50K, actual=' . number_format($dT_clamped, 1, '.', '') . 'K)';
            }

            $designHeatLoss_W = isset($originalResult['designHeatLoss_W']) ? (float) $originalResult['designHeatLoss_W'] : 0.0;
            if ($designHeatLoss_W <= 0) {
                return $improvements;
            }

            if ((float) $U_values['roof'] > 0.15) {
                $newU_roof = 0.15;
                $roofLossOld = (float) $areas['roof'] * (float) $U_values['roof'] * $dT_clamped;
                $roofLossNew = (float) $areas['roof'] * $newU_roof * $dT_clamped;
                $savings = (($roofLossOld - $roofLossNew) / $designHeatLoss_W) * 100;
                if ($savings > 1) {
                    $improvements[] = array('label' => 'Ocieplenie dachu (wełna 25cm)', 'energy_saved' => round($savings * 10) / 10);
                }
            }

            if ((float) $U_values['wall'] > 0.2) {
                $newU_wall = 0.2;
                $wallsArea = (float) $areas['walls'];
                $wallsLossOld = $wallsArea * (float) $U_values['wall'] * $dT_clamped;
                $wallsLossNew = $wallsArea * $newU_wall * $dT_clamped;
                $savings = (($wallsLossOld - $wallsLossNew) / $designHeatLoss_W) * 100;
                if ($savings > 1) {
                    $improvements[] = array('label' => 'Ocieplenie ścian (styropian 15cm)', 'energy_saved' => round($savings * 10) / 10);
                }
            }

            if ((float) $U_values['window'] > 0.9) {
                $newU_window = 0.9;
                $windowsLossOld = (float) $areas['windows'] * (float) $U_values['window'] * $dT_clamped;
                $windowsLossNew = (float) $areas['windows'] * $newU_window * $dT_clamped;
                $savings = (($windowsLossOld - $windowsLossNew) / $designHeatLoss_W) * 100;
                if ($savings > 1) {
                    $improvements[] = array('label' => 'Wymiana okien na trójszybowe', 'energy_saved' => round($savings * 10) / 10);
                }
            }

            if (!isset($payload['ventilation_type']) || $payload['ventilation_type'] !== 'mechanical_recovery') {
                $ventOld = self::VENTILATION['natural'];
                $ventNew = self::VENTILATION['mechanical_recovery'];
                $volume = (isset($originalResult['geometry']['volume']) && is_numeric($originalResult['geometry']['volume']))
                    ? (float) $originalResult['geometry']['volume']
                    : 300.0;
                $V_dot = (float) $ventOld['ach'] * $volume;
                $lossOld = 0.34 * $V_dot * $dT_clamped * (1 - 0);
                $lossNew = 0.34 * $V_dot * $dT_clamped * (1 - (float) $ventNew['eta_rec']);
                $savings = (($lossOld - $lossNew) / $designHeatLoss_W) * 100;
                if ($savings > 1) {
                    $improvements[] = array('label' => 'Montaż rekuperacji', 'energy_saved' => round($savings * 10) / 10);
                }
            }

            usort($improvements, function ($a, $b) {
                $av = isset($a['energy_saved']) ? (float) $a['energy_saved'] : 0.0;
                $bv = isset($b['energy_saved']) ? (float) $b['energy_saved'] : 0.0;
                if ($av === $bv) return 0;
                return ($av < $bv) ? 1 : -1;
            });
            return $improvements;
        }

        private function calculateHotWaterPower($payload) {
            $cwu_engine = $this->resolve_cwu_engine();
            if ($cwu_engine !== null && method_exists($cwu_engine, 'estimateHotWaterPowerKwFromPayload')) {
                return (float) $cwu_engine->estimateHotWaterPowerKwFromPayload(is_array($payload) ? $payload : array());
            }

            if (empty($payload['include_hot_water']) || empty($payload['hot_water_persons'])) {
                return 0.0;
            }

            $persons = isset($payload['hot_water_persons']) && is_numeric($payload['hot_water_persons']) ? (float) $payload['hot_water_persons'] : 0.0;
            $usage = isset($payload['hot_water_usage']) && is_string($payload['hot_water_usage']) && $payload['hot_water_usage'] !== ''
                ? $payload['hot_water_usage']
                : 'shower_bath';
            $powerPerPerson = array('shower' => 0.15, 'shower_bath' => 0.17, 'bath' => 0.175);
            $basePower = $persons * (isset($powerPerPerson[$usage]) ? (float) $powerPerPerson[$usage] : 0.17);

            return max(0.3, min(1.5, round($basePower * 100) / 100));
        }

        private function calculateBivalentPoints($maxPower_kW, $designTemp, $avgTemp, $indoorTemp) {
            $temperatures = array(-5, -7, -9, -11);
            $parallel = array();
            $alternative = array();
            $deltaT_design = (float) $indoorTemp - (float) $designTemp;

            foreach ($temperatures as $temp) {
                $deltaT = (float) $indoorTemp - (float) $temp;
                $power_W = round((float) $maxPower_kW * 1000 * ($deltaT / $deltaT_design));
                if ($temp >= 0) {
                    $percent = min(99, round(70 + $temp * 2));
                } elseif ($temp >= -10) {
                    $percent = round(80 + $temp * 1.5);
                } else {
                    $percent = max(20, round(90 + $temp * 0.5));
                }
                $parallel[] = array('temperature' => $temp, 'power' => $power_W, 'percent' => $percent);
                $alternative[] = array('temperature' => $temp, 'power' => $power_W, 'percent' => max(20, $percent - 45));
            }

            return array('parallel' => $parallel, 'alternative' => $alternative);
        }

        private function calculateHeatingCosts($annualEnergy_kWh, $maxPower_kW) {
            $FUEL_PRICES = array(
                'electricity' => 1.1,
                'gas' => 0.35,
                'pellet' => 1500,
                'coal' => 1200,
                'wood' => 200,
            );
            $EFFICIENCIES = array(
                'heat_pump' => 4.0,
                'gas_boiler' => 1.0,
                'pellet_boiler' => 0.85,
                'coal_boiler' => 0.8,
                'wood_boiler' => 0.8,
                'electric_boiler' => 0.99,
            );
            $FUEL_ENERGY = array(
                'pellet' => 5000,
                'coal' => 7000,
                'wood' => 1800,
            );

            $costs = array();

            $actualSCOP = 4.25;
            $displaySCOP = 4.0;
            $hpEnergy = (float) $annualEnergy_kWh / $actualSCOP;
            $hpCost = round($hpEnergy * $FUEL_PRICES['electricity']);
            $costs[] = array(
                'label' => 'Pompa Ciepła (powietrzna)',
                'detail' => 'SCOP ' . $displaySCOP,
                'fuel' => array(
                    'name' => 'Prąd',
                    'price' => $FUEL_PRICES['electricity'],
                    'unit' => 'kWh',
                    'trade_amount' => 1,
                    'trade_unit' => 'kWh',
                    'energy' => 3.6,
                ),
                'amount' => round($hpEnergy),
                'consumption' => round($hpEnergy * 100) / 100,
                'efficiency' => 400,
                'cost' => $hpCost,
            );

            $gasEnergy = (float) $annualEnergy_kWh / $EFFICIENCIES['gas_boiler'];
            $gasCost = round($gasEnergy * $FUEL_PRICES['gas']);
            $costs[] = array(
                'label' => 'Gaz ziemny',
                'detail' => 'Kocioł kondensacyjny',
                'fuel' => array(
                    'name' => 'Gaz',
                    'price' => $FUEL_PRICES['gas'],
                    'unit' => 'kWh',
                    'trade_amount' => 1,
                    'trade_unit' => 'kWh',
                    'energy' => 3.6,
                ),
                'amount' => round($gasEnergy),
                'consumption' => round($gasEnergy * 100) / 100,
                'efficiency' => round($EFFICIENCIES['gas_boiler'] * 100),
                'cost' => $gasCost,
            );

            $pelletEnergyNeeded = (float) $annualEnergy_kWh / $EFFICIENCIES['pellet_boiler'];
            $pelletTons = $pelletEnergyNeeded / $FUEL_ENERGY['pellet'];
            $pelletCost = round($pelletTons * $FUEL_PRICES['pellet']);
            $costs[] = array(
                'label' => 'Pellet',
                'detail' => 'Kocioł automatyczny',
                'fuel' => array(
                    'name' => 'Pellet',
                    'price' => $FUEL_PRICES['pellet'] / $FUEL_ENERGY['pellet'],
                    'unit' => 'kg',
                    'trade_amount' => $FUEL_ENERGY['pellet'],
                    'trade_unit' => 't',
                    'energy' => 18.0,
                ),
                'amount' => round($pelletEnergyNeeded),
                'consumption' => round($pelletTons * 100) / 100,
                'efficiency' => round($EFFICIENCIES['pellet_boiler'] * 100),
                'cost' => $pelletCost,
            );

            $coalEnergyNeeded = (float) $annualEnergy_kWh / $EFFICIENCIES['coal_boiler'];
            $coalTons = $coalEnergyNeeded / $FUEL_ENERGY['coal'];
            $coalCost = round($coalTons * $FUEL_PRICES['coal']);
            $costs[] = array(
                'label' => 'Węgiel',
                'detail' => 'Kocioł zasypowy',
                'fuel' => array(
                    'name' => 'Wegiel',
                    'price' => $FUEL_PRICES['coal'] / $FUEL_ENERGY['coal'],
                    'unit' => 'kg',
                    'trade_amount' => $FUEL_ENERGY['coal'],
                    'trade_unit' => 't',
                    'energy' => 25.2,
                ),
                'amount' => round($coalEnergyNeeded),
                'consumption' => round($coalTons * 100) / 100,
                'efficiency' => round($EFFICIENCIES['coal_boiler'] * 100),
                'cost' => $coalCost,
            );

            $woodEnergyNeeded = (float) $annualEnergy_kWh / $EFFICIENCIES['wood_boiler'];
            $woodMp = $woodEnergyNeeded / $FUEL_ENERGY['wood'];
            $woodCost = round($woodMp * $FUEL_PRICES['wood']);
            $costs[] = array(
                'label' => 'Drewno',
                'detail' => 'Kocioł na drewno bez podajnika',
                'fuel' => array(
                    'name' => 'Drewno',
                    'price' => $FUEL_PRICES['wood'] / $FUEL_ENERGY['wood'],
                    'unit' => 'kg',
                    'trade_amount' => 450,
                    'trade_unit' => 'mp',
                    'energy' => 16.0,
                ),
                'amount' => round($woodEnergyNeeded),
                'consumption' => round($woodMp * 100) / 100,
                'efficiency' => round($EFFICIENCIES['wood_boiler'] * 100),
                'cost' => $woodCost,
            );

            $electricEnergy = (float) $annualEnergy_kWh / $EFFICIENCIES['electric_boiler'];
            $electricCost = round($electricEnergy * $FUEL_PRICES['electricity']);
            $costs[] = array(
                'label' => 'Kocioł elektryczny',
                'detail' => 'Grzałki elektryczne',
                'fuel' => array(
                    'name' => 'Prąd',
                    'price' => $FUEL_PRICES['electricity'],
                    'unit' => 'kWh',
                    'trade_amount' => 1,
                    'trade_unit' => 'kWh',
                    'energy' => 3.6,
                ),
                'amount' => round($electricEnergy),
                'consumption' => round($electricEnergy * 100) / 100,
                'efficiency' => round($EFFICIENCIES['electric_boiler'] * 100),
                'cost' => $electricCost,
            );

            usort($costs, function ($a, $b) {
                $av = isset($a['cost']) ? (float) $a['cost'] : 0.0;
                $bv = isset($b['cost']) ? (float) $b['cost'] : 0.0;
                if ($av === $bv) return 0;
                return ($av < $bv) ? -1 : 1;
            });

            return $costs;
        }

        private function estimateAnnualCwuEnergyKWh($payload) {
            $cwu_engine = $this->resolve_cwu_engine();
            if ($cwu_engine !== null && method_exists($cwu_engine, 'estimateAnnualCwuEnergyKWhFromPayload')) {
                return (int) $cwu_engine->estimateAnnualCwuEnergyKWhFromPayload(is_array($payload) ? $payload : array());
            }

            $include_hot_water = false;
            if (is_array($payload) && array_key_exists('include_hot_water', $payload)) {
                $raw_include = $payload['include_hot_water'];
                $include_hot_water = $raw_include === true || $raw_include === 1 || $raw_include === '1' || $raw_include === 'true' || $raw_include === 'yes';
            }
            if (!$include_hot_water) {
                return 0;
            }

            $persons = isset($payload['hot_water_persons']) && is_numeric($payload['hot_water_persons'])
                ? (float) $payload['hot_water_persons']
                : null;
            if ($persons === null || $persons <= 0.0) {
                return 0;
            }

            $liters_per_person_per_day = array(
                'shower' => 35,
                'shower_bath' => 50,
                'bath' => 65,
            );
            $usage = isset($payload['hot_water_usage']) ? (string) $payload['hot_water_usage'] : 'shower_bath';
            $liters = isset($liters_per_person_per_day[$usage]) ? $liters_per_person_per_day[$usage] : $liters_per_person_per_day['shower_bath'];
            $delta_t = 35.0;
            $kwh_per_liter = (4.186 * $delta_t) / 3600.0;

            return (int) round($persons * $liters * 365 * $kwh_per_liter);
        }

        /**
         * @return object|null
         */
        private function resolve_cwu_engine() {
            if (class_exists('TopInstal_CwuEngine')) {
                return new TopInstal_CwuEngine();
            }
            return null;
        }

        private function normalizeFuelPrices($rawPrices = array()) {
            $rawPrices = is_array($rawPrices) ? $rawPrices : array();
            $to_per_kwh = static function ($price, $energy_per_unit) {
                $price_value = is_numeric($price) ? (float) $price : null;
                $energy_value = is_numeric($energy_per_unit) ? (float) $energy_per_unit : null;
                if ($price_value === null || $price_value <= 0.0 || $energy_value === null || $energy_value <= 0.0) {
                    return null;
                }
                return $price_value / $energy_value;
            };
            $positive_number = static function ($value) {
                return is_numeric($value) && (float) $value > 0.0 ? (float) $value : null;
            };

            $electricity_per_kwh = isset($rawPrices['electricityPLNperKWh'])
                ? $positive_number($rawPrices['electricityPLNperKWh'])
                : null;
            $gas_per_kwh = isset($rawPrices['gasPLNperKWh'])
                ? $positive_number($rawPrices['gasPLNperKWh'])
                : null;
            $pellet_per_kwh = isset($rawPrices['pelletPLNperKWh'])
                ? $positive_number($rawPrices['pelletPLNperKWh'])
                : $to_per_kwh(
                    isset($rawPrices['pelletPLNperTon']) ? $rawPrices['pelletPLNperTon'] : null,
                    isset($rawPrices['pelletKWhPerTon']) ? $rawPrices['pelletKWhPerTon'] : null
                );
            $wood_per_kwh = isset($rawPrices['woodPLNperKWh'])
                ? $positive_number($rawPrices['woodPLNperKWh'])
                : $to_per_kwh(
                    isset($rawPrices['woodPLNperMp']) ? $rawPrices['woodPLNperMp'] : null,
                    isset($rawPrices['woodKWhPerMp']) ? $rawPrices['woodKWhPerMp'] : null
                );
            $coal_per_kwh = isset($rawPrices['coalPLNperKWh'])
                ? $positive_number($rawPrices['coalPLNperKWh'])
                : $to_per_kwh(
                    isset($rawPrices['coalPLNperTon']) ? $rawPrices['coalPLNperTon'] : null,
                    isset($rawPrices['coalKWhPerTon']) ? $rawPrices['coalKWhPerTon'] : null
                );

            return array(
                'electricityPLNperKWh' => $electricity_per_kwh !== null ? $electricity_per_kwh : 1.1,
                'gasPLNperKWh' => $gas_per_kwh !== null ? $gas_per_kwh : 0.35,
                'pelletPLNperKWh' => $pellet_per_kwh !== null ? $pellet_per_kwh : 0.45,
                'woodPLNperKWh' => $wood_per_kwh !== null ? $wood_per_kwh : 0.19,
                'coalPLNperKWh' => $coal_per_kwh !== null ? $coal_per_kwh : 0.23,
            );
        }

        private function calculateHeatingCostsDetailed($input, $maxPower_kW = null, $customOptions = array()) {
            unset($maxPower_kW);

            $legacy_annual_energy = is_numeric($input) ? (float) $input : null;
            $options = is_array($input) ? $input : (is_array($customOptions) ? $customOptions : array());
            $annual_co_kwh = is_array($input)
                ? (
                    (isset($input['annualCoKWh']) && is_numeric($input['annualCoKWh'])) ? (float) $input['annualCoKWh']
                        : ((isset($input['annualHeatDemandKWh']) && is_numeric($input['annualHeatDemandKWh'])) ? (float) $input['annualHeatDemandKWh'] : 0.0)
                )
                : ($legacy_annual_energy !== null ? $legacy_annual_energy : 0.0);
            $annual_cwu_kwh = is_array($input) && isset($input['annualCwuKWh']) && is_numeric($input['annualCwuKWh'])
                ? (float) $input['annualCwuKWh']
                : 0.0;

            $prices = $this->normalizeFuelPrices(array(
                'electricityPLNperKWh' => isset($options['electricityPLNperKWh']) ? $options['electricityPLNperKWh'] : null,
                'gasPLNperKWh' => isset($options['gasPLNperKWh']) ? $options['gasPLNperKWh'] : null,
                'pelletPLNperKWh' => isset($options['pelletPLNperKWh']) ? $options['pelletPLNperKWh'] : null,
                'woodPLNperKWh' => isset($options['woodPLNperKWh']) ? $options['woodPLNperKWh'] : null,
                'coalPLNperKWh' => isset($options['coalPLNperKWh']) ? $options['coalPLNperKWh'] : null,
                'pelletPLNperTon' => isset($options['pelletPLNperTon']) ? $options['pelletPLNperTon'] : 2250,
                'pelletKWhPerTon' => isset($options['pelletKWhPerTon']) ? $options['pelletKWhPerTon'] : 5000,
                'woodPLNperMp' => isset($options['woodPLNperMp']) ? $options['woodPLNperMp'] : 350,
                'woodKWhPerMp' => isset($options['woodKWhPerMp']) ? $options['woodKWhPerMp'] : 1800,
                'coalPLNperTon' => isset($options['coalPLNperTon']) ? $options['coalPLNperTon'] : 1600,
                'coalKWhPerTon' => isset($options['coalKWhPerTon']) ? $options['coalKWhPerTon'] : 7000,
            ));

            $positive_number = static function ($value) {
                return is_numeric($value) && (float) $value > 0.0 ? (float) $value : null;
            };
            $scop_used = isset($options['scopUsed']) ? $positive_number($options['scopUsed']) : null;
            $heat_pump_scop = $scop_used !== null && $scop_used > 0.0 ? $scop_used : 4.0;
            $efficiencies_used = array(
                'gas' => isset($options['gasEfficiency']) ? ($positive_number($options['gasEfficiency']) !== null ? $positive_number($options['gasEfficiency']) : 0.9) : 0.9,
                'pellet' => isset($options['pelletEfficiency']) ? ($positive_number($options['pelletEfficiency']) !== null ? $positive_number($options['pelletEfficiency']) : 0.85) : 0.85,
                'coal' => isset($options['coalEfficiency']) ? ($positive_number($options['coalEfficiency']) !== null ? $positive_number($options['coalEfficiency']) : 0.8) : 0.8,
                'wood' => isset($options['woodEfficiency']) ? ($positive_number($options['woodEfficiency']) !== null ? $positive_number($options['woodEfficiency']) : 0.8) : 0.8,
                'electricResistance' => isset($options['electricEfficiency']) ? ($positive_number($options['electricEfficiency']) !== null ? $positive_number($options['electricEfficiency']) : 1.0) : 1.0,
            );

            $annual_co_kwh = max(0.0, $annual_co_kwh);
            $annual_cwu_kwh = max(0.0, $annual_cwu_kwh);
            $energy_total = $annual_co_kwh + $annual_cwu_kwh;
            $date_stamp = gmdate('Y-m-d');

            $assumptions = array(
                'electricityPLNperKWh' => $prices['electricityPLNperKWh'],
                'gasPLNperKWh' => $prices['gasPLNperKWh'],
                'pelletPLNperKWh' => $prices['pelletPLNperKWh'],
                'woodPLNperKWh' => $prices['woodPLNperKWh'],
                'annualKWhCO' => $annual_co_kwh,
                'annualKWhCWU' => $annual_cwu_kwh,
                'annualKWhTotal' => $energy_total,
                'scopUsed' => $heat_pump_scop,
                'efficienciesUsed' => $efficiencies_used,
                'dateStamp' => $date_stamp,
            );
            $format_js_number = static function ($value) {
                if (!is_numeric($value)) {
                    return (string) $value;
                }
                $number = (float) $value;
                if (abs($number - round($number)) < 0.000000000001) {
                    return (string) (int) round($number);
                }
                $encoded = json_encode($number);
                return is_string($encoded) ? $encoded : (string) $number;
            };
            $assumptions['displayLine'] = 'Założenia: prąd ' . $format_js_number($assumptions['electricityPLNperKWh'])
                . ' PLN/kWh, gaz ' . $format_js_number($assumptions['gasPLNperKWh'])
                . ' PLN/kWh, pellet ' . $format_js_number($assumptions['pelletPLNperKWh'])
                . ' PLN/kWh, drewno ' . $format_js_number($assumptions['woodPLNperKWh'])
                . ' PLN/kWh, SCOP ' . $format_js_number($assumptions['scopUsed'])
                . ', data ' . $assumptions['dateStamp'] . '.';

            $rows = array(
                array(
                    'key' => 'heat_pump',
                    'label' => 'Pompa ciepła (powietrzna)',
                    'detail' => 'SCOP ' . $heat_pump_scop,
                    'efficiencyFactor' => $heat_pump_scop,
                    'efficiencyDisplay' => 'SCOP ' . $heat_pump_scop,
                    'fuelPricePerKWh' => $prices['electricityPLNperKWh'],
                ),
                array(
                    'key' => 'gas',
                    'label' => 'Gaz ziemny',
                    'detail' => 'Kocioł kondensacyjny',
                    'efficiencyFactor' => $efficiencies_used['gas'],
                    'efficiencyDisplay' => round($efficiencies_used['gas'] * 100) . '%',
                    'fuelPricePerKWh' => $prices['gasPLNperKWh'],
                ),
                array(
                    'key' => 'pellet',
                    'label' => 'Pellet',
                    'detail' => 'Kocioł automatyczny',
                    'efficiencyFactor' => $efficiencies_used['pellet'],
                    'efficiencyDisplay' => round($efficiencies_used['pellet'] * 100) . '%',
                    'fuelPricePerKWh' => $prices['pelletPLNperKWh'],
                ),
                array(
                    'key' => 'coal',
                    'label' => 'Węgiel',
                    'detail' => 'Kocioł zasypowy',
                    'efficiencyFactor' => $efficiencies_used['coal'],
                    'efficiencyDisplay' => round($efficiencies_used['coal'] * 100) . '%',
                    'fuelPricePerKWh' => $prices['coalPLNperKWh'],
                ),
                array(
                    'key' => 'wood',
                    'label' => 'Drewno',
                    'detail' => 'Kocioł na drewno',
                    'efficiencyFactor' => $efficiencies_used['wood'],
                    'efficiencyDisplay' => round($efficiencies_used['wood'] * 100) . '%',
                    'fuelPricePerKWh' => $prices['woodPLNperKWh'],
                ),
                array(
                    'key' => 'electric_resistance',
                    'label' => 'Kocioł elektryczny',
                    'detail' => 'Ogrzewanie oporowe',
                    'efficiencyFactor' => $efficiencies_used['electricResistance'],
                    'efficiencyDisplay' => round($efficiencies_used['electricResistance'] * 100) . '%',
                    'fuelPricePerKWh' => $prices['electricityPLNperKWh'],
                ),
            );

            $mapped = array();
            foreach ($rows as $row) {
                $eta = isset($row['efficiencyFactor']) && is_numeric($row['efficiencyFactor']) ? (float) $row['efficiencyFactor'] : 0.0;
                if ($eta <= 0.0) {
                    continue;
                }

                $annual_cost_co = ($annual_co_kwh / $eta) * (float) $row['fuelPricePerKWh'];
                $annual_cost_cwu = ($annual_cwu_kwh / $eta) * (float) $row['fuelPricePerKWh'];
                $annual_cost_total = ($energy_total / $eta) * (float) $row['fuelPricePerKWh'];
                if (!is_finite($annual_cost_total)) {
                    continue;
                }

                $mapped[] = array(
                    'key' => isset($row['key']) ? (string) $row['key'] : '',
                    'label' => $row['label'],
                    'detail' => $row['detail'],
                    'efficiency_factor' => round($eta * 1000) / 1000,
                    'efficiency_display' => $row['efficiencyDisplay'],
                    'efficiency' => (int) round($eta * 100),
                    'fuel' => array(
                        'name' => ($row['key'] === 'heat_pump' || $row['key'] === 'electric_resistance') ? 'Prąd' : $row['label'],
                        'price' => (float) $row['fuelPricePerKWh'],
                        'unit' => 'kWh',
                        'trade_amount' => 1,
                        'trade_unit' => 'kWh',
                        'energy' => 3.6,
                    ),
                    'amount' => (int) round($energy_total / $eta),
                    'consumption' => round(($energy_total / $eta) * 100) / 100,
                    'annual_cost_co_pln' => $annual_cwu_kwh > 0.0 ? (int) round($annual_cost_co) : null,
                    'annual_cost_cwu_pln' => $annual_cwu_kwh > 0.0 ? (int) round($annual_cost_cwu) : null,
                    'annual_cost_total_pln' => (int) round($annual_cost_total),
                    'annual_cost_pln' => (int) round($annual_cost_total),
                    'cost' => (int) round($annual_cost_total),
                );
            }

            usort($mapped, static function ($a, $b) {
                $av = isset($a['cost']) ? (float) $a['cost'] : 0.0;
                $bv = isset($b['cost']) ? (float) $b['cost'] : 0.0;
                if ($av === $bv) {
                    return 0;
                }
                return $av < $bv ? -1 : 1;
            });

            return array(
                'rows' => $mapped,
                'assumptions' => $assumptions,
            );
        }

        private function computeAnnualEnergy_kWh($payload, &$ozcResult, $climate, $opts = array()) {
            $H_total_for_HDD = isset($ozcResult['_internal']['H_total_for_HDD']) ? $ozcResult['_internal']['H_total_for_HDD'] : null;
            $zoneKey = isset($ozcResult['_internal']['zoneKey'])
                ? $ozcResult['_internal']['zoneKey']
                : (isset($climate['zoneKey']) ? $climate['zoneKey'] : 'PL_III');
            $hdd_base = isset($ozcResult['_internal']['HDD_base'])
                ? $ozcResult['_internal']['HDD_base']
                : (isset(self::CLIMATE_HDD[$zoneKey]) ? self::CLIMATE_HDD[$zoneKey] : self::CLIMATE_HDD['PL_III']);

            if (!is_numeric($H_total_for_HDD) || (float) $H_total_for_HDD <= 0) {
                $internal = isset($ozcResult['_internal']) && is_array($ozcResult['_internal']) ? $ozcResult['_internal'] : null;
                $areas = ($internal && isset($internal['areas']) && is_array($internal['areas'])) ? $internal['areas'] : null;
                $U_values = ($internal && isset($internal['U_values']) && is_array($internal['U_values'])) ? $internal['U_values'] : null;
                $buildingType = isset($payload['building_type']) && $payload['building_type'] !== '' ? $payload['building_type'] : 'single_house';

                if ($areas && $U_values) {
                    $HT_walls_external = (isset($areas['walls_external']) ? (float) $areas['walls_external'] : 0.0) * (isset($U_values['wall']) ? (float) $U_values['wall'] : 0.0);
                    $HT_roof = (isset($areas['roof']) ? (float) $areas['roof'] : 0.0) * (isset($U_values['roof']) ? (float) $U_values['roof'] : 0.0);
                    $HT_floor = (isset($areas['floor']) ? (float) $areas['floor'] : 0.0) * (isset($U_values['floor']) ? (float) $U_values['floor'] : 0.0);
                    $HT_windows_doors =
                        (isset($areas['windows']) ? (float) $areas['windows'] : 0.0) * (isset($U_values['window']) ? (float) $U_values['window'] : 0.0) +
                        (isset($areas['doors']) ? (float) $areas['doors'] : 0.0) * (isset($U_values['door']) ? (float) $U_values['door'] : 0.0);
                    $shapeCorrection = isset($internal['shapeCorrection']) && is_numeric($internal['shapeCorrection']) ? (float) $internal['shapeCorrection'] : 1.0;

                    if (isset($internal['V_dot_m3h']) && is_numeric($internal['V_dot_m3h'])) {
                        $H_ventilation = 0.34 * (float) $internal['V_dot_m3h'];
                    } elseif (
                        isset($internal['ach']) && is_numeric($internal['ach']) &&
                        isset($ozcResult['geometry']['volume']) && is_numeric($ozcResult['geometry']['volume'])
                    ) {
                        $H_ventilation = 0.34 * ((float) $internal['ach'] * (float) $ozcResult['geometry']['volume']);
                    } else {
                        throw new \RuntimeException('H_total_for_HDD missing: cannot compute H_ventilation (missing V_dot_m3h or ach+volume)');
                    }

                    $H_transmission_for_HDD = $HT_walls_external + $HT_windows_doors;
                    $roofToOutdoor = $buildingType !== 'apartment' ||
                        (((isset($payload['whats_over']) ? $payload['whats_over'] : null) !== 'heated_room') &&
                            ((isset($payload['whats_over']) ? $payload['whats_over'] : null) !== 'unheated_room'));
                    if ($roofToOutdoor) {
                        $H_transmission_for_HDD += $HT_roof;
                    }
                    $floorToOutdoor = $buildingType !== 'apartment' ||
                        (((isset($payload['whats_under']) ? $payload['whats_under'] : null) !== 'heated_room') &&
                            ((isset($payload['whats_under']) ? $payload['whats_under'] : null) !== 'unheated_room'));
                    if ($floorToOutdoor) {
                        $H_transmission_for_HDD += $HT_floor * $shapeCorrection;
                    }

                    $thermalBridgesMultiplier = isset($internal['thermalBridgesMultiplier']) && is_numeric($internal['thermalBridgesMultiplier'])
                        ? (float) $internal['thermalBridgesMultiplier']
                        : 1.1;
                    $ventKey = isset($payload['ventilation_type']) ? (string) $payload['ventilation_type'] : '';
                    $eta_rec = (isset(self::VENTILATION[$ventKey]) && isset(self::VENTILATION[$ventKey]['eta_rec']))
                        ? (float) self::VENTILATION[$ventKey]['eta_rec']
                        : 0.0;
                    $H_total_for_HDD = $this->resolveHddHeatTransfer(
                        $buildingType,
                        $payload,
                        $HT_walls_external,
                        $HT_windows_doors,
                        $HT_roof,
                        $HT_floor,
                        $shapeCorrection,
                        $thermalBridgesMultiplier,
                        $H_ventilation,
                        $eta_rec
                    );
                    if (isset($ozcResult['assumptions']) && is_array($ozcResult['assumptions'])) {
                        $ozcResult['assumptions'][] = 'Annual energy: reconstructed H_total_for_HDD from _internal';
                    }
                } else {
                    throw new \RuntimeException('H_total_for_HDD missing: cannot reconstruct from _internal (missing areas or U_values)');
                }
            }

            if (!is_numeric($H_total_for_HDD) || (float) $H_total_for_HDD <= 0) {
                throw new \RuntimeException('H_total_for_HDD missing or invalid');
            }

            $utilization = isset(self::DEFAULTS['annualEnergy']['utilizationFactor'])
                ? (float) self::DEFAULTS['annualEnergy']['utilizationFactor']
                : 0.72;
            $utilization = $this->clamp($utilization, 0.5, 1.0);
            $E_kWh = ((float) $H_total_for_HDD * (float) $hdd_base * 24) / 1000.0;
            $E_kWh *= $utilization;
            if (isset($ozcResult['assumptions']) && is_array($ozcResult['assumptions'])) {
                $ozcResult['assumptions'][] = 'Annual energy: HDD estimate scaled by utilizationFactor=' .
                    number_format($utilization, 2, '.', '') . ' (internal gains / non-full-load allowance; non-certificate)';
            }
            return round($E_kWh);
        }

        private function convertToCieploAppFormat($ozcResult, $payload, $extendedData = null) {
            if (isset($ozcResult['geometry']) && is_array($ozcResult['geometry']) && isset($ozcResult['geometry']['floorArea'])) {
                $floorAreaNetto = (float) $ozcResult['geometry']['floorArea'];
                $floorAreaBrutto = isset($ozcResult['geometry']['floorAreaBrutto']) ? (float) $ozcResult['geometry']['floorAreaBrutto'] : $floorAreaNetto;
            } else {
                if (isset($payload['floor_area']) && is_numeric($payload['floor_area'])) {
                    $floorAreaBrutto = (float) $payload['floor_area'];
                    $floorAreaNetto = (float) $payload['floor_area'];
                } elseif (isset($payload['building_length']) && isset($payload['building_width']) && is_numeric($payload['building_length']) && is_numeric($payload['building_width'])) {
                    $floorAreaBrutto = (float) $payload['building_length'] * (float) $payload['building_width'];
                    $floorAreaNetto = $floorAreaBrutto;
                } else {
                    $floorAreaBrutto = 100.0;
                    $floorAreaNetto = 100.0;
                }
            }

            $heatedFloorsCount =
                (isset($payload['building_heated_floors']) && is_array($payload['building_heated_floors']) && count($payload['building_heated_floors']) > 0)
                    ? (int) count($payload['building_heated_floors'])
                    : ((isset($payload['building_floors']) && is_numeric($payload['building_floors'])) ? (int) $payload['building_floors'] : 1);
            $totalFloors = (isset($payload['building_floors']) && is_numeric($payload['building_floors'])) ? (float) $payload['building_floors'] : 1.0;

            $atticCtx = $this->resolveAtticHeatingContext($payload);
            $atticHeatedMult = (float) self::DEFAULTS['attic']['heatedAreaMultiplier'];
            $atticExtraTotalFactor = (float) self::DEFAULTS['attic']['extraTotalAreaBruttoFactor'];

            $totalArea = $floorAreaBrutto * $totalFloors;
            if ($atticCtx['addExtraTotalArea']) {
                $totalArea += $floorAreaBrutto * $atticExtraTotalFactor;
            }

            $heatedArea = 0.0;
            for ($i = 0; $i < $heatedFloorsCount; $i++) {
                $isAttic = $atticCtx['applyOnLastHeatedFloor'] && $i === ($heatedFloorsCount - 1);
                $heatedArea += $isAttic ? ($floorAreaNetto * $atticHeatedMult) : $floorAreaNetto;
            }

            $maxPower = isset($ozcResult['designHeatLoss_kW']) ? (float) $ozcResult['designHeatLoss_kW'] : 0.0;
            $climate = $this->resolveClimate($payload);
            $designOutdoorTemp = (float) $climate['theta_e'];
            $avgOutdoorTemp = (float) $climate['theta_avg_season'];
            $indoorTemp = $this->getIndoorTemp($payload);

            $annualEnergy = $this->computeAnnualEnergy_kWh($payload, $ozcResult, $climate);
            $designDeltaT = $indoorTemp - $designOutdoorTemp;
            $avgDeltaT = $indoorTemp - $avgOutdoorTemp;
            $tempRatio = $designDeltaT > 0 ? $avgDeltaT / $designDeltaT : 0.5;
            $avgHeatingPower = $maxPower * $tempRatio;

            $bivalentTemp = -6;
            $bivalentDeltaT = $indoorTemp - $bivalentTemp;
            $bivalentPower = $designDeltaT > 0 ? $maxPower * ($bivalentDeltaT / $designDeltaT) : $maxPower * 0.659;
            $energyFactor = $heatedArea > 0 ? $annualEnergy / $heatedArea : 0.0;
            $warnings = $this->normalizeWarningRecords(isset($ozcResult['warnings']) ? $ozcResult['warnings'] : array());
            $assumptions = $this->normalizeAssumptionRecords(isset($ozcResult['assumptions']) ? $ozcResult['assumptions'] : array());
            $reasonCodes = array();
            if (isset($ozcResult['defaultsUsed']) && is_array($ozcResult['defaultsUsed'])) {
                foreach ($ozcResult['defaultsUsed'] as $defaultRecord) {
                    if (is_array($defaultRecord) && isset($defaultRecord['code']) && is_string($defaultRecord['code']) && trim($defaultRecord['code']) !== '') {
                        $reasonCodes[] = trim($defaultRecord['code']);
                    }
                }
            }

            $result = array(
                'id' => 'OZC-' . (int) round(microtime(true) * 1000),
                'total_area' => round($totalArea),
                'heated_area' => round($heatedArea),
                'design_outdoor_temperature' => $designOutdoorTemp,
                'max_heating_power' => round($maxPower * 100) / 100,
                'recommended_power_kw' => round($maxPower * 100) / 100,
                'hot_water_power' => $this->calculateHotWaterPower($payload),
                'bivalent_point_heating_power' => round($bivalentPower * 100) / 100,
                'avg_heating_power' => round($avgHeatingPower * 100) / 100,
                'avg_outdoor_temperature' => $avgOutdoorTemp,
                'annual_energy_consumption' => $annualEnergy,
                'annual_energy_consumption_factor' => round($energyFactor),
                'avg_daily_energy_consumption' => round($annualEnergy / 365),
                'heating_power_factor' => round((isset($ozcResult['heatLossPerM2']) ? (float) $ozcResult['heatLossPerM2'] : 0.0) * 100) / 100,
                'source' => 'internal_ozc_engine',
                'fallback' => false,
                'warnings' => $warnings,
                'assumptions' => $assumptions,
                'reasonCodes' => array_values(array_unique($reasonCodes)),
            );

            if (is_array($extendedData)) {
                $result['extended'] = array(
                    'energy_losses' => (isset($extendedData['energy_losses']) && is_array($extendedData['energy_losses'])) ? $extendedData['energy_losses'] : array(),
                    'improvements' => (isset($extendedData['improvements']) && is_array($extendedData['improvements'])) ? $extendedData['improvements'] : array(),
                    'heating_costs' => (isset($extendedData['heating_costs']) && is_array($extendedData['heating_costs'])) ? $extendedData['heating_costs'] : array(),
                    'heating_costs_assumptions' => (isset($extendedData['heating_costs_assumptions']) && is_array($extendedData['heating_costs_assumptions'])) ? $extendedData['heating_costs_assumptions'] : null,
                    'bivalent_points' => $this->calculateBivalentPoints($maxPower, $designOutdoorTemp, $avgOutdoorTemp, $this->getIndoorTemp($payload)),
                );
            }

            $audit = $this->buildOzcAudit($result, isset($ozcResult['defaultsUsed']) && is_array($ozcResult['defaultsUsed']) ? $ozcResult['defaultsUsed'] : array());
            $validationWarnings = $this->buildValidationWarnings($result, $audit);
            if (!empty($validationWarnings)) {
                $result['warnings'] = array_merge($result['warnings'], $validationWarnings);
                foreach ($validationWarnings as $warning) {
                    if (is_array($warning) && isset($warning['code']) && is_string($warning['code']) && trim($warning['code']) !== '') {
                        $result['reasonCodes'][] = trim($warning['code']);
                    }
                }
                $result['reasonCodes'] = array_values(array_unique($result['reasonCodes']));
            }
            $result['audit'] = $audit;

            return $result;
        }

        private function calculateOZCWithExtended($payload) {
            $ozcResult = $this->calculateOZC($payload);
            $extendedData = array();

            if (isset($ozcResult['_internal']) && is_array($ozcResult['_internal']) && isset($ozcResult['breakdown']) && is_array($ozcResult['breakdown'])) {
                $internal = $ozcResult['_internal'];
                $extendedData['energy_losses'] = $this->calculateEnergyLosses(
                    $ozcResult['breakdown'],
                    $internal['areas'],
                    $internal['U_values'],
                    $internal['deltaT'],
                    isset($internal['deltaT_ground']) ? $internal['deltaT_ground'] : $internal['deltaT'],
                    $ozcResult['designHeatLoss_W'],
                    $payload,
                    array(
                        'A_walls_external' => isset($internal['walls_external']) ? $internal['walls_external'] : null,
                        'A_walls_adjacent' => isset($internal['walls_adjacent']) ? $internal['walls_adjacent'] : null,
                        'dT_adjacent' => isset($internal['dT_adjacent']) ? $internal['dT_adjacent'] : null,
                        'shapeCorrection' => isset($internal['shapeCorrection']) ? $internal['shapeCorrection'] : null,
                    )
                );
            }

            if (isset($ozcResult['_internal']) && is_array($ozcResult['_internal'])) {
                $extendedData['improvements'] = $this->calculateImprovements(
                    $payload,
                    $ozcResult,
                    $ozcResult['_internal']['areas'],
                    $ozcResult['_internal']['U_values']
                );
            }

            $climate = $this->resolveClimate($payload);
            $annualEnergy = $this->computeAnnualEnergy_kWh($payload, $ozcResult, $climate);
            $heatingCosts = $this->calculateHeatingCostsDetailed(
                array(
                    'annualCoKWh' => $annualEnergy,
                    'annualCwuKWh' => $this->estimateAnnualCwuEnergyKWh($payload),
                    'electricityPLNperKWh' => array_key_exists('electricityPLNperKWh', $payload) && $payload['electricityPLNperKWh'] !== '' ? $payload['electricityPLNperKWh'] : null,
                    'gasPLNperKWh' => array_key_exists('gasPLNperKWh', $payload) && $payload['gasPLNperKWh'] !== '' ? $payload['gasPLNperKWh'] : null,
                    'pelletPLNperKWh' => array_key_exists('pelletPLNperKWh', $payload) && $payload['pelletPLNperKWh'] !== '' ? $payload['pelletPLNperKWh'] : null,
                    'woodPLNperKWh' => array_key_exists('woodPLNperKWh', $payload) && $payload['woodPLNperKWh'] !== '' ? $payload['woodPLNperKWh'] : null,
                    'coalPLNperKWh' => array_key_exists('coalPLNperKWh', $payload) && $payload['coalPLNperKWh'] !== '' ? $payload['coalPLNperKWh'] : null,
                    'pelletPLNperTon' => array_key_exists('pelletPLNperTon', $payload) && $payload['pelletPLNperTon'] !== '' ? $payload['pelletPLNperTon'] : null,
                    'pelletKWhPerTon' => array_key_exists('pelletKWhPerTon', $payload) && $payload['pelletKWhPerTon'] !== '' ? $payload['pelletKWhPerTon'] : null,
                    'woodPLNperMp' => array_key_exists('woodPLNperMp', $payload) && $payload['woodPLNperMp'] !== '' ? $payload['woodPLNperMp'] : null,
                    'woodKWhPerMp' => array_key_exists('woodKWhPerMp', $payload) && $payload['woodKWhPerMp'] !== '' ? $payload['woodKWhPerMp'] : null,
                    'coalPLNperTon' => array_key_exists('coalPLNperTon', $payload) && $payload['coalPLNperTon'] !== '' ? $payload['coalPLNperTon'] : null,
                    'coalKWhPerTon' => array_key_exists('coalKWhPerTon', $payload) && $payload['coalKWhPerTon'] !== '' ? $payload['coalKWhPerTon'] : null,
                    'scopUsed' => array_key_exists('scopUsed', $payload) && $payload['scopUsed'] !== '' ? $payload['scopUsed'] : null,
                    'gasEfficiency' => array_key_exists('gasEfficiency', $payload) && $payload['gasEfficiency'] !== '' ? $payload['gasEfficiency'] : null,
                    'pelletEfficiency' => array_key_exists('pelletEfficiency', $payload) && $payload['pelletEfficiency'] !== '' ? $payload['pelletEfficiency'] : null,
                    'coalEfficiency' => array_key_exists('coalEfficiency', $payload) && $payload['coalEfficiency'] !== '' ? $payload['coalEfficiency'] : null,
                    'woodEfficiency' => array_key_exists('woodEfficiency', $payload) && $payload['woodEfficiency'] !== '' ? $payload['woodEfficiency'] : null,
                    'electricEfficiency' => array_key_exists('electricEfficiency', $payload) && $payload['electricEfficiency'] !== '' ? $payload['electricEfficiency'] : null,
                ),
                $ozcResult['designHeatLoss_kW']
            );
            $extendedData['heating_costs'] = isset($heatingCosts['rows']) && is_array($heatingCosts['rows']) ? $heatingCosts['rows'] : array();
            $extendedData['heating_costs_assumptions'] = isset($heatingCosts['assumptions']) && is_array($heatingCosts['assumptions'])
                ? $heatingCosts['assumptions']
                : null;

            return $this->convertToCieploAppFormat($ozcResult, $payload, $extendedData);
        }

        public function computeDesignHeatLoss($building, $preferences) {
            $payload = is_array($building) ? $building : array();
            $preferences = is_array($preferences) ? $preferences : array();
            $default_location_assumed = false;
            $default_floor_area_assumed = false;

            if (!isset($payload['heating_type']) || $payload['heating_type'] === '') {
                $payload['heating_type'] = $this->dig($preferences, array('heating', 'emitterType'));
            }
            if (!isset($payload['ventilation_type']) || $payload['ventilation_type'] === '') {
                $payload['ventilation_type'] = $this->dig($preferences, array('heating', 'ventilationType'));
            }
            if (!isset($payload['indoor_temperature']) || $payload['indoor_temperature'] === '') {
                $payload['indoor_temperature'] = $this->dig($preferences, array('heating', 'indoorTemperatureC'));
            }
            if (!array_key_exists('include_hot_water', $payload)) {
                $payload['include_hot_water'] = $this->dig($preferences, array('dhw', 'enabled'), false) ? true : false;
            }
            if (!isset($payload['hot_water_persons']) || $payload['hot_water_persons'] === '') {
                $payload['hot_water_persons'] = $this->dig($preferences, array('dhw', 'persons'));
            }
            if (!isset($payload['hot_water_usage']) || $payload['hot_water_usage'] === '') {
                $payload['hot_water_usage'] = $this->dig($preferences, array('dhw', 'usageProfile'));
            }
            if (!isset($payload['location_id']) || trim((string) $payload['location_id']) === '') {
                $payload['location_id'] = 'PL_STREFA_III';
                $default_location_assumed = true;
            } else {
                $payload['location_id'] = $this->normalizeLocationId($payload['location_id']);
            }
            if (
                (!isset($payload['floor_area']) || !is_numeric($payload['floor_area']) || (float) $payload['floor_area'] <= 0.0)
            ) {
                $legacy_area = $this->dig($payload, array('heated_area'));
                if (!is_numeric($legacy_area) || (float) $legacy_area <= 0.0) {
                    $legacy_area = $this->dig($payload, array('total_area'));
                }
                if (is_numeric($legacy_area) && (float) $legacy_area > 0.0) {
                    $payload['floor_area'] = (float) $legacy_area;
                } elseif (
                    isset($payload['building_length']) && is_numeric($payload['building_length']) &&
                    isset($payload['building_width']) && is_numeric($payload['building_width']) &&
                    (float) $payload['building_length'] > 0.0 &&
                    (float) $payload['building_width'] > 0.0
                ) {
                    $payload['floor_area'] = (float) $payload['building_length'] * (float) $payload['building_width'];
                } else {
                    $payload['floor_area'] = 100.0;
                    $default_floor_area_assumed = true;
                }
            }

            $raw = $this->calculateOZC($payload);
            $formatted = $this->calculateOZCWithExtended($payload);
            $warnings = $this->normalizeWarningRecords(isset($formatted['warnings']) ? $formatted['warnings'] : array());
            $assumptions = $this->normalizeAssumptionRecords(isset($formatted['assumptions']) ? $formatted['assumptions'] : array());

            if ($default_location_assumed) {
                $warnings[] = array(
                    'code' => 'DEFAULT_LOCATION_ASSUMED',
                    'message' => 'location_id missing; default_location=PL_STREFA_III',
                );
                $assumptions[] = array(
                    'code' => 'DEFAULT_LOCATION_ASSUMED',
                    'params' => array(
                        'defaultLocationId' => 'PL_STREFA_III',
                    ),
                );
            }

            if ($default_floor_area_assumed) {
                $warnings[] = array(
                    'code' => 'DEFAULT_FLOOR_AREA_ASSUMED',
                    'message' => 'floor_area missing; default_floor_area=100',
                );
                $assumptions[] = array(
                    'code' => 'DEFAULT_FLOOR_AREA_ASSUMED',
                    'params' => array(
                        'defaultFloorArea' => 100.0,
                    ),
                );
            }

            $reasonCodes = isset($formatted['reasonCodes']) && is_array($formatted['reasonCodes']) ? $formatted['reasonCodes'] : array();
            foreach ($warnings as $warning) {
                if (isset($warning['code'])) {
                    $reasonCodes[] = (string) $warning['code'];
                }
            }

            return array(
                'designHeatLoss_kW' => isset($raw['designHeatLoss_kW']) ? round((float) $raw['designHeatLoss_kW'], 2) : 0.0,
                'recommendedPower_kW' => isset($raw['designHeatLoss_kW']) ? round((float) $raw['designHeatLoss_kW'], 2) : 0.0,
                'heatedArea_m2' => isset($formatted['heated_area']) ? round((float) $formatted['heated_area'], 2) : 0.0,
                'hotWaterPower_kW' => isset($formatted['hot_water_power']) ? round((float) $formatted['hot_water_power'], 2) : 0.0,
                'assumptions' => $assumptions,
                'warnings' => $warnings,
                'reasonCodes' => array_values(array_unique($reasonCodes)),
                'source' => 'internal_ozc_engine',
                'metrics' => array(
                    'annual_energy_consumption' => isset($formatted['annual_energy_consumption']) ? (int) $formatted['annual_energy_consumption'] : null,
                    'annual_energy_consumption_factor' => isset($formatted['annual_energy_consumption_factor']) ? (int) $formatted['annual_energy_consumption_factor'] : null,
                    'avg_heating_power' => isset($formatted['avg_heating_power']) ? (float) $formatted['avg_heating_power'] : null,
                    'avg_outdoor_temperature' => isset($formatted['avg_outdoor_temperature']) ? (float) $formatted['avg_outdoor_temperature'] : null,
                    'design_outdoor_temperature' => isset($formatted['design_outdoor_temperature']) ? (float) $formatted['design_outdoor_temperature'] : null,
                    'heating_power_factor' => isset($formatted['heating_power_factor']) ? (float) $formatted['heating_power_factor'] : null,
                ),
                'extended' => isset($formatted['extended']) && is_array($formatted['extended']) ? $formatted['extended'] : array(),
                'audit' => isset($formatted['audit']) && is_array($formatted['audit']) ? $formatted['audit'] : null,
                'fallback' => array(
                    'used' => false,
                    'reasons' => array(),
                ),
            );
        }

        private function dig($data, $path, $default = null) {
            $cursor = $data;
            foreach ($path as $part) {
                if (!is_array($cursor) || !array_key_exists($part, $cursor)) {
                    return $default;
                }
                $cursor = $cursor[$part];
            }
            return $cursor;
        }

        /**
         * @param mixed $raw
         * @return string
         */
        private function normalizeLocationId($raw) {
            if (!is_string($raw) || trim($raw) === '') {
                return 'PL_STREFA_III';
            }

            $value = strtoupper(trim($raw));
            if ($value === 'PL_I') return 'PL_STREFA_I';
            if ($value === 'PL_II') return 'PL_STREFA_II';
            if ($value === 'PL_III') return 'PL_STREFA_III';
            if ($value === 'PL_IV') return 'PL_STREFA_IV';
            if ($value === 'PL_V') return 'PL_STREFA_V';

            return $value;
        }
    }
}

if (!class_exists('TopInstal_OzcEngine_Mvp')) {
    class TopInstal_OzcEngine_Mvp extends TopInstal_OzcEngine {
    }
}
if (!class_exists('TopInstal_OzcEngine_Full')) {
    /**
     * Canonical native PHP OZC runtime.
     *
     * Public class name and output contract stay unchanged, but active
     * calculate-offer execution no longer depends on Node/JS.
     */
    class TopInstal_OzcEngine_Full extends TopInstal_OzcEngine {
        /**
         * @param string|null $node_binary Kept for constructor compatibility.
         */
        public function __construct($node_binary = null) {
            unset($node_binary);
        }

        /**
         * @param array<string,mixed> $building
         * @param array<string,mixed> $preferences
         * @return array<string,mixed>
         */
        public function computeDesignHeatLoss($building, $preferences) {
            $building = is_array($building) ? $building : array();
            $preferences = is_array($preferences) ? $preferences : array();

            try {
                $build = $this->build_payload($building, $preferences);
                $payload = isset($build['payload']) && is_array($build['payload']) ? $build['payload'] : array();
                $bridge_audit = isset($build['bridgeAudit']) && is_array($build['bridgeAudit']) ? $build['bridgeAudit'] : array();

                $result = parent::computeDesignHeatLoss($payload, array());
                if (!is_array($result)) {
                    throw new \RuntimeException('Native PHP OZC runtime returned an invalid result.');
                }

                $raw = $this->calculateRaw($payload);
                $result['raw'] = is_array($raw) ? $raw : null;
                $result['audit'] = $this->merge_full_audit(
                    isset($result['audit']) && is_array($result['audit']) ? $result['audit'] : array(),
                    $bridge_audit
                );
                $result['assumptions'] = $this->merge_unique_records(
                    array(
                        array(
                            'code' => 'OZC_FULL_MODEL',
                            'params' => array(
                                'source' => 'internal_ozc_engine',
                                'runner' => 'php',
                            ),
                        ),
                    ),
                    isset($result['assumptions']) && is_array($result['assumptions']) ? $result['assumptions'] : array()
                );
                $result['assumptions'] = $this->merge_unique_records(
                    $result['assumptions'],
                    isset($bridge_audit['assumptions']) ? $this->normalize_assumptions($bridge_audit['assumptions']) : array()
                );
                $result['warnings'] = $this->merge_unique_records(
                    isset($result['warnings']) && is_array($result['warnings']) ? $result['warnings'] : array(),
                    isset($bridge_audit['warnings']) ? $this->normalize_warnings($bridge_audit['warnings']) : array()
                );
                $result['reasonCodes'] = $this->merge_reason_codes(
                    isset($result['reasonCodes']) && is_array($result['reasonCodes']) ? $result['reasonCodes'] : array(),
                    isset($result['warnings']) && is_array($result['warnings']) ? $result['warnings'] : array(),
                    isset($result['audit']['defaults_used']) && is_array($result['audit']['defaults_used']) ? $result['audit']['defaults_used'] : array()
                );
                $result['source'] = 'internal_ozc_engine';
                if (!isset($result['fallback']) || !is_array($result['fallback'])) {
                    $result['fallback'] = array(
                        'used' => false,
                        'reasons' => array(),
                    );
                }

                return $result;
            } catch (\Throwable $error) {
                return $this->fallback_to_parity($building, $preferences, $error);
            }
        }

        /**
         * @param array<string,mixed> $building
         * @param array<string,mixed> $preferences
         * @return array<string,mixed>
         */
        private function build_payload($building, $preferences) {
            $payload = is_array($building) ? $building : array();
            $bridge_audit = array(
                'defaultsUsed' => array(),
                'warnings' => array(),
                'assumptions' => array(),
            );

            if (!isset($payload['floor_area'])) {
                $fallback_area = $this->to_float($this->pick($payload, array('heated_area', 'total_area')), null);
                if ($fallback_area !== null && $fallback_area > 0) {
                    $payload['floor_area'] = $fallback_area;
                }
            }

            if (!isset($payload['heating_type']) || $payload['heating_type'] === '') {
                $payload['heating_type'] = $this->pick_first(array(
                    $this->dig($preferences, array('heating', 'emitterType')),
                    isset($payload['installation_type']) ? $payload['installation_type'] : null,
                ));
            }

            if (!isset($payload['ventilation_type']) || $payload['ventilation_type'] === '') {
                $payload['ventilation_type'] = $this->dig($preferences, array('heating', 'ventilationType'));
            }

            if (!isset($payload['indoor_temperature']) || $payload['indoor_temperature'] === '') {
                $payload['indoor_temperature'] = $this->dig($preferences, array('heating', 'indoorTemperatureC'));
            }

            $indoor_temperature = $this->to_float(isset($payload['indoor_temperature']) ? $payload['indoor_temperature'] : null, null);
            if ($indoor_temperature === null || $indoor_temperature < 10.0 || $indoor_temperature > 30.0) {
                $payload['indoor_temperature'] = 21.0;
                $bridge_audit['defaultsUsed'][] = array(
                    'code' => 'DEFAULT_INDOOR_TEMPERATURE_ASSUMED',
                    'params' => array(
                        'defaultIndoorTemperatureC' => 21.0,
                        'acceptedRangeC' => array(10.0, 30.0),
                        'source' => 'full_php_runtime',
                    ),
                );
                $bridge_audit['warnings'][] = array(
                    'code' => 'DEFAULT_INDOOR_TEMPERATURE_ASSUMED',
                    'message' => 'indoor_temperature missing or invalid; default_indoor_temperature=21',
                );
                $bridge_audit['assumptions'][] = array(
                    'code' => 'DEFAULT_INDOOR_TEMPERATURE_ASSUMED',
                    'params' => array(
                        'defaultIndoorTemperatureC' => 21.0,
                    ),
                );
            }

            if (!array_key_exists('include_hot_water', $payload)) {
                $payload['include_hot_water'] = $this->to_bool($this->dig($preferences, array('dhw', 'enabled')), false);
            }
            if (!isset($payload['hot_water_persons']) || $payload['hot_water_persons'] === '') {
                $payload['hot_water_persons'] = $this->dig($preferences, array('dhw', 'persons'));
            }
            if (!isset($payload['hot_water_usage']) || $payload['hot_water_usage'] === '') {
                $payload['hot_water_usage'] = $this->dig($preferences, array('dhw', 'usageProfile'));
            }

            if (!isset($payload['location_id']) || trim((string) $payload['location_id']) === '') {
                $payload['location_id'] = 'PL_STREFA_III';
                $bridge_audit['defaultsUsed'][] = array(
                    'code' => 'DEFAULT_LOCATION_ASSUMED',
                    'params' => array(
                        'defaultLocationId' => 'PL_STREFA_III',
                        'source' => 'full_php_runtime',
                    ),
                );
                $bridge_audit['warnings'][] = array(
                    'code' => 'DEFAULT_LOCATION_ASSUMED',
                    'message' => 'location_id missing; default_location=PL_STREFA_III',
                );
                $bridge_audit['assumptions'][] = array(
                    'code' => 'DEFAULT_LOCATION_ASSUMED',
                    'params' => array(
                        'defaultLocationId' => 'PL_STREFA_III',
                    ),
                );
            } else {
                $payload['location_id'] = $this->normalize_location_id($payload['location_id']);
            }

            return array(
                'payload' => $payload,
                'bridgeAudit' => $bridge_audit,
            );
        }

        /**
         * @param array<string,mixed> $audit
         * @param array<string,mixed> $bridge_audit
         * @return array<string,mixed>
         */
        private function merge_full_audit($audit, $bridge_audit) {
            $audit = is_array($audit) ? $audit : array();
            $defaults_used = isset($audit['defaults_used']) && is_array($audit['defaults_used']) ? $audit['defaults_used'] : array();
            $audit['defaults_used'] = $this->merge_unique_records(
                $defaults_used,
                isset($bridge_audit['defaultsUsed']) && is_array($bridge_audit['defaultsUsed']) ? $bridge_audit['defaultsUsed'] : array()
            );
            $audit['bridge'] = array(
                'runner' => 'php',
                'mode' => 'native_php_runtime',
                'defaults_used' => isset($bridge_audit['defaultsUsed']) && is_array($bridge_audit['defaultsUsed']) ? $bridge_audit['defaultsUsed'] : array(),
                'warnings' => isset($bridge_audit['warnings']) && is_array($bridge_audit['warnings']) ? $bridge_audit['warnings'] : array(),
            );

            return $audit;
        }

        /**
         * @param array<int,array<string,mixed>> $base
         * @param array<int,array<string,mixed>> $extra
         * @return array<int,array<string,mixed>>
         */
        private function merge_unique_records($base, $extra) {
            $base = is_array($base) ? $base : array();
            $extra = is_array($extra) ? $extra : array();
            $merged = array();
            $seen = array();

            foreach (array_merge($base, $extra) as $record) {
                if (!is_array($record)) {
                    continue;
                }
                $encoded = json_encode($record);
                $hash = md5((string) $encoded);
                if (isset($seen[$hash])) {
                    continue;
                }
                $seen[$hash] = true;
                $merged[] = $record;
            }

            return $merged;
        }

        /**
         * @param mixed $warnings
         * @return array<int,array<string,mixed>>
         */
        private function normalize_warnings($warnings) {
            if (!is_array($warnings)) {
                return array();
            }

            $normalized = array();
            foreach ($warnings as $warning) {
                if (is_array($warning) && isset($warning['code']) && isset($warning['message'])) {
                    $normalized[] = $warning;
                    continue;
                }
                if (is_string($warning) && trim($warning) !== '') {
                    $normalized[] = array(
                        'code' => 'OZC_WARNING',
                        'message' => trim($warning),
                    );
                }
            }

            return $normalized;
        }

        /**
         * @param mixed $assumptions
         * @return array<int,array<string,mixed>>
         */
        private function normalize_assumptions($assumptions) {
            if (!is_array($assumptions)) {
                return array();
            }

            $normalized = array();
            foreach ($assumptions as $assumption) {
                if (is_array($assumption) && isset($assumption['code'])) {
                    $normalized[] = $assumption;
                    continue;
                }
                if (is_string($assumption) && trim($assumption) !== '') {
                    $normalized[] = array(
                        'code' => 'OZC_ASSUMPTION',
                        'params' => array(
                            'message' => trim($assumption),
                        ),
                    );
                }
            }

            return $normalized;
        }

        /**
         * @param array<int,string> $reason_codes
         * @param array<int,array<string,mixed>> $records
         * @param array<int,array<string,mixed>> $defaults
         * @return array<int,string>
         */
        private function merge_reason_codes($reason_codes, $records = array(), $defaults = array()) {
            $collected = is_array($reason_codes) ? $reason_codes : array();
            foreach (array_merge(is_array($records) ? $records : array(), is_array($defaults) ? $defaults : array()) as $record) {
                if (is_array($record) && isset($record['code']) && is_string($record['code']) && trim($record['code']) !== '') {
                    $collected[] = trim($record['code']);
                }
            }
            return array_values(array_unique($collected));
        }

        /**
         * @param array<string,mixed> $building
         * @param array<string,mixed> $preferences
         * @param \Throwable $error
         * @return array<string,mixed>
         */
        private function fallback_to_parity($building, $preferences, $error) {
            $result = parent::computeDesignHeatLoss(
                is_array($building) ? $building : array(),
                is_array($preferences) ? $preferences : array()
            );

            $fallback_code = 'OZC_FULL_ENGINE_FAILED';
            $error_message = trim($error->getMessage()) !== ''
                ? trim($error->getMessage())
                : 'Unknown native OZC full-engine execution failure.';

            $warnings = isset($result['warnings']) && is_array($result['warnings']) ? $result['warnings'] : array();
            $warnings[] = array(
                'code' => $fallback_code,
                'message' => $error_message,
            );
            $warnings[] = array(
                'code' => 'OZC_PARITY_USED',
                'message' => 'Parity OZC fallback used after native full-engine failure.',
            );
            $result['warnings'] = $warnings;
            $result['reasonCodes'] = $this->merge_reason_codes(
                isset($result['reasonCodes']) && is_array($result['reasonCodes']) ? $result['reasonCodes'] : array(),
                $warnings
            );

            $assumptions = isset($result['assumptions']) && is_array($result['assumptions']) ? $result['assumptions'] : array();
            $assumptions[] = array(
                'code' => 'OZC_FULL_ENGINE_FALLBACK',
                'params' => array(
                    'fallback' => 'parity',
                ),
            );
            $result['assumptions'] = $assumptions;
            $result['fallback'] = array(
                'used' => true,
                'reasons' => array($fallback_code),
            );

            return $result;
        }

        /**
         * @param mixed $raw
         * @return string
         */
        private function normalize_location_id($raw) {
            if (!is_string($raw) || trim($raw) === '') {
                return 'PL_STREFA_III';
            }

            $value = strtoupper(trim($raw));
            if ($value === 'PL_I') return 'PL_STREFA_I';
            if ($value === 'PL_II') return 'PL_STREFA_II';
            if ($value === 'PL_III') return 'PL_STREFA_III';
            if ($value === 'PL_IV') return 'PL_STREFA_IV';
            if ($value === 'PL_V') return 'PL_STREFA_V';

            return $value;
        }

        /**
         * @param mixed $value
         * @param array<int|string,mixed> $fallback_keys
         * @return mixed
         */
        private function pick($value, $fallback_keys = array()) {
            if (is_array($fallback_keys) && is_array($value)) {
                foreach ($fallback_keys as $key) {
                    if (array_key_exists($key, $value) && $value[$key] !== null && $value[$key] !== '') {
                        return $value[$key];
                    }
                }
                return null;
            }

            foreach (func_get_args() as $arg) {
                if ($arg !== null && $arg !== '') {
                    return $arg;
                }
            }
            return null;
        }

        /**
         * @param array<int,mixed> $values
         * @return mixed
         */
        private function pick_first($values) {
            if (!is_array($values)) {
                return null;
            }
            foreach ($values as $value) {
                if ($value !== null && $value !== '') {
                    return $value;
                }
            }
            return null;
        }

        /**
         * @param array<string,mixed> $data
         * @param array<int,string> $path
         * @return mixed
         */
        private function dig($data, $path) {
            if (!is_array($data) || !is_array($path)) {
                return null;
            }

            $cursor = $data;
            foreach ($path as $segment) {
                if (!is_array($cursor) || !array_key_exists($segment, $cursor)) {
                    return null;
                }
                $cursor = $cursor[$segment];
            }

            return $cursor;
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
    }
}
