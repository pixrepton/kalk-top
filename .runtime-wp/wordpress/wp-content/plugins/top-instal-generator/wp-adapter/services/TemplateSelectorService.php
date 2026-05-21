<?php

if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists('TopInstal_TemplateSelector_Service')) {
    class TopInstal_TemplateSelector_Service {
        /**
         * @param array<string,mixed> $input
         * @param array<string,mixed>|null $kit_info
         * @param string $kit_group
         * @return array{templateName:string,templateKey:string}
         */
        public function select($input, $kit_info, $kit_group) {
            $installation_type = isset($input['installationType']) ? (string) $input['installationType'] : 'heat_pump';
            $has_buffer = !empty($input['bufferEnabled']);
            $has_cwu = !empty($input['tankEnabled']);
            $kit_group = (string) $kit_group;

            if ($installation_type === 'floor_heating') {
                return array(
                    'templateName' => 'szablon-podloga-parter-poddasze-garaz.docx',
                    'templateKey' => 'floor-heating-standard',
                );
            }

            $is_all_in_one = strpos($kit_group, 'all_in_one') !== false;
            $is_tcap = strpos($kit_group, 'tcap') !== false;
            $voltage = is_array($kit_info) && isset($kit_info['voltage']) ? (string) $kit_info['voltage'] : '';
            $is_3_phase = strtoupper(trim($voltage)) === '400V';

            if ($is_all_in_one) {
                if ($kit_group === 'all_in_one_185') {
                    $template = $is_3_phase
                        ? ($has_buffer ? 'szablon-3f-aio-cwu185-bufor.docx' : 'szablon-3f-aio-cwu185.docx')
                        : ($has_buffer ? 'szablon-1f-aio-cwu-bufor.docx' : 'szablon-1f-aio-cwu.docx');
                    return array('templateName' => $template, 'templateKey' => str_replace('.docx', '', $template));
                }

                if ($kit_group === 'all_in_one_260') {
                    $template = $has_buffer ? 'szablon-3f-aio-cwu260-bufor.docx' : 'szablon-3f-aio-cwu260.docx';
                    return array('templateName' => $template, 'templateKey' => str_replace('.docx', '', $template));
                }

                if ($kit_group === 'all_in_one_2strefowy') {
                    $template = $has_buffer ? 'szablon-1f-aio-cwu-bufor.docx' : 'szablon-1f-aio-cwu.docx';
                    return array('templateName' => $template, 'templateKey' => str_replace('.docx', '', $template));
                }
            }

            if ($is_tcap && strpos($kit_group, 'tcap_aio') !== false) {
                if ($kit_group === 'tcap_aio_260') {
                    $template = $has_buffer ? 'szablon-3f-aio-cwu260-bufor.docx' : 'szablon-3f-aio-cwu260.docx';
                    return array('templateName' => $template, 'templateKey' => str_replace('.docx', '', $template));
                }

                $template = $is_3_phase
                    ? ($has_buffer ? 'szablon-3f-aio-cwu185-bufor.docx' : 'szablon-3f-aio-cwu185.docx')
                    : ($has_buffer ? 'szablon-1f-aio-cwu-bufor.docx' : 'szablon-1f-aio-cwu.docx');
                return array('templateName' => $template, 'templateKey' => str_replace('.docx', '', $template));
            }

            if ($is_3_phase) {
                if ($has_cwu && $has_buffer) {
                    $template = 'szablon-3f-split-cwu-bufor.docx';
                } elseif ($has_cwu) {
                    $template = 'szablon-3f-split-cwu.docx';
                } elseif ($has_buffer) {
                    $template = 'szablon-3f-split-bufor.docx';
                } else {
                    $template = 'szablon-3f-split.docx';
                }
                return array('templateName' => $template, 'templateKey' => str_replace('.docx', '', $template));
            }

            if ($has_cwu && $has_buffer) {
                $template = 'szablon-1f-split-cwu-bufor.docx';
            } elseif ($has_cwu) {
                $template = 'szablon-1f-split-cwu.docx';
            } elseif ($has_buffer) {
                $template = 'szablon-1f-split-bufor.docx';
            } else {
                $template = 'szablon-1f-split.docx';
            }

            return array('templateName' => $template, 'templateKey' => str_replace('.docx', '', $template));
        }
    }
}

