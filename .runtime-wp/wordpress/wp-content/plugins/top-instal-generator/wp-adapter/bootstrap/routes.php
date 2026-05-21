<?php

if (!defined('ABSPATH')) {
    exit;
}

if (!function_exists('topinstal_generator_register_routes')) {
    /**
     * @return void
     */
    function topinstal_generator_register_routes() {
        if (class_exists('TopInstal_GenerateOfferDocument_Controller')) {
            TopInstal_GenerateOfferDocument_Controller::register_routes();
        }
    }
}

