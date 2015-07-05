var _ = require('lodash')
  , request = require('request')
  , moment = require('moment');

function Lockmaster(opts) {
    this.config = opts.config;
    this.redisClient = opts.redisClient;
    this.rivers = opts.rivers;
    this._running = {};
}

Lockmaster.prototype._handleRiverData = function(err, name, id, timestamp, data) {
    // TODO: handle this error properly.
    if (err) throw err;

    // console.log('_handleRiverData for %s ID:%s at %s...', name, id, timestamp);
    // console.log(data);
};

Lockmaster.prototype._handleRiverProperties = function(err, name, id, data) {
    // TODO: handle this error properly.
    if (err) throw err;
    this.redisClient.writeRiverElementProperties(name, id, data, function(error) {
        // TODO: handle this error properly.
        if (error) throw error;
    });
};

Lockmaster.prototype.start = function start() {
    var me = this;

    _.each(me.rivers, function(river) {
        var interval = river.config.interval.split(/\s+/)
          , intervalValue = parseInt(interval.shift())
          , intervalUnits = interval.shift()
          , duration = moment.duration(intervalValue, intervalUnits)
          , intervalSeconds = duration.asMilliseconds()
          , fetchHandle
          , name = river.config.name
          , nameInjectorWrapper
          ;

        // Simply injects the river name into the arguments before calling
        // _handleRiverData()
        nameInjectorWrapper = function(wrappedFunction) {
            return function() {
                var args = Array.prototype.slice.call(arguments);
                args.splice(1, 0, name);
                wrappedFunction.apply(me, args);
            };
        };

        console.log(
            'Starting river "%s", which will run every %s'
          , name
          , river.config.interval
        );

        fetchHandle = setInterval(function() {
            var config = river.config;

            _.each(config.urls, function(url) {

                request.get(url, function(err, resp, body) {
                    // pass response body into parser
                    river.parse.call(
                        river
                      , config
                      , body
                      , url
                        // field callback (wrapped)
                      , nameInjectorWrapper(me._handleRiverData)
                        // property callback (wrapped)
                      , nameInjectorWrapper(me._handleRiverProperties)
                    );
                });
            });
        }, intervalSeconds);

        me._running[river] = fetchHandle;

    });
};

module.exports = Lockmaster;
