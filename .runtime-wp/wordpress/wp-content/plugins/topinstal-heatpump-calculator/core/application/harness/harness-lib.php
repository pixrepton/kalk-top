<?php


if (!function_exists('topinstal_harness_bootstrap')) {
    /**
     * Load classes needed by CalculateOfferUseCase outside WordPress runtime.
     *
     * @return void
     */
    function topinstal_harness_bootstrap(): void
    {
        static $bootstrapped = false;
        if ($bootstrapped) {
            return;
        }

        $root = dirname(__DIR__, 3);
        $files = array(
            $root . '/core/contracts/ReasonCodes.php',
            $root . '/core/domain/cwu/CwuEngine.php',
            $root . '/core/domain/ozc/OzcEngine.php',
            $root . '/core/domain/selection/SelectionEngine.php',
            $root . '/core/domain/buffer/BufferEngine.php',
            $root . '/core/domain/pricing/PricingEngine.php',
            $root . '/core/application/CalculateOfferUseCase.php',
        );

        foreach ($files as $file) {
            if (!is_file($file)) {
                throw new RuntimeException('Harness bootstrap missing file: ' . $file);
            }
            require_once $file;
        }

        $bootstrapped = true;
    }
}

if (!function_exists('topinstal_harness_fixture_dir')) {
    /**
     * @return string
     */
    function topinstal_harness_fixture_dir(): string
    {
        return __DIR__ . '/fixtures';
    }
}

if (!function_exists('topinstal_harness_load_fixture')) {
    /**
     * @param string $fixture_name
     * @return array<string,mixed>
     */
    function topinstal_harness_load_fixture(string $fixture_name): array
    {
        $path = topinstal_harness_fixture_dir() . '/' . $fixture_name;
        if (!is_file($path)) {
            throw new RuntimeException('Fixture not found: ' . $path);
        }

        $raw = file_get_contents($path);
        if ($raw === false) {
            throw new RuntimeException('Cannot read fixture: ' . $path);
        }

        $json = json_decode($raw, true);
        if (!is_array($json)) {
            throw new RuntimeException('Invalid JSON fixture: ' . $path);
        }

        return $json;
    }
}

if (!function_exists('topinstal_harness_create_use_case')) {
    /**
     * Build a use-case instance with deterministic in-memory repositories.
     *
     * @return TopInstal_CalculateOffer_UseCase
     */
    function topinstal_harness_create_use_case(): TopInstal_CalculateOffer_UseCase
    {
        topinstal_harness_bootstrap();

        $price_book = array(
            'schema_version' => 'prices_v3',
            'pricing_version' => 'harness-v1',
            'data_version' => 'harness-v1',
            'currency' => 'PLN',
            'vat_rate' => 0.08,
            'pump' => array(
                'by_power_kw' => array(
                    '5' => array('split_net' => 12700, 'aio_premium_net' => 18000),
                    '7' => array('split_net' => 13500, 'aio_premium_net' => 18900),
                    '9' => array('split_net' => 14700, 'split400_net' => 15500, 'aio_premium_net' => 20000, 'aio_premium400_net' => 22800),
                    '12' => array('split400_net' => 17650, 'aio_premium400_net' => 24100),
                    '16' => array('split400_net' => 21000, 'aio_premium400_net' => 25750),
                ),
            ),
            'cwu' => array(
                'emalia' => array('150' => 2250, '200' => 2750, '250' => 2900, '300' => 3000, '400' => 3600, '500' => 4200),
                'inox' => array('150' => 2800, '200' => 3200, '250' => 3600, '300' => 4100, '400' => 5200, '500' => 6100),
            ),
            'buffer' => array(
                '50' => array('sprzeglo' => 1250, 'na_powrocie' => 650),
                '100' => array('sprzeglo' => 1750, 'na_powrocie' => 1150),
                '200' => array('sprzeglo' => 2150, 'na_powrocie' => 1500),
            ),
            'foundation' => array('fundament-nasz' => 300, 'fundament-klienta' => 0, 'stojak' => 600),
            'drainage' => array('skropliny-z-grzalka' => 1000, 'bez' => 0),
            'water' => array(
                'filters' => array('filtry-zmiekczacz' => 4500, 'filtry-podstawowe' => 200, 'bez-filtrow' => 0),
                'pressure' => array('z-reduktorem-cisnienia' => 400, 'bez-reduktora' => 0),
            ),
            'options' => array(
                'service-cloud' => 0,
                'cyrkulacja-tak' => 350,
                'cyrkulacja-nie' => 0,
                'magnetic_filter_standard' => 0,
                'magnetic_filter_premium' => 1200,
                'hydro_safety_standard' => 0,
                'hydro_safety_extended' => 1500,
                'flushing_standard' => 800,
                'flushing_premium' => 1200,
                'electrical_standard' => 0,
            ),
            'hydraulic_components_aio' => 2700,
            'hydraulic_components_split' => 3700,
            'installation_net' => 11000,
            'pricing_policy' => array(
                'pump' => array('catalog_powers_kw' => array(5, 7, 9, 12, 16)),
                'cwu' => array(
                    'capacity_by_persons' => array('le_2' => 150, 'le_4' => 200, 'gt_4' => 300),
                    'default_material' => 'emalia',
                ),
                'defaults' => array('currency' => 'PLN', 'vat_rate' => 0.08),
            ),
        );

        $buffer_rules = array(
            'capacityPerKw' => array(
                'underfloor' => 10,
                'radiators_lt' => 20,
                'radiators_ht' => 25,
                'radiators' => 20,
                'mixed' => 15,
            ),
            'systemVolumePerM2' => array(
                'underfloor' => 0.95,
                'radiators_lt' => 0.6,
                'radiators_ht' => 0.9,
                'radiators' => 0.6,
                'mixed' => 0.9,
            ),
            'antiCyclingDefaults' => array(
                't_min_minutes' => 12,
                'deltaT_K' => 7,
                'deltaT_by_type' => array(
                    'underfloor' => 5,
                    'mixed' => 6,
                    'radiators' => 7,
                    'radiators_ht' => 8,
                    'radiators_lt' => 6,
                ),
                'minModulationPercent' => 0.35,
                'waterSpecificHeat' => 1.16,
            ),
            'availableCapacities' => array(
                'buffer' => array(50, 80, 100, 120, 150, 200, 300, 400, 500, 800, 1000),
            ),
            'minimumCapacities' => array(
                'seriesBuffer' => 50,
                'parallelBuffer' => 100,
                'flowProtection' => 50,
            ),
            'bivalentStorage' => array(
                'solid_fuel_boiler' => array(
                    'litersPerKw' => 60,
                    'defaultPowerFactor' => 1.0,
                    'defaultPowerClamp' => array(6, 20),
                ),
                'fireplace_back_boiler' => array(
                    'minimum' => 500,
                    'litersPerKw' => 50,
                    'defaultPowerFactor' => 0.9,
                    'defaultPowerClamp' => array(6, 18),
                ),
            ),
            'bufferEnginePolicy' => array(
                'fallback_capacity_per_kw' => 20,
                'oversized_warning_liters' => 500,
                'setup_type_threshold_key' => 'parallelBuffer',
                'setup_types' => array(
                    'none' => 'NONE',
                    'series' => 'BUFOR_SZEREGOWO',
                    'parallel' => 'BUFOR_ROWNOLEGLE',
                ),
            ),
            'cwuRules' => array(
                'baseCapacity' => array('1' => 150, '2' => 150, '3' => 200, '4' => 200, '5+' => 300),
                'usageAdjustments' => array('shower' => 0, 'shower_bath' => 50, 'bath' => 100),
                'materialAdjustments' => array('inox' => 50, 'emalia' => 100),
                'safetyRule' => array('usage' => 'bath', 'persons_min' => 2, 'minimumCapacity' => 200),
                'availableCapacities' => array(150, 200, 250, 300, 400, 500),
            ),
            'ozcPolicy' => array(
                'area' => array('small' => 80, 'medium' => 150),
                'thermal' => array('old' => 1.0, 'modern' => 0.8),
                'climate' => array('PL_I' => -16, 'PL_II' => -18, 'PL_III' => -20, 'PL_IV' => -22, 'PL_V' => -24),
            ),
        );

        $selection_rules = array(
            'pumpMatchingTable' => array(
                'HP-SPLIT-7' => array(
                    'type' => 'split',
                    'phase' => 1,
                    'power' => 7,
                    'min' => array('surface' => 4.0, 'mixed' => 4.2, 'radiators' => 4.5),
                    'max' => array('surface' => 8.5, 'mixed' => 8.0, 'radiators' => 8.0),
                ),
                'HP-SPLIT-9' => array(
                    'type' => 'split',
                    'phase' => 1,
                    'power' => 9,
                    'min' => array('surface' => 6.5, 'mixed' => 6.7, 'radiators' => 6.5),
                    'max' => array('surface' => 10.5, 'mixed' => 10.0, 'radiators' => 10.0),
                ),
                'HP-SPLIT-12-3F' => array(
                    'type' => 'split',
                    'phase' => 3,
                    'power' => 12,
                    'min' => array('surface' => 9.0, 'mixed' => 9.0, 'radiators' => 9.0),
                    'max' => array('surface' => 13.5, 'mixed' => 13.0, 'radiators' => 13.0),
                ),
                'HP-AIO-9' => array(
                    'type' => 'all-in-one',
                    'phase' => 1,
                    'power' => 9,
                    'min' => array('surface' => 6.5, 'mixed' => 6.7, 'radiators' => 6.5),
                    'max' => array('surface' => 10.5, 'mixed' => 10.0, 'radiators' => 10.0),
                ),
            ),
            'aioMap' => array(
                'HP-SPLIT-7' => 'HP-AIO-7',
                'HP-SPLIT-9' => 'HP-AIO-9',
                'HP-SPLIT-12-3F' => 'HP-AIO-12-3F',
            ),
            'selectionPolicy' => array(
                'preferred_type' => 'split',
                'heating_type_aliases' => array(
                    'surface' => 'surface',
                    'underfloor' => 'surface',
                    'floor_heating' => 'surface',
                    'podlogowe' => 'surface',
                    'mixed' => 'mixed',
                    'radiators' => 'radiators',
                    'grzejniki' => 'radiators',
                ),
                'fallback_strategy' => array(
                    'mode' => 'nearest',
                ),
            ),
        );

        $price_book_repo = new class($price_book) {
            /** @var array<string,mixed> */
            private $price_book;

            /** @param array<string,mixed> $price_book */
            public function __construct(array $price_book)
            {
                $this->price_book = $price_book;
            }

            /** @return array<string,mixed> */
            public function get_price_book(): array
            {
                return $this->price_book;
            }
        };

        $buffer_rules_repo = new class($buffer_rules) {
            /** @var array<string,mixed> */
            private $rules;

            /** @param array<string,mixed> $rules */
            public function __construct(array $rules)
            {
                $this->rules = $rules;
            }

            /** @return array<string,mixed> */
            public function get_rules(): array
            {
                return $this->rules;
            }
        };

        $selection_rules_repo = new class($selection_rules) {
            /** @var array<string,mixed> */
            private $rules;

            /** @param array<string,mixed> $rules */
            public function __construct(array $rules)
            {
                $this->rules = $rules;
            }

            /** @return array<string,mixed> */
            public function get_rules(): array
            {
                return $this->rules;
            }
        };

        return new TopInstal_CalculateOffer_UseCase(
            $price_book_repo,
            $buffer_rules_repo,
            $selection_rules_repo
        );
    }
}

if (!function_exists('topinstal_harness_assert_offer_shape')) {
    /**
     * @param array<string,mixed> $offer
     * @param string $label
     * @return void
     */
    function topinstal_harness_assert_offer_shape(array $offer, string $label = 'offer'): void
    {
        $required_keys = array('schemaVersion', 'traceId', 'engineering', 'pricing', 'warnings', 'assumptions', 'engineMeta');
        foreach ($required_keys as $key) {
            if (!array_key_exists($key, $offer)) {
                throw new RuntimeException($label . ': missing key `' . $key . '`.');
            }
        }

        if (!is_string($offer['traceId']) || trim($offer['traceId']) === '') {
            throw new RuntimeException($label . ': traceId must be non-empty string.');
        }

        if (!is_array($offer['warnings'])) {
            throw new RuntimeException($label . ': warnings must be array.');
        }

        if (!is_array($offer['engineering'])) {
            throw new RuntimeException($label . ': engineering must be array.');
        }

        $engineering_keys = array('ozc', 'selection', 'buffer');
        foreach ($engineering_keys as $key) {
            if (!array_key_exists($key, $offer['engineering'])) {
                throw new RuntimeException($label . ': engineering missing `' . $key . '`.');
            }
        }

        if (!is_array($offer['pricing']) || !isset($offer['pricing']['totals']) || !is_array($offer['pricing']['totals'])) {
            throw new RuntimeException($label . ': pricing.totals must be array.');
        }

        if (!isset($offer['pricing']['source']) || !is_string($offer['pricing']['source']) || trim($offer['pricing']['source']) === '') {
            throw new RuntimeException($label . ': pricing.source must be non-empty string.');
        }

        if (!isset($offer['pricing']['catalogVersion']) || !is_string($offer['pricing']['catalogVersion']) || trim($offer['pricing']['catalogVersion']) === '') {
            throw new RuntimeException($label . ': pricing.catalogVersion must be non-empty string.');
        }

        $totals = $offer['pricing']['totals'];
        foreach (array('net', 'vat', 'gross') as $field) {
            if (!array_key_exists($field, $totals) || !is_numeric($totals[$field])) {
                throw new RuntimeException($label . ': pricing.totals.' . $field . ' must be numeric.');
            }
        }

        if (
            isset($offer['engineMeta']) &&
            is_array($offer['engineMeta']) &&
            isset($offer['engineMeta']['masterDataVersion']) &&
            is_string($offer['engineMeta']['masterDataVersion']) &&
            trim($offer['engineMeta']['masterDataVersion']) !== '' &&
            trim($offer['engineMeta']['masterDataVersion']) !== trim($offer['pricing']['catalogVersion'])
        ) {
            throw new RuntimeException($label . ': pricing.catalogVersion must match engineMeta.masterDataVersion.');
        }
    }
}

if (!function_exists('topinstal_harness_normalize_offer_for_stability')) {
    /**
     * @param array<string,mixed> $offer
     * @return array<string,mixed>
     */
    function topinstal_harness_normalize_offer_for_stability(array $offer): array
    {
        if (isset($offer['engineMeta']) && is_array($offer['engineMeta'])) {
            unset($offer['engineMeta']['timestamp']);
        }
        return $offer;
    }
}
