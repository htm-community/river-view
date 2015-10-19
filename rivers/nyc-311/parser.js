var _ = require('lodash'),
    moment = require('moment-timezone');

function dateStringToTimestampWithZone(timeIn, zone) {
    // "2015-09-16T00:00:00"
    var pieces = timeIn.split('T'),
        dateString = pieces[0],
        timeString = pieces[1],
        datePieces = dateString.split('-'),
        timePieces = timeString.split(':'),
        timeObject = {},
        timestamp;

    timeObject.year = parseInt(datePieces.shift());
    timeObject.month = parseInt(datePieces.shift()) - 1;
    timeObject.day = parseInt(datePieces.shift());

    timeObject.hour = parseInt(timePieces.shift());
    timeObject.minute = parseInt(timePieces.shift());
    timeObject.seconds = parseInt(timePieces.shift());

    timestamp = moment.tz(timeObject, zone).unix();

    return timestamp;
}

module.exports = function(payload, options, temporalDataCallback, metaDataCallback) {
    var config = options.config,
        timezone = options.config.timezone;

    moment.tz.setDefault(config.timezone);

    _.each(payload, function(point) {

        // Skip records with no location.
        if (! point.longitude || ! point.latitude) {
            return;
        }

        var streamId = point.complaint_type,
            timestamp,
            fieldValues,
            created_date = point.created_date;

        fieldValues = [
            point.latitude,
            point.longitude,
            point.address_type,
            point.agency,
            point.borough,
            point.city,
            point.community_board,
            point.descriptor,
            point.due_date,
            point.facility_type,
            point.incident_address,
            point.incident_zip,
            point.location_type,
            point.street_name,
            point.unique_key
        ];

        timestamp = dateStringToTimestampWithZone(created_date, timezone);

        temporalDataCallback(streamId, timestamp, fieldValues);

    });
};
