var proxyquire = require('proxyquire');
var expect = require('chai').expect;
var assert = require('chai').assert;


describe('when running a river', function() {

    it('calls parse function with correct params', function(done) {
        var urlFetched = false;
        var Lockmaster = proxyquire('../../lib/lockmaster', {
            request: {
                get: function(url, cb) {
                    expect(url).to.equal('mock url');
                    urlFetched = true;
                    cb(null, {statusCode: 200}, 'mock response body');
                }
            }
        });
        var mockRiverConfig = {
            name: 'mock-river',
            interval: '1 hour',
            sources: ['mock url']
        };

        var parseFn = function(body, options, cb1, cb2) {
            expect(options.config).to.deep.equal(mockRiverConfig);
            expect(body).to.equal('mock response body');
            expect(options.url).to.equal('mock url');
            assert.ok(urlFetched);
            done();
        };

        var lm = new Lockmaster({
            config: {},
            rivers: [{
                config: mockRiverConfig,
                parse: parseFn
            }],
            redisClient: {
                logObject: function() {}
            }
        });

        lm.start();

    });

    it('handles a manually thrown error from the parser by logging it to redis', function(done) {
        var Lockmaster = proxyquire('../../lib/lockmaster', {
            request: {
                get: function(url, cb) {
                    expect(url).to.equal('mock url');
                    cb(null, {statusCode: 200}, 'mock response body');
                }
            }
        });
        var mockRiverConfig = {
            name: 'mock-river',
            interval: '1 hour',
            sources: ['mock url']
        };
        var parseFn = function() {
            throw new Error('PARSE ERROR');
        };
        var mockLogObject = function(params) {
            if (params.level == 'warn') {
                expect(params.river).to.equal('mock-river');
                expect(params.message).to.equal('PARSE ERROR');
                done();
            }
        };

        var lm = new Lockmaster({
            config: {},
            rivers: [{
                config: mockRiverConfig,
                parse: parseFn,
                name: 'mock-river'
            }],
            redisClient: {
                logObject: mockLogObject
            }
        });

        lm.start();

    });

    it('handles a JSON error from the parser by logging it to redis', function(done) {
        var Lockmaster = proxyquire('../../lib/lockmaster', {
            request: {
                get: function(url, cb) {
                    expect(url).to.equal('mock url');
                    cb(null, {statusCode: 200}, 'mock response body');
                }
            }
        });
        var mockRiverConfig = {
            name: 'mock-river',
            interval: '1 hour',
            sources: ['mock url']
        };
        var parseFn = function() {
            JSON.parse('{{ddgjhlekh]]d]d]]d]');
        };
        var mockLogObject = function(params) {
            if (params.level == 'warn') {
                expect(params.river).to.equal('mock-river');
                expect(params.message).to.equal('Unexpected token {');
                done();
            }
        };

        var lm = new Lockmaster({
            config: {},
            rivers: [{
                config: mockRiverConfig,
                parse: parseFn,
                name: 'mock-river'
            }],
            redisClient: {
                logObject: mockLogObject
            }
        });

        lm.start();

    });


});

