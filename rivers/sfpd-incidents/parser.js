var _ = require('lodash'),
    moment = require('moment-timezone');

module.exports = function(body, options, temporalDataCallback, metaDataCallback) {
    var config = options.config,
        data = JSON.parse(body),
        streamId = 'sfpd-incidents';

    // This is important.
    moment.tz.setDefault(config.timezone);

    _.each(data, function(event) {
        var dateString = event.date.split('T').shift(),
            timeString = event.time,
            date = moment(dateString + ' ' + timeString, 'YYYY-MM-DD HH:mm'),
            timestamp = date.unix(),
            latitude = parseFloat(event.y),
            longitude = parseFloat(event.x),
            fieldValues;

        if (isNaN(latitude) || isNaN(longitude)) {
            latitude = null;
            longitude = null;
        }

        fieldValues = [
            latitude, longitude, parseInt(event.incidntnum), event.category, event.pddistrict, event.pdid, event.address, event.descript, event.resolution
        ];

        temporalDataCallback(streamId, timestamp, fieldValues);
    });
};
