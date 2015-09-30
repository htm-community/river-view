
var _ = require('lodash'),
    moment = require('moment-timezone');

module.exports = function(data, options, temporalDataCallback, metaDataCallback) {
    var config = options.config,
        streamId = 'nypd-motor-vehicle-collisions';

    // This is important.
    moment.tz.setDefault(config.timezone);
    _.each(data, function(event) {
        var dateString = event.date.split('T').shift(),
            timeString = event.time,
            date = moment(dateString + ' ' + timeString, 'YYYY-MM-DD HH:mm'),
            timestamp = date.unix(),
            latitude = parseFloat(event.latitude),
            longitude = parseFloat(event.longitude),
            fieldValues;

        if (isNaN(latitude) || isNaN(longitude)) {
            // IF there is no coordinate, this data doesn't get into RV.
            return;
        }

        fieldValues = [
            latitude, longitude, parseInt(event.unique_key), event.borough,
            event.contributing_factor_vehicle_1, event.contributing_factor_vehicle_2,
            parseInt(event.number_of_cyclist_injured), parseInt(event.number_of_cyclist_killed),
            parseInt(event.number_of_motorist_injured), parseInt(event.number_of_motorist_killed),
            parseInt(event.number_of_pedestrians_injured), parseInt(event.number_of_pedestrians_killed),
            parseInt(event.number_of_persons_injured), parseInt(event.number_of_persons_killed),
            event.off_street_name, event.on_street_name, event.vehicle_type_code1,
            event.vehicle_type_code2, event.zip_code
        ];

        temporalDataCallback(streamId, timestamp, fieldValues);
    });
};
