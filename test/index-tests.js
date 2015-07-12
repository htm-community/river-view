var assert = require('chai').assert
  , expect = require('chai').expect
  , proxyquire = require('proxyquire')
  ;

describe('when program starts', function() {
    it('fails when REDIS_URL is not set', function() {
        delete process.env.REDIS_URL;
        expect(function() {
            require('../index');
        }).to.throw(
            Error
          , 'Expected Redis connection to be set into environment variable "REDIS_URL".'
        );
    });
});
