var _ = require('lodash')
  , moment = require('moment-timezone')
  , xml2js = require('xml2js')
  ;



module.exports = function(config, body, url, temporalDataCallback, metaDataCallback) {
    var metaDataNames = config.metadata
      , fieldNames = config.fields
      , timezone = config.timezone
      ;

    // This is important.
    moment.tz.setDefault(config.timezone);

    xml2js.parseString(body, function(err, result) {
        if (err) {
            return console.error(err);
        }

        var props = result.site['$']
          , id = props.id
          , metaData = {}
          , fieldValues = []
          , data = result.site.observed[0].datum.reverse()
          ;

        _.each(data, function(point) {
            var timeString = point.valid[0]._
              , timestamp = moment(new Date(timeString)).tz(timezone).unix()
              , stage = parseFloat(point.primary[0]._)
              , flow = 0.0
              ;

            // Some locations don't have this info
            if (point.secondary) {
                 flow = parseFloat(point.secondary[0]._)
            }

            temporalDataCallback(id, timestamp, [stage, flow]);
        });

        _.each(metaDataNames, function(propName) {
            metaData[propName] = props[propName];
        });
        metaDataCallback(id, metaData);

    });
};
