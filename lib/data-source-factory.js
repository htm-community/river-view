var fs = require('fs')
  , path = require('path')
  , _ = require('lodash')
  , configuration = require('./configuration')
  , DataSource = require('./data-source')
  , configFileName = 'config.yml'
  , parserFileName = 'parser.js'
  ;

function createDataSource(absPath, dsDirName, dsName) {
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
        throw new Error('Data-Source ' + dsName
            + ' is missing ' + configFileName);
    }
    configPath = path.join(absPath, configFileName);
    config = configuration.parseYaml(configPath);

    // Ensure the name of the data source is included in the config.
    config.name = dsName;
    
    if (! _.contains(files, parserFileName)) {
        throw new Error('Data-Source ' + dsName
            + ' is missing ' + parserFileName);
    }
    requirePath = path.join('..', dsDirName, dsName)
        + '/' + parserFileName.split('.')[0];
    parseFunction = require(requirePath);
    return new DataSource({
        config: config
      , parser: parseFunction
    });
}

function createDataSources(dataSourceDir) {
    var out = []
      , absDir = path.join(__dirname, '..', dataSourceDir);
    _.each(fs.readdirSync(absDir), function(ds) {
        var dsPath = path.join(absDir, ds);
        out.push(createDataSource(dsPath, dataSourceDir, ds));
    });
    return out;
}

module.exports = {
    createDataSources: createDataSources
};
