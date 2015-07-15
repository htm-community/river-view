
var fs = require('fs'),
    nodeUrl = require('url'),
    http = require('http'),
    request = require('request'),
    _ = require('lodash'),
    csvParse = require('csv-parse'),
    async = require('async'),
    AdmZip = require('adm-zip'),
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

function unzipToString(pathToZip, callback) {
    var data = [],
        dataLen = 0;

    request.get({
        url: pathToZip,
        encoding: null
    })
        .on('error', function(err) {
            callback(err)
        })
        .on('data', function(chunk) {
            data.push(chunk);
            dataLen += chunk.length;
        })
        .on('end', function() {
            var buf = new Buffer(dataLen),
                i = 0,
                len, pos, zip, zipEntries;

            for (i = 0, len = data.length, pos = 0; i < len; i++) {
                data[i].copy(buf, pos);
                pos += data[i].length;
            }
            zip = new AdmZip(buf);
            zipEntries = zip.getEntries();

            for (i = 0; i < zipEntries.length; i++)
                callback(null, zip.readAsText(zipEntries[i]));
        });

}

function systemWideDemand(config, body, url, temporalDataCallback, metaDataCallback) {
    var $ = cheerio.load(body),
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
            href = $tr.find('td:nth-child(4) a').attr('href')
            downloadUrl = sourceDomain + href;
            downloaders.push(function(callback) {
                unzipToString(downloadUrl, function(err, csvContents) {
                    if (err) {
                        return console.error(err);
                    }
                    csvParse(csvContents.trim(), {
                        auto_parse: true
                    }, function(err, data) {
                        if (err) {
                            return console.error(err);
                        }
                        var headers = data.shift()
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