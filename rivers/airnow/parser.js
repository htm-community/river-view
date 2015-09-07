
var _ = require('lodash'),
    moment = require('moment-timezone'),
    xml2js = require('xml2js'),
    cheerio = require('cheerio');

var abbrs = {
    EST : 'Eastern Standard Time',
    EDT : 'Eastern Daylight Time',
    CST : 'Central Standard Time',
    CDT : 'Central Daylight Time',
    MST : 'Mountain Standard Time',
    MDT : 'Mountain Daylight Time',
    PST : 'Pacific Standard Time',
    PDT : 'Pacific Daylight Time'
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
    var pieces = timeIn.split(' '),
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
    timeObject.year = parseInt(datePieces.shift());

    timeObject.hour = parseInt(timePieces.shift());
    timeObject.minute = parseInt(timePieces.shift());

    if (ampm.toLowerCase() == 'pm' && timeObject.hour != 12) {
        timeObject.hour += 12;
    }
console.log(moment.tz(timeObject, zone).format());
    timestamp = moment.tz(timeObject, zone).unix();

    return timestamp;
}

module.exports = function(body, options, temporalDataCallback, metaDataCallback) {

    console.log('');

    xml2js.parseString(body, function(err, result) {
        var data, html, $, $dataEl, location, airQualityString, airQualityParts,
            agency, updatedAtString, updatedAt, airQualityReports = [];
        if (err) {
            return console.error(err);
        }
        data = result.rss.channel[0];

        html = data.item[0].description[0];

        $ = cheerio.load(html);
        $dataEl = $('[valign="top"]');

        location = $dataEl.find('div:first-child').text().split(':').pop().trim();
        console.log(location);

        airQualityString = $dataEl.find('div:nth-child(4)').text().trim();
        airQualityParts = _.map(_.filter(airQualityString.split('\n'), function(line) {
            return line.trim().length;
        }), function(line) {
            return line.trim();
        });

        agency = airQualityParts.pop().split(':').pop().trim();
        console.log(agency);

        updatedAtString = $dataEl.find('div:nth-child(3)').text().trim();
        updatedAtString = updatedAtString.split('\n')[1].trim();
        updatedAt = dateStringToTimestampWithZone(updatedAtString);
        console.log(updatedAtString);
        console.log(updatedAt);

        airQualityReports = _.map(airQualityParts, decipherAirQualityReport);

        console.log(airQualityReports);

    });
};
