var _ = require('lodash'),
    moment = require('moment-timezone'),
    xml2js = require('xml2js');

function gmtDateStringToTimestamp(timeIn) {
    return moment(new Date(timeIn)).unix();
}

module.exports = function(body, options, temporalDataCallback, metaDataCallback) {
    var config = options.config;

    // This is important.
    moment.tz.setDefault(config.timezone);

    xml2js.parseString(body, function (err, result) {
        var freeways;
        if (err) {
            return console.error(err);
        }
        freeways = result.rss.channel[0].item;

        _.each(freeways, function(freeway) {
            var streamId = freeway.title[0];
            var fields;
            var travelTimeString;
            var travelTimeStringParts;
            var travelDuration;
            var metadata = {
                title: streamId
            };
            var timestamp = gmtDateStringToTimestamp(freeway.pubDate[0]);

            metaDataCallback(streamId, metadata);

            travelTimeString = freeway.description[0].split(':').pop().trim();
            travelTimeStringParts = travelTimeString.split(/\s+/);
            travelDuration = moment.duration(
                parseInt(travelTimeStringParts.shift()),
                travelTimeStringParts.shift()
            );

            fields = [travelDuration.asMinutes()];

            temporalDataCallback(streamId, timestamp, fields);

        });

    });

};
