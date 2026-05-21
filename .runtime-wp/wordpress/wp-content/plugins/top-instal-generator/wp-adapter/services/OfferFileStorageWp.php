<?php

if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists('TopInstal_OfferFileStorage_Wp')) {
    class TopInstal_OfferFileStorage_Wp {
        /**
         * @param string $installation_type
         * @param string $trace_id
         * @return array<string,string>
         */
        public function create_docx_paths($installation_type, $trace_id) {
            $upload_dir = wp_upload_dir();
            $base_dir = isset($upload_dir['basedir']) ? (string) $upload_dir['basedir'] : '';
            $base_url = isset($upload_dir['baseurl']) ? (string) $upload_dir['baseurl'] : '';
            if ($base_dir === '' || $base_url === '') {
                throw new TopInstal_OfferDocument_Exception(
                    TopInstal_DocumentReasonCodes::STORAGE_ERROR,
                    'Uploads directory is unavailable.',
                    500
                );
            }

            $output_dir = rtrim($base_dir, '/\\') . '/top-instal-offers';
            if (!is_dir($output_dir) && !wp_mkdir_p($output_dir)) {
                throw new TopInstal_OfferDocument_Exception(
                    TopInstal_DocumentReasonCodes::STORAGE_ERROR,
                    'Cannot create output directory.',
                    500,
                    array('outputDir' => $output_dir)
                );
            }

            $safe_trace = preg_replace('/[^a-zA-Z0-9\-_]/', '', (string) $trace_id);
            if (!is_string($safe_trace) || $safe_trace === '') {
                $safe_trace = 'trace';
            }
            $timestamp = gmdate('Y-m-d_H-i-s');
            $prefix = $installation_type === 'floor_heating' ? 'Oferta-Podlogowka' : 'Oferta-PC-Panasonic';
            $filename = $prefix . '_' . $timestamp . '_' . substr($safe_trace, 0, 12) . '.docx';
            $path = rtrim($output_dir, '/\\') . '/' . $filename;

            return array(
                'outputDir' => $output_dir,
                'docxFilename' => $filename,
                'docxPath' => $path,
                'docxUrl' => rtrim($base_url, '/\\') . '/top-instal-offers/' . $filename,
            );
        }

        /**
         * @param array<string,string> $paths
         * @return array<string,string>
         */
        public function to_pdf_paths($paths) {
            $docx_filename = isset($paths['docxFilename']) ? (string) $paths['docxFilename'] : '';
            $docx_path = isset($paths['docxPath']) ? (string) $paths['docxPath'] : '';
            $docx_url = isset($paths['docxUrl']) ? (string) $paths['docxUrl'] : '';

            $pdf_filename = str_replace('.docx', '.pdf', $docx_filename);
            return array(
                'pdfFilename' => $pdf_filename,
                'pdfPath' => str_replace('.docx', '.pdf', $docx_path),
                'pdfUrl' => str_replace('.docx', '.pdf', $docx_url),
            );
        }

        /**
         * @param string $output_dir
         * @return void
         */
        public function cleanup_old_files($output_dir) {
            $max_age = 30 * 24 * 60 * 60;
            foreach (glob(rtrim((string) $output_dir, '/\\') . '/*.{docx,pdf}', GLOB_BRACE) as $file) {
                if (!is_file($file)) {
                    continue;
                }
                if ((time() - (int) filemtime($file)) > $max_age) {
                    @unlink($file);
                }
            }
        }
    }
}

