<template>
	<div class="wbmi-media-search-results">
		<div :class="'wbmi-media-search-results__list--' + mediaType"
			class="wbmi-media-search-results__list">
			<component
				:is="resultComponent"
				v-for="(result, index) in results[ mediaType ]"
				:ref="result.pageid"
				:key="index"
				v-bind="result"
				@show-details="showDetails">
			</component>
		</div>

		<aside class="wbmi-media-search-results__details"
			:class="{ 'wbmi-media-search-results__details--expanded': !!details }">
			<quick-view
				v-if="details"
				ref="quickview"
				:key="details.pageid"
				v-bind="details"
				:media-type="mediaType"
				@close="hideDetails">
			</quick-view>
		</aside>
	</div>
</template>

<script>
/**
 * @file SearchResults.vue
 *
 * The SearchResults component is responsible for displaying a list or grid of
 * search results, regardless of media type. Appearance and behavior will vary
 * depending on the value of the mediaType prop.
 *
 * This component can also display a "quickview" preview element for a given
 * result, including some additional data fetched from the API.
 */
var mapState = require( 'vuex' ).mapState,
	ImageResult = require( './ImageResult.vue' ),
	AudioResult = require( './AudioResult.vue' ),
	VideoResult = require( './VideoResult.vue' ),
	GenericResult = require( './GenericResult.vue' ),
	QuickView = require( './QuickView.vue' ),
	api = new mw.Api();

// @vue/component
module.exports = {
	name: 'SearchResults',

	components: {
		'image-result': ImageResult,
		'video-result': VideoResult,
		'audio-result': AudioResult,
		'generic-result': GenericResult,
		'quick-view': QuickView
	},

	props: {
		mediaType: {
			type: String,
			required: true
		},

		enableQuickView: {
			type: Boolean
		}
	},

	data: function () {
		return {
			details: null
		};
	},

	computed: $.extend( {}, mapState( [
		'term',
		'results',
		'pending'
	] ), {
		/**
		 * Which component should be used to display individual search results
		 *
		 * @return {string} image-result|video-result|generic-result
		 */
		resultComponent: function () {
			if ( this.mediaType === 'bitmap' ) {
				return 'image-result';
			} else if ( this.mediaType === 'video' ) {
				return 'video-result';
			} else if ( this.mediaType === 'audio' ) {
				return 'audio-result';
			} else {
				return 'generic-result';
			}
		}
	} ),

	methods: {
		/**
		 * Store the results of the fetchDetails API request as `this.details`
		 * so that it can be passed to the QuickView component.
		 *
		 * @param {number} pageid
		 * @param {string} originalUrl
		 */
		showDetails: function ( pageid, originalUrl ) {
			// Do not show the Quickview unless the feature has been enabled
			if ( !this.enableQuickView ) {
				window.open( originalUrl, '_blank' );
				return;
			}

			// @TODO show a placeholder Quickview UI immediately, and then
			// replace with the real data as soon as the request has completed
			this.fetchDetails( pageid ).then( function ( response ) {
				this.details = response.query.pages[ pageid ];

				// Let the QuickView component programatically manage focus
				// once it is displayed
				this.$nextTick( function () {
					this.$refs.quickview.focus();
				}.bind( this ) );

			}.bind( this ) );
		},
		/**
		 * Reset details data to null. Restores focus to the originating result
		 * if an optional argument is provided.
		 *
		 * @param {boolean} restoreFocus
		 */
		hideDetails: function ( restoreFocus ) {
			var originatingResultId = this.details.pageid;

			if ( restoreFocus ) {
				this.$refs[ originatingResultId ][ 0 ].focus();
			}

			this.details = null;
		},
		/**
		 * Make an API request for basic image information plus extended
		 * metadata
		 *
		 * @param {number} pageid
		 * @return {jQuery.Deferred}
		 */
		fetchDetails: function ( pageid ) {
			var params = {
				format: 'json',
				uselang: mw.config.get( 'wgUserLanguage' ),
				action: 'query',
				prop: 'info|imageinfo|pageterms',
				iiprop: 'url|size|mime|extmetadata',
				iiurlheight: this.mediaType === 'bitmap' ? 180 : undefined,
				iiurlwidth: this.mediaType === 'video' ? 200 : undefined,
				inprop: 'url',
				pageids: pageid
			};

			// Real version: use mw.api
			return api.get( params );
			// Test version: use production commons API
			// return $.get( 'https://commons.wikimedia.org/w/api.php', params );
		}
	},

	watch: {
		// if search term changes, immediately discard any expanded detail view
		term: function ( /* newTerm */ ) {
			this.details = null;
		}
	}
};
</script>

<style lang="less">
@import 'mediawiki.mixins';
@import '../../mediainfo-variables.less';

.wbmi-media-search-results {
	.flex-display();
	.flex-wrap( nowrap );

	// The "list" part of search results should always fill all available space.
	// By default lists will display results in a single column.
	&__list {
		.flex( 1, 1, auto );
		margin: @wbmi-spacing-sm;

		// Audio results are limited to half-width
		&--audio {
			> * {
				max-width: @max-width-base;
			}
		}

		// Video results are displayed as tiles/cards with a uniform size
		&--video {
			.flex-display();
			.flex-wrap( wrap );
			justify-content: flex-start;

			// stylelint-disable-next-line no-descending-specificity
			> * {
				.flex( 1, 1, 260px );
			}
		}

		// Image results are arranged flush in a "masonry" style layout that
		// attempts to do as little cropping as possible.
		// @TODO on mobile, image grid should switch to vertical columns with
		// fixed width instead of horizontal rows with fixed height.
		&--bitmap {
			.flex-display();
			.flex-wrap( wrap );
			// stylelint-disable-next-line no-descending-specificity
			> * {
				.flex( 1, 1, auto );

				&:last-child {
					.flex( 0, 1, auto );
				}
			}
		}
	}

	// The "details" part of search result (container for QuickView) is
	// collapsed by default, but can expand to 50% or a set max-width, whichever
	// is smaller
	&__details {
		.flex( 0, 0, auto );
		max-width: @max-width-base;
		width: 0%;

		&--expanded {
			.flex( 1, 0, auto );
			-webkit-overflow-scrolling: touch;
			background-color: @wmui-color-base80;
			height: 100vh;
			margin-right: -1rem; // needed for full-bleed of background color
			overflow-y: scroll;
			position: sticky;
			top: 0;
			width: 50%;

			// Needed to override extra padding that gets applied at this screen
			// size from these styles (we want this element to line up with the
			// right edge at all times):
			// https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/skins/Vector/+/refs/heads/master/resources/skins.vector.styles/legacy/layout.less#152
			@media screen and ( min-width: 982px ) {
				margin-right: -1.5rem;
			}
		}
	}
}
</style>
