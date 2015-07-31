var fs = require('fs'),
    _ = require('lodash'),
    request = require('request'),
    geocoder = require('node-geocoder')('google', 'http'),
    moment = require('moment-timezone'),
    cheerio = require('cheerio'),
    hashtagRegex = /(^|\s)(#[a-z\d-]+)/gi,
    urlRegex = /(http|https):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&amp;:/~+#-]*[\w@?^=%&amp;/~+#-])?/i;

function fetchMoreDataFrom(url, callback) {
    request.get(url, function(err, resp, body) {
        var $, out = {},
            headers;
        if (err) return callback(err);
        $ = cheerio.load(body);
        out = {};

        // If the tweet is old, the URL usually gets removed.
        if ($('#content h1').html() == 'Item Not Found') {
            return callback(null, out);
        }

        headers = [
            'region', 'county', 'roadway', 'direction', 'description', 'begins', 'lastUpdated'
        ];

        $('#content p').each(function(i, p) {
            out[headers[i]] = $(p).html().trim();
        });

        // If there is a roadway (usually a street name), we'll try to resolve
        // it into lat/lon through Google Maps.
        if (out.roadway) {
            geocoder.geocode(out.roadway + ', New York City, NY', function(err, res) {
                if (err) return callback(null, out);
                out.latitude = res[0].latitude;
                out.longitude = res[0].longitude;
                callback(null, out);
            });
        } else {
            callback(null, out);
        }

    });
}

module.exports = function(body, options, temporalDataCallback, metaDataCallback) {
    var config = options.config,
        $ = cheerio.load(body),
        id = 'twitter-511nyc';

    // This is important.
    moment.tz.setDefault(config.timezone);

    // For each .tweet HTML element on the page
    $('.tweet').each(function(i, tweet) {
        var $tweet = $(tweet),
            text, timestamp, eventType, eventStatus, hashMatch,
            hashtag, urlMatch, url, fieldValues;

        text = $tweet.find('.tweet-text').text();

        if (!text) {
            return;
        }

        // Twitter provides the timestamp in UNIX format.
        timestamp = parseInt(
            $tweet.find('.tweet-timestamp span.js-short-timestamp')
                .attr('data-time')
        );

        eventType = text.split(' on ').shift().trim();

        // Trying to guess the event type based on the tweet text. All the
        // tweets from this account have a common format, or else this wouldn't
        // work.
        if (_.contains(eventType, ':')) {
            eventStatus = eventType.split(':').shift().trim();
            eventType = eventType.split(':').pop().trim();
        } else {
            // If there is no even status, it is an initial report, so we make
            // it up.
            eventStatus = 'Initial';
        }

        // Look for hashtag and store it if there's one.
        hashMatch = text.match(hashtagRegex);
        if (hashMatch) {
            hashtag = hashMatch.shift().trim();
        }

        // Look for a URL in the tweet that we can GET for extra information.
        urlMatch = text.match(urlRegex);
        if (urlMatch) {
            url = urlMatch.shift().trim();
        }

        // Even if there is no URL to get extra info, we'll always provide the
        // following:
        fieldValues = [
            eventType, eventStatus, text, hashtag
        ];

        // If there's a URL to GET, add more data.
        if (url) {
            fetchMoreDataFrom(url, function(error, moreData) {
                if (error) {
                    return console.error(error);
                }
                fieldValues = fieldValues.concat([
                    moreData.region, moreData.roadway, moreData.county, moreData.direction, moreData.description, moreData.begins, moreData.last_updated, moreData.latitude, moreData.longitude
                ]);
                temporalDataCallback(id, timestamp, fieldValues);
            });
        }
        // If no URL to GET, the rest of the field values are empty.
        else {
            fieldValues = fieldValues.concat([null, null, null, null, null, null, null, null, null]);
            temporalDataCallback(id, timestamp, fieldValues);
        }


    });
};