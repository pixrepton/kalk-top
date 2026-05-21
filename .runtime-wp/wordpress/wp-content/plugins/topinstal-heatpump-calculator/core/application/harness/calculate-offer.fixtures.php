<?php


require_once __DIR__ . '/harness-lib.php';

$fixtures = glob(topinstal_harness_fixture_dir() . '/*.json');
if (!is_array($fixtures) || count($fixtures) === 0) {
    fwrite(STDERR, 'No fixtures found in ' . topinstal_harness_fixture_dir() . PHP_EOL);
    exit(1);
}

sort($fixtures);
$use_case = topinstal_harness_create_use_case();

$passed = 0;
$failed = 0;

foreach ($fixtures as $path) {
    $name = basename($path);

    try {
        $request = topinstal_harness_load_fixture($name);

        $offer_1 = $use_case->execute($request);
        topinstal_harness_assert_offer_shape($offer_1, $name . ' run#1');

        $offer_2 = $use_case->execute($request);
        topinstal_harness_assert_offer_shape($offer_2, $name . ' run#2');

        $normalized_1 = topinstal_harness_normalize_offer_for_stability($offer_1);
        $normalized_2 = topinstal_harness_normalize_offer_for_stability($offer_2);

        $json_1 = json_encode($normalized_1);
        $json_2 = json_encode($normalized_2);

        if ($json_1 === false || $json_2 === false) {
            throw new RuntimeException('Cannot encode normalized offers to JSON.');
        }

        if ($json_1 !== $json_2) {
            throw new RuntimeException('Stability check failed (run#1 != run#2).');
        }

        $passed++;
        echo '[PASS] ' . $name . PHP_EOL;
    } catch (Throwable $exception) {
        $failed++;
        fwrite(STDERR, '[FAIL] ' . $name . ' -> ' . $exception->getMessage() . PHP_EOL);
    }
}

echo PHP_EOL . 'Fixtures: passed=' . $passed . ', failed=' . $failed . ', total=' . count($fixtures) . PHP_EOL;
exit($failed === 0 ? 0 : 1);
