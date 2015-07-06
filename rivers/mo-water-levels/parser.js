var _ = require('lodash')
  , moment = require('moment-timezone')
  , xml2js = require('xml2js')
  ;



module.exports = function(config, body, url, fieldCallback, propertyCallback) {
    var propertyNames = config.properties
      , fieldNames = config.fields
      , timezone = config.timezone
      ;

    xml2js.parseString(body, function(err, result) {
        var props = result.site['$']
          , id = props.id
          , dataProperties = {}
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

            fieldCallback(null, id, timestamp, [stage, flow]);
        });

        _.each(propertyNames, function(propName) {
            dataProperties[propName] = props[propName];
        });
        propertyCallback(null, id, dataProperties);

    });
};
