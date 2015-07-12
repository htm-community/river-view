var _ = require('lodash')
  , moment = require('moment-timezone')
  ;

function dateStringToTimestampWithZone(timeIn, zone) {
    // 07/09/2015 11:00 AM
    var pieces = timeIn.split(' ')
      , dateString = pieces[0]
      , timeString = pieces[1]
      , ampm = pieces[2]
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

    if (ampm.toLowerCase() == 'pm' && timeObject.hour != 12) {
        timeObject.hour += 12;
    }

    timestamp = moment.tz(timeObject, zone).unix();
    return timestamp;
}

module.exports = function(config, body, url, temporalDataCallback, metaDataCallback) {
    var dataArray
      , fieldNames = config.fields
      , metadataNames = config.metadata
      ;

    try {
        dataArray = JSON.parse(body)
    } catch (err) {
        console.error(body);
        throw new Error('JSON parse error: ' + err.message);
    }

    // This is important.
    moment.tz.setDefault(config.timezone);

    _.each(dataArray, function(dataPoint) {
        var fieldValues = []
          , metadata = {}
          , sensorId = dataPoint.beach_name
          , dateString = dataPoint.last_updated_label
          , timestamp = dateStringToTimestampWithZone(dateString, config.timezone)
          ;

        // Temporal data
        _.each(fieldNames, function(fieldName) {
            fieldValues.push(parseFloat(dataPoint[fieldName]));
        });

        temporalDataCallback(sensorId, timestamp, fieldValues);

        // Metadata
        _.each(metadataNames, function(metadataName) {
            metadata[metadataName] = dataPoint[metadataName];
        });

        metaDataCallback(sensorId, metadata);


    });

};
