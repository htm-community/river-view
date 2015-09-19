var _ = require('lodash'),
    moment = require('moment-timezone'),
    satellite = require('satellite.js').satellite;

function julianYearAndDayToTimestamp(year, days) {
    var thisCentury = Math.round(moment().get('year') / 100) * 100;
    var time = moment({year: thisCentury + year});
    time.add(days, 'days');
    console.log(time.format());
    return time.unix();
}


function processTle(name, line1, line2, temporalDataCallback, metaDataCallback) {
    var now = new Date();
    var record = satellite.twoline2satrec(line1, line2);
    var positionAndVelocity = satellite.propagate(
        record,
        now.getUTCFullYear(),
        now.getUTCMonth() + 1,
        now.getUTCDate(),
        now.getUTCHours(),
        now.getUTCMinutes(),
        now.getUTCSeconds()
    );
    var position = positionAndVelocity.position;
    var velocity = positionAndVelocity.velocity;
    var timestamp = julianYearAndDayToTimestamp(record.epochyr, record.epochdays);
    var fieldValues;

    fieldValues = [
        position.x,
        position.y,
        position.z,
        velocity.x,
        velocity.y,
        velocity.z
    ];

    temporalDataCallback(name, timestamp, fieldValues);
}


module.exports = function(body, options, temporalDataCallback, metaDataCallback) {
    var lines = body.split('\n'),
        name, line1, line2;

    moment.tz.setDefault(options.config.timezone);

    _.each(lines, function(line) {
        if (! name) {
            name = line;
        } else if (! line1) {
            line1 = line;
        } else {
            line2 = line;
            processTle(name, line1, line2, temporalDataCallback, metaDataCallback);
            name = undefined;
            line1 = undefined;
            line2 = undefined;
        }
    });
};
