<template>
	<!-- eslint-disable vue/no-v-html -->
	<div class="wbmi-media-search-quick-view">
		<header class="wbmi-media-search-quick-view__header">
			<img v-if="isBitmap"
				:src="thumbnail"
				:alt="title"
				class="wbmi-media-search-quick-view__thumbnail"
			>

			<video v-else-if="isVideo"
				controls
				class="wbmi-media-search-quick-view__thumbnail
					wbmi-media-search-quick-view__thumbnail--video">

				<source
					:src="imageinfo[ 0 ].url"
					:type="mimeType"
				>
			</video>

			<audio v-else-if="isAudio"
				controls
				class="wbmi-media-search-quick-view__thumbnail
					wbmi-media-search-quick-view__thumbnail--audio">

				<source
					:src="imageinfo[ 0 ].url"
					:type="mimeType"
				>
			</audio>

			<a ref="close"
				tabindex="0"
				class="wbmi-media-search-quick-view__close-button"
				role="button"
				@keyup.enter="closeAndRestoreFocus"
				@click="close">
				<mw-icon :icon="'close'">
				</mw-icon>
			</a>
		</header>

		<!-- File details: most of this information comes from the Commons
		Metadata API; the data available for a given file can vary widely and
		may include complex HTML generated by templates. -->
		<div class="wbmi-media-search-quick-view__body">
			<h3 class="wbmi-media-search-quick-view__title">
				<a ref="title"
					:href="canonicalurl"
					target="blank">
					{{ title }}
				</a>
			</h3>

			<p v-if="description"
				class="wbmi-media-search-quick-view__description"
				v-html="description">
			</p>

			<p v-if="artist">
				<mw-icon :icon="'userAvatar'"></mw-icon>
				<span v-html="artist"></span>
			</p>

			<!-- Attempt to show license text, an appropriate icon, and an
			optional link to external license URL -->
			<p v-if="licenseText">
				<mw-icon v-if="licenseIcon" :icon="licenseIcon"></mw-icon>
				<a v-if="licenseUrl"
					:href="licenseUrl"
					target="_blank">
					<span v-html="licenseText"></span>
				</a>
				<span v-else v-html="licenseText"></span>
			</p>

			<!-- Sometimes this is free text, sometimes it is formatted. Can
			we make things semi-consistent? -->
			<p v-if="creationDate">
				<mw-icon :icon="'clock'"></mw-icon>
				<span v-html="creationDate"></span>
			</p>

			<p v-if="resolution">
				<mw-icon :icon="'camera'"></mw-icon>
				<span>{{ resolution }}</span>
			</p>

			<p v-if="mimeType">
				<mw-icon :icon="'pageSettings'"></mw-icon>
				<span>{{ mimeType }}</span>
			</p>

			<mw-button
				class="wbmi-media-search-quick-view__cta"
				:progressive="true"
				@click="goToFilePage( canonicalurl )">
				More Details
			</mw-button>
		</div>
	</div>
</template>

<script>
var Icon = require( './base/Icon.vue' ),
	Button = require( './base/Button.vue' );

// Helper function to check for date validity
function isValidDate( d ) {
	return d instanceof Date && !isNaN( d );
}

/**
 * @file QuickView.vue
 *
 * Component to display expanded details about a given search result
 */
// @vue/component
module.exports = {
	name: 'QuickView',

	components: {
		'mw-icon': Icon,
		'mw-button': Button
	},

	props: {
		title: {
			type: String,
			required: true
		},

		canonicalurl: {
			type: String,
			required: true
		},

		pageid: {
			type: Number,
			required: true
		},

		imageinfo: {
			type: Array,
			required: false,
			default: function () {
				return [ {} ];
			}
		},

		mediaType: {
			type: String,
			required: false,
			default: 'bitmap'
		}
	},

	computed: {
		isBitmap: function () {
			return this.mediaType === 'bitmap';
		},

		isVideo: function () {
			return this.mediaType === 'video';
		},

		isAudio: function () {
			return this.mediaType === 'audio';
		},

		/**
		 * @return {string|undefined}
		 */
		thumbnail: function () {
			return this.imageinfo[ 0 ].thumburl;
		},

		/**
		 * @return {Object|undefined}
		 */
		metadata: function () {
			return this.imageinfo[ 0 ].extmetadata;
		},

		/**
		 * @return {string|null} String that may contain HTML
		 */
		description: function () {
			if ( this.metadata && this.metadata.ImageDescription ) {
				return this.metadata.ImageDescription.value;
			} else {
				return null;
			}
		},

		/**
		 * @return {string|null} String that may contain HTML (often a link to a User page)
		 */
		artist: function () {
			if ( this.metadata && this.metadata.Artist ) {
				return this.metadata.Artist.value;
			} else {
				return null;
			}
		},

		/**
		 * @return {string|null}
		 */
		licenseText: function () {
			if ( this.metadata && this.metadata.UsageTerms ) {
				return this.metadata.UsageTerms.value;
			} else {
				return null;
			}
		},

		licenseIcon: function () {
			if ( this.metadata && this.metadata.License ) {
				return this.getLicenseIcon( this.metadata.License.value );
			} else {
				return null;
			}
		},

		licenseUrl: function () {
			if ( this.metadata && this.metadata.LicenseUrl ) {
				return this.metadata.LicenseUrl.value;
			} else {
				return null;
			}
		},

		/**
		 * @return {string|null} String that may contain HTML
		 */
		creationDate: function () {
			var d;

			if ( this.metadata && this.metadata.DateTimeOriginal ) {
				d = new Date( this.metadata.DateTimeOriginal.value );

				// If we have a value for DateTimeOriginal at all, create a date
				// object using that value and test for validity (JS unhelpfully
				// doesn't throw an error in the Date constructor if invalid).
				// If we are dealing with a parseable date value, return a
				// consistently-formatted string.
				//
				// Otherwise just return whatever the original string was in the
				// hope that it will make sense to the user.
				if ( isValidDate( d ) ) {
					return d.toLocaleDateString( undefined, {
						day: 'numeric',
						year: 'numeric',
						month: 'long'
					} );
				} else {
					return this.metadata.DateTimeOriginal.value;
				}

			} else {
				return null;
			}
		},

		/**
		 * @return {string|null}
		 */
		resolution: function () {
			var width = this.imageinfo[ 0 ].width,
				height = this.imageinfo[ 0 ].height;

			if ( this.imageinfo && width && height ) {
				return width + ' × ' + height;
			} else {
				return null;
			}
		},

		mimeType: function () {
			return this.imageinfo[ 0 ].mime;
		}
	},

	methods: {
		/**
		 * @fires close
		 */
		close: function () {
			this.$emit( 'close' );
		},

		/**
		 * Includes a boolean flag that tells the parent to restore focus to
		 * the originating search result
		 *
		 * @fires close
		 */
		closeAndRestoreFocus: function () {
			this.$emit( 'close', true );
		},

		/**
		 * Use this method if a non-HTML metadata value is required.
		 *
		 * @param {string} raw HTML string
		 * @return {string}
		 */
		stripHTML: function ( raw ) {
			return $( '<p>' ).append( raw ).text();
		},

		getLicenseIcon: function ( valueString ) {
			if ( /^cc/i.test( valueString ) ) {
				return 'logoCC';
			} else if ( /^pd/i.test( valueString ) ) {
				return 'unLock';
			} else {
				return null;
			}
		},

		goToFilePage: function ( url ) {
			window.open( url, '_blank' );
		},

		/**
		 * Programatically set focus on the title element; used by the parent
		 * component when the Quickview is opened.
		 */
		focus: function () {
			this.$refs.close.focus();
		}
	}
};
</script>

<style lang="less">
@import 'mediawiki.mixins';
@import '../../mediainfo-variables.less';

.wbmi-media-search-quick-view {
	.box-shadow( 4px 4px 5px -2px @border-color-base );
	background-color: @background-color-base;
	border-radius: 4px;
	box-sizing: border-box;
	margin: 16px;
	overflow: hidden; // needed to ensure border radius clips content
	position: relative;

	&__thumbnail {
		background-color: @wmui-color-base30;
		object-fit: contain;
		height: auto;
		max-height: 300px;
		width: 100%;

		&--audio {
			padding-top: 48px;
		}
	}

	&__body {
		padding: 16px;

		// stylelint-disable-next-line selector-class-pattern
		.mw-icon {
			opacity: 0.33;
			margin-right: 4px;
		}
	}

	& &__title {
		padding-top: 0;
		margin-top: 0;
	}

	&__cta {
		margin: @wbmi-spacing-sm 0;
	}

	&__description {
		// We really have no idea what we will find here; hopefully we can force it
		// to fit...
		> * {
			max-width: 100%;
		}
	}

	&__close-button {
		.flex-display();
		align-items: center;
		background-color: @background-color-base;
		border-radius: 15px;
		box-sizing: border-box;
		height: 30px;
		justify-content: center;
		left: 8px;
		padding: 0;
		position: absolute;
		top: 8px;
		width: 30px;

		// stylelint-disable-next-line selector-class-pattern
		.mw-icon {
			opacity: 0.5;
			transition: opacity @transition-base;
		}

		&:hover,
		&:focus {
			// stylelint-disable-next-line selector-class-pattern
			.mw-icon {
				opacity: 1;
			}
		}
	}
}
</style>
