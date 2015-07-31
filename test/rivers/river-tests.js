var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var yaml = require('js-yaml');
var request = require('request');
var async = require('async');
var moment = require('moment-timezone');
var expect = require('chai').expect;
var assert = require('chai').assert;

var riverName = global._RIVER_NAME_;

var riverDir = path.join(__dirname, '..', '..', 'rivers', riverName);
var configPath = path.join(riverDir, 'config.yml');
var parserPath = path.join(riverDir, 'parser.js');

var TIMEOUT = 5000;

var config;
var httpResponses = {};

function parseYaml(filePath) {
    var contents = fs.readFileSync(filePath, 'utf8');
    return yaml.safeLoad(contents);
}

describe('river directory', function() {

    it('exists', function(done) {
        fs.exists(riverDir, function(exists) {
            expect(exists).to.equal(true, 'Expected river directory at ' + riverDir);
            done();
        });
    });

    it('has a config.yml', function(done) {
        fs.exists(configPath, function(exists) {
            expect(exists).to.equal(true, 'Expected river config at ' + configPath);
            done();
        });
    });

    it('has a parser.js', function(done) {
        fs.exists(parserPath, function(exists) {
            expect(exists).to.equal(true, 'Expected river parser at ' + parserPath);
            done();
        });
    });

});

describe('river config', function() {

    this.timeout(TIMEOUT);

    it('is valid YAML', function(done) {
        try {
            config = parseYaml(configPath);
        } catch (e) {
            assert.fail(null, null, 'config.yml is not valid YAML.');
        } finally {
            done();
        }
    });

    it('has a name', function() {
        assert.ok(config.name, 'config.yml is missing "name"');
    });

    it('has a valid type', function() {
        assert.ok(config.type, 'config.yml is missing "type"');
        expect(['scalar', 'geospatial']).to.contain(config.type);
    });

    it('has a description', function() {
        assert.ok(config.description, 'config.yml is missing "description"');
    });

    it('has an author', function() {
        assert.ok(config.description, 'config.yml is missing "author"');
    });

    it('has an email', function() {
        assert.ok(config.description, 'config.yml is missing "email"');
    });

    it('has a valid timezone', function() {
        assert.ok(config.timezone, 'config.yml is missing "timezone"');
        assert.ok(_.contains(moment.tz.names(), config.timezone), '"timezone" value in config must be a valid timezone string.');
    });

    it('has at least one source', function() {
        assert.ok(config.sources, 'config.yml is missing "sources"');
        expect(config.sources).to.be.instanceOf(Array, '"sources" must be an array of URLs.');
    });

    it('sources all resolve to working URLs', function(done) {
        var fetchers = {};
        var me = this;

        // Each source URL needs time for the HTTP call to respond. We will
        // increase the callback for each source.
        me.timeout(TIMEOUT * config.sources.length);

        _.each(config.sources, function(sourceUrl) {
            fetchers[sourceUrl] = function(callback) {
                request.get(sourceUrl, function(err, resp, body) {
                    if (err) callback(err);
                    callback(null, body);
                });
            };
        });
        async.parallel(fetchers, function(error, responses) {
            assert.notOk(error);
            httpResponses = responses;
            done()
        });
    });

    it('has at least one field', function() {
        assert.ok(config.fields, 'config.yml is missing "fields"');
        expect(config.fields).to.be.instanceOf(Array, '"fields" must be an array of strings.');
        _.each(config.fields, function(field) {
            assert.ok(field, 'at least one element of the "fields" array is empty');
        });
    });

});

describe('river parser', function() {

    var requirePath = path.join(parserPath.split('.')[0]);
    var parse = require(requirePath);

    this.timeout(TIMEOUT);

    it('parse script exports a function', function() {
        expect(parse).to.be.instanceOf(Function);
    });

    describe('when passed a live response body', function() {
        var temporalCallbacks = [];
        var metadataCallbacks = [];

        it('calls the temporalDataCallback with data matching config', function(done) {
            var fetchers = [];
            _.each(httpResponses, function(body, url) {
                fetchers.push(function(cb) {
                    parse(config, body, url,
                        function(id, ts, vals) {
                            assert.ok(id, 'temporal data callback must be sent an id');
                            assert.ok(ts === parseInt(ts, 10), 'timestamp is not an integer');
                            expect(vals).to.be.instanceOf(Array);
                            expect(vals).to.have.length(config.fields.length, 'length of values array sent to temporal callback should match the fields in the config.');
                            temporalCallbacks.push(arguments);
                        },
                        function(id, metadata) {}
                    );
                    setTimeout(cb, 1000);
                });
            });
            async.parallel(fetchers, function(err) {
                if (err) assert.fail(null, null, err.message);
                expect(temporalCallbacks).to.have.length.above(0, 'temporal callback was never called');
                done();
            });
        });

        it('calls the metadataCallback with JSON-parseable data', function(done) {
            var fetchers = [];
            _.each(httpResponses, function(body, url) {
                fetchers.push(function(cb) {
                    parse(config, body, url,
                        function() {},
                        function(id, metadata) {
                            assert.ok(id, 'metadata data callback must be sent an id');
                            metadataCallbacks.push(metadata);
                        }
                    );
                    setTimeout(cb, 1000);
                });
            });
            async.parallel(fetchers, function(err) {
                if (err) assert.fail(null, null, err.message);
                if (metadataCallbacks.length) {
                    _.each(metadataCallbacks, function(metadata) {
                        try {
                            JSON.stringify(metadata);
                        } catch(e) {
                            assert.fail(null, null, 'Cannot stringify metadata response into JSON: ' + metadata);
                        }
                    });
                }
                done();
            });
        });


    });

});