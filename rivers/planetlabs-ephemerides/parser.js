var _ = require('lodash'),
    moment = require('moment-timezone'),
    satellite = require('satellite.js').satellite,
    request = require('request'),
    earliestSeenData = undefined;

function julianYearAndDayToTimestamp(year, days) {
    var thisCentury = Math.round(moment().get('year') / 100) * 100;
    var time = moment({year: thisCentury + year});
    time.add(days, 'days');
    return time.unix();
}


function processTle(name, line1, line2, temporalDataCallback) {
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

function processTleBody(body, timezone, temporalDataCallback) {
    var lines = body.split('\n'),
        name, line1, line2;

    _.each(lines, function(line) {
        if (! name) {
            name = line.substr(2);
        } else if (! line1) {
            line1 = line;
        } else {
            line2 = line;
            processTle(name, line1, line2, temporalDataCallback);
            name = undefined;
            line1 = undefined;
            line2 = undefined;
        }
    });
}

function processJspoc(body, metaDataCallback) {
    var lines = body.split('\n');
    _.each(_.filter(lines, function(line) {
        return line.length && ! _.startsWith(line, '#');
    }), function(line) {
        var catid = line.substr(0, 5).trim();
        var name = line.substr(7, 20).toUpperCase().trim();
        var rms = line.substr(27, 6).trim();
        metaDataCallback(name, {
            catid: catid,
            rms: rms
        });
        // Sometimes there is a 2nd record for the same catid.
        if (line.length > 35) {
            name = line.substr(31, 20).toUpperCase().trim();
            rms = line.substr(51, 6).trim();
        }
        metaDataCallback(name, {
            catid: catid,
            rms: rms
        });
    });
}

function initialize(options, callback) {
    earliestSeenData = options.lastUpdated;
    callback();
}

function preload(since, until, config, temporalDataCallback) {
    var current = since;
    var urlPattern = config.historicUrlPattern;
    var yesterday = moment().subtract(1, 'day');
    console.log(current.unix());
    console.log(until.unix());
    console.log('');
    while (current < until) {
        console.log('hi');
        console.log(current.format());
        //var year = current.year();
        //var month = current.month();
        //var day = current.day();
        //var url = urlPattern.replace('YYYYMMDD', year + month + day);
        //if (current >= yesterday) {
        //    break;
        //}
        //console.log(url);
        //request.get(url, function(error, body, response) {
        //    parse(body, {
        //        url: url,
        //        config: config
        //    }, temporalDataCallback)
        //});
        current = current.add(1, 'day');
    }
    console.log('broke out');
}

function parse(body, options, temporalDataCallback, metaDataCallback) {
    var url = options.url,
        timezone = options.config.timezone;

    moment.tz.setDefault(timezone);

    // Let's preload data for the past month if it doesn't already exist :)
    if (earliestSeenData && earliestSeenData.add(1, 'month') > moment()) {
        preload(
            moment().subtract(1, 'month'),
            earliestSeenData,
            options.config,
            temporalDataCallback
        );
    }

    if (_.contains(url, 'jspoc_matches')) {
        processJspoc(body, metaDataCallback);
    } else {
        processTleBody(body, timezone, temporalDataCallback);
    }
}

module.exports = {
    initialize: initialize,
    parse: parse
};
