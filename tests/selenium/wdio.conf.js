/**
* See also: http://webdriver.io/guide/testrunner/configurationfile.html
*/

const fs = require( 'fs' ),
	saveScreenshot = require( 'wdio-mediawiki' ).saveScreenshot;

// Load values from .env file
require( 'dotenv' ).config();

exports.config = {

	// =========================
	// MediaWiki-specific Config
	// =========================
	username: process.env.MEDIAWIKI_USER,
	password: process.env.MEDIAWIKI_PASSWORD,
	baseUrl: process.env.MW_SERVER + process.env.MW_SCRIPT_PATH,

	// ============
	// Test Files
	// ============
	specs: [
		__dirname + '/specs/**/*.js',
		__dirname + '/specs_betacommons/**/*.js'
	],

	// ============
	// Capabilities
	// ============
	capabilities: [ {
		// https://sites.google.com/a/chromium.org/chromedriver/capabilities
		browserName: 'chrome',
		maxInstances: 1,
		chromeOptions: {
			// If DISPLAY is set, assume developer asked non-headless or CI with Xvfb.
			// Otherwise, use --headless (added in Chrome 59)
			// https://chromium.googlesource.com/chromium/src/+/59.0.3030.0/headless/README.md
			args: [
				...( process.env.DISPLAY ? [] : [ '--headless' ] ),
				// Chrome sandbox does not work in Docker
				...( fs.existsSync( '/.dockerenv' ) ? [ '--no-sandbox' ] : [] )
			]
		}
	} ],

	// ===================
	// Test Configurations
	// ===================
	// Level of verbosity: silent | verbose | command | data | result | error
	logLevel: 'error',

	// Setting this enables automatic screenshots for when a browser command fails
	// It is also used by afterTest for capturig failed assertions.
	screenshotPath: process.env.LOG_DIR || __dirname + '/log',

	// Default timeout for each waitFor* command.
	waitforTimeout: 10 * 1000,

	// See also: http://webdriver.io/guide/testrunner/reporters.html
	reporters: [ 'spec' ],
	// See also: http://mochajs.org

	mochaOpts: {
		ui: 'bdd',
		timeout: 60 * 1000
	},

	// =====
	// Hooks
	// =====

	/**
	 * Save a screenshot when test fails.
	 *
	 * @param {Object} test Mocha Test object
	 */

	afterTest: function ( test ) {

		var filePath;
		if ( !test.passed ) {
			filePath = saveScreenshot( test.title );
			console.log( '\n\tScreenshot: ' + filePath + '\n' );
		}
	}

};
