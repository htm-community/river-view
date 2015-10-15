var expect = require('chai').expect,
    proxyquire = require('proxyquire'),
    dummyFunction = function() {};

describe('after starting', function() {
    var handlers = {};
    var mockApp = {
        use: function(path, func) {
            if (typeof path == 'string') {
                handlers[path] = func;
            }
        },
        listen: dummyFunction
    };
    var mockRedisClient = {
        getTemporalStreamCount: function(cb) {
            cb(null, 0);
        }
    };
    var mockOptions = {
        config: {
            baseurl: 'baseurl',
            defaults: {
                data: {
                    html: 0
                }
            }
        },
        app: mockApp,
        redisClient: mockRedisClient,
        rivers: [{
            name: 'foo',
            config: {},
            getKeys: function(options, cb) {
                cb(null, []);
            }
        }, {
            name: 'bar',
            config: {}
        }]
    };
    var mockTemplates = { compile: dummyFunction };

    var startDataService = proxyquire('../../lib/data-server', {
        './templates': mockTemplates
    });

    startDataService(mockOptions);

    describe('json api', function() {

        describe('river index', function() {

            var handler = handlers['/index\.:ext?'];

            it('returns river objects with navigation urls', function(done) {
                var mockRequest = {
                    query: {},
                    params: {
                        ext: 'json'
                    }
                };
                var mockResponse = {
                    setHeader: dummyFunction,
                    end: function(stringOut) {
                        var jsonOut = JSON.parse(stringOut);
                        expect(jsonOut).to.have.key('rivers');
                        expect(jsonOut.rivers).to.have.length(2);
                        expect(jsonOut.rivers[0]).to.have.key('urls');
                        expect(jsonOut.rivers[0].urls).to.have.keys('keys', 'meta');
                        expect(jsonOut.rivers[0].urls.keys).to.equal('baseurl/foo/keys.json');
                        expect(jsonOut.rivers[0].urls.meta).to.equal('baseurl/foo/meta.json');
                        done();
                    }
                };
                handler(mockRequest, mockResponse);
            });

        });

        describe('river stream meta', function() {

            var handler = handlers['/:river/keys\.:ext?'];

            it('returns navigation urls', function(done) {
                var mockRequest = {
                    query: {},
                    params: {
                        ext: 'json',
                        river: 'foo'
                    }
                };
                var mockResponse = {
                    setHeader: dummyFunction,
                    end: function(stringOut) {
                        var jsonOut = JSON.parse(stringOut);
                        expect(jsonOut).to.have.key('urls', 'keys', 'name');
                        expect(jsonOut.urls).to.have.keys('keys', 'meta', 'streams');
                        expect(jsonOut.urls.keys).to.equal('baseurl/foo/keys.json');
                        expect(jsonOut.urls.meta).to.equal('baseurl/foo/meta.json');
                        done();
                    }
                };
                handler(mockRequest, mockResponse);
            });

        });

        describe('river data', function() {

            var handler = handlers['/:river/:id/data\.:ext?'];
            var testStatus = undefined;

            it('returns 400 if "since" and "until" and "limit" query params are all provided', function(done) {

                var mockRequest = {
                    query: {
                        since: 1111111,
                        until: 2222222,
                        limit: 10
                    },
                    params: {
                        ext: 'json',
                        river: 'foo',
                        id: 'bar'
                    },
                    accepts: function(type) {
                        return (type == 'json');
                    }
                };
                var mockResponse = {
                    setHeader: dummyFunction,
                    end: function(stringOut) {
                        var jsonOut = JSON.parse(stringOut);
                        expect(jsonOut).to.have.key('errors');
                        expect(jsonOut.errors).to.be.instanceOf(Array);
                        expect(jsonOut.errors).to.have.length(1);
                        expect(jsonOut.errors[0]).to.equal('Cannot specify "since" and "until" and "limit" simultaneously.');
                        expect(testStatus).to.equal(400);
                        done();
                    },
                    status: function(status) {
                        testStatus = status;
                    }
                };

                handler(mockRequest, mockResponse);

            });

        });

    });

});

