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
        if (! point.address_with_geocode) {
            return;
        }

        var streamId = point.category,
            timestamp,
            fieldValues,
            created_date = point.creation_date;

        fieldValues = [
            point.address_with_geocode.longitude,
            point.address_with_geocode.latitude,
            point.case_id,
            point.case_url,
            point.category,
            point.closed_date,
            point.council_district,
            point.days_to_close,
            point.department,
            point.detail,
            point.exceeded_est_timeframe,
            point.neighborhood,
            point.parcel_id_no,
            point.request_type,
            point.source,
            point.status,
            point.street_address,
            point.type,
            point.work_group,
            point.zip_code
        ];

        timestamp = dateStringToTimestampWithZone(created_date, timezone);

        temporalDataCallback(streamId, timestamp, fieldValues);

    });
};
