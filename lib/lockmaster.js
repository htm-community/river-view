var _ = require('lodash'),
    request = require('request'),
    moment = require('moment'),
    schedule = require('node-schedule');

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
Lockmaster.prototype.start = function start() {
    var me = this;

    _.each(me.rivers, function(river) {
        var interval = river.config.interval.split(/\s+/),
            intervalValue = parseInt(interval.shift()),
            intervalUnits = interval.shift(),
            duration = moment.duration(intervalValue, intervalUnits),
            intervalSeconds = duration.asMilliseconds(),
            name = river.config.name,
            riverRunner;

        me.redisClient.logObject({
            level: 'info',
            river: river.name,
            message: 'Starting river "' + name + '", which will run every ' +
            river.config.interval + '.'
        });

        riverRunner = function() {
            var config = river.config;
            console.log('Initializing River "' + config.name + '"...');
            _.each(config.sources, function(url) {
                console.log('Making %s request to\n\t%s', river.name, url);
                me.redisClient.logObject({
                    level: 'info',
                    river: river.name,
                    message: 'request made to ' + url
                });
                request.get(url, function(err, resp, body) {
                    if (err) {
                        console.error(err);
                        me.redisClient.logObject({
                            level: 'warn',
                            river: river.name,
                            message: 'HTTP error from ' + url + ': ' + err.message
                        });
                        return;
                    }
                    console.log('Received %s response from \n\t%s', river.name, url);
                    me.redisClient.logObject({
                        level: 'info',
                        river: river.name,
                        message: 'response ' + resp.statusCode + ' received from ' + url
                    });
                    try {
                        // pass response body into parser
                        river.parse.call(
                            // We are not going to pass the parse function any
                            // contex, that means that "this" will be undefined.
                            undefined,
                            // river config
                            config,
                            // response body from HTTP call to source URL
                            body,
                            // The source URL
                            url,
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
                            river: river.name,
                            message: parseError.message
                        });
                    }
                });
            });
        };

        // Start running at intervals.
        if (river.config.hasOwnProperty('cronInterval')) {
            if (typeof river.config.cronInterval === 'string') {
                schedule.scheduleJob(river.config.cronInterval);
            } else {
                _.each(river.config.cronInterval, function(interval) {
                    schedule.scheduleJob(interval, riverRunner);
                });
            }
        } else {
            me._running[river] = setInterval(riverRunner, intervalSeconds);

            // Run once now at startup.
            riverRunner();
        }

    });
};

module.exports = Lockmaster;