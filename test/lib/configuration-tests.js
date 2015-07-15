var expect = require('chai').expect,
    proxyquire = require('proxyquire'),
    configuration;

describe('when parsing yaml config', function() {

    it('parses yaml at specified file path', function() {
        configuration = proxyquire('../../lib/configuration', {
            fs: {
                readFileSync: function(filePath, encoding) {
                    expect(filePath).to.equal('mock config path');
                    expect(encoding).to.equal('utf8');
                    return 'mock yaml contents';
                }
            },
            'js-yaml': {
                safeLoad: function(contents) {
                    expect(contents).to.equal('mock yaml contents');
                    return 'mock config';
                }
            }
        });

        expect(configuration.parseYaml('mock config path')).to.equal('mock config');
    });

});