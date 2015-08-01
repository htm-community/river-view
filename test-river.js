var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var async = require('async');
var Mocha = require('mocha');

var riverDir = path.join(__dirname, 'rivers');
var riverName = process.argv[2];
var runners = [];

function clearRiverTestsFromRequireCache() {
    var key = _.filter(_.keys(require.cache), function(k) {
        return (_.endsWith(k, 'river-tests.js'));
    }).shift();
    delete require.cache[key];
}

function testRiver(name, cb) {
    console.log('Testing river %s', name);
    var mocha = new Mocha({noExit: true});
    global._RIVER_NAME_ = name;

    // Must to this to force reload of the test.
    clearRiverTestsFromRequireCache();

    mocha.addFile(path.join('test', 'rivers', 'river-tests.js'));

    mocha.run(function(failures) {
        console.log('Done testing ' + name);
        cb && cb(failures);
    });
}

if (! riverName) {

    _.each(fs.readdirSync(riverDir), function(name) {
        if (fs.statSync(path.join(riverDir, name)).isDirectory()) {
            runners.push(function(cb) {
                testRiver(name, cb);
            });
        }
    });
    async.series(runners, function(failures) {
        if (failures) {
            process.exit(failures);
        } else {
            process.exit();
        }
    });

} else {
    testRiver(riverName);
}
