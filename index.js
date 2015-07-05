var path = require('path')
  , url = require('url')
  , _ = require('lodash')
  , express = require('express')
  , RiverFactory = require('./lib/river-factory')
  , Lockmaster = require('./lib/lockmaster')
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
rivers = RiverFactory.createRivers(CONFIG.riverDir)

console.log('Starting with %s rivers:', rivers.length);
console.log('==============================================');
_.each(rivers, function(s) { console.log(s); });
console.log('==============================================');

// Connect to redis
redisClient = new RedisClient(REDIS_URL);
redisClient.initialize(function(err) {
    if (err) throw err;

    lockmaster = new Lockmaster({
        config: CONFIG
      , redisClient: redisClient
      , rivers: rivers
    });

    lockmaster.start();

});

// Start web server with:
// - HTML handlers for:
//   - main River View page with data source listing
//   - data source pages
//     - index with list of data items
//     - charts
