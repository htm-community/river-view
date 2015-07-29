/*
Structure: 

Prelim M6.2 earthquake FIJI REGION Apr-28 16:39 UTC, updates http://on.doi.gov/1P3449l , 0 #quake tweets/min

*/



var fs = require('fs'),
    _ = require('lodash'),
    request = require('request'),
    geocoder = require('node-geocoder')('google', 'http'),
    moment = require('moment-timezone'),
    cheerio = require('cheerio'),
    hashtagRegex = new RegExp("/(^|\s)(#[a-z\d-]+)/gi"),
    urlRegex = new RegExp("/(http|https):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&amp;:/~+#-]*[\w@?^=%&amp;/~+#-])?/i"),
    locationRegex = new RegExp("/((\d+).(\d+))&deg;([\NS])((\d+).(\d+))&deg;([\EW])\s+(\<br\/\>)\s+(\d+.\d+)\s+(\w+)\s+(\w+)/"),
    timeRegex = new RegExp("/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2})\s(\d{2}):(\d{2})\sUTC?/"),
    last_updatedRegex = new RegExp("/Last Modified:\s+(\d+-\d+-\d+\s+\d+:\d+:\d+)/");



function dateStringToTimestampWithZone(timeIn, timezone) {
    // 2015-07-16 15:16:32 (UTC)
    var dateString = timeIn.replace('(UTC)', '').trim().split(' '),
        timeString = timeIn.split(' ').pop(),
        datePieces = dateString.split('-'),
        timePieces = timeString.split(':'),
        timeObject = {},
        timestamp;

    timeObject.year = parseInt(datePieces.shift());
    timeObject.month = parseInt(datePieces.shift()) - 1;
    timeObject.day = parseInt(datePieces.shift());
    timeObject.hour = parseInt(timePieces.shift());
    timeObject.minute = parseInt(timePieces.shift());
    timeObject.second = parseInt(timePieces.shift());

    timestamp = parseInt(moment.tz(timeObject, timezone).unix());

    return timestamp;
}


function parseTimeString(timeMatch, timestamp_posting) {
    if (timeMatch) {
        // time pattern:
        // Jun-20 02:10 UTC
        var monthList = {'Jan':0, 'Feb':1, 'Mar':2, 'Apr':3, 'May':4,'Jun':5, 'Jul':6, 'Aug':7, 'Sep':8, 'Oct':9, 'Nov':10, 'Dec':11},
                    timeObject = {};
                timeObject.month = parseInt(monthList[timeMatch[0]]);
                timeObject.day = parseInt(timeMatch[1]);
                timeObject.year = parseInt(new Date().getFullYear());
                timeObject.hour = parseInt(timeMatch[2]);
                timeObject.minute = parseInt(timeMatch[3]);
                timeObject.second = parseInt('00');
                timestamp = parseInt(moment.tz(timeObject, config.timezone).unix());
            } else {
                        // Twitter provides the timestamp in UNIX format.
                        timestamp = timestamp_posting;
    }
    return timestamp;
}


function fetchMoreDataFrom(url, callback) {
    request.get(url, function(err, resp, body) {
        var $, $content, $dataTexts, out = {},
            location_str, locationMatch, event_content;
        if (err) return callback(err);
        $ = cheerio.load(body);
        out = {};

        if ($('#content h1').html() == 'Item Not Found') {
            return callback(null, out);
        }

        out['timestamp'] = dateStringToTimestampWithZone($('span[class="utc"]').html().trim());

        out['region'] = $('header[class="page-header"]').html().trim().split(' - ')[1].trim(); 

        out['magnitude'] = parseFloat($('header[class="page-header"]').html().split(' - ')[0].trim().replace('M', '')); 

        location_str = $('span[class="location"]').html().trim();
        /* Location string is of the form: 

        13.878&deg;N58.508&deg;W      <br/>
            10.0 km depth
        */
        locationMatch = locationRegex.exec(location_str)
        if (locationMatch) {
            if (locationMatch[3] == 'N') {
                out['latitude'] = parseInt(locationMatch[0]);
            } else {
                out['latitude'] = -1 * parseInt(locationMatch[0]);
            }

            if (locationMatch[3] == 'E') {
                out['longitude'] = parseInt(locationMatch[4]);
            } else {
                out['longitude'] = -1 * parseInt(locationMatch[4]);
            }

            out['depth'] = parseInt(locationMatch[9]);
        }

        if ($('a[class="tsunami"').length) {
            out['tsunami_alert'] = true;
        } else {
            out['tsunami_alert'] = false;
        }

        event_content = $('section[class="event-content"]').html().trim();
        // Last Modified: 2015-07-18 02:50:02 UTC
        out['last_updated'] = dateStringToTimestampWithZone(last_updatedRegex.exec(event_content), config.timezone);

        out['descriptionAndLinks'] = event_content; 

        callback(null, out);
    });
}

module.exports = function(body, options, temporalDataCallback, metaDataCallback) {
    var config = options.config, 
        url = options.url,
        lastTimestamp = options.lastTimestamp,
        $ = cheerio.load(body),
        columnNames = [],
        id = 'twitter_earthquake';

    // This is important.
    moment.tz.setDefault(config.timezone);

    $('.tweet').each(function(i, tweet) {
        var $tweet = $(tweet),
            text, tweet_text, timestamp_posting, timestamp, event_type, 
            event_status, magnitude, hashMatch, hashtag, tweet_counter,
            urlMatch, link, fieldValues;

        text = $tweet.find('.tweet-text').text();

        if (!text) {
            return;
        }

        tweet_text = text;

        timestamp_posting = parseInt(
            $tweet.find('.tweet-timestamp span.js-short-timestamp')
                .attr('data-time')
        );

        event_type = text.split(' ')[2];

        event_status = text.split(' ')[0];

        hashMatch = text.match(hashtagRegex)
        if (hashMatch) {
            hashtag = hashMatch.shift().trim();
        }

        tweet_counter = parseInt(text.split(' ')[-3]);

        urlMatch = text.match(urlRegex)
        if (urlMatch) {
            link = urlMatch.shift().trim();
        }

        fieldValues = [
            event_type, event_status, tweet_text, hashtag, tweet_counter, link, timestamp_posting
        ];

        if (link) {
            fetchMoreDataFrom(link, function(error, moreData) {
                if (error) {
                    return console.error(error);
                }
                fieldValues = fieldValues.concat([
                    moreData.timestamp, moreData.magnitude, moreData.last_updated, moreData.region, moreData.latitude, moreData.longitude, moreData.depth, moreData.tsunami_alert, moreData.descriptionAndLinks
                ]);
                if (moreData.timestamp === NaN) {
                    moreData.timestamp = parseTimeString(timeMatch, timestamp_posting);
                }
                // only push new data!
                if (parseInt(moreData.timestamp) === lastTimestamp) {
                    return;
                } else {
                temporalDataCallback(id, parseInt(moreData.timestamp), fieldValues);
                }
            });
        } else {
            var timeMatch, magnitude, timestamp;

            timeMatch = timeRegex.exec(text)
            timestamp = parseTimeString(timeMatch, timestamp_posting);
            
            magnitude = parseFloat(text.split(' ')[1].replace('M', ''));

            fieldValues = fieldValues.concat([timestamp, magnitude, null, null, null, null, null, null, null]);
            // only push new data!
            if (parseInt(timestamp) === lastTimestamp) {
                return;
            } else {
            temporalDataCallback(id, parseInt(timestamp), fieldValues);
            }
        }
    });
};