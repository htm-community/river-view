var assert = require('chai').assert
  , expect = require('chai').expect
  ;

describe('when program starts', function() {
    it('runs tests', function() {
        require('../index');
        assert.ok(true);
    });
});
