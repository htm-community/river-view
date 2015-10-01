var _ = require('lodash'),
    request = require('request'),
    moment = require('moment'),
    async = require('async'),
    CronJob = require('cron').CronJob,
    // This is using a local soda-js library right now because of
    // https://github.com/socrata/soda-js/issues/12
    soda = require('./soda'),
    riverUtils = require('./river-utilities'),
    MAX_SODA_LIMIT = 50000;

/**
 * The Lockmaster handles when River parsers are run, what they are sent, and
 * how their responses are processes.
 *
 * In real life, a Lockmaster is a person in
 * charge of a lock and dam.
 * @param opts {object} configuration for the Lockmaster
 * @param opts.config {object} Application configuration
 * @param opts.rivers {array} List of {@link River} objects
 * @param opts.redisClient {RedisClient} Redis client.
 * @class
 */
function Lockmaster(opts) {
    this.config = opts.config;
    this.rivers = opts.rivers;
    this.redisClient = opts.redisClient;
    this._running = {};
}

Lockmaster.prototype.requestCallbackWrapper = function(river, source, localCallback) {
    var me = this;
    var config = river.config;
    return function requestCallback(err, response) {
        var options = {};
        var riverName = config.name;
        if (err) {
            console.error(err);
            me.redisClient.logObject({
                level: 'warning',
                river: riverName,
                message: 'HTTP error from ' + source + ': ' + err.message
            });
            return;
        }
        // Set up the options object we'll be sending to all parsers.
        options.config = config;
        options.source = source;

        try {
            // pass response body into parser
            river.parse.call(
                // We are not going to pass the parse function any
                // context, that means that "this" will be undefined.
                undefined,
                // response from HTTP call to source URL
                response,
                // Options object containing all additional info like
                // config and url and whatever else we want to send in
                // the future.
                options,
                // Callback for data with a timestamp.
                function() {
                    river.saveTemporalData.apply(river, arguments);
                },
                // Callback for metadata.
                function() {
                    river.saveMetaData.apply(river, arguments);
                }
            );
        } catch (parseError) {
            me.redisClient.logObject({
                level: 'warning',
                river: riverName,
                message: parseError.message
            });
        }
        localCallback();
    }
};

Lockmaster.prototype.makeRequest = function(url, callback) {
    //console.log('URL: %s', url);
    // If the url ends with ".gz", treat it as a gzipped file.
    if (_.endsWith(url, '.gz')) {
        riverUtils.gZippedPathToString(url, function(err, resp, body) {
            callback(err, body);
        });
    } else {
        request.get(url, function(err, resp, body) {
            callback(err, body);
        });
    }
};

Lockmaster.prototype.makeSodaRequest = function(sodaOptions, callback) {
    //console.log('SODA: %s', JSON.stringify(sodaOptions));
    soda(sodaOptions, callback);
};

Lockmaster.prototype.preLoadSodaRiver = function(river, callback) {
    var me = this;
    var config = river.config;
    var riverName = config.name;
    var loaders = {};
    _.each(config.soda, function(sodaConfig) {
        var limit = sodaConfig.limit;
        var intervalString = config.interval;
        var intervalDuration = moment.duration(
            parseInt(intervalString.split(/\s+/).shift()),
            intervalString.split(/\s+/).pop()
        );
        var expiresString = config.expires;
        var expiresDuration = moment.duration(
            parseInt(expiresString.split(/\s+/).shift()),
            expiresString.split(/\s+/).pop()
        );
        var halfLifeDate = moment().subtract(expiresDuration.asDays() / 2, 'days');
        var preLoadLimit = (expiresDuration.asDays() / intervalDuration.asDays()) * limit;
        var streamName = sodaConfig.name;

        loaders[riverName + ' ' + streamName] = function(localCallback) {
            var preLoadSodaConfig = _.extend({}, sodaConfig);
            function fetchSodaData(err, lastUpdated) {
                //console.log('--- %s:%s ---', riverName, sodaConfig.name);
                //console.log('last updated: %s', lastUpdated);
                //console.log('half life   : %s', halfLifeDate);
                //console.log('limit       : %s', limit);
                //console.log('interval    : %s', intervalString);
                //console.log('expires     : %s', expiresString);

                if (! lastUpdated || lastUpdated > halfLifeDate) {
                    if (preLoadLimit > MAX_SODA_LIMIT) {
                        preLoadLimit = MAX_SODA_LIMIT;
                    }
                    preLoadSodaConfig.limit = preLoadLimit;
                    console.log('Preloading %s:%s with %s rows of data...', riverName, streamName, preLoadLimit);
                    me.makeSodaRequest(preLoadSodaConfig, me.requestCallbackWrapper(
                        river, preLoadSodaConfig, localCallback
                    ));
                } else {
                    localCallback();
                }
            }
            if (streamName) {
                me.redisClient.getEarliestTimestampForRiverStream(riverName, streamName, fetchSodaData);
            } else {
                me.redisClient.getEarliestTimestampForRiver(riverName, fetchSodaData);
            }
        };
    });

    async.parallel(loaders, function(err) {
        if (err) {
            console.log('preload error for %s:', riverName);
            console.log(err);
            callback(err);
        } else {
            console.log('%s has been preloaded successfully.', riverName);
            callback();
        }
    });
};

Lockmaster.prototype.initializeRivers = function(callback) {
    var me = this,
        redisClient = this.redisClient,
        initializers = {},
        timeFetchers = {},
        initializationFailures = {};

    _.each(this.rivers, function(r) {
        if (! r.config.disabled) {
            timeFetchers[r.name] = function(localCallback) {
                redisClient.getEarliestTimestampForRiver(r.name, localCallback);
            };
        }
    });

    async.parallel(timeFetchers, function(err, times) {

        _.each(times, function(ts, riverName) {
            console.log('  - ' + riverName);
            var r = _.find(me.rivers, function(river) {
                return river.name == riverName;
            });
            var lastUpdated;

            if (ts) lastUpdated = moment.unix(ts);

            initializers[riverName] = function(localCallback) {
                if (r.initialize && typeof r.initialize == 'function') {
                    console.log('Initializing %s...', riverName);
                    r.initialize({
                        config: r.config,
                        lastUpdated: lastUpdated
                    }, function(err, sourceUrls) {
                        if (err) {
                            initializationFailures[r.name] = err;
                        }
                        localCallback(null, sourceUrls);
                    });
                } else if (r.config.soda) {
                    console.log('Preloading SODA data for %s...', riverName);
                    me.preLoadSodaRiver(r, localCallback);
                } else {
                    localCallback();
                }
            };
        });

        async.parallel(initializers, function(err, sourceUrls) {
            var urls = {};
            _.each(sourceUrls, function(url, name) {
                if (url) {
                    urls[name] = url;
                }
            });
            if (_.isEmpty(urls)) {
                urls = undefined;
            }
            callback(initializationFailures, urls);
        });

    });

};

/**
 * When called, the Lockmaster wills start start running Rivers given the
 * `interval` setting in the River's config.yml file. It will run each river's
 * parser immediately.
 *
 * First, Lockmaster makes an HTTP request to each of the `sources` in the River
 * config. Then it passes the body of the response to the River parser defined
 * in `parser.js` in the river directory. When the parser calls the callback
 * functions specified by the Lockmaster, the data is saved.
 */
Lockmaster.prototype.start = function start(startCallback) {
    var me = this;

    me.initializeRivers(function(initializationFailures, sourceUrls) {

        var skipped = 0;

        _.each(me.rivers, function(river) {
            var interval = river.config.interval.split(/\s+/),
                intervalValue = parseInt(interval.shift()),
                intervalUnits = interval.shift(),
                duration = moment.duration(intervalValue, intervalUnits),
                intervalSeconds = duration.asMilliseconds(),
                riverName = river.config.name,
                riverRunner;

            // Do NOT start this river if it is disabled.
            if (river.config.disabled) {
                console.warn('River "%s" is disabled. Skipping.', riverName);
                skipped++;
                return;
            }

            // Do NOT start this river if there was an initialization failure.
            if (initializationFailures[riverName]) {
                console.warn('River initialization failure for "%s"', riverName);
                console.warn(initializationFailures[riverName]);
                skipped++;
                return;
            }

            // The initializer might have returned the source urls. If so, they
            // override the config source urls.
            if (sourceUrls && sourceUrls[riverName]) {
                river.config.sources = sourceUrls[riverName];
            }

            me.redisClient.logObject({
                level: 'info',
                river: riverName,
                message: 'Starting river "' + riverName + '", which will run every ' +
                river.config.interval + '.'
            });

            riverRunner = function(runCallback) {
                var config = river.config,
                    runners = [];

                _.each(config.sources, function(source) {
                    runners.push(function(localCallback) {
                        me.makeRequest(source, me.requestCallbackWrapper(
                            river, source, localCallback
                        ));
                    });
                });

                _.each(config.soda, function(source) {
                    runners.push(function(localCallback) {
                        me.makeSodaRequest(source, me.requestCallbackWrapper(
                            river, source, localCallback
                        ));
                    });
                });

                async.parallel(runners, runCallback);
            };

            // Start running at intervals.
            if (river.config.hasOwnProperty('cronInterval')) {
                if (typeof river.config.cronInterval === 'string') {
                    new CronJob(river.config.cronInterval, riverRunner, null, true, river.config.timezone);
                } else {
                    _.each(river.config.cronInterval, function(interval) {
                        new CronJob(interval, riverRunner, null, true, river.config.timezone);
                    });
                }
            } else {
                me._running[river] = setInterval(riverRunner, intervalSeconds);
                // Run once now at startup.
                riverRunner(startCallback);
            }

        });

        // If all rivers were skipped, call the start callback (or else it will
        // never be called.

        if (me.rivers.length == skipped) {
            startCallback();
        }
    });

};

module.exports = Lockmaster;
