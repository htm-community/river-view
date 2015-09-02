var fs = require('fs'),
    _ = require('lodash'),
    request = require('request'),
    cheerio = require('cheerio'),
    hashtagRegex = /(^|\s)(#[a-z\d-]+)/gi,
    mentionRegex = /(^|\s)(@[a-z\d-]+)/gi,
    picRegex = /pic\.twitter\.com\/[a-z\d-]+/gi,
    urlRegex = /(http|https):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&amp;:/~+#-]*[\w@?^=%&amp;/~+#-])?/gi;


function scrapeTweets(body, callback) {
    var $,
        tweets = [];

    try {
        $ = cheerio.load(body)
    } catch (loadError) {
        return callback(loadError);
    }

    // For each .tweet HTML element on the page
    $('.tweet').each(function(i, tweet) {
        var $tweet = $(tweet), tweetId, text, timestamp, screenName, name,
            userId, hashtags = [], urls = [], pics = [], mentions = [];

        text = $tweet.find('.tweet-text').text();

        if (!text) {
            return;
        }

        // Look for hashtags.
        hashtags = text.match(hashtagRegex) || [];
        hashtags = _.unique(_.map(hashtags, _.trim));

        // Look for mentions.
        mentions = text.match(mentionRegex) || [];
        mentions = _.unique(_.map(mentions, _.trim));

        // Look for a URLs.
        urls = text.match(urlRegex) || [];

        // Look for pics.
        pics = text.match(picRegex) || [];
        pics = _.map(pics, _.trim);



        // Twitter provides the timestamp in UNIX format.
        timestamp = parseInt(
            $tweet.find('.tweet-timestamp span.js-short-timestamp')
                .attr('data-time')
        );

        tweetId = $tweet.attr('data-tweet-id');
        screenName = $tweet.attr('data-screen-name');
        name = $tweet.attr('data-name');
        userId = $tweet.attr('data-user-id');

        tweets.push({
            text: text,
            timestamp: timestamp,
            hashtags: hashtags,
            urls: urls,
            pics: pics,
            mentions: mentions,
            tweetId: tweetId,
            screenName: screenName,
            name: name,
            userId: userId
        });

    });

    callback(null, tweets);
}

module.exports = scrapeTweets;
