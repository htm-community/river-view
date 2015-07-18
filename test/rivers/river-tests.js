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

    var config;

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
        var fetchers = [];
        _.each(config.sources, function(sourceUrl) {
            fetchers.push(function(callback) {
                request.get(sourceUrl, callback);
            });
        });
        async.parallel(fetchers, function(error) {
            assert.notOk(error);
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

//describe('river parser', function() {
//
//    it('', function() {});
//
//    it('', function() {});
//
//    it('', function() {});
//
//
//});