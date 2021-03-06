'use strict'

//----------------
// Includes: Self
//----------------
var shared = require('./2 - shared.js')

//----------
// Includes
//----------
var chalk = require('chalk') // ~ 20 ms
var path  = require('path')  // ~  1 ms

//-----------
// Variables
//-----------
var config = {
    // null values will be populated later
    concurLimit: 1, // 1-3 recommended since node libuv has 4 slots by default
    fileType: null, // object that will hold options for individual file types
    includeFileTypes: ['ejs', 'jade', 'less', 'pug', 'sass', 'scss', 'styl'], // Used by watch.buildOne to know which file types may use includes.
    includePrefix: '_',   // Files prefixed with this string will not be published directly to the destination directory. Prefixed files can be included inside other files that do get published to destination though.
    glob: { // glob search strings like **/*.gif
        'clean': '', // If specified, use when running clean.processClean without the files parameter.
        'build': '', // If specified, use when running build.processBuild without the files parameter.
        'watch': {
            'source': '', // If specified, use when running watch.processWatch without the sourceFiles parameter.
            'dest'  : ''  // If specified, use when running watch.processWatch without the destFiles parameter.
        }
    },
    language: 'en-us', // should map to a json file in the language directory
    livereloadFileTypes: ['css', 'html', 'js', 'php'], // Only refresh the livereload client if one of these file types has been changed.
    map: {
        'destToSourceExt'  : null, // object of destination file extensions and their possible source file types
        'sourceToDestTasks': null  // object of file extensions, each with an array of building functions
    },
    option: { // options which can be set programmatically or via the command line
        'build'              : true,
        'clean'              : true,
        'debug'              : false,
        'forcebuild'         : false,
        'init'               : false,
        'livereload'         : false,
        'republish'          : false,
        'stats'              : true,
        'watch'              : false
    },
    path: { // paths which can be set programmatically or via the command line
        'source': path.join(shared.path.pwd, 'source'),
        'dest'  : path.join(shared.path.pwd, 'dest')
    },
    sourceMaps: false,
    sourceRoot: '/source-maps', // The virtual folder all source maps will show up under when using developer tools in a web browser.
    thirdParty: null // object that will hold options for various third party packages
}

//-------------------
// File Type Options
//-------------------
config.fileType = {
    coffee: {
        'sourceMaps': false // used by build.coffeeScript
    },
    concat: {
        'enabled': true,
        'sourceMaps': false // used by build.concat
    },
    css: {
        'sourceMaps': false // used by build.css
    },
    js: {
        'sourceMaps': false // used by build.js
    },
    jsx: {
        'sourceMaps': false // used by build.jsx
    },
    less: {
        'sourceMaps': false // used by build.less
    },
    sass: {
        'sourceMaps': false // used by build.sass
    },
    scss: {
        'sourceMaps': false // used by build.sass
    },
    styl: {
        'sourceMaps': false // used by build.stylus
    }
}

//---------------------------------------------
// Destination Extensions to Source Extensions
//---------------------------------------------
config.map.destToSourceExt = {
    'css' : ['less', 'sass', 'scss', 'styl'],
    'gz'  : ['*'],
    'html': ['ejs', 'jade', 'md', 'pug'],
    'js'  : ['coffee', 'jsx'],
    'map' : ['*']
}

//--------------------------------------
// Source Extensions to Build Tasks Map
//--------------------------------------
config.map.sourceToDestTasks = {
    'coffee': ['coffeeScript', 'js'],
    'concat': ['concat'],
    'css'   : ['css'],
    'ejs'   : ['ejs', 'html'],
    'gif'   : ['gif'],
    'htm'   : ['html'],
    'html'  : ['html'],
    'jade'  : ['jade', 'html'],
    'jpg'   : ['jpg'],
    'jpeg'  : ['jpg'],
    'js'    : ['js'],
    'jsx'   : ['jsx'],
    'less'  : ['less'],
    'md'    : ['markdown', 'html'],
    'png'   : ['png'],
    'pug'   : ['pug', 'html'],
    'sass'  : ['sass'],
    'scss'  : ['sass'],
    'styl'  : ['stylus'],
    // copy only tasks
    '7z'    : ['copy'],
    'ai'    : ['copy'],
    'asp'   : ['copy'],
    'aspx'  : ['copy'],
    'c'     : ['copy'],
    'cfm'   : ['copy'],
    'cfc'   : ['copy'],
    'csv'   : ['copy'],
    'doc'   : ['copy'],
    'docx'  : ['copy'],
    'eot'   : ['copy'],
    'eps'   : ['copy'],
    'exe'   : ['copy'],
    'flv'   : ['copy'],
    'gz'    : ['copy'],
    'h'     : ['copy'],
    'ico'   : ['copy'],
    'ini'   : ['copy'],
    'iso'   : ['copy'],
    'json'  : ['copy'],
    'm4a'   : ['copy'],
    'map'   : ['copy'],
    'mid'   : ['copy'],
    'midi'  : ['copy'],
    'mov'   : ['copy'],
    'mp3'   : ['copy'],
    'mp4'   : ['copy'],
    'ogg'   : ['copy'],
    'otf'   : ['copy'],
    'pdf'   : ['copy'],
    'php'   : ['copy'],
    'pl'    : ['copy'],
    'ppt'   : ['copy'],
    'pptx'  : ['copy'],
    'psd'   : ['copy'],
    'py'    : ['copy'],
    'rb'    : ['copy'],
    'rss'   : ['copy'],
    'svg'   : ['copy'],
    'swf'   : ['copy'],
    'tar'   : ['copy'],
    'ttf'   : ['copy'],
    'txt'   : ['copy'],
    'vtt'   : ['copy'],
    'wav'   : ['copy'],
    'weba'  : ['copy'],
    'webm'  : ['copy'],
    'woff'  : ['copy'],
    'xls'   : ['copy'],
    'xlsx'  : ['copy'],
    'xml'   : ['copy'],
    'zip'   : ['copy']
}

//---------------------
// Third Party Options
//---------------------
config.thirdParty = {
    chokidar: { // used by watch.*
        // ignore dot objects except for .htaccess files and .nvm directories
        // also ignore newly created folders for Mac OS, Ubuntu, and Windows
        'ignored': [/[\/\\]\.(?!htaccess|nvm)/, '**/untitled folder', '**/Untitled Folder', '**/New folder'],
        'ignoreInitial' : true,
        'followSymlinks': false
    },
    cleanCss: { // used by build.css
        'advanced'           : false,
        'aggressiveMerging'  : false,
        'keepSpecialComments': 0,
        'mediaMerging'       : false,
        'processImport'      : false,
        'rebase'             : false,
        'roundingPrecision'  : -1,
        'shorthandCompacting': false
    },
    htmlMinifier: { // used by build.html
        'removeComments'           : true,
        'collapseWhitespace'       : true,
        'collapseBooleanAttributes': true,
        'removeAttributeQuotes'    : true,
        'removeRedundantAttributes': true,
        'removeEmptyAttributes'    : true,
        'minifyJS': {
            'mangle': false
        },
        'minifyCSS': {
            'advanced'           : false,
            'aggressiveMerging'  : false,
            'keepSpecialComments': 0,
            'mediaMerging'       : false,
            'processImport'      : false,
            'restructuring'      : false,
            'shorthandCompacting': false
        },
        'minifyURLs': {
            'output'            : 'rootRelative',
            'removeEmptyQueries': true
        }
    },
    livereload: { // used by watch.*
        'port': 35729
    },
    markdownIt: { // used by build.markdown
        'breaks': false,
        'highlight': null,
        'html': false,
        'langPrefix': 'language-',
        'linkify': true,
        'maxNesting': 100,
        'quotes': '“”‘’',
        'typographer': false,
        'xhtmlOut': false
    }
}

//---------
// Exports
//---------
module.exports = config