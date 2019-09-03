'use strict';

var ComponentWidget = require( 'wikibase.mediainfo.base' ).ComponentWidget,
	ItemInputWidget = require( './ItemInputWidget.js' ),
	AddPropertyWidget;

/**
 * @constructor
 * @param {Object} [config]
 * @cfg {array} [propertyIds] An array of property ids of statements that exist on the page
 */
AddPropertyWidget = function MediaInfoAddPropertyWidget( config ) {
	config = config || {};
	this.state = {
		propertyIds: config.propertyIds || [],
		editing: false
	};

	AddPropertyWidget.parent.call( this, config );
	ComponentWidget.call(
		this,
		'wikibase.mediainfo.statements',
		'templates/statements/AddPropertyWidget.mustache+dom'
	);
};
OO.inheritClass( AddPropertyWidget, OO.ui.Widget );
OO.mixinClass( AddPropertyWidget, ComponentWidget );

/**
 * @inheritDoc
 */
AddPropertyWidget.prototype.getTemplateData = function () {
	var propertyInputWidget,
		addPropertyButton,
		removeButton;

	propertyInputWidget = new ItemInputWidget( {
		classes: [ 'wbmi-entityview-add-statement-property' ],
		entityType: 'property',
		filter: this.getFilters(),
		maxSuggestions: 7,
		placeholder: mw.message( 'wikibasemediainfo-add-property' ).text()
	} );
	propertyInputWidget.connect( this, { choose: 'onChoose' } );
	propertyInputWidget.connect( this, { choose: [ 'setEditing', false ] } );
	propertyInputWidget.connect( this, { choose: [ 'emit', 'choose' ] } );

	addPropertyButton = new OO.ui.ButtonWidget( {
		classes: [ 'wbmi-entityview-add-statement-property-button' ],
		framed: true,
		icon: 'add',
		flags: [ 'progressive' ],
		label: mw.message( 'wikibasemediainfo-add-statement' ).text()
	} );
	addPropertyButton.connect( this, { click: [ 'setEditing', !this.state.editing ] } );

	removeButton = new OO.ui.ButtonWidget( {
		classes: [ 'wbmi-item-remove' ],
		title: mw.message( 'wikibasemediainfo-statements-item-remove' ).text(),
		flags: 'destructive',
		icon: 'trash',
		framed: false
	} );
	removeButton.connect( this, { click: [ 'setEditing', false ] } );

	return {
		editing: this.state.editing,
		addPropertyButton: addPropertyButton,
		propertyInputWidget: propertyInputWidget,
		removeButton: removeButton
	};
};

/**
 * @return {Array}
 */
AddPropertyWidget.prototype.getFilters = function () {
	return [
		{ field: 'datatype', value: 'wikibase-item' },
		{ field: '!id', value: this.state.propertyIds.join( '|' ) }
	];
};

/**
 * @param {string} propertyId
 * @return {jQuery.Promise}
 */
AddPropertyWidget.prototype.addPropertyId = function ( propertyId ) {
	if ( this.state.propertyIds.indexOf( propertyId ) >= 0 ) {
		return $.Deferred().resolve( this.$element ).promise();
	}

	return this.setState( { propertyIds: this.state.propertyIds.concat( propertyId ) } );
};

/**
 * @param {boolean} editing
 * @return {jQuery.Promise} Resolves after rerender
 */
AddPropertyWidget.prototype.setEditing = function ( editing ) {
	return this.setState( { editing: editing } );
};

/**
 * @param {ItemInputWidget} item
 * @param {Object} data
 */
AddPropertyWidget.prototype.onChoose = function ( item, data ) {
	this.addPropertyId( data.id );
};

/**
 * If a statement panel has been removed then the filters in the property input widget need to
 * be updated (properties with existing panels are filtered out of the input widget, and the
 * property id of the removed panel shouldn't be filtered out anymore)
 *
 * @param {int} panelPropertyId
 */
AddPropertyWidget.prototype.onStatementPanelRemoved = function ( panelPropertyId ) {
	this.setState( {
		propertyIds: this.state.propertyIds.filter( function ( propertyId ) {
			return propertyId !== panelPropertyId;
		} )
	} );
};

module.exports = AddPropertyWidget;
