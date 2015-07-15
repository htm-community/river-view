var assert = require('chai').assert,
    expect = require('chai').expect,
    proxyquire = require('proxyquire');

describe('when program starts', function() {

    it('fails when REDIS_URL is not set', function() {
        var redisUrl = process.env.REDIS_URL;
        delete process.env.REDIS_URL;
        expect(function() {
            require('../index');
        }).to.throw(
            Error, 'Expected Redis connection to be set into environment variable "REDIS_URL".'
        );
        process.env.REDIS_URL = redisUrl;
    });

    it('passes redis url to redis client', function() {
        var mockRedisClient = {
                initialize: function() {}
            },
            mockRedisClientConstructor = function(redisUrl) {
                expect(redisUrl).to.equal('mock redis url');
                return mockRedisClient;
            },
            redisUrl = process.env.REDIS_URL;
        process.env.REDIS_URL = 'mock redis url';
        proxyquire('../index', {
            './lib/redis-client': mockRedisClientConstructor
        });
        process.env.REDIS_URL = redisUrl;
    });

});