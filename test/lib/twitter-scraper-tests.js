var expect = require('chai').expect,
    proxyquire = require('proxyquire'),
    path = require('path'),
    _ = require('lodash'),
    fs = require('fs'),
    mockBody,
    scraper = require('../../lib/twitter-scraper');

mockBody = fs.readFileSync(path.join(__dirname, '../mock-data/twitterstream-rhyolight.html'), 'utf-8');

describe('when parsing tweets', function() {

    it('collects the right number of tweets', function() {
        scraper(mockBody, function(err, tweets) {
            expect(tweets).to.have.length(19);
        });
    });

    it('gets the proper data from each tweet', function() {
        scraper(mockBody, function(err, tweets) {
            var tweet;

            _.each(tweets, function(tweet) {
                expect(tweet).to.have.keys(
                    'text',
                    'timestamp',
                    'hashtags',
                    'urls',
                    'tweetId',
                    'screenName',
                    'name',
                    'userId',
                    'pics',
                    'mentions'
                );
            });

            // 'Something awful happened to cartoons while we weren\'t paying
            // attention pic.twitter.com/STzfS5vgA8'
            tweet = tweets[0];
            expect(tweet.text).to.equal('Something awful happened to cartoons while we weren\'t paying attention pic.twitter.com/STzfS5vgA8');
            expect(tweet.tweetId).to.equal('638896074007056384');
            expect(tweet.userId).to.equal('6797182');
            expect(tweet.screenName).to.equal('rhyolight');
            expect(tweet.name).to.equal('☠ Matthew Taylor ☠');
            expect(tweet.timestamp).to.equal(1441159668);
            expect(tweet.pics).to.have.length(1);
            expect(tweet.pics[0]).to.equal('pic.twitter.com/STzfS5vgA8');
            expect(tweet.hashtags).to.have.length(0);
            expect(tweet.urls).to.have.length(0);
            expect(tweet.mentions).to.have.length(0);

            // 'Programming with shared mutable state: pic.twitter.com/5bndmkC6FU'
            tweet = tweets[1];
            expect(tweet.text).to.equal('Programming with shared mutable state: pic.twitter.com/5bndmkC6FU');
            expect(tweet.tweetId).to.equal('518071391959388160');
            expect(tweet.userId).to.equal('22544940');
            expect(tweet.screenName).to.equal('teozaurus');
            expect(tweet.name).to.equal('teo danciu');
            expect(tweet.timestamp).to.equal(1412352819);
            expect(tweet.pics).to.have.length(1);
            expect(tweet.pics[0]).to.equal('pic.twitter.com/5bndmkC6FU');
            expect(tweet.hashtags).to.have.length(0);
            expect(tweet.urls).to.have.length(0);
            expect(tweet.mentions).to.have.length(0);

            // 'In case you were wondering, this is how a Super Star Destroyer
            // and Manhattan compare in size. http://bit.ly/1NRENj8 
            // pic.twitter.com/l0Opxzl0K7'
            tweet = tweets[4];
            expect(tweet.urls).to.have.length(1);
            expect(tweet.urls[0]).to.equal('http://bit.ly/1NRENj8');
            expect(tweet.pics).to.have.length(1);
            expect(tweet.pics[0]).to.equal('pic.twitter.com/l0Opxzl0K7');

            // '#NuPIC is the 3rd most contributed-to open source python machine
            // learning project on GitHub.
            // https://twitter.com/DBaker007/status/625860809919451136 …
            // Top 20 #Python #MachineLearning #OpenSource Projects @KDnuggets
            // http://ow.ly/Q4XVd  #scikitLearn #PyLearn2 #NuPic
            // pic.twitter.com/eHzENrRGhi'
            tweet = tweets[9];
            expect(tweet.hashtags).to.have.length(7);
            expect(tweet.hashtags).to.deep.equal([
                '#NuPIC',
                '#Python',
                '#MachineLearning',
                '#OpenSource',
                '#scikitLearn',
                '#PyLearn2',
                '#NuPic'
            ]);

            expect(tweet.urls).to.have.length(2);
            expect(tweet.urls).to.deep.equal([
                'https://twitter.com/DBaker007/status/625860809919451136',
                'http://ow.ly/Q4XVd'
            ]);

            // 'Anyone who is up in arms about the @nytimes article about
            // @amazon should read this response from an Amazon employee
            // http://bit.ly/1JaLMPW '
            tweet = tweets[17];
            expect(tweet.mentions).to.have.length(2);
            expect(tweet.mentions).to.deep.equal([
                '@nytimes',
                '@amazon'
            ]);

        });
    });

});
