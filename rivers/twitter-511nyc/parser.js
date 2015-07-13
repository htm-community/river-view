var fs = require('fs')
  , _ = require('lodash')
  , moment = require('moment-timezone')
  , cheerio = require('cheerio')
  , hashtagRegex = /(^|\s)(#[a-z\d-]+)/gi
  ;

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

        temporalDataCallback(id, timestamp, [
            text
          , eventType
          , eventStatus
          , hashtag
        ]);

    });
};
