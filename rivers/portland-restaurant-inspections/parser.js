var _ = require('lodash')
  , moment = require('moment-timezone')
  , csvParse = require('csv-parse')
  ;

function dateStringToTimestampWithZone(dateString, zone) {
    // 2015-05-13
    var datePieces = dateString.split('-')
      , timeObject = {}
      , timestamp
      ;

    timeObject.year = parseInt(datePieces.shift())
    timeObject.month = parseInt(datePieces.shift()) - 1
    timeObject.day = parseInt(datePieces.shift())

    timestamp = moment.tz(timeObject, zone).unix();

    return timestamp;
}

module.exports = function(config, body, url, temporalDataCallback, metaDataCallback) {
    var data = JSON.parse(body).results
      , id = 'portland-restaurant-inspections';

    _.each(data, function(point) {
        var dateString = point.date
          , timestamp = dateStringToTimestampWithZone(dateString, config.timezone)
          , fieldValues;

        fieldValues = [
            point.location.Latitude
          , point.location.Longitude
          , point.restaurant_id
          , point.name
          , parseInt(point.score)
          , point.inspection_number
          , point.type
          , point.address.street
          , point.address.city
          , point.address.zip
        ];

        temporalDataCallback(id, timestamp, fieldValues);

    });
};
