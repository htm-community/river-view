var _ = require('lodash')
  , moment = require('moment-timezone')
  , xml2js = require('xml2js')
  ;

function dateStringToTimestampWithZone(timeIn, zone) {
    // 2015-07-11T15:08:30
    var dateString = timeIn.split('T').shift()
      , timeString = timeIn.split('T').pop()
      , datePieces = dateString.split('-')
      , timePieces = timeString.split(':')
      , timeObject = {}
      , timestamp
      ;

    timeObject.year = parseInt(datePieces.shift())
    timeObject.month = parseInt(datePieces.shift()) - 1
    timeObject.day = parseInt(datePieces.shift())

    timeObject.hour = parseInt(timePieces.shift())
    timeObject.minute = parseInt(timePieces.shift())
    timeObject.second = parseInt(timePieces.shift())

    timestamp = moment.tz(timeObject, zone).unix();

    return timestamp;
}

function calculateMinAndMaxSpeed(speedString) {
    // Example input strings:
    // - '62 MPH'
    // - 'Between 50 - 65 MPH'
    // - 'Over 65 MPH'
    // - 'Under 10 MPH'
    var out = {
            min: undefined
          , max: undefined
        };

    if (_.startsWith(speedString, 'Over')) {
        out.min = parseFloat(speedString.split(/\s+/)[1]);
        out.max = Infinity;
    } else if (_.startsWith(speedString, 'Between')) {
        out.min = parseFloat(speedString.split(/\s+/)[1]);
        out.max = parseFloat(speedString.split(/\s+/)[3]);
    } else if (_.startsWith(speedString, 'Under')) {
        out.min = -Infinity;
        out.max = parseFloat(speedString.split(/\s+/)[1]);
    } else {
        out.min = parseFloat(speedString.split(/\s+/)[0]);
        out.max = parseFloat(speedString.split(/\s+/)[0]);
    }
    return out;
}

module.exports = function(config, body, url, temporalDataCallback, metaDataCallback) {

    // This is important.
    moment.tz.setDefault(config.timezone);

    xml2js.parseString(body, function(err, result) {
        if (err) {
            return console.error(err);
        }
        _.each(result.speedSensors.sensor, function(sensor) {
            var minMax
              , metadata
              , fieldValues;

            minMax = calculateMinAndMaxSpeed(sensor.speed[0]);

            metadata = {
                id: sensor.deviceID[0]
              , location: sensor.location[0]
              , latitude: parseFloat(sensor.latitude[0])
              , longitude: parseFloat(sensor.longitude[0])
              , direction: sensor.direction[0]
            };

            metaDataCallback(sensor.deviceID, metadata);

            fieldValues = [minMax.min, minMax.max];

            temporalDataCallback(
                sensor.deviceID[0]
              , dateStringToTimestampWithZone(sensor.timeReported[0], config.timezone)
              , fieldValues
            );

        });
    });

};
