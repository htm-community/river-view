
var _ = require('lodash'),
    moment = require('moment-timezone'),
    xml2js = require('xml2js'),
    cheerio = require('cheerio');

var abbrs = {
    EST : 'America/New_York',
    EDT : 'America/New_York',
    CST : 'America/Chicago',
    CDT : 'America/Chicago',
    MST : 'America/Denver',
    MDT : 'America/Denver',
    PST : 'America/Los_Angeles',
    PDT : 'America/Los_Angeles'
};

function decipherAirQualityReport(reportString) {
    var out = {}, aqiValue,
        parts = _.map(reportString.split('-'), function(line) {
            return line.trim();
        });
    out.quality = parts.shift();
    aqiValue = parseInt(parts.shift().split(/\s+/).shift());
    out.microns = parts.shift();
    out.aqi = aqiValue;
    return out;
}

function dateStringToTimestampWithZone(timeIn) {
    // 09/05/15 8:00 PM PDT
    var thisCentury = Math.round(moment().get('year') / 100) * 100,
        pieces = timeIn.split(' '),
        dateString = pieces[0],
        timeString = pieces[1],
        ampm = pieces[2],
        zone = pieces[3],
        datePieces = dateString.split('/'),
        timePieces = timeString.split(':'),
        timeObject = {},
        timestamp;

    timeObject.month = parseInt(datePieces.shift()) - 1;
    timeObject.day = parseInt(datePieces.shift());
    timeObject.year = parseInt(datePieces.shift()) + thisCentury;

    timeObject.hour = parseInt(timePieces.shift());
    timeObject.minute = parseInt(timePieces.shift());

    if (ampm.toLowerCase() == 'pm' && timeObject.hour != 12) {
        timeObject.hour += 12;
    }
    //console.log(timeIn);
    //console.log(moment.tz(timeObject, abbrs[zone]).format());

    timestamp = moment.tz(timeObject, abbrs[zone]).unix();

    return timestamp;
}

function initialize(config, callback) {
    var urls = [],
        // As of today (Sep 7, 2015), there are 788 RSS feeds.
        feedCount = 788;
    _.times(feedCount, function(index) {
        var feedId = index + 1;
        if (! _.contains(config.excludedFeeds, feedId)) {
            urls.push('http://feeds.airnowapi.org/rss/realtime/' + feedId + '.xml');
        }
    });
    callback(null, urls);
}

function parse(body, options, temporalDataCallback, metaDataCallback) {
    xml2js.parseString(body, function(err, result) {
        var data, html, $, $dataEl, location, airQualityString, airQualityParts,
            agency, updatedAtString, updatedAt, airQualityReports = [],
            fieldValues = [];
        if (err) {
            return console.error(err);
        }
        if (! result.rss) {
            // Not every RSS feed from 1 - 788 is actually valid. We'll just
            // ingore the ones that return 404s.
            return console.warn('error fetching %s', options.url);
        }
        data = result.rss.channel[0];

        html = data.item[0].description[0];

        if (_.contains(html, 'Current Air Quality unavailable')) {
            return;
        }

        $ = cheerio.load(html);
        $dataEl = $('[valign="top"]');

        location = $dataEl.find('div:first-child').text().split(':').pop().trim();
        //console.log(location);

        airQualityString = $dataEl.find('div:nth-child(4)').text().trim();
        //console.log(airQualityString);
        airQualityParts = _.map(_.filter(airQualityString.split('\n'), function(line) {
            return line.trim().length;
        }), function(line) {
            return line.trim();
        });

        //console.log(airQualityParts);

        agency = airQualityParts.pop().split(':').pop().trim();
        //console.log(agency);

        updatedAtString = $dataEl.find('div:nth-child(3)').text().trim();
        updatedAtString = updatedAtString.split('\n')[1].trim();
        updatedAt = dateStringToTimestampWithZone(updatedAtString);
        //console.log(updatedAtString);
        //console.log(updatedAt);

        airQualityReports = _.map(airQualityParts, decipherAirQualityReport);

        //console.log(airQualityReports);

        _.each(options.config.fields, function(fieldName) {
            var value = undefined;
            _.each(airQualityReports, function(report) {
                if (report.microns == fieldName) {
                    value = report.aqi;
                }
            });
            fieldValues.push(value);
        });

        //console.log(fieldValues);

        temporalDataCallback(location, updatedAt, fieldValues);

        metaDataCallback(location, {
            agency: agency,
            location: location
        });

    });
}

module.exports = {
    initialize: initialize,
    parse: parse
};
