var _ = require('lodash'),
    request = require('request'),
    moment = require('moment'),
    async = require('async'),
    CronJob = require('cron').CronJob;
    riverUtils = require('./river-utilities')
    ;

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

Lockmaster.prototype.makeRequest = function(url, callback) {
    // If the url ends with ".gz", treat it as a gzipped file.
    if (_.endsWith(url, '.gz')) {
        riverUtils.gZippedPathToString(url, callback);
    } else {
        request.get(url, callback);
    }
};

Lockmaster.prototype.initializeRivers = function(callback) {
    var initializers = {},
        initializationFailures = {};
    _.each(this.rivers, function(r) {
        if (r.initialize && typeof r.initialize == 'function') {
            console.log('Initializing River "' + r.name + '"...');
            initializers[r.name] = function(localCallback) {
                r.initialize(function(err, sourceUrls) {
                    if (err) {
                        initializationFailures[r.name] = err;
                    }
                    localCallback(null, sourceUrls);
                });
            };
        }
    });
    async.parallel(initializers, function(err, sourceUrls) {
        var urls = sourceUrls;
        if (_.isEmpty(urls)) {
            urls = undefined;
        }
        callback(initializationFailures, urls);
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

        _.each(me.rivers, function(river) {
            var interval = river.config.interval.split(/\s+/),
                intervalValue = parseInt(interval.shift()),
                intervalUnits = interval.shift(),
                duration = moment.duration(intervalValue, intervalUnits),
                intervalSeconds = duration.asMilliseconds(),
                riverName = river.config.name,
                riverRunner;

            // Do NOT start this river if there was an initialization failure.
            if (initializationFailures[riverName]) {
                console.warn('River initialization failure for "%s"', riverName);
                console.warn(initializationFailures[riverName]);
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

                _.each(config.sources, function(url) {

                    runners.push(function(localCallback) {
                        function requestCallback(err, resp, body) {
                            var options = {};
                            if (err) {
                                console.error(err);
                                me.redisClient.logObject({
                                    level: 'warn',
                                    river: riverName,
                                    message: 'HTTP error from ' + url + ': ' + err.message
                                });
                                return;
                            }
                            // Set up the options object we'll be sending to all parsers.
                            options.config = config;
                            options.url = url;
                            try {
                                // pass response body into parser
                                river.parse.call(
                                    // We are not going to pass the parse function any
                                    // context, that means that "this" will be undefined.
                                    undefined,
                                    // response body from HTTP call to source URL
                                    body,
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
                                    level: 'warn',
                                    river: riverName,
                                    message: parseError.message
                                });
                            }
                            localCallback();
                        }

                        me.makeRequest(url, requestCallback);

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

    });

};

module.exports = Lockmaster;
