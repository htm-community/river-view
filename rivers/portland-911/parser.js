
var _ = require('lodash'),
    moment = require('moment-timezone'),
    xml2js = require('xml2js');

function dateStringToTimestampWithZone(timeIn, zone) {
    // 2015-07-10T17:20:47.0-07:00
    var pieces = timeIn.split('T'),
        dateString = pieces[0],
        timeString = pieces[1].split('-').shift(),
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

module.exports = function(body, options, temporalDataCallback, metaDataCallback) {
    var config = options.config,
        id = 'portland-911';

    // This is important.
    moment.tz.setDefault(config.timezone);

    xml2js.parseString(body, function(err, result) {
        if (err) {
            return console.error(err);
        }
        var meta = result.feed,
            data = result.feed.entry,
            title = meta.title,
            subtitle = meta.subtitle,
            author = meta.author.name,
            email = meta.author.email,
            fieldValues = [];

        metaDataCallback(id, {
            id: id,
            title: title,
            subtitle: subtitle,
            author: author,
            email: email
        });

        _.each(data, function(dispatch) {
            var published = dispatch.published[0],
                updated = dispatch.updated[0],
                timeString = published,
                timestamp = dateStringToTimestampWithZone(timeString, config.timezone),
                latlngString = dispatch['georss:point'][0].trim(),
                lat = parseFloat(latlngString.split(' ').shift()),
                lng = parseFloat(latlngString.split(' ').pop()),
                dispatchId = dispatch.id[0],
                summary = dispatch.summary[0],
                category = dispatch.category[0]['$'].label;

            fieldValues = [
                lat, lng, dispatchId, summary, category, updated, published
            ];

            temporalDataCallback(id, timestamp, fieldValues);
        });

    });

};