/**
 * This be where the Rivers be made.
 * @module lib/river-factory
 */
var fs = require('fs'),
    path = require('path'),
    _ = require('lodash'),
    configuration = require('./configuration'),
    River = require('./river'),
    configFileName = 'config.yml',
    parserFileName = 'parser.js',
    defaultRiverValues = undefined;

function createRiver(redisClient, absPath, riverDirectory, riverName) {
    var configPath, config, requirePath, riverModule,
        parseFunction, initFunction, files = fs.readdirSync(absPath);
    // Process config file.
    if (!_.contains(files, configFileName)) {
        throw new Error('River "' + riverName + '" is missing ' + configFileName);
    }
    configPath = path.join(absPath, configFileName);
    config = configuration.parseYaml(configPath);

    // Ensure the name of the river is included in the config.
    config.name = riverName;

    if (!_.contains(files, parserFileName)) {
        throw new Error('River "' + riverName + '" is missing ' + parserFileName);
    }
    requirePath = path.join('..', riverDirectory, riverName) + '/' + parserFileName.split('.')[0];
    riverModule = require(requirePath);

    if (typeof riverModule == 'function') {
        parseFunction = riverModule;
    } else {
        parseFunction = riverModule.parse;
        initFunction = riverModule.initialize;
    }

    if (! config.interval) {
        config.interval = defaultRiverValues.interval;
    }
    if (! config.expires) {
        config.expires = defaultRiverValues.expires;
    }
    return new River({
        config: config,
        redisClient: redisClient,
        initialize: initFunction,
        parse: parseFunction
    });
}

function createRivers(riverDir, defaults, redisClient) {
    var out = [],
        absDir = path.join(__dirname, '..', riverDir);
    defaultRiverValues = defaults;
    _.each(fs.readdirSync(absDir), function(riverName) {
        var riverPath = path.join(absDir, riverName),
            riverStat = fs.statSync(riverPath);
        if (riverStat.isDirectory()) {
            out.push(createRiver(redisClient, riverPath, riverDir, riverName));
        }
    });
    return out;
}

module.exports = {
    createRivers: createRivers
};
