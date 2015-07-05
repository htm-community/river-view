var _ = require('lodash')
  , moment = require('moment-timezone')
  , csvParse = require('csv-parse')
  ;

function dateStringToTimestampWithZone(timeIn, zone) {
    // 6/29/2015 16:42:48
    var dateString = timeIn.split(' ').shift()
      , timeString = timeIn.split(' ').pop()
      , datePieces = dateString.split('/')
      , timePieces = timeString.split(':')
      , timeObject = {}
      , timestamp
      ;

    timeObject.month = parseInt(datePieces.shift()) - 1
    timeObject.day = parseInt(datePieces.shift())
    timeObject.year = parseInt(datePieces.shift())
    timeObject.hour = parseInt(timePieces.shift())
    timeObject.minute = parseInt(timePieces.shift())
    timeObject.second = parseInt(timePieces.shift())

    timestamp = moment.tz(timeObject, zone).unix();

    return timestamp;
}

module.exports = function(config, body, url, fieldCallback, propertyCallback) {
    var temporalData
      , propertyNames = config.properties
      , fieldNames = config.fields
      ;

      csvParse(body, {
          delimiter: '\t'
        , auto_parse: true
      }, function(err, data) {
          var headers = data.shift()

          _.each(data, function(path) {
              var dataProperties = {}
                , fieldValues = []
                , typeValues = {}
                , pathId = path[headers.indexOf('Id')]
                , timeString = path[headers.indexOf('DataAsOf')]
                , timestamp = dateStringToTimestampWithZone(
                    timeString, "America/New_York"
                  )
                ;

              _.each(propertyNames, function(propName) {
                  dataProperties[propName] = path[headers.indexOf(propName)];
              });
              propertyCallback(null, pathId, dataProperties);

              _.each(fieldNames, function(fieldName) {
                  fieldValues.push(path[headers.indexOf(fieldName)]);
              });
              fieldCallback(null, pathId, timestamp, fieldValues);
          });

      });

};
