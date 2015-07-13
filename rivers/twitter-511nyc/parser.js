var fs = require('fs')
  , _ = require('lodash')
  , request = require('request')
  , moment = require('moment-timezone')
  , cheerio = require('cheerio')
  , hashtagRegex = /(^|\s)(#[a-z\d-]+)/gi
  , urlRegex = /(http|https):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&amp;:/~+#-]*[\w@?^=%&amp;/~+#-])?/i
  ;

function fetchMoreDataFrom(url, callback) {
    request.get(url, function(err, resp, body) {
        var $, $content, $dataTexts, out = {}, headers;
        if (err) return callback(err);
        $ = cheerio.load(body);
        out = {};

        if ($('#content h1').html() == 'Item Not Found') {
            return callback(null, out);
        }

        headers = [
            'region', 'county', 'roadway', 'direction'
          , 'description', 'begins', 'lastUpdated'
        ];

        $('#content p').each(function(i, p) {
            out[headers[i]] = $(p).html().trim();
        });
        callback(null, out);
    });
}

module.exports = function(config, body, url, temporalDataCallback, metaDataCallback) {
    var $ = cheerio.load(body)
      , columnNames = []
      , id = 'twitter-511nyc'
      ;

    // This is important.
    moment.tz.setDefault(config.timezone);

    $('.tweet').each(function(i, tweet) {
        var $tweet = $(tweet)
          , text
          , timestamp
          , eventType
          , eventStatus
          , colonSplit
          , hashMatch
          , hashtag
          , urlMatch
          , url
          , fieldValues
          ;

        text = $tweet.find('.tweet-text').text();

        if (! text) {
            return;
        }

        timestamp = parseInt(
            $tweet.find('.tweet-timestamp span.js-short-timestamp')
                  .attr('data-time')
        );

        eventType = text.split(' on ').shift().trim();

        if (_.contains(eventType, ':')) {
            eventStatus = eventType.split(':').shift().trim();
            eventType = eventType.split(':').pop().trim();
        } else {
            eventStatus = 'Initial';
        }

        hashMatch = text.match(hashtagRegex)
        if (hashMatch) {
            hashtag = hashMatch.shift().trim();
        }

        urlMatch = text.match(urlRegex)
        if (urlMatch) {
            url = urlMatch.shift().trim();
        }

        fieldValues = [
            eventType, eventStatus, text, hashtag
        ];

        if (url) {
            fetchMoreDataFrom(url, function(error, moreData) {
                if (error) throw error;
                fieldValues = fieldValues.concat([
                    moreData.region
                  , moreData.roadway
                  , moreData.county
                  , moreData.direction
                  , moreData.description
                  , moreData.begins
                  , moreData.last_updated
                ]);
                temporalDataCallback(id, timestamp, fieldValues);
            });
        } else {
            fieldValues = fieldValues.concat([null,null,null,null,null,null,null,]);
            temporalDataCallback(id, timestamp, fieldValues);
        }


    });
};
