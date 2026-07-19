<?php
define('ABSPATH', '/kalk-top/.runtime-wp/wordpress/');
include '/kalk-top/.runtime-wp/wordpress/wp-load.php';

echo "agent_key: " . get_option('top_instal_agent_api_key', 'NOT_SET') . "\n";
echo "calc_agent_key: " . get_option('topinstal_calc_agent_api_key', 'NOT_SET') . "\n";
echo "gotenberg_url: " . get_option('top_instal_pdf_converter_url', 'NOT_SET') . "\n";
echo "siteurl: " . get_option('siteurl') . "\n";
