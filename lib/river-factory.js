var fs = require('fs')
  , path = require('path')
  , _ = require('lodash')
  , configuration = require('./configuration')
  , River = require('./river')
  , configFileName = 'config.yml'
  , parserFileName = 'parser.js'
  ;

function createRiver(absPath, riverDirectory, riverName) {
    var configPath
      , config
      , configContents
      , parserPath
      , parser
      , requirePath
      , parseFunction
      , files = fs.readdirSync(absPath)
      ;
    // Process config file.
    if (! _.contains(files, configFileName)) {
        throw new Error('River "' + riverName
            + '" is missing ' + configFileName);
    }
    configPath = path.join(absPath, configFileName);
    config = configuration.parseYaml(configPath);

    // Ensure the name of the river is included in the config.
    config.name = riverName;

    if (! _.contains(files, parserFileName)) {
        throw new Error('River "' + riverName
            + '" is missing ' + parserFileName);
    }
    requirePath = path.join('..', riverDirectory, riverName)
        + '/' + parserFileName.split('.')[0];
    parseFunction = require(requirePath);
    return new River({
        config: config
      , parser: parseFunction
    });
}

function createRivers(riverDir) {
    var out = []
      , absDir = path.join(__dirname, '..', riverDir);
    _.each(fs.readdirSync(absDir), function(ds) {
        var riverPath = path.join(absDir, ds);
        out.push(createRiver(riverPath, riverDir, ds));
    });
    return out;
}

module.exports = {
    createRivers: createRivers
};
