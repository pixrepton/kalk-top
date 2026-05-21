<?php
require_once __DIR__ . '/wp-load.php';
$c = new TopInstal_Generator_Config_Wp();
echo 'OPTION=' . get_option('top_instal_agent_api_key', '') . "\n";
echo 'READ=' . $c->get_agent_api_key() . "\n";
?>