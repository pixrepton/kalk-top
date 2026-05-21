<?php
require 'C:/Users/compg/Desktop/kalk-top/.runtime-wp/wordpress/wp-load.php';
if (!class_exists('TopInstal_CalculateOffer_UseCase')) {
  require_once 'C:/Users/compg/Desktop/kalk-top/.runtime-wp/wordpress/wp-content/plugins/topinstal-heatpump-calculator/heatpump-calculator.php';
}
$use = new TopInstal_CalculateOffer_UseCase(new TopInstal_PriceBookRepository_Wp(), new TopInstal_BufferRulesRepository_Wp(), new TopInstal_SelectionRulesRepository_Wp(), new TopInstal_Logger_Wp());
$req = array(
  'schemaVersion'=>'1.0','traceId'=>'manual-offer-doc-1','lead'=>array('name'=>'Test'),
  'building'=>array('heated_area'=>120,'include_hot_water'=>true,'hot_water_persons'=>3,'hot_water_usage'=>'shower_bath'),
  'preferences'=>array('heating'=>array('emitterType'=>'surface','sourceType'=>'air_to_water_hp'),'dhw'=>array('enabled'=>true,'persons'=>3,'usageProfile'=>'shower_bath'),'hasBuffer'=>false)
);
$offer = $use->execute($req);
$body = array(
 'schemaVersion'=>'1.0',
 'traceId'=>'manual-offer-doc-1',
 'mode'=>'from-offer-dto',
 'documentType'=>'offer_document',
 'outputFormat'=>'pdf',
 'offerDto'=>$offer,
 'payload'=>array(
   'tank'=>array('enabled'=>true,'capacity'=>'200','manufacturer'=>'Trinnity'),
   'buffer'=>array('enabled'=>false,'capacity'=>'none')
 ),
 'context'=>array('source'=>'agent','channel'=>'manual-test')
);
$response = wp_remote_post('http://127.0.0.1:8090/wp-json/topinstal/v1/offer-documents/generate', array(
  'timeout'=>60,
  'headers'=>array('Content-Type'=>'application/json','Accept'=>'application/json','X-Top-Instal-Agent-Key'=>'doc-agent-key-xyz'),
  'body'=>wp_json_encode($body),
));
if (is_wp_error($response)) {
  echo 'WP_ERROR=' . $response->get_error_message() . PHP_EOL;
  exit(1);
}
$code = wp_remote_retrieve_response_code($response);
$raw = wp_remote_retrieve_body($response);
echo 'CODE=' . $code . PHP_EOL;
echo 'RAW_ASCII=' . preg_replace('/[^\x20-\x7E]/', '?', (string)$raw) . PHP_EOL;
?>
