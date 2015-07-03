var path = require('path')
  , url = require('url')
  , _ = require('lodash')
  , express = require('express')
  , DataSourceFactory = require('./lib/data-source-factory')
  , CronManager = require('./lib/cron-manager')
  , configuration = require('./lib/configuration')
  , RedisClient = require('./lib/redis-client')
  , appConfig = path.join(__dirname, 'config.yml')
  , CONFIG
  , REDIS_URL
  , redisClient
  , cronMananger
  , dataSources = []
  , webapp = express()
  ;

// read application configuration
CONFIG = configuration.parseYaml(appConfig);
console.log('Application Configuration');
console.log('==============================================');
console.log(CONFIG);
console.log('==============================================');

// Fail fast
if (! process.env[CONFIG.redisEnv]) {
    throw new Error('Expected REDIS URL set into environment varible "' + CONFIG.redisEnv + '".');
} else {
    REDIS_URL = process.env[CONFIG.redisEnv];
}

// Look for data-sources.
dataSources = DataSourceFactory.createDataSources(CONFIG.dataSourceDir)

console.log('Data-Sources:');
console.log('==============================================');
_.each(dataSources, function(s) { console.log(s); });
console.log('==============================================');

// Connect to redis
redisClient = new RedisClient(REDIS_URL);
redisClient.initialize(function(err) {
    if (err) throw err;

    cronManager = new CronManager({
        config: CONFIG
      , redisClient: redisClient
      , dataSources: dataSources
    });

    cronManager.start();


});

// Start web server with:
// - HTML handlers for:
//   - main River View page with data source listing
//   - data source pages
//     - index with list of data items
//     - charts
