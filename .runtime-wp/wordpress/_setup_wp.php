<?php
$root = __DIR__;
$dbCopy = $root . '/wp-content/plugins/sqlite-database-integration/db.copy';
$dbPhp = $root . '/wp-content/db.php';
$c = file_get_contents($dbCopy);
$c = str_replace('{SQLITE_IMPLEMENTATION_FOLDER_PATH}', str_replace('\\', '/', $root . '/wp-content/plugins/sqlite-database-integration'), $c);
$c = str_replace('{SQLITE_PLUGIN}', 'sqlite-database-integration/load.php', $c);
file_put_contents($dbPhp, $c);
if (!file_exists($root . '/wp-config.php')) {
  copy($root . '/wp-config-sample.php', $root . '/wp-config.php');
}
$config = file_get_contents($root . '/wp-config.php');
$config = str_replace('database_name_here', 'topinstal_sqlite', $config);
$config = str_replace('username_here', 'root', $config);
$config = str_replace('password_here', 'root', $config);
if (strpos($config, "define('FS_METHOD'") === false) {
  $insert = "\ndefine('WP_DEBUG', true);\ndefine('WP_DEBUG_LOG', true);\ndefine('WP_DEBUG_DISPLAY', false);\ndefine('FS_METHOD', 'direct');\ndefine('DISABLE_WP_CRON', true);\n";
  $config = str_replace("/* That's all, stop editing! Happy publishing. */", $insert . "\n/* That's all, stop editing! Happy publishing. */", $config);
}
file_put_contents($root . '/wp-config.php', $config);
echo "CONFIG_OK\n";
?>
