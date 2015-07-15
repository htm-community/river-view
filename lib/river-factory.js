
var fs = require('fs'),
    path = require('path'),
    _ = require('lodash'),
    configuration = require('./configuration'),
    River = require('./river'),
    configFileName = 'config.yml',
    parserFileName = 'parser.js';

function createRiver(redisClient, absPath, riverDirectory, riverName) {
    var configPath, config, requirePath, parseFunction, files = fs.readdirSync(absPath);
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
    parseFunction = require(requirePath);
    return new River({
        config: config,
        redisClient: redisClient,
        parser: parseFunction
    });
}

function createRivers(riverDir, redisClient) {
    var out = [],
        absDir = path.join(__dirname, '..', riverDir);
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