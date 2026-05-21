<?php
require 'C:/Users/compg/Desktop/kalk-top/.runtime-wp/wordpress/wp-load.php';
require_once 'C:/Users/compg/Desktop/kalk-top/heatpump-calculator.php';
$use = new TopInstal_CalculateOffer_UseCase(new TopInstal_PriceBookRepository_Wp(), new TopInstal_BufferRulesRepository_Wp(), new TopInstal_SelectionRulesRepository_Wp(), new TopInstal_Logger_Wp());
$req = array(
  'schemaVersion'=>'1.0',
  'traceId'=>'client-test-1',
  'lead'=>array('name'=>'Test'),
  'building'=>array('heated_area'=>120,'include_hot_water'=>true,'hot_water_persons'=>3,'hot_water_usage'=>'shower_bath'),
  'preferences'=>array('heating'=>array('emitterType'=>'surface','sourceType'=>'air_to_water_hp'),'dhw'=>array('enabled'=>true,'persons'=>3,'usageProfile'=>'shower_bath'),'hasBuffer'=>false)
);
$offer = $use->execute($req);
$params = array(
  'pumpKw'=>7,
  'cwuLiters'=>200,
  'cwuProducer'=>'Trinnity',
  'bufferEnabled'=>false,
  'bufferLiters'=>null,
  'kitModel'=>isset($offer['engineering']['selection']['pumpModel']) ? $offer['engineering']['selection']['pumpModel'] : '',
  'output'=>'pdf',
  'customPriceGross'=>isset($offer['pricing']['totals']['gross']) ? $offer['pricing']['totals']['gross'] : null,
);
$client = new TopInstal_Agent_OfferPdfGeneratorClient(array(
  'directEndpoint'=>'http://127.0.0.1:8090/wp-json/topinstal/v1/offer-documents/generate',
  'authToken'=>'doc-agent-key-xyz',
  'pageUrl'=>'http://127.0.0.1:8090/pdf/'
));
$res = $client->generate_offer($params, array('traceId'=>'client-test-1','leadId'=>'lead-test-1','offerDto'=>$offer));
echo wp_json_encode($res, JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT) . PHP_EOL;
?>
