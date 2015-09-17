/**
 * Main program. Starts the {@link Lockmaster} and {@link module:lib/data-server}.
 * @module index
 */
var path = require('path'),
    url = require('url'),
    _ = require('lodash'),
    express = require('express'),
    buildStaticSite = require('./lib/site-builder'),
    RiverFactory = require('./lib/river-factory'),
    Lockmaster = require('./lib/lockmaster'),
    startDataService = require('./lib/data-server'),
    configuration = require('./lib/configuration'),
    RedisClient = require('./lib/redis-client'),
    appConfig = path.join(__dirname, 'config.yml'),
    CONFIG, REDIS_URL, redisClient, lockmaster, rivers = [],
    webapp = express();

// read application configuration
CONFIG = configuration.parseYaml(appConfig);

// Make local config substitutions
if (process.env['PORT']) {
    CONFIG.port = process.env['PORT'];
}
if (process.env['HOST']) {
    CONFIG.host = process.env['HOST'];
}
if (CONFIG.host == 'http://localhost') {
    CONFIG.baseurl = CONFIG.host + ':' + CONFIG.port;
} else {
    CONFIG.baseurl = CONFIG.host;
}

// Fail fast if no Redis connection URL is set.
if (!process.env[CONFIG.redisEnv]) {
    throw new Error('Expected Redis connection to be set into environment variable "' + CONFIG.redisEnv + '".');
} else {
    REDIS_URL = process.env[CONFIG.redisEnv];
}

// Connect to redis
redisClient = new RedisClient(REDIS_URL);
redisClient.initialize(function(err) {
    if (err) throw err;

    // Look for data-sources.
    rivers = RiverFactory.createRivers(
        CONFIG.riverDir, CONFIG.defaults.river, redisClient
    );

    console.log('Starting with %s rivers:', rivers.length);

    lockmaster = new Lockmaster({
        config: CONFIG,
        rivers: rivers,
        redisClient: redisClient
    });

    lockmaster.start();

    buildStaticSite(CONFIG, function(err) {
        if (err) throw err;

        webapp.use('/static', express.static('build'));
        startDataService({
            app: webapp,
            redisClient: redisClient,
            rivers: rivers,
            config: CONFIG

        });

    });

});