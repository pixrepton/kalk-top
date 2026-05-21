<?php
require_once __DIR__ . '/wp-load.php';
$keys = array(
  'topinstal_agent_gmail_client_id',
  'topinstal_agent_gmail_client_secret',
  'topinstal_agent_gmail_refresh_token',
  'topinstal_agent_gmail_user_email',
  'topinstal_agent_gmail_query',
  'topinstal_agent_gmail_label_processed',
  'topinstal_agent_gmail_label_needs_review'
);
foreach ($keys as $k) {
  $v = (string) get_option($k, '');
  if ($v === '') {
    $masked = '<empty>';
  } elseif (strlen($v) <= 6) {
    $masked = $v;
  } else {
    $masked = substr($v, 0, 3) . '***' . substr($v, -3);
  }
  echo $k . '=' . $masked . "\n";
}
?>
