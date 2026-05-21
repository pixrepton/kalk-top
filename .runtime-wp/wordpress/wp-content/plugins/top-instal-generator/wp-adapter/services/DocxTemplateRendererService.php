<?php

if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists('TopInstal_DocxTemplateRenderer_Service')) {
    class TopInstal_DocxTemplateRenderer_Service {
        /**
         * @param string $template_path
         * @param string $output_path
         * @param array<string,string> $placeholders
         * @return void
         */
        public function render($template_path, $output_path, $placeholders) {
            if (!class_exists('\PhpOffice\PhpWord\TemplateProcessor')) {
                throw new TopInstal_OfferDocument_Exception(
                    TopInstal_DocumentReasonCodes::DOCX_RENDER_FAILED,
                    'TemplateProcessor dependency is missing.',
                    500
                );
            }

            try {
                $tpl = new \PhpOffice\PhpWord\TemplateProcessor($template_path);
                if (method_exists($tpl, 'setMacroChars')) {
                    $tpl->setMacroChars('{{', '}}');
                }

                foreach ($placeholders as $key => $value) {
                    $tpl->setValue((string) $key, (string) $value);
                }

                $tpl->saveAs($output_path);
            } catch (Throwable $e) {
                throw new TopInstal_OfferDocument_Exception(
                    TopInstal_DocumentReasonCodes::DOCX_RENDER_FAILED,
                    'Failed to render DOCX document.',
                    500,
                    array(
                        'exception' => $e->getMessage(),
                    )
                );
            }
        }
    }
}

