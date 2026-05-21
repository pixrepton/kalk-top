<?php
require __DIR__ . '/wp-load.php';
$posts = get_posts([
  'post_type' => 'page',
  'numberposts' => 20,
  'suppress_filters' => false,
]);
foreach ($posts as $p) {
  if (strpos($p->post_content, '[heatpump_calc') !== false) {
    echo get_permalink($p->ID), PHP_EOL;
  }
}
