
var _ = require('lodash'),
    moment = require('moment-timezone');

function dateStringToTimestampWithZone(timeIn, zone) {
    // 07/09/2015 11:00 AM
    var pieces = timeIn.split(' '),
        dateString = pieces[0],
        timeString = pieces[1],
        ampm = pieces[2],
        datePieces = dateString.split('/'),
        timePieces = timeString.split(':'),
        timeObject = {},
        timestamp;

    timeObject.month = parseInt(datePieces.shift()) - 1;
    timeObject.day = parseInt(datePieces.shift());
    timeObject.year = parseInt(datePieces.shift());

    timeObject.hour = parseInt(timePieces.shift());
    timeObject.minute = parseInt(timePieces.shift());

    if (ampm.toLowerCase() == 'pm' && (timeObject.hour != 12 || timeObject.hour != 24)) {
        timeObject.hour += 12;
    }

    timestamp = moment.tz(timeObject, zone).unix();
    return timestamp;
}

module.exports = function(dataArray, options, temporalDataCallback, metaDataCallback) {
    var config = options.config,
        fieldNames = config.fields,
        metadataNames = config.metadata;

    moment.tz.setDefault(config.timezone);


    _.each(dataArray, function(dataPoint) {
        var fieldValues = [],
            metadata = {},
            streamId = dataPoint.beach_name,
            dateString = dataPoint.measurement_timestamp_label,
            timestamp = dateStringToTimestampWithZone(dateString, config.timezone);

        // Temporal data
        _.each(fieldNames, function(fieldName) {
            fieldValues.push(parseFloat(dataPoint[fieldName]));
        });

        temporalDataCallback(streamId, timestamp, fieldValues);

        // Metadata
        _.each(metadataNames, function(metadataName) {
            metadata[metadataName] = dataPoint[metadataName];
        });

        metaDataCallback(streamId, metadata);


    });

};
