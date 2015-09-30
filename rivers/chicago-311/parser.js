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
    var source = options.source,
        config = options.config,
        timezone = options.config.timezone;

    moment.tz.setDefault(config.timezone);

    _.each(payload, function(point) {

        if (point.service_request_number == 'SERVICE REQUEST NUMBER') {
            return;
        }

        // Skip records with no location.
        if (! point.location) {
            return;
        }

        var streamId = source.name,
            timestamp,
            fieldValues,
            location = point.location,
            latitude = location.latitude,
            longitude = location.longitude,
            creation_date = point.creation_date,
            police_district = point.police_district,
            zip_code = point.zip_code,
            status = point.status,
            service_request_number = point.service_request_number,
            ward = point.ward,
            community_area = point.community_area,
            type_of_service_request = point.type_of_service_request,
            street_address = point.street_address;

        fieldValues = [
            latitude,
            longitude,
            police_district,
            zip_code,
            status,
            service_request_number,
            ward,
            community_area,
            type_of_service_request,
            street_address
        ];

        timestamp = dateStringToTimestampWithZone(creation_date, timezone);

        temporalDataCallback(streamId, timestamp, fieldValues);

    });
};
