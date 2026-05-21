<?php

if (!defined('ABSPATH')) {
    exit;
}

if (!function_exists('topinstal_generator_register_ajax')) {
    /**
     * @return void
     */
    function topinstal_generator_register_ajax() {
        if (class_exists('TopInstal_Ajax_Kits_Controller')) {
            TopInstal_Ajax_Kits_Controller::register_hooks();
        }
        if (class_exists('TopInstal_Ajax_GenerateOfferDocument_Controller')) {
            TopInstal_Ajax_GenerateOfferDocument_Controller::register_hooks();
        }
    }
}

