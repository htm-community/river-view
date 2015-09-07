var proxyquire = require('proxyquire');
var expect = require('chai').expect;
var assert = require('chai').assert;

describe('when initializing a river', function() {

    it('does not start rivers with initialization errors', function(done) {
        var Lockmaster = proxyquire('../../lib/lockmaster', {
            request: {
                get: function(url, cb) {
                    expect(url).to.equal('mock url');
                    cb(null, {statusCode: 200}, 'mock response body');
                }
            }
        });
        var barParseCalled = false;
        var mockRiverInitFail = {
            initialize: function(callback) {
                callback(new Error('oh noes!'));
            },
            parse: function() {
                assert.fail('parse function should not be called on a river ' +
                            'that failed initialization');
            },
            name: 'foo',
            config: {
                name: 'foo',
                interval: '1 hour',
                sources: ['mock url']
            }
        };
        var mockRiverInitPass = {
            initialize: function(callback) {
                callback();
            },
            parse: function() {
                barParseCalled = true;
            },
            name: 'bar',
            config: {
                name: 'bar',
                interval: '1 hour',
                sources: ['mock url']
            }
        };
        var lm = new Lockmaster({
            config: {},
            rivers: [mockRiverInitFail, mockRiverInitPass],
            redisClient: {
                logObject: function() {}
            }
        });

        lm.start(function() {
            assert.ok(barParseCalled);
            done();
        });

    });

    it('uses url list returned from initializer as source urls', function(done) {
        var urlsCalled = [];
        var Lockmaster = proxyquire('../../lib/lockmaster', {
            request: {
                get: function(url, cb) {
                    urlsCalled.push(url);
                    cb(null, {statusCode: 200}, 'mock response body');
                }
            }
        });
        var mockRiver = {
            initialize: function(callback) {
                callback(null, ['url1', 'url2', 'url3']);
            },
            parse: function() {
                barParseCalled = true;
            },
            name: 'bar',
            config: {
                name: 'bar',
                interval: '1 hour'
            }
        };
        var lm = new Lockmaster({
            config: {},
            rivers: [mockRiver],
            redisClient: {
                logObject: function() {}
            }
        });

        lm.start(function() {
            expect(urlsCalled).to.have.length(3);
            expect(urlsCalled).to.contain('url1');
            expect(urlsCalled).to.contain('url2');
            expect(urlsCalled).to.contain('url3');
            done();
        });
    });

});

describe('when running a river', function() {

    it('does not run disabled rivers', function(done) {
        var Lockmaster = proxyquire('../../lib/lockmaster', {
            request: {
                get: function(url, cb) {
                    assert.fail('Disabled rivers should not be run.');
                }
            }
        });
        var mockRiverConfig = {
            name: 'mock-river',
            interval: '1 hour',
            sources: ['mock url'],
            disabled: true
        };

        var lm = new Lockmaster({
            config: {},
            rivers: [{
                config: mockRiverConfig,
                parse: function() {
                    assert.fail('Disabled rivers should now be run.');
                },
                initialize: function() {
                    assert.fail('Disabled rivers should now be run.');
                }
            }]
        });

        lm.start(done);
    });

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

    it('handles an undefined reference error from the parser by logging it to redis', function(done) {
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
            var noop = undefined;
            // Forcing an undefined reference error:
            noop.foo;
        };
        var mockLogObject = function(params) {
            if (params.level == 'warn') {
                expect(params.river).to.equal('mock-river');
                expect(params.message).to.equal('Cannot read property \'foo\' of undefined');
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
