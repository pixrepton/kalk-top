<?php

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Minimal loader for calculator-side PDF / offer-document generation (shared WorkflowConfig + client).
 * Full mail-ingress workflow lives in the separate topinstal-mail-ingress plugin.
 */
$topinstal_offer_documents_bootstrap = array(
    dirname(__DIR__) . '/agents/SecretStore.php',
    dirname(__DIR__) . '/mail-ingress/WorkflowConfig.php',
    dirname(__DIR__) . '/mail-ingress/OfferDocumentsGeneratorClient.php',
);
foreach ($topinstal_offer_documents_bootstrap as $topinstal_offer_documents_file) {
    if (is_file($topinstal_offer_documents_file)) {
        require_once $topinstal_offer_documents_file;
    }
}
