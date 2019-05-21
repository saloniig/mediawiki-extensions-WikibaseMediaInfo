'use strict';

var AnonWarning = require( './AnonWarning.js' ),
	CancelPublishWidget = require( './CancelPublishWidget.js' ),
	FormatValueElement = require( 'wikibase.mediainfo.statements' ).FormatValueElement,
	LicenseDialogWidget = require( './LicenseDialogWidget.js' ),
	StatementWidget = require( 'wikibase.mediainfo.statements' ).StatementWidget,
	StatementPanel;

/**
 * Panel for displaying/editing structured data statements
 *
 * @extends OO.ui.Element
 * @mixins OO.ui.mixin.PendingElement
 *
 * @constructor
 * @param {Object} [config]
 * @cfg {jQuery} $element
 * @cfg {string} propertyId
 */
StatementPanel = function StatementPanel( config ) {
	// Parent constructor
	StatementPanel.super.apply( this, arguments );

	this.$element = config.$element;
	delete config.$element;

	this.config = config || {};

	// Mixin constructors
	OO.ui.mixin.PendingElement.call( this, this.config );

	this.editing = false;
	this.licenseDialogWidget = new LicenseDialogWidget();
	this.editToggle = new OO.ui.ButtonWidget( {
		label: mw.message( 'wikibasemediainfo-filepage-edit' ).text(),
		framed: false,
		flags: 'progressive',
		title: mw.message( 'wikibasemediainfo-filepage-edit-depicts' ).text(),
		classes: [ 'wbmi-entityview-editButton' ]
	} );

	this.editToggle.connect( this, { click: 'makeEditable' } );
	this.cancelPublish = new CancelPublishWidget( this );
	this.cancelPublish.disablePublish();

	this.populateFormatValueCache( JSON.parse( this.$element.attr( 'data-formatvalue' ) || '{}' ) );
	this.statementWidget = new StatementWidget( this.config );
};

/* Inheritance */
OO.inheritClass( StatementPanel, OO.ui.Element );
OO.mixinClass( StatementPanel, OO.ui.mixin.PendingElement );

/**
 * Pre-populate the formatValue cache, which will save some
 * API calls if we end up wanting to format some of these...
 *
 * @param {Object} data
 */
StatementPanel.prototype.populateFormatValueCache = function ( data ) {
	Object.keys( data ).map( function ( dataValue ) {
		Object.keys( data[ dataValue ] ).map( function ( format ) {
			Object.keys( data[ dataValue ][ format ] ).map( function ( language ) {
				var json = JSON.parse( dataValue ),
					key = FormatValueElement.getKey(
						dataValues.newDataValue( json.type, json.value ), format, language
					),
					result = data[ dataValue ][ format ][ language ];
				FormatValueElement.toCache( key, result );
			} );
		} );
	} );
};

StatementPanel.prototype.initialize = function () {
	var deserializer = new wikibase.serialization.StatementListDeserializer(),
		statementsJson,
		popup;

	this.cancelPublish.hide();

	// load data into js widget instead
	statementsJson = JSON.parse( this.$element.attr( 'data-statements' ) || '[]' );
	this.statementWidget.setData( deserializer.deserialize( statementsJson ) );
	this.statementWidget.connect( this, { change: 'onDepictsChange' } );

	// ...and attach the widget to DOM, replacing the server-side rendered equivalent
	this.$element.empty().append( this.statementWidget.$element );

	// ...and attach edit/cancel/publish controls
	this.statementWidget.$element.find( '.wbmi-statement-header' ).append( this.editToggle.$element );
	this.statementWidget.$element.find( '.wbmi-statement-footer' ).append( this.cancelPublish.$element );

	// @todo below is only temporary, until we officially support more statements...
	if ( this.$element.hasClass( 'wbmi-entityview-statementsGroup-undefined' ) ) {
		popup = new OO.ui.PopupWidget( {
			$floatableContainer: this.editToggle.$element,
			padded: true,
			autoClose: true
		} );

		this.$element.append( popup.$element );
		this.editToggle.on( 'click', function () {
			// this is a bit of a hack: there's no great way to figure out
			// what properties are "supported" (what even means "supported"
			// in this project - Commons focuses on 'depicts' ATM, but other
			// wikis could use this with any other property they like, as
			// long as it's a supported data type...
			// so... let's just grab the names from DOM instead of trying to
			// figure out better methods of getting these to JS (either
			// expose as a JS config var or via an API call to format) because
			// this is only a temporary measure
			// eslint-disable-next-line no-jquery/no-global-selector
			var supportedProperties = $( '.wbmi-entityview-statementsGroup:not( .wbmi-entityview-statementsGroup-undefined )' )
				.toArray()
				.map( function ( element ) {
					return $(
						// 2nd selector (plural wbmi-statements-header) is for
						// backward compatibility - can be renamed 30+d after
						// merging this patch
						'.wbmi-statement-header .wbmi-entity-label, .wbmi-statements-header .wbmi-entity-label',
						element
					).text();
				} );

			popup.$body.empty().append(
				$( '<div>' ).append(
					$( '<h4>' ).html( mw.message( 'wikibasemediainfo-statements-unsupported-property-title' ).parse() ),
					$( '<p>' ).html(
						mw.message(
							'wikibasemediainfo-statements-unsupported-property-content',
							mw.language.listToText( supportedProperties )
						).parse()
					)
				)
			);
			popup.toggle( true );
		} );
	}
};

/**
 * Check for changes to statement claims or number of statements
 * @return {bool}
 */
StatementPanel.prototype.hasChanges = function () {
	var changes = this.statementWidget.getChanges(),
		removals = this.statementWidget.getRemovals();

	return changes.length > 0 || removals.length > 0;
};

StatementPanel.prototype.isEditable = function () {
	return this.editing;
};

StatementPanel.prototype.onDepictsChange = function () {
	var hasChanges = this.hasChanges();

	if ( hasChanges ) {
		this.cancelPublish.enablePublish();
	} else {
		this.cancelPublish.disablePublish();
	}

	this.makeEditable();
};

StatementPanel.prototype.makeEditable = function () {
	var self = this;

	// Show IP address logging notice to anon users
	if ( mw.user.isAnon() ) {
		AnonWarning.notifyOnce();
	}

	// show dialog informing user of licensing & store the returned promise
	// in licenseAcceptance - submit won't be possible until dialog is closed
	this.licenseDialogWidget.getConfirmationIfNecessary().then( function () {
		self.cancelPublish.show();
		self.editToggle.$element.hide();
		self.$element.addClass( 'wbmi-entityview-editable' );
		self.statementWidget.setEditing( true );
		self.editing = true;
	} );
};

StatementPanel.prototype.makeReadOnly = function () {
	var self = this;
	this.editing = false;
	this.$element.removeClass( 'wbmi-entityview-editable' );
	this.cancelPublish.disablePublish();
	this.cancelPublish.hide();

	this.statementWidget.disconnect( this, { change: 'onDepictsChange' } );
	this.statementWidget.reset().then( function () {
		self.statementWidget.connect( self, { change: 'onDepictsChange' } );
		self.editToggle.$element.show();
	} );
};

StatementPanel.prototype.sendData = function () {
	var self = this;
	this.cancelPublish.setStateSending();

	this.statementWidget.disconnect( this, { change: 'onDepictsChange' } );
	this.statementWidget.submit( mw.mediaInfo.structuredData.currentRevision )
		.then( function ( response ) {
			mw.mediaInfo.structuredData.currentRevision = response.pageinfo.lastrevid;
			self.makeReadOnly();

		} )
		.catch( function () {
			self.cancelPublish.enablePublish();
		} )
		.always( function () {
			self.statementWidget.connect( self, { change: 'onDepictsChange' } );
			self.cancelPublish.setStateReady();
		} );
};

module.exports = StatementPanel;
