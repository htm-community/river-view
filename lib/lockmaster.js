var _ = require('lodash')
  , request = require('request')
  , moment = require('moment');

function Lockmaster(opts) {
    this.config = opts.config;
    this.rivers = opts.rivers;
    this._running = {};
}

Lockmaster.prototype.start = function start() {
    var me = this;

    _.each(me.rivers, function(river) {
        var interval = river.config.interval.split(/\s+/)
          , intervalValue = parseInt(interval.shift())
          , intervalUnits = interval.shift()
          , duration = moment.duration(intervalValue, intervalUnits)
          , intervalSeconds = duration.asMilliseconds()
          , name = river.config.name
          , nameInjectorWrapper
          , riverRunner
          ;

        console.log(
            'Starting river "%s", which will run every %s'
          , name
          , river.config.interval
        );

        riverRunner = function() {
            var config = river.config;
            console.log('Running River "' + config.name + '"...');
            _.each(config.sources, function(url) {

                request.get(url, function(err, resp, body) {
                    // pass response body into parser
                    river.parse.call(
                        // We are not going to pass the parse function any
                        // contex, that means that "this" will be undefined.
                        undefined
                      , config
                      , body
                      , url
                        // field callback with proper context
                      , function() {
                          river.saveRiverData.apply(river, arguments);
                      }
                        // property callback with proper context
                      , function() {
                          river.saveRiverProperties.apply(river, arguments);
                      }
                    );
                });
            });
        };

        // Start running at intervals.
        me._running[river] = setInterval(riverRunner, intervalSeconds);

        // Run once now at startup.
        riverRunner();
    });
};

module.exports = Lockmaster;
