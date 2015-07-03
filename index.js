var path = require('path')
  , Registrar = require('./lib/registrar')
  , DataSourceFactory = require('./lib/data-source-factory')
  , configuration = require('./lib/configuration')
  , appConfig = path.join(__dirname, 'config.yml')
  , CONFIG
  , dataSources = []
  ;

// read application configuration
CONFIG = configuration.parseYaml(appConfig);
console.log(CONFIG);

// Look for data-sources.
dataSources = DataSourceFactory.createDataSources(CONFIG.dataSourceDir)

console.log(dataSources);

// For each data-source:
    // parse config
    // load parser
    // validate config
        // validate url(s)

// connect to redis

// for each data source
    // check registration for data source, if not registered:
        // register data source in redis
    // if registered
        // print a warning and overwrite
    // create redis client
    // create cron job use data source parser, config, and redis client

// create administractive cron jobs for:
// - data cleanup

// Start web server with:
// - HTML handlers for:
//   - main River View page with data source listing
//   - data source pages
//     - index with list of data items
//     - charts
