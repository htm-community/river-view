
var fs = require('fs'),
    nodeUrl = require('url'),
    http = require('http'),
    _ = require('lodash'),
    riverUtils = require('../../lib/river-utilities'),
    csvParse = require('csv-parse'),
    async = require('async'),
    moment = require('moment-timezone'),
    cheerio = require('cheerio');

function dateStringToTimestampWithZone(dateString, timeString, zone) {
    // 07/09/2015
    // 13:15
    var datePieces = dateString.split('/'),
        timePieces = timeString.split(':'),
        timeObject = {},
        timestamp;

    timeObject.month = parseInt(datePieces.shift()) - 1;
    timeObject.day = parseInt(datePieces.shift());
    timeObject.year = parseInt(datePieces.shift());

    timeObject.hour = parseInt(timePieces.shift());
    timeObject.minute = parseInt(timePieces.shift());
    timestamp = moment.tz(timeObject, zone).unix();
    return timestamp;
}

function systemWideDemand(body, options, temporalDataCallback, metaDataCallback) {
    var config = options.config,
        url = options.url,
        $ = cheerio.load(body),
        id = 'system_wide_demand',
        parsedUrl = nodeUrl.parse(url),
        sourceDomain = parsedUrl.protocol + '//' + parsedUrl.hostname,
        downloaders = [];

    // This is important.
    moment.tz.setDefault(config.timezone);

    $($('table')[2]).find('tr').each(function(i, tr) {
        var $tr = $(tr),
            href, downloadUrl, fileName = $tr.find('td.labelOptional_ind').html();
        if (_.endsWith(fileName, 'csv.zip')) {
            href = $tr.find('td:nth-child(4) a').attr('href');
            downloadUrl = sourceDomain + href;
            downloaders.push(function(callback) {
                riverUtils.zippedPathToString(downloadUrl, function(err, csvContents) {
                    if (err) {
                        return console.error(err);
                    }
                    csvParse(csvContents.trim(), {
                        auto_parse: true
                    }, function(err, data) {
                        if (err) {
                            return console.error(err);
                        }
                        // remove headers
                        data.shift();
                        _.each(data, function(row) {
                            var dateString = row[0],
                                timeString = row[1],
                                timestamp = dateStringToTimestampWithZone(dateString, timeString, config.timezone),
                                demand = parseFloat(row[2]);
                            temporalDataCallback(id, timestamp, [demand]);
                        });

                    });
                });
            });
        }
    });

    async.parallel(downloaders, function(err, responses) {
        if (err) throw err;
    });
}

module.exports = systemWideDemand;
