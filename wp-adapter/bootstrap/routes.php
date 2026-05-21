<?php

if (!defined('ABSPATH')) {
    exit;
}

if (!function_exists('topinstal_register_routes')) {
    /**
     * Register all topinstal REST routes.
     *
     * @return void
     */
    function topinstal_register_routes() {
        if (class_exists('TopInstal_CalculateOffer_Controller')) {
            TopInstal_CalculateOffer_Controller::register_routes();
        }
        if (class_exists('TopInstal_Agent_Healthcheck_Controller')) {
            TopInstal_Agent_Healthcheck_Controller::register_routes();
        }
    }
}
