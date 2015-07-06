var path = require('path')
  , url = require('url')
  , _ = require('lodash')
  , express = require('express')
  , RiverFactory = require('./lib/river-factory')
  , Lockmaster = require('./lib/lockmaster')
  , startDataService = require('./lib/data-server')
  , configuration = require('./lib/configuration')
  , RedisClient = require('./lib/redis-client')
  , appConfig = path.join(__dirname, 'config.yml')
  , CONFIG
  , REDIS_URL
  , redisClient
  , lockmaster
  , rivers = []
  , webapp = express()
  ;

// read application configuration
CONFIG = configuration.parseYaml(appConfig);

// Make local config substitutions
if (process.env['BASE_URL']) {
    config.baseurl = process.env['BASE_URL'];
}
if (process.env['PORT']) {
    config.baseurl = process.env['PORT'];
}

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

// Connect to redis
redisClient = new RedisClient(REDIS_URL);
redisClient.initialize(function(err) {
    if (err) throw err;

    // Look for data-sources.
    rivers = RiverFactory.createRivers(CONFIG.riverDir, redisClient)

    console.log('Starting with %s rivers:', rivers.length);
    console.log('==============================================');
    _.each(rivers, function(s) { console.log(s); });
    console.log('==============================================');


    lockmaster = new Lockmaster({
        config: CONFIG
      , rivers: rivers
    });

    lockmaster.start();

    startDataService({
        app: webapp
      , redisClient: redisClient
      , rivers: rivers
      , config: CONFIG
    });

});




// Start web server with:
// - HTML handlers for:
//   - main River View page with data source listing
//   - data source pages
//     - index with list of data items
//     - charts
