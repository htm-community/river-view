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
                console.log('Making %s request to\n\t%s', river.name, url);
                request.get(url, function(err, resp, body) {
                    if (err) {
                        console.warn(err);
                        console.warn('continuing...');
                        return;
                    }
                    console.log('Received %s response from \n\t%s', river.name, url);
                    // pass response body into parser
                    river.parse.call(
                        // We are not going to pass the parse function any
                        // contex, that means that "this" will be undefined.
                        undefined
                      , config
                      , body
                      , url
                        // Callback for data with a timestamp.
                      , function() {
                          river.saveTemporalData.apply(river, arguments);
                      }
                        // Callback for more static, meta-data.
                      , function() {
                          river.saveMetaData.apply(river, arguments);
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
