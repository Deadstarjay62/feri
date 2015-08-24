'use strict'

//----------------
// Includes: Self
//----------------
var shared = require('./2 - shared.js')
var config = require('./3 - config.js')

//----------
// Includes
//----------
var chalk        = require('chalk')          // ~ 20 ms
var fs           = require('fs')             // ~  1 ms
var glob         = require('glob')           // ~ 13 ms
var mkdirp       = require('mkdirp')         // ~  1 ms
var path         = require('path')           // ~  1 ms
var promisify    = require('promisify-node') // ~  8 ms
var uniqueNumber = require("unique-number")  // ~  2 ms

//---------------------
// Includes: Promisify
//---------------------
var fsReadFilePromise  = promisify(fs.readFile)       // ~  1 ms
var fsStatPromise      = promisify(fs.stat)           // ~  1 ms
var fsWriteFilePromise = promisify(fs.writeFile)      // ~  1 ms
var rimrafPromise      = promisify(require('rimraf')) // ~ 13 ms

//-----------
// Variables
//-----------
var functions = {}

//-----------
// Functions
//-----------
functions.addDestToSourceExt = function functions_addDestToSourceExt(ext, mappings) {
    /*
    Add or append a mapping to config.map.destToSourceExt without harming existing entries.
    @param  {String}         ext       Extension like 'html'
    @param  {String,Object}  mappings  String like 'ejs' or array of strings like ['ejs', 'jade', 'md']
    */
    if (typeof mappings === 'string') {
        mappings = [mappings]
    }

    if (!config.map.destToSourceExt.hasOwnProperty(ext)) {
        // create extension mapping property and empty array
        config.map.destToSourceExt[ext] = []
    }

    // append array
    Array.prototype.push.apply(config.map.destToSourceExt[ext], mappings)
} // addDestToSourceExt

functions.cacheReset = function functions_cacheReset() {
    /*
    Reset cache for a new pass through a set of files.
    */
    shared.cache.errorsSeen = []
    shared.cache.includeFilesSeen = {}
    shared.cache.includesNewer = {}
    shared.cache.missingMapBuild = []

    shared.uniqueNumber = new uniqueNumber()
} // cacheReset

functions.changeExt = function functions_changeExt(filePath, newExtension) {
    /*
    Change one extension to another.
    @param   {String}  filePath      File path like '/files/index.jade'
    @param   {String}  newExtension  Extension like 'html'
    @return  {String}                File path like '/files/index.html'
    */
    return filePath.substr(0, filePath.lastIndexOf('.')) + '.' + newExtension
} // changeExt

functions.cleanArray = function functions_cleanArray(array) {
    /*
    Remove empty items from an array.
    @param   {Object}  array  Array like [1,,3]
    @return  {Object}         Cleaned array like [1,3]
    */
    // This function comes from http://stackoverflow.com/questions/281264/remove-empty-elements-from-an-array-in-javascript
    var len = array.length

    for (var i = 0; i < len; i++) {
        array[i] && array.push(array[i]) // copy non-empty values to the end of the array
    }

    array.splice(0 , len) // cut the array and leave only the non-empty values

    return array
} // cleanArray

functions.cloneObj = function functions_cloneObj(object) {
    /*
    Clone an object recursively so the return is not a reference to the original object.
    @param  {Object}    obj     Object like { number: 1, bool: true, array: [], subObject: {} }
    @return {Object}
    */
    if (object === null || typeof object !== 'object') {
        // return early for boolean, function, null, number, string, symbol, undefined
        return object
    }

    if (object instanceof Date) {
        return new Date(object)
    }

    if (object instanceof RegExp) {
        return new RegExp(object)
    }

    // unique procedure to support cloning shared.uniqueNumber
    if (object instanceof uniqueNumber) {
        return new uniqueNumber()
    }

    var objectConstructor = object.constructor()

    for (var key in object) {
        // call self recursively
        objectConstructor[key] = functions.cloneObj(object[key])
    }

    return objectConstructor
} // cloneObj

functions.configPathsAreGood = function functions_configPathsAreGood() {
    /*
    Ensure source and destination are not the same and not in each others path.
    @return  {Boolean}  True if both paths are good.
    */
    var source = config.path.source + shared.slash
    var dest = config.path.dest + shared.slash

    if (source !== dest) {
        if (source.indexOf(dest) < 0 && dest.indexOf(source) < 0 ) {
            return true
        }
    }

    return false
} // configPathsAreGood

functions.destToSource = function functions_destToSource(dest) {
    /*
    Convert destination path to its source equivalent.
    @param   {String}  dest  File path like '/dest/index.html'
    @return  {String}        File path like '/source/index.html'
    */
    return dest.replace(config.path.dest, config.path.source)
} // destToSource

functions.fileExists = function functions_fileExists(filePath) {
    /*
    Find out if a file or folder exists.
    @param   {String}   filePath  Path to a file or folder.
    @return  {Promise}            Promise that returns a boolean. True if yes.
    */
    return fsStatPromise(filePath).then(function() {
        return true
    }).catch(function(err) {
        return false
    })
} // fileExists

functions.filesExist = function functions_filesExist(filePaths) {
    /*
    Find out if one or more files or folders exist.
    @param   {Object}   filePaths  Array of file paths like ['/source/index.html', '/source/about.html']
    @return  {Promise}             Promise that returns an array of booleans. True if a particular file exists.
    */
    var files = filePaths.map(function(file) {
        return functions.fileExists(file)
    })

    return Promise.all(files)
} // filesExist

functions.fileExistsAndTime = function functions_fileExistsAndTime(filePath) {
    /*
    Find out if a file exists along with its modified time.
    @param   {String}   filePath  Path to a file or folder.
    @return  {Promise}            Promise that returns an object like { exists: true, mtime: 123456789 }
    */
    return fsStatPromise(filePath).then(function(stat) {
        return {
            'exists': true,
            'mtime': stat.mtime.getTime()
        }
    }).catch(function(err) {
        return {
            'exists': false,
            'mtime': 0
        }
    })
} // fileExistsAndTime

functions.filesExistAndTime = function functions_filesExistAndTime(source, dest) {
    /*
    Find out if one or both files exist along with their modified time.
    @param   {String}  source  Source file path like '/source/favicon.ico'
    @param   {String}  dest    Destination file path like '/dest/favicon.ico'
    @return  {Promise}         Promise that returns an object like { source: { exists: true, mtime: 123456789 }, dest: { exists: false, mtime: 0 } }
    */
    var files = [source, dest].map(function(file) {
        return fsStatPromise(file).then(function(stat) {
            return {
                'exists': true,
                'mtime': stat.mtime.getTime()
            }
        }).catch(function(err) {
            return {
                'exists': false,
                'mtime': 0
            }
        })
    })

    return Promise.all(files).then(function(array) {
        return {
            'source': array[0],
            'dest': array[1]
        }
    })
} // filesExistAndTime

functions.fileExtension = function functions_fileExtension(filePath) {
    /*
    Return file extension in string.
    @param   {String}  filePath  File path like '/conan/riddle-of-steel.txt'
    @return  {String}            String like 'txt'
    */
    return path.extname(filePath).replace('.', '').toLowerCase()
} // fileExtension

functions.fileSize = function functions_fileSize(filePath) {
    /*
    Find out the size of a file or folder.
    @param  {String}    filePath    Path to a file or folder.
    @return {Promise}               Promise that will return a boolean. True if yes.
    */
    return fsStatPromise(filePath).then(function(stats) {
        return stats.size
    }).catch(function(err) {
        return 0
    })
} // fileSize

functions.findFiles = function functions_findFiles(match, options) {
    /*
    Find the files using https://www.npmjs.com/package/glob
    @param   {String}  match      String like '*.jpg'
    @param   {Object}  [options]  Optional. Options for glob.
    @return  {Promise}            Promise that returns an array of files or empty array if successful. Error if not.
    */
    return new Promise(function(resolve, reject) {
        if (typeof options === 'undefined') {
            options = functions.globOptions()
        }

		if (match.charAt(1) === ':') {
			// we have a windows path

			// glob doesn't like c: or similar so trim two characters
			match = match.substr(2)

			// glob only likes forward slashes
			match = match.replace(/\\/g, '/')
		}

        glob(match, options, function(err, files) {
            if (err) {
                reject(err)
            } else {
                resolve(files)
            }
        })
    })
} // findFiles

functions.globOptions = function functions_globOptions() {
    /*
    Return glob options updated to ignore include prefixed files.
    @return  {Object}
    */
    return {
        'ignore'  : '**/' + config.includePrefix + '*', // glob ignores dot files by default
        'nocase'  : true,
        'nodir'   : true,
        'realpath': true
    }
} // globOptions

functions.inSource = function functions_inSource(filePath) {
    /*
    Find out if a path is in the source directory.
    @param   {String}   filePath  Full file path like '/var/projects/a/source/index.ejs'
    @return  {Boolean}            True if the file path is in the source directory.
    */
    return filePath.indexOf(config.path.source) === 0
} // inSource

functions.log = function functions_log(message, indent) {
    /*
    Display a console message if logging is enabled.
    @param  {String}   message   String to display.
    @param  {Boolean}  [indent]  Optional and defaults to true. If true, the string will be indented four spaces.
    */
    if (config.log) {
        indent = (indent === false) ? '' : '    '
        console.info(indent + message)
    }
} // log

functions.logError = function functions_logError(error) {
    /*
    Log a stack trace or simple text string depending on the type of object passed in.
    @param  {Object,String}  err  Error object or simple string describing the error.
    */
    var message = error.message || error
    var displayError = false

    if (config.log) {
        if (message === '') {
            if (typeof error.stack === 'string') {
                displayError = true
            }
        } else {
            // check if we have seen this error before
            if (shared.cache.errorsSeen.indexOf(error) < 0) {
                // error is unique so cache it for next time
                shared.cache.errorsSeen.push(error)
                displayError = true
            }
        }
    }

    if (displayError) {
        if (typeof error.stack === 'string') {
            // error is an object
            console.warn('\n' + chalk.red(error.stack) + '\n')
        } else {
            // error is a string
            console.warn('\n' + chalk.gray('Error: ') + chalk.red(error) + '\n')
        }
    }
} // logError

functions.logOutput = function functions_logOutput(destFilePath, message) {
    /*
    Log a pretty output message with a relative looking path.
    @param  {String}  destFilePath  Full path to a destination file.
    @param  {String}  [message]     Optional and defaults to 'output'.
    */
    var file = destFilePath.replace(path.dirname(config.path.dest), '')

    message = message || 'output'

    if (shared.slash === '\\') {
        // we are on windows
        file = file.replace(/\\/g, '/')
    }

    functions.log(chalk.gray(shared.language.display('paddedGroups.build.' + message)) + chalk.cyan(file))
} // logOutput

functions.logWorker = function functions_logWorker(workerName, obj) {
    /*
    Overly chatty logging utility used by build functions.
    @param  {String}  workerName  Name of worker.
    @param  {Object}  obj         Reusable object originally created by build.processOneBuild
    */
    if (config.option.debug) {
        var data = (obj.data === '') ? '' : 'yes'

        functions.log(chalk.gray('\n' + workerName + ' -> called'))
        functions.log('source = ' + obj.source)
        functions.log('dest   = ' + obj.dest)
        functions.log('data   = ' + data)
        functions.log('build  = ' + obj.build)
    }
} // logWorker

functions.makeDirPath = function functions_makeDirPath(filePath) {
    /*
    Create an entire directory structure leading up to a file, if needed.
    @param   {String}  filePath  Path like '/dest/images/koi/magikarp.png'
    @return  {Promise}           Promise that returns true if successful. Error object if not.
    */
    return new Promise(function(resolve, reject) {
        mkdirp(path.dirname(filePath), function(err) {
            if (err) {
                reject(err)
            } else {
                resolve(true)
            }
        })
    })
} // makeDirPath

functions.mathRoundPlaces = function functions_mathRoundPlaces(number, decimals) {
    /*
    Round a number to a certain amount of decimal places.
    @param   {Number}  number    Number to round.
    @param   {Number}  decimals  Number of decimal places.
    @return  {Number}            Returns 0.04 if mathRoundPlaces(0.037, 2) was called.
    */
    return +(Math.round(number + 'e+' + decimals) + 'e-' + decimals)
} // mathRoundPlaces

functions.occurrences = function functions_occurrences(string, subString, allowOverlapping) {
    /*
    Find out how many characters or strings are in a string.
    @param   {String}   string              String to search.
    @param   {String}   subString           Character or string to search for.
    @param   {Boolean}  [allowOverlapping]  Optional and defaults to false.
    @return  {Number}                       Number of occurences of 'subString' in 'string'.
    */
    // This function comes from http://stackoverflow.com/questions/4009756/how-to-count-string-occurrence-in-string
    string += ''
    subString += ''

    if (subString.length <= 0) {
        return string.length + 1
    }

    var n = 0
    var pos = 0

    var step = (allowOverlapping) ? 1 : subString.length

    while (true) {
        pos = string.indexOf(subString, pos)

        if (pos >= 0) {
            n++
            pos += step
        } else {
            break
        }
    }

    return n
} // occurrences

functions.readFile = function functions_readFile(filePath, encoding) {
    /*
    Promise version of fs.readFile.
    @param   {String}  filePath    File path like '/dest/index.html'
    @param   {String}  [encoding]  Optional and defaults to 'utf8'
    @return  {String}              Data from file.
    */
    encoding = encoding || 'utf8'

    return fsReadFilePromise(filePath, { 'encoding': encoding })
} // readFile

functions.readFiles = function functions_readFiles(filePaths, encoding) {
    /*
    Sequentially read in multiple files and return an array of their contents.
    @param   {Object}   filePaths   Array of file paths like ['/source/file1.txt', '/source/file2.txt']
    @param   {String}   [encoding]  Optional and defaults to 'utf8'
    @return  {Promise}              Promise that returns an array of data like ['data from file1', 'data from file2']
    */
    encoding = encoding || 'utf8'

    var len = filePaths.length
    var p = Promise.resolve([])

    for (var i = 0; i < len; i++) {
        (function() {
            var file = filePaths[i]
            p = p.then(function(dataArray) {
                return functions.readFile(file, encoding).then(function(data) {
                    dataArray.push(data)
                    return dataArray
                }).catch(function(err) {
                    dataArray.push('')
                    return dataArray
                })
            })
        })()
    }

    return p
} // readFiles

functions.removeDest = function functions_removeDest(filePath, log) {
    /*
    Remove file or folder if unrelated to the source directory.
    @param   {String}   filePath  Path to a file or folder.
    @param   {Boolean}  log       Set to false to disable console log removal messages.
    @return  {Promise}            Promise that returns true if the file or folder was removed succesfully otherwise an error if not.
    */
    return Promise.resolve().then(function() {
        if (filePath.indexOf(config.path.source) >= 0) {
            throw 'functions.removeDest -> ' + shared.language.display('error.removeDest') + ' -> ' + filePath
        }

        return rimrafPromise(filePath).then(function() {
            if (log !== false) {
                functions.log(chalk.gray(filePath.replace(config.path.dest, '/' + path.basename(config.path.dest)) + ' ' + shared.language.display('words.removed')))
            }
            return true
        })
    })
} // removeDest

functions.removeExt = function functions_removeExt(filePath) {
    /*
    Remove one extension from a file path.
    @param   {String}  filePath  File path like '/files/index.html.gz'
    @return  {String}            File path like '/files/index.html'
    */
    return filePath.substr(0, filePath.lastIndexOf('.'))
} // removeExt

functions.removeFile = function functions_removeFile(filePath) {
    /*
    Remove a file or folder.
    @param   {String}   files  String like '/dest/index.html'
    @return  {Promise}         Promise that returns true if the file or folder was removed or if there was nothing to do. An error otherwise.
    */
    return rimrafPromise(filePath).then(function() {
        return true
    })
} // removeFile

functions.removeFiles = function functions_removeFile(files) {
    /*
    Remove files and folders.
    @param   {String,Object}  files  String like '/dest/index.html' or Object like ['/dest/index.html', '/dest/css']
    @return  {Promise}               Promise that returns true if the files and folders were removed or if there was nothing to do. An error otherwise.
    */
    if (typeof files === 'string') {
        files = [files]
    }

    var promiseArray = []

    for (var i in files) {
        promiseArray.push(functions.removeFile(files[i]))
    }

    return Promise.all(promiseArray).then(function() {
        return true
    })
} // removeFiles

functions.restoreObj = function functions_restoreObj(obj, fromObj) {
    /*
    Restore an object without affecting any references to said object.
    @return {Object}    obj     Object to be restored.
    @param  {Object}    fromObj Object to restore from.
    @return {Object}            Object that is a restore of the original. Not a reference.
    */
    for (var i in obj) {
        delete obj[i]
    }

    for (var key in fromObj) {
        obj[key] = functions.cloneObj(fromObj[key])
    }

    return obj
} // restoreObj

functions.sharedStatsTimeTo = function functions_sharedStatsTimeTo(time) {
    /*
    Get the current time or return the time elapsed in seconds from a previous time.
    @param   {Number}  [time]  Optional and defaults to 0. Commonly a number produced by a previous call to this function.
    @return  {Number}
    */
    time = time || 0

    if (time === 0) {
        // start timer
        time = new Date().getTime()
    } else {
        // calculate time past in seconds
        time = (new Date().getTime() - time) / 1000
    }

    return time
} // sharedStatsTimeTo

functions.setLanguage = function functions_setLanguage(lang) {
    /*
    Replace the shared.language.loaded object with the contents of a JSON language file.
    @param   {String}   [lang]  Optional. Defaults to using the value specified by config.language
    @return  {Promise}          Promise that returns true if everything is ok otherwise an error.
    */
    if (typeof lang === 'string') {
        config.language = lang
    }

    var file = path.join(shared.path.self, 'language', (config.language + '.json'))

    return functions.readFile(file).then(function(data) {
        shared.language.loaded = JSON.parse(data)

        var currentLen, longestLen, padding

        for (var i in shared.language.loaded.paddedGroups) {
            currentLen = 0
            longestLen = 0
            padding = ''

            // loop through once to find the longest string
            for (var j in shared.language.loaded.paddedGroups[i]) {
                currentLen = shared.language.loaded.paddedGroups[i][j].length
                if (currentLen > longestLen) {
                    longestLen = currentLen
                }
            }

            longestLen = longestLen + 1

            padding = Array(longestLen + 1).join(' ')

            // now loop through again and pad any strings up to the longest length
            for (var k in shared.language.loaded.paddedGroups[i]) {
                shared.language.loaded.paddedGroups[i][k] = (shared.language.loaded.paddedGroups[i][k] + padding).substring(0, longestLen)
            }
            // now these items will line up nicely in columns when displayed
        }

        return true
    })
} // setLanguage

functions.sourceToDest = function functions_sourceToDest(source) {
    /*
    Convert source path to its destination equivalent.
    @param   {String}  source  File path like '/source/index.html'
    @return  {String}          File path like '/dest/index.html'
    */
    var sourceExt = functions.fileExtension(source)

    var dest = source.replace(config.path.source, config.path.dest)

    for (var destExt in config.map.destToSourceExt) {
        if (config.map.destToSourceExt[destExt].indexOf(sourceExt) >= 0) {
            dest = functions.changeExt(dest, destExt)
        }
    }

    return dest
} // sourceToDest

functions.stats = function functions_stats() {
    /*
    Returns a copy of the shared.stats object for programatic consumers.
    @return  {Object}
    */
    return functions.cloneObj(shared.stats)
}

functions.trimSource = function functions_trimSource(filePath) {
    /*
    Trim most of the source path off a string.
    @param   {String}  filePath  File path like '/web/projects/source/index.html'
    @return  {String}            String like '/source/index.html'
    */
    return filePath.replace(path.dirname(config.path.source), '')
} // tirmSource

functions.trimDest = function functions_trimDest(filePath) {
    /*
    Trim most of the dest path off a string.
    @param   {String}  filePath  File path like '/web/projects/dest/index.html'
    @return  {String}            String like '/dest/index.html'
    */
    return filePath.replace(path.dirname(config.path.dest), '')
} // trimDest

functions.uniqueArray = function functions_uniqueArray(array) {
    /*
    Keep only unique values in an array.
    @param   {Object}  array  Array like [0,0,7]
    @return  {Object}         Array like [0,7]
    */
    // Code from http://stackoverflow.com/questions/1960473/unique-values-in-an-array
    return array.filter(function (a, b, c) {
        // keeps first occurrence
        return c.indexOf(a) === b
    })
} // uniqueArray

functions.writeFile = function functions_writeFile(filePath, data, encoding) {
    /*
    Promise version of fs.writeFile.
    @param   {String}   filePath    File path like '/web/dest/index.html'
    @param   {String}   data        Data to be written.
    @param   {String}   [encoding]  Optional and defaults to 'utf8'
    @return  {Promise}              Promise that returns true if the file was written otherwise an error.
    */
    var options = {
        'encoding': encoding || 'utf8'
    }

    return fsWriteFilePromise(filePath, data, options).then(function() {
        return true
    })
} // writeFile

//---------------------
// Functions: Includes
//---------------------
functions.includesNewer = function functions_includesNewer(includePaths, fileType, destTime) {
    /*
    Figure out if any include files are newer than the modified time of the destination file.
    @param   {Object}   includePaths  Array of file paths like ['/source/_header.ejs', '/source/_footer.ejs']
    @param   {String}   fileType      File type like 'ejs', 'sass', 'stylus', etc...
    @param   {Number}   destTime      Modified time of the destination file.
    @return  {Promise}                Promise that returns true if any includes files are newer.
    */
    return Promise.resolve().then(function() {

        var newer = false

        var includesMap = includePaths.map(function(include) {
            if (newer) {
                // one of the promises must have set rebuild = true so return early
                return true
            }

            // make an object friendly property version of the file name by removing forward slashes and periods
            var fileName = include.replace(/[\/\.]/g, '')

            if (!shared.cache.includesNewer.hasOwnProperty(fileType)) {
                shared.cache.includesNewer[fileType] = {}
            }

            if (shared.cache.includesNewer[fileType].hasOwnProperty(fileName)) {
                // we already know the date
                if (shared.cache.includesNewer[fileType][fileName] > destTime) {
                    newer = true
                }
            } else {
                return fsStatPromise(include).then(function(stat) {
                    // add date to cache
                    shared.cache.includesNewer[fileType][fileName] = stat.mtime.getTime()
                    if (shared.cache.includesNewer[fileType][fileName] > destTime) {
                        newer = true
                    }
                }).catch(function(err) {
                    // the file probably does not exist so absorb the error and move on
                })
            }
        })

        return Promise.all(includesMap).then(function() {
            if (newer) {
                functions.log(chalk.gray(shared.language.display('message.includesNewer').replace('{extension}', fileType.toUpperCase())))
                return true
            }
            return false
        })

    })
} // includesNewer

functions.includePathsEjs = function functions_includePathsEjs(data, filePath, includePathsCacheName) {
    /*
    Find EJS includes and return an array of matches.
    @param   {String}   data                     String to search for include paths.
    @param   {String}   filePath                 Source file where data came from.
    @param   {String}   [includePathsCacheName]  Optional. Unique property name used with shared.cache.includeFilesSeen to keep track of which include files have been found when recursing.
    @return  {Promise}                           Promise that returns an array of includees like ['/partials/_footer.ejs'] if succesful. An error object if not.
    */
    var cleanup = false

    if (typeof includePathsCacheName === 'undefined') {
        cleanup = true
        includePathsCacheName = 'ejs' + shared.uniqueNumber.generate()
        shared.cache.includeFilesSeen[includePathsCacheName] = [filePath]
    }

    return Promise.resolve().then(function() {

        /*
        Regular Expression should find the name of the include file in each of these lines...

            <%- include('one', {a: 'b'}) %>
            <% include('two') %>
            <% include 'three.ejs' %>
            <% include four.ejs %>

        Reference at https://github.com/tj/ejs#includes
        */
        var re = /(?:<%[-= ]*include[( ]*)([^,)%]*)(?:,?.*%>)/gi

        var match
        var includes = []

        // config.fileType.ejs.root can be used by the EJS engine to figure out include paths so make it available for evaling in this function too
        var root = config.fileType.ejs.root

        while (match = re.exec(data)) {
            match = match[1].trim()

            try {
                match = eval(match).trim()
            } catch(e) {
                // could not eval match
            }

            if (match.indexOf(config.path.source) !== 0) {
                // path must be relative
                match = path.join(path.dirname(filePath), match)
            }

            // add ejs extension if needed
            if (!path.extname(match)) {
                match = match + '.ejs'
            }

            if (shared.cache.includeFilesSeen[includePathsCacheName].indexOf(match) < 0) {
                shared.cache.includeFilesSeen[includePathsCacheName].push(match)
                includes.push(match)
            }
        }

        if (includes.length > 0) {
            // now we have an array of includes like ['/full/path/partials/_header.ejs']
            var promiseArray = []

            for (var i in includes) {
                (function() {
                    var ii = i
                    promiseArray.push(
                        functions.fileExists(includes[ii]).then(function(exists) {
                            if (exists) {
                                return functions.readFile(includes[ii]).then(function(data) {
                                    return functions.includePathsEjs(data, includes[ii], includePathsCacheName)
                                })
                            } else {
                                delete includes[ii] // leaves an empty space in the array which we will clean up later
                            }
                        })
                    )
                })()
            } // for

            return Promise.all(promiseArray).then(function() {

                // clean out any empty includes which meant their files could not be found
                includes = functions.cleanArray(includes)

                for (var i in promiseArray) {
                    var subArr = promiseArray[i].value()
                    for (var ii in subArr) {
                        includes.push(subArr[ii])
                    }
                }

            }).then(function() {

                return includes

            })
        } else {
            return includes
        }

    }).then(function(includes) {

        if (cleanup) {
            delete shared.cache.includeFilesSeen[includePathsCacheName]
        }

        return includes

    })
} // includePathsEjs

functions.includePathsJade = function functions_includePathsJade(data, filePath, includePathsCacheName) {
    /*
    Find Jade includes and return an array of matches.
    @param   {String}   data                     String to search for include paths.
    @param   {String}   filePath                 Source file where data came from.
    @param   {String}   [includePathsCacheName]  Optional. Unique property name used with shared.cache.includeFilesSeen to keep track of which include files have been found when recursing.
    @return  {Promise}                           Promise that returns an array of includees like ['/partials/_footer.jade'] if succesful. An error object if not.
    */
    var cleanup = false

    if (typeof includePathsCacheName === 'undefined') {
        cleanup = true
        includePathsCacheName = 'jade' + shared.uniqueNumber.generate()
        shared.cache.includeFilesSeen[includePathsCacheName] = [filePath]
    }

    return Promise.resolve().then(function() {

        /*
        Regular Expression should find the name of the include file in each of these lines...

            include one.jade
            include ./two.jade
            include partials/three.jade
            incldue:ignore-this-filter four.md

        Reference at http://jade-lang.com/reference/includes/
        */
        var re = /^\s*include:?[^ ]* (.*)$/gmi

        var match
        var includes = []

        while ((match = re.exec(data)) !== null) {
            match = match[1].trim()

            if (match.indexOf(config.path.source) !== 0) {
                // path must be relative
                match = path.join(path.dirname(filePath), match)
            }

            // add extension if necessary
            if (!path.extname(match)) {
                match = match + '.jade'
            }

            if (shared.cache.includeFilesSeen[includePathsCacheName].indexOf(match) < 0) {
                shared.cache.includeFilesSeen[includePathsCacheName].push(match)
                includes.push(match)
            }
        }

        if (includes.length > 0) {
            // now we have an array of includes like ['/full/path/css/_fonts.jade']
            var promiseArray = []

            for (var i in includes) {
                (function() {
                    var ii = i
                    promiseArray.push(
                        functions.fileExists(includes[ii]).then(function(exists) {
                            if (exists) {
                                return functions.readFile(includes[ii]).then(function(data) {
                                    return functions.includePathsJade(data, includes[ii], includePathsCacheName)
                                })
                            } else {
                                delete includes[ii] // leaves an empty space in the array which we will clean up later

                            }
                        })
                    )
                })()
            } // for

            return Promise.all(promiseArray).then(function() {

                // clean out any empty includes which meant their files could not be found
                includes = functions.cleanArray(includes)

                for (var i in promiseArray) {
                    var subArr = promiseArray[i].value()
                    for (var ii in subArr) {
                        includes.push(subArr[ii])
                    }
                }

            }).then(function() {

                return includes

            })
        } else {
            return includes
        }

    }).then(function(includes) {

        if (cleanup) {
            delete shared.cache.includeFilesSeen[includePathsCacheName]
        }

        return includes

    })
} // includePathsJade

functions.includePathsLess = function functions_includePathsLess(data, filePath, includePathsCacheName) {
    /*
    Find Less includes and return an array of matches.
    @param   {String}   data                     String to search for import paths.
    @param   {String}   filePath                 Source file where data came from.
    @param   {String}   [includePathsCacheName]  Optional. Unique property name used with shared.cache.includeFilesSeen to keep track of which include files have been found when recursing.
    @return  {Promise}                           Promise that returns an array of includees like ['/partials/_fonts.less'] if succesful. An error object if not.
    */
    var cleanup = false

    if (typeof includePathsCacheName === 'undefined') {
        cleanup = true
        includePathsCacheName = 'less' + shared.uniqueNumber.generate()
        shared.cache.includeFilesSeen[includePathsCacheName] = [filePath]
    }

    return Promise.resolve().then(function() {

        /*
        Regular Expression should find the name of the import file in each of these lines...

            @import "one";
            @import "one.less";

        Reference at http://lesscss.org/features/#features-overview-feature-importing
        */
        var re = /^\s*@import ["'](.*)["'].*$/gmi

        var match
        var imports = []

        while (match = re.exec(data)) {
            match = match[1].trim()

            if (match.indexOf(config.path.source) !== 0) {
                // path must be relative
                match = path.join(path.dirname(filePath), match)
            }

            // add extension if necessary
            if (!path.extname(match)) {
                match = match + '.less'
            }

            if (shared.cache.includeFilesSeen[includePathsCacheName].indexOf(match) < 0) {
                shared.cache.includeFilesSeen[includePathsCacheName].push(match)
                imports.push(match)
            }
        }

        if (imports.length > 0) {
            // now we have an array of imports like ['/full/path/css/_fonts.less']
            var promiseArray = []

            for (var i in imports) {
                (function() {
                    var ii = i
                    promiseArray.push(
                        functions.fileExists(imports[ii]).then(function(exists) {
                            if (exists) {
                                return functions.readFile(imports[ii]).then(function(data) {
                                    return functions.includePathsLess(data, imports[ii], includePathsCacheName)
                                })
                            } else {
                                delete imports[ii] // leaves an empty space in the array which we will clean up later

                            }
                        })
                    )
                })()
            } // for

            return Promise.all(promiseArray).then(function() {

                // clean out any empty imports which meant their files could not be found
                imports = functions.cleanArray(imports)

                for (var i in promiseArray) {
                    var subArr = promiseArray[i].value()
                    for (var ii in subArr) {
                        imports.push(subArr[ii])
                    }
                }

            }).then(function() {

                return imports

            })
        } else {
            return imports
        }

    }).then(function(imports) {

        if (cleanup) {
            delete shared.cache.includeFilesSeen[includePathsCacheName]
        }

        return imports

    })
} // includePathsLess

functions.includePathsSass = function functions_includePathsSass(data, filePath, includePathsCacheName) {
    /*
    Find SASS includes and return an array of matches.
    @param   {String}   data                     String to search for import paths.
    @param   {String}   filePath                 File path to where data came from.
    @param   {String}   [includePathsCacheName]  Optional. Unique property name used with shared.cache.includeFilesSeen to keep track of which include files have been found when recursing.
    @return  {Promise}                           Promise that returns an array of includees like ['/partials/_fonts.scss'] if succesful. An error object if not.
    */

    var cleanup = false

    if (typeof includePathsCacheName === 'undefined') {
        cleanup = true
        includePathsCacheName = 'sass' + shared.uniqueNumber.generate()
        shared.cache.includeFilesSeen[includePathsCacheName] = [filePath]
    }

    return Promise.resolve().then(function() {

        /*
        Regular Expression should find the name of the import file in each of these lines...

            @import 'reset'
            @import "reset";
            @import 'reset' // comment
            @import '_reset.scss'
            @import 'include/fonts'
            @import 'reset', 'fonts'
            @import a
            @import b.sass

        Notes from http://sass-lang.com/guide#topic-5

            Sass builds on top of the current CSS @import but instead of requiring an HTTP request, Sass will take the file that you want to import and combine it with the file you're importing into so you can serve a single CSS file to the web browser.

        Notes from http://sass-lang.com/documentation/file.SASS_REFERENCE.html#import

            It’s also possible to import multiple files in one @import. For example:
                @import "rounded-corners", "text-shadow";
        */
        var re = /^(?:\s)*@import ?(.*)/gmi

        var match
        var imports = []

        while (match = re.exec(data)) {
            match = match[1].replace(/['";]/g, '')

            // remove comments
            match = match.replace(/\/\/.*/, '').replace(/\/\*.*/, '')

            ;(function() {
                var matchArray = match.split(',')

                var checkFiles = []

                for (var i in matchArray) {
                    matchArray[i] = matchArray[i].trim()

                    if (matchArray[i].indexOf(config.path.source) !== 0) {
                        // path must be relative
                        matchArray[i] = path.join(path.dirname(filePath), matchArray[i])
                    }

                    if (!path.extname(matchArray[i])) {
                        // add extensions
                        checkFiles.push(matchArray[i] + '.scss')
                        checkFiles.push(matchArray[i] + '.sass')
                    } else {
                        checkFiles.push(matchArray[i])
                    }

                    for (var j in checkFiles) {
                        if (path.basename(checkFiles[j]).charAt(0) !== '_') {
                            var fileWithPrefix = path.dirname(checkFiles[j]) + '/_' + path.basename(checkFiles[j])
                            if (shared.cache.includeFilesSeen[includePathsCacheName].indexOf(fileWithPrefix) < 0) {
                                shared.cache.includeFilesSeen[includePathsCacheName].push(fileWithPrefix)
                                imports.push(fileWithPrefix)
                            }
                        }

                        if (shared.cache.includeFilesSeen[includePathsCacheName].indexOf(checkFiles[j]) < 0) {
                            shared.cache.includeFilesSeen[includePathsCacheName].push(checkFiles[j])
                            imports.push(checkFiles[j])
                        }
                    }
                }
            })()
        }

        if (imports.length > 0) {
            // now we have an array of imports like ['/full/path/css/_fonts.scss']
            var promiseArray = []

            for (var i in imports) {
                (function() {
                    var ii = i
                    promiseArray.push(
                        functions.fileExists(imports[ii]).then(function(exists) {
                            if (exists) {
                                return functions.readFile(imports[ii]).then(function(data) {
                                    return functions.includePathsSass(data, imports[ii], includePathsCacheName)
                                })
                            } else {
                                delete imports[ii] // leaves an empty space in the array which we will clean up later

                            }
                        })
                    )
                })()
            } // for

            return Promise.all(promiseArray).then(function() {

                // clean out any empty imports which meant their files could not be found
                imports = functions.cleanArray(imports)

                for (var i in promiseArray) {
                    var subArr = promiseArray[i].value()
                    for (var ii in subArr) {
                        imports.push(subArr[ii])
                    }
                }

            }).then(function() {

                return imports

            })
        } else {
            return imports
        }

    }).then(function(imports) {

        if (cleanup) {
            delete shared.cache.includeFilesSeen[includePathsCacheName]
        }

        return imports

    })
} // includePathsSass

functions.includePathsStylus = function functions_includePathsStylus(data, filePath, includePathsCacheName) {
    /*
    Find Stylus includes and return an array of matches.
    @param   {String}   data                     String to search for includes paths.
    @param   {String}   filePath                 Full file path to where data came from.
    @param   {String}   [includePathsCacheName]  Optional. Unique property name used with shared.cache.includeFilesSeen to keep track of which include files have been found when recursing.
    @return  {Promise}                           Promise that returns an array of includes like ['/partials/_fonts.styl'] if succesful. An error object if not.
    */
    var cleanup = false

    if (typeof includePathsCacheName === 'undefined') {
        cleanup = true
        includePathsCacheName = 'styl' + shared.uniqueNumber.generate()
        shared.cache.includeFilesSeen[includePathsCacheName] = [filePath]
    }

    return Promise.resolve().then(function() {

        /*
        Regular Expression should match...

            @require "file.styl"
            @require file.styl
            @import 'file'
            @import 'file.css'
            @import 'mixins/*'

        Notes from https://learnboost.github.io/stylus/docs/import.html

            When using @import without the .css extension, it’s assumed to be a Stylus sheet (e.g., @import "mixins/border-radius").

            @import also supports index styles. This means when you @import blueprint, it will resolve either blueprint.styl or blueprint/index.styl. This is really useful for libraries that want to expose all their features, while still allowing feature subsets to be imported.

            Stylus supports globbing. With it you could import many files using a file mask:
                @import 'product/*'
        */
        var re = /^(?:\s)*@(require|import)([^;\n]*).*$/gmi

        var match
        var includes = []
        var globs = []

        while (match = re.exec(data)) {
            match = match[2].trim()

            try {
                match = eval(match)
            } catch(e) {
                // do nothing
            }

            if (path.extname(match) === 'css') {
                // leave CSS @import as is
            } else {
                if (match.indexOf(config.path.source) !== 0) {
                    // path must be relative
                    match = path.join(path.dirname(filePath), match)
                }

                if (match.indexOf('*') >= 0) {
                    // we are dealing with a glob
                    globs.push(match.replace(/\.styl/i, '') + '.styl')
                    continue
                }

                // extension-less imports
                if (!path.extname(match)) {
                    // import could be a stylus file
                    if (shared.cache.includeFilesSeen[includePathsCacheName].indexOf(match + '.styl') < 0) {
                        // a unique path we haven't seen yet so continue
                        shared.cache.includeFilesSeen[includePathsCacheName].push(match + '.styl')
                        includes.push(match + '.styl')
                    } else {
                        // already seen this include
                    }

                    // import could also be an index stylus file in a sub folder
                    if (shared.cache.includeFilesSeen[includePathsCacheName].indexOf(match + '/index.styl') < 0) {
                        shared.cache.includeFilesSeen[includePathsCacheName].push(match + '/index.styl')
                        includes.push(match + '/index.styl')
                    }
                } else {
                    if (shared.cache.includeFilesSeen[includePathsCacheName].indexOf(match) < 0) {
                        shared.cache.includeFilesSeen[includePathsCacheName].push(match)
                        includes.push(match)
                    }
                }
            }
        }

        if (globs.length > 0) {

            var promiseArray = []

            for (var i in globs) {
                (function() {
                    var ii = i
                    var options = {
                        "nocase"  : true,
                        "nodir"   : false,
                        "realpath": true
                    }
                    promiseArray.push(
                        functions.findFiles(globs[ii], options).then(function(files) {
                            if (files.length > 0) {
                                for (var j in files) {
                                    includes.push(files[j])
                                }
                            }
                        })
                    )
                })()
            } // for

            return Promise.all(promiseArray).then(function() {
                return includes
            })
        } else {
            return includes
        }

    }).then(function(includes) {

        if (includes.length > 0) {
            // now we have an array of includes like ['/full/path/css/_fonts.styl']

            var promiseArray = []

            for (var i in includes) {
                (function() {
                    var ii = i
                    promiseArray.push(
                        functions.fileExists(includes[ii]).then(function(exists) {
                            if (exists) {
                                return functions.readFile(includes[ii]).then(function(data) {
                                    return functions.includePathsStylus(data, includes[ii], includePathsCacheName)
                                })
                            } else {
                                delete includes[ii] // leaves an empty space in the array which we will clean up later

                            }
                        })
                    )
                })()
            } // for

            return Promise.all(promiseArray).then(function() {

                // clean out any empty includes which meant their files could not be found
                includes = functions.cleanArray(includes)

                for (var i in promiseArray) {
                    var subArr = promiseArray[i].value()
                    for (var ii in subArr) {
                        includes.push(subArr[ii])
                    }
                }

            }).then(function() {
                return includes
            })
        } else {
            return includes
        }

    }).then(function(includes) {

        if (cleanup) {
            delete shared.cache.includeFilesSeen[includePathsCacheName]
        }

        return includes

    })
} // includePathsStylus

//-------------------------------------
// Functions: Reusable Object Building
//-------------------------------------
functions.objBuildWithIncludes = function functions_objBuildWithIncludes(obj, includeFunction) {
    /*
    Figure out if a reusable object, which may may have include files, needs to be built in memory.
    @param   {Object}    obj              Reusable object originally created by build.processOneBuild
    @param   {Function}  includeFunction  Function that will parse this particular type of file (ejs, sass, stylus, etc...) and return any paths to include files.
    @return  {Promise}                    Promise that returns a reusable object.
    */
    var destTime = 0
    var sourceExt = functions.fileExtension(obj.source)

    obj.build = false

    return Promise.resolve().then(function() {

        if (obj.data !== '') {
            // a previous promise has filled in the data variable so we should rebuild this file
            obj.build = true
        } else if (obj.dest !== '') {
            // make sure obj.dest does not point to a file in the source directory
            if (functions.inSource(obj.dest)) {
                throw 'functions.objBuildWithIncludes -> ' + shared.language.display('error.destPointsToSource')
            } else {
                // read dest file into memory
                return fsReadFilePromise(obj.dest, { encoding: 'utf8' }).then(function(data) {
                    obj.data = data
                    obj.build = true
                }).catch(function(err) {
                    throw 'functions.objBuildWithIncludes -> ' + shared.language.display('error.missingDest')
                })
            }
        } else {
            // just a source file to work from

            // figure out dest
            obj.dest = functions.sourceToDest(obj.source)

            if (config.option.forcebuild) {
                obj.build = true
            } else {                
                // check to see if the source file is newer than a possible dest file
                return functions.filesExistAndTime(obj.source, obj.dest).then(function(files) {
                    if (!files.source.exists) {
                        // missing source file
                        throw 'functions.objBuildWithIncludes -> ' + shared.language.display('error.missingSource')
                    }
    
                    if (files.dest.exists) {
                        // source and dest exist so compare their times
                        if (files.source.mtime > files.dest.mtime) {
                            obj.build = true
                        }
    
                        destTime = files.dest.mtime // save destTime so we can check includes against it to see if they are newer
                    } else {
                        // dest file does not exist so build it
                        obj.build = true
                    }
                })
            }
        }

    }).then(function() {

        if (obj.data === '') {
            // read the source because we are either rebuilding or we need to check to see if any include files are newer than our dest file
            return fsReadFilePromise(obj.source, { encoding: 'utf8' }).then(function(data) {
                obj.data = data
            })
        }

    }).then(function() {

        if (!obj.build) {
            // check includes to see if any of them are newer
            return Promise.resolve().then(function() {
                return includeFunction(obj.data, obj.source).then(function(includes) {
                    return functions.includesNewer(includes, sourceExt, destTime)
                })
            })
        }

    }).then(function(includesNewer) {

        if (obj.build || includesNewer) {
            obj.build = true
        }

        return obj

    })
} // objBuildWithIncludes

functions.objBuildInMemory = function functions_objBuildInMemory(obj) {
    /*
    Figure out if a reusable object needs to be built in memory.
    @param   {Object}   obj  Reusable object originally created by build.processOneBuild
    @return  {Promise}  obj  Promise that returns a reusable object.
    */
    obj.build = false

    return Promise.resolve().then(function() {

        if (obj.data !== '') {
            // a previous promise has filled in the data variable so we should rebuild this file
            obj.build = true
        } else if (obj.dest !== '') {
            // make sure obj.dest does not point to a file in the source directory
            if (functions.inSource(obj.dest)) {
                throw 'functions.objBuildInMemory -> ' + shared.language.display('error.destPointsToSource')
            } else {
                // read dest file into memory
                return fsReadFilePromise(obj.dest, { encoding: 'utf8' }).then(function(data) {
                    obj.data = data
                    obj.build = true
                }).catch(function(err) {
                    throw 'functions.objBuildInMemory -> ' + shared.language.display('error.missingDest')
                })
            }
        } else {
            // just a source file to work from

            // figure out dest
            obj.dest = functions.sourceToDest(obj.source)
            
            if (config.option.forcebuild) {
                obj.build = true
            } else {   
                // check to see if the source file is newer than a possible dest file
                return functions.filesExistAndTime(obj.source, obj.dest).then(function(files) {
                    if (!files.source.exists) {
                        // missing source file
                        throw 'functions.objBuildInMemory -> ' + shared.language.display('error.missingSource')
                    }
    
                    if (files.dest.exists) {
                        // source and dest exist so compare their times
                        if (files.source.mtime > files.dest.mtime) {
                            obj.build = true
                        }
                    } else {
                        // dest file does not exist so build it
                        obj.build = true
                    }
                })
            }
        }

    }).then(function() {

        if (obj.build && obj.data === '') {
            // read source file into memory
            return fsReadFilePromise(obj.source, { encoding: 'utf8' }).then(function(data) {
                obj.data = data
            })
        }

    }).then(function() {

        return obj

    })
} // objBuildInMemory

functions.objBuildOnDisk = function functions_objBuildOnDisk(obj) {
    /*
    Figure out if a reusable object needs to be written to disk and if so, prepare for a command line program to use it next.
    @param   {Object}   obj  Reusable object originally created by build.processOneBuild
    @return  {Promise}  obj  Promise that returns a reusable object.
    */
    obj.build = false

    return Promise.resolve().then(function() {

        if (obj.data !== '') {
            // a previous promise has filled in the data variable so we should rebuild this file
            obj.build = true

            if (obj.dest === '') {
                obj.dest = functions.sourceToDest(obj.source)
            } else {
                // make sure obj.dest does not point to a file in the source directory
                if (functions.inSource(obj.dest)) {
                    throw 'functions.objBuildOnDisk -> ' + shared.language.display('error.destPointsToSource')
                }
            }

            // write to dest file
            return functions.makeDirPath(obj.dest).then(function() {
                return fsWriteFilePromise(obj.dest, obj.data)
            }).then(function() {
                obj.data = ''

                // set source to dest so any command line programs after this will compile dest to dest
                obj.source = obj.dest
            })
        } else if (obj.dest !== '') {
            // dest file is already in place
            return functions.fileExists(obj.dest).then(function(exists) {
                if (exists) {
                    obj.build = true

                    // set source to dest so any command line programs after this will compile dest to dest
                    obj.source = obj.dest
                } else {
                    obj.dest = ''
                    return functions.objBuildOnDisk(obj)
                }
            })
        } else {
            // just a source file to work from

            // figure out dest
            obj.dest = functions.sourceToDest(obj.source)
            
            if (config.option.forcebuild) {
                obj.build = true
            } else {
                // check to see if the source file is newer than a possible dest file
                return functions.filesExistAndTime(obj.source, obj.dest).then(function(files) {
                    if (!files.source.exists) {
                        // missing source file
                        throw 'functions.objBuildOnDisk -> ' + shared.language.display('error.missingSource')
                    }
    
                    if (files.dest.exists) {
                        // source and dest exist so compare their times
                        if (files.source.mtime > files.dest.mtime) {
                            obj.build = true
                        }
                    } else {
                        // dest file does not exist so build it
                        obj.build = true
    
                        return functions.makeDirPath(obj.dest)
                    }
                })
            }
        }

    }).then(function() {

        return obj

    })
} // objBuildOnDisk

//---------
// Exports
//---------
module.exports = functions
