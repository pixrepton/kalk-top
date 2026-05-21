<?php

if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists('TopInstal_Generator_Config_Wp')) {
    class TopInstal_Generator_Config_Wp {
        /**
         * @param string $option_name
         * @param string $const_name
         * @param string $default
         * @return string
         */
        public function get_string($option_name, $const_name, $default = '') {
            if (defined($const_name)) {
                $constant = constant($const_name);
                if (is_string($constant) && trim($constant) !== '') {
                    return trim($constant);
                }
            }

            $env_value = getenv($const_name);
            if (is_string($env_value) && trim($env_value) !== '') {
                return trim($env_value);
            }

            if (function_exists('get_option')) {
                $option = get_option($option_name, '');
                if (is_string($option) && trim($option) !== '') {
                    return trim($option);
                }
            }

            return (string) $default;
        }

        /**
         * @return string
         */
        public function get_pdf_converter_url() {
            return $this->get_string(
                'top_instal_pdf_converter_url',
                'TOP_INSTAL_PDF_CONVERTER_URL',
                defined('TOP_INSTAL_PDF_CONVERTER_URL_DEFAULT') ? (string) TOP_INSTAL_PDF_CONVERTER_URL_DEFAULT : ''
            );
        }

        /**
         * @return string
         */
        public function get_pdf_converter_token() {
            return $this->get_string(
                'top_instal_pdf_converter_token',
                'TOP_INSTAL_PDF_CONVERTER_TOKEN',
                defined('TOP_INSTAL_PDF_CONVERTER_TOKEN_DEFAULT') ? (string) TOP_INSTAL_PDF_CONVERTER_TOKEN_DEFAULT : ''
            );
        }

        /**
         * @return bool
         */
        public function get_pdf_debug_log_enabled() {
            $raw = $this->get_string('top_instal_pdf_debug_log', 'TOP_INSTAL_PDF_DEBUG_LOG', '');
            if ($raw === '') {
                return (bool) (function_exists('get_option') ? get_option('top_instal_pdf_debug_log', false) : false);
            }
            $normalized = strtolower(trim((string) $raw));
            return in_array($normalized, array('1', 'true', 'yes', 'on'), true);
        }

        /**
         * @return string
         */
        public function get_agent_api_key() {
            return $this->get_string('top_instal_agent_api_key', 'TOP_INSTAL_AGENT_API_KEY', '');
        }
    }
}

