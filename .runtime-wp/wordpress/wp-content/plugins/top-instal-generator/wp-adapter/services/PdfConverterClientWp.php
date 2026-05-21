<?php

if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists('TopInstal_PdfConverterClient_Wp')) {
    class TopInstal_PdfConverterClient_Wp {
        /** @var TopInstal_Generator_Config_Wp */
        private $config;

        /**
         * @param TopInstal_Generator_Config_Wp|null $config
         */
        public function __construct($config = null) {
            $this->config = $config ?: new TopInstal_Generator_Config_Wp();
        }

        /**
         * @param string $docx_path
         * @param string $pdf_output_path
         * @return array<string,mixed>
         */
        public function convert_docx_to_pdf($docx_path, $pdf_output_path) {
            $converter_url = trim((string) $this->config->get_pdf_converter_url());
            $converter_token = trim((string) $this->config->get_pdf_converter_token());
            $remote_result = $this->convert_via_remote_converter($docx_path, $pdf_output_path, $converter_url, $converter_token);
            if (!empty($remote_result['ok'])) {
                return $remote_result;
            }

            $local_result = $this->convert_via_local_soffice($docx_path, $pdf_output_path);
            if (!empty($local_result['ok'])) {
                return $local_result;
            }

            $message_parts = array();
            if (!empty($remote_result['errorMessage'])) {
                $message_parts[] = 'remote: ' . (string) $remote_result['errorMessage'];
            }
            if (!empty($local_result['errorMessage'])) {
                $message_parts[] = 'local: ' . (string) $local_result['errorMessage'];
            }

            return array(
                'ok' => false,
                'errorCode' => !empty($remote_result['errorCode'])
                    ? $remote_result['errorCode']
                    : TopInstal_DocumentReasonCodes::PDF_CONVERSION_FAILED,
                'errorMessage' => !empty($message_parts)
                    ? implode(' | ', $message_parts)
                    : 'PDF conversion failed.',
                'httpCode' => isset($remote_result['httpCode']) ? (int) $remote_result['httpCode'] : 0,
            );
        }

        /**
         * @param string $docx_path
         * @param string $pdf_output_path
         * @param string $converter_url
         * @param string $converter_token
         * @return array<string,mixed>
         */
        private function convert_via_remote_converter($docx_path, $pdf_output_path, $converter_url, $converter_token) {
            if ($converter_url === '' || $converter_token === '') {
                return array(
                    'ok' => false,
                    'errorCode' => TopInstal_DocumentReasonCodes::PDF_CONVERTER_UNAVAILABLE,
                    'errorMessage' => 'PDF converter URL/token is not configured.',
                    'httpCode' => 0,
                );
            }

            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $converter_url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
            curl_setopt($ch, CURLOPT_TIMEOUT, 60);
            curl_setopt($ch, CURLOPT_HTTPHEADER, array(
                'X-Converter-Token: ' . $converter_token,
            ));
            curl_setopt($ch, CURLOPT_POSTFIELDS, array(
                'files' => new CURLFile(
                    $docx_path,
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    basename($docx_path)
                ),
            ));

            $response = curl_exec($ch);
            $http_code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $error = (string) curl_error($ch);
            curl_close($ch);

            if ($this->config->get_pdf_debug_log_enabled() || (defined('WP_DEBUG') && WP_DEBUG)) {
                @file_put_contents(
                    rtrim((string) TOP_INSTAL_PLUGIN_PATH, '/\\') . '/curl_debug.txt',
                    print_r(array(
                        'converter_url' => $converter_url,
                        'http_code' => $http_code,
                        'error' => $error,
                        'response_len' => is_string($response) ? strlen($response) : 0,
                        'source_file' => $docx_path,
                    ), true)
                );
            }

            if ($http_code === 200 && is_string($response) && strlen($response) > 0) {
                @file_put_contents($pdf_output_path, $response);
                return array(
                    'ok' => true,
                    'errorCode' => null,
                    'errorMessage' => null,
                    'httpCode' => $http_code,
                    'method' => 'remote-converter',
                );
            }

            return array(
                'ok' => false,
                'errorCode' => TopInstal_DocumentReasonCodes::PDF_CONVERSION_FAILED,
                'errorMessage' => $error !== '' ? $error : 'Converter returned non-200 response.',
                'httpCode' => $http_code,
            );
        }

        /**
         * @param string $docx_path
         * @param string $pdf_output_path
         * @return array<string,mixed>
         */
        private function convert_via_local_soffice($docx_path, $pdf_output_path) {
            $binary = $this->find_local_soffice_binary();
            if ($binary === '') {
                return array(
                    'ok' => false,
                    'errorCode' => TopInstal_DocumentReasonCodes::PDF_CONVERTER_UNAVAILABLE,
                    'errorMessage' => 'Local LibreOffice binary not found.',
                    'httpCode' => 0,
                );
            }

            $output_dir = dirname($pdf_output_path);
            if (!is_dir($output_dir)) {
                return array(
                    'ok' => false,
                    'errorCode' => TopInstal_DocumentReasonCodes::PDF_CONVERSION_FAILED,
                    'errorMessage' => 'PDF output directory does not exist.',
                    'httpCode' => 0,
                );
            }

            if (is_file($pdf_output_path)) {
                @unlink($pdf_output_path);
            }

            $command = sprintf(
                '%s --headless --nologo --nofirststartwizard --convert-to pdf --outdir %s %s',
                escapeshellarg($binary),
                escapeshellarg($output_dir),
                escapeshellarg($docx_path)
            );

            $output = array();
            $exit_code = 0;
            @exec($command . ' 2>&1', $output, $exit_code);

            if ($exit_code === 0 && is_file($pdf_output_path) && filesize($pdf_output_path) > 0) {
                return array(
                    'ok' => true,
                    'errorCode' => null,
                    'errorMessage' => null,
                    'httpCode' => 200,
                    'method' => 'local-soffice',
                );
            }

            return array(
                'ok' => false,
                'errorCode' => TopInstal_DocumentReasonCodes::PDF_CONVERSION_FAILED,
                'errorMessage' => !empty($output)
                    ? implode("\n", $output)
                    : 'Local LibreOffice conversion failed.',
                'httpCode' => 0,
            );
        }

        /**
         * @return string
         */
        private function find_local_soffice_binary() {
            $candidates = array(
                'C:\\Program Files\\LibreOffice\\program\\soffice.com',
                'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
                'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.com',
                'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
            );

            foreach ($candidates as $candidate) {
                if (is_string($candidate) && $candidate !== '' && is_file($candidate)) {
                    return $candidate;
                }
            }

            return '';
        }
    }
}
