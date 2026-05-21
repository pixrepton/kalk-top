<?php

if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists('TopInstal_OfferDocument_Exception')) {
    class TopInstal_OfferDocument_Exception extends RuntimeException {
        /** @var string */
        private $error_code;
        /** @var array<string,mixed> */
        private $details;
        /** @var int */
        private $status;

        /**
         * @param string $error_code
         * @param string $message
         * @param int $status
         * @param array<string,mixed> $details
         */
        public function __construct($error_code, $message, $status = 400, $details = array()) {
            $this->error_code = (string) $error_code;
            $this->details = is_array($details) ? $details : array();
            $this->status = (int) $status;
            parent::__construct((string) $message);
        }

        /**
         * @return string
         */
        public function get_error_code() {
            return $this->error_code;
        }

        /**
         * @return array<string,mixed>
         */
        public function get_details() {
            return $this->details;
        }

        /**
         * @return int
         */
        public function get_status() {
            return $this->status;
        }
    }
}

