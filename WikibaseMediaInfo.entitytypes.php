<?php

/**
 * Definition of the media info entity type.
 * The array returned by the code below is supposed to be merged into $wgWBRepoEntityTypes.
 *
 * @note: Keep in sync with Wikibase
 *
 * @note: This is bootstrap code, it is executed for EVERY request. Avoid instantiating
 * objects or loading classes here!
 *
 * @license GPL-2.0-or-later
 * @author Bene* < benestar.wikimedia@gmail.com >
 */

use MediaWiki\MediaWikiServices;
use Wikibase\Client\WikibaseClient;
use Wikibase\DataAccess\DataAccessSettings;
use Wikibase\DataAccess\UnusableEntitySource;
use Wikibase\DataModel\DeserializerFactory;
use Wikibase\DataModel\Entity\EntityDocument;
use Wikibase\DataModel\Entity\EntityId;
use Wikibase\DataModel\Entity\PropertyId;
use Wikibase\DataModel\SerializerFactory;
use Wikibase\DataModel\Services\EntityId\EntityIdFormatter;
use Wikibase\DataModel\Services\Lookup\InProcessCachingDataTypeLookup;
use Wikibase\LanguageFallbackChain;
use Wikibase\Lib\LanguageNameLookup;
use Wikibase\Lib\Store\CachingPropertyOrderProvider;
use Wikibase\Lib\Store\EntityInfo;
use Wikibase\Lib\Store\WikiPagePropertyOrderProvider;
use Wikibase\Lib\Store\Sql\WikiPageEntityMetaDataLookup;
use Wikibase\MediaInfo\ChangeOp\Deserialization\MediaInfoChangeOpDeserializer;
use Wikibase\MediaInfo\Content\MediaInfoContent;
use Wikibase\MediaInfo\Content\MediaInfoHandler;
use Wikibase\MediaInfo\Content\MissingMediaInfoHandler;
use Wikibase\MediaInfo\DataModel\MediaInfo;
use Wikibase\MediaInfo\DataModel\MediaInfoId;
use Wikibase\MediaInfo\DataModel\Serialization\MediaInfoDeserializer;
use Wikibase\MediaInfo\DataModel\Serialization\MediaInfoSerializer;
use Wikibase\MediaInfo\DataModel\Services\Diff\MediaInfoDiffer;
use Wikibase\MediaInfo\DataModel\Services\Diff\MediaInfoPatcher;
use Wikibase\MediaInfo\Diff\BasicMediaInfoDiffVisualizer;
use Wikibase\MediaInfo\Search\MediaInfoFieldDefinitions;
use Wikibase\MediaInfo\Services\MediaInfoServices;
use Wikibase\MediaInfo\Services\MediaInfoEntityQuery;
use Wikibase\MediaInfo\View\MediaInfoEntityTermsView;
use Wikibase\MediaInfo\View\MediaInfoEntityStatementsView;
use Wikibase\MediaInfo\View\MediaInfoView;
use Wikibase\Repo\Diff\ClaimDiffer;
use Wikibase\Repo\Diff\ClaimDifferenceVisualizer;
use Wikibase\Repo\MediaWikiLanguageDirectionalityLookup;
use Wikibase\Repo\MediaWikiLocalizedTextProvider;
use Wikibase\Repo\Search\Elastic\Fields\DescriptionsProviderFieldDefinitions;
use Wikibase\Repo\Search\Elastic\Fields\LabelsProviderFieldDefinitions;
use Wikibase\Repo\Search\Elastic\Fields\StatementProviderFieldDefinitions;
use Wikibase\Repo\WikibaseRepo;
use Wikibase\SettingsArray;

return [
	MediaInfo::ENTITY_TYPE => [
		'storage-serializer-factory-callback' => function( SerializerFactory $serializerFactory ) {
			return new MediaInfoSerializer(
				$serializerFactory->newTermListSerializer(),
				$serializerFactory->newStatementListSerializer()
			);
		},
		'serializer-factory-callback' => function( SerializerFactory $serializerFactory ) {
			return new MediaInfoSerializer(
				$serializerFactory->newTermListSerializer(),
				$serializerFactory->newStatementListSerializer()
			);
		},
		'deserializer-factory-callback' => function( DeserializerFactory $deserializerFactory ) {
			return new MediaInfoDeserializer(
				$deserializerFactory->newEntityIdDeserializer(),
				$deserializerFactory->newTermListDeserializer(),
				$deserializerFactory->newStatementListDeserializer()
			);
		},
		'view-factory-callback' => function(
			Language $language,
			LanguageFallbackChain $fallbackChain,
			EntityDocument $entity,
			EntityInfo $entityInfo
		) {

			$mwConfig = MediaWikiServices::getInstance()->getMainConfig();
			$languageCode = $language->getCode();

			// Use a MediaInfo-specific EntityTermsView class instead of the default one
			$langDirLookup = new MediaWikiLanguageDirectionalityLookup();
			$textProvider = new MediaWikiLocalizedTextProvider( $language );
			$mediaInfoEntityTermsView = new MediaInfoEntityTermsView(
				new LanguageNameLookup( $languageCode ),
				$langDirLookup,
				$textProvider,
				$fallbackChain
			);

			// Use a MediaInfo-specific EntityStatementView class
			$wbRepo = WikibaseRepo::getDefaultInstance();
			$propertyOrderProvider = new CachingPropertyOrderProvider(
				new WikiPagePropertyOrderProvider(
					Title::newFromText( 'MediaWiki:Wikibase-SortedProperties' )
				),
				ObjectCache::getLocalClusterInstance()
			);

			$defaultPropertyIdsForView = [];
			$properties = $mwConfig->get( 'MediaInfoProperties' );
			$depictsPropertyId = $properties['depicts'] ?? null;
			if ( !empty( $depictsPropertyId ) ) {
				$defaultPropertyIdsForView[] = new PropertyId( $depictsPropertyId );
			}

			$qualifierPropertyIds = $mwConfig->get( 'DepictsQualifierProperties' );
			$statementsView = new MediaInfoEntityStatementsView(
				$propertyOrderProvider,
				$textProvider,
				$wbRepo->getEntityTitleLookup(),
				$defaultPropertyIdsForView,
				$wbRepo->getSnakFormatterFactory(),
				$wbRepo->getValueFormatterFactory(),
				$wbRepo->getCompactBaseDataModelSerializerFactory(),
				$languageCode,
				$properties,
				$mwConfig->get( 'MediaInfoShowQualifiers' ) ? $qualifierPropertyIds : []
			);

			return new MediaInfoView(
				$mediaInfoEntityTermsView,
				new MediaWikiLanguageDirectionalityLookup(),
				$languageCode,
				$statementsView
			);
		},
		'content-model-id' => MediaInfoContent::CONTENT_MODEL_ID,
		'search-field-definitions' => function ( array $languageCodes, SettingsArray $searchSettings ) {
			$repo = WikibaseRepo::getDefaultInstance();
			return new MediaInfoFieldDefinitions(
				new LabelsProviderFieldDefinitions( $languageCodes ),
				new DescriptionsProviderFieldDefinitions( $languageCodes,
					$searchSettings->getSetting( 'entitySearch' ) ),
				StatementProviderFieldDefinitions::newFromSettings(
					new InProcessCachingDataTypeLookup( $repo->getPropertyDataTypeLookup() ),
					$repo->getDataTypeDefinitions()->getSearchIndexDataFormatterCallbacks(),
					$searchSettings
				)
			);
		},
		'content-handler-factory-callback' => function() {
			$wikibaseRepo = WikibaseRepo::getDefaultInstance();

			return new MediaInfoHandler(
				$wikibaseRepo->getStore()->getTermIndex(),
				$wikibaseRepo->getEntityContentDataCodec(),
				$wikibaseRepo->getEntityConstraintProvider(),
				$wikibaseRepo->getValidatorErrorLocalizer(),
				$wikibaseRepo->getEntityIdParser(),
				$wikibaseRepo->getEntityIdLookup(),
				$wikibaseRepo->getLanguageFallbackLabelDescriptionLookupFactory(),
				new MissingMediaInfoHandler(
					MediaInfoServices::getMediaInfoIdLookup(),
					MediaInfoServices::getFilePageLookup(),
					$wikibaseRepo->getEntityParserOutputGeneratorFactory()
				),
				MediaInfoServices::getFilePageLookup(),
				$wikibaseRepo->getFieldDefinitionsByType( MediaInfo::ENTITY_TYPE ),
				WikibaseClient::getDefaultInstance()->getStore()->getUsageUpdater(),
				null
			);
		},
		'entity-id-pattern' => MediaInfoId::PATTERN,
		'entity-id-builder' => function( $serialization ) {
			return new MediaInfoId( $serialization );
		},
		'entity-id-composer-callback' => function( $repositoryName, $uniquePart ) {
			return new MediaInfoId( EntityId::joinSerialization( [
				$repositoryName,
				'',
				'M' . $uniquePart
			] ) );
		},
		'entity-differ-strategy-builder' => function() {
			return new MediaInfoDiffer();
		},
		'entity-patcher-strategy-builder' => function() {
			return new MediaInfoPatcher();
		},
		'entity-factory-callback' => function() {
			return new MediaInfo();
		},

		// Identifier of a resource loader module that, when `require`d, returns a function
		// returning a deserializer
		'js-deserializer-factory-function' => 'wikibase.mediainfo.getDeserializer',
		'changeop-deserializer-callback' => function() {
			$changeOpDeserializerFactory = WikibaseRepo::getDefaultInstance()
				->getChangeOpDeserializerFactory();

			return new MediaInfoChangeOpDeserializer(
				$changeOpDeserializerFactory->getLabelsChangeOpDeserializer(),
				$changeOpDeserializerFactory->getDescriptionsChangeOpDeserializer(),
				$changeOpDeserializerFactory->getClaimsChangeOpDeserializer()
			);
		},
		'entity-diff-visualizer-callback' => function (
			MessageLocalizer $messageLocalizer,
			ClaimDiffer $claimDiffer,
			ClaimDifferenceVisualizer $claimDiffView,
			SiteLookup $siteLookup,
			EntityIdFormatter $entityIdFormatter
		) {
			return new BasicMediaInfoDiffVisualizer(
				$messageLocalizer,
				$claimDiffer,
				$claimDiffView,
				$siteLookup,
				$entityIdFormatter
			);
		},
		'entity-metadata-accessor-callback' => function( $dbName, $repoName ) {
			$entityNamespaceLookup = WikibaseRepo::getDefaultInstance()->getEntityNamespaceLookup();
			$entityQuery = new MediaInfoEntityQuery(
				$entityNamespaceLookup,
				MediaWikiServices::getInstance()->getSlotRoleStore()
			);
			$settings = WikibaseRepo::getDefaultInstance()->getSettings();
			$dataAccessSettings = new DataAccessSettings(
				$settings->getSetting( 'maxSerializedEntitySize' ),
				$settings->getSetting( 'useTermsTableSearchFields' ),
				$settings->getSetting( 'forceWriteTermsTableSearchFields' ),
					DataAccessSettings::USE_REPOSITORY_PREFIX_BASED_FEDERATION
			);

			return new WikiPageEntityMetaDataLookup(
				$entityNamespaceLookup,
				$entityQuery,
				new UnusableEntitySource(),
				$dataAccessSettings,
				$dbName,
				$repoName
			);
		}
	]
];
