var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var async = require('async');
var Mocha = require('mocha');

var riverDir = path.join(__dirname, 'rivers');
var riverName = process.argv[2];
var runners = [];

function testRiver(name, cb) {
    var mocha = new Mocha();
    console.log('testing river %s', name);
    global._RIVER_NAME_ = name;

    mocha.addFile(path.join('test', 'rivers', 'river-tests.js'));

    mocha.run(function(failures){
        process.on('exit', function () {
            if (cb) return cb(failures);
            console.log('exiting');
            process.exit(failures);
        });
    });

}

if (! riverName) {

    /*
     * This part isn't quite done yet. I was planning on writing it so that if
     * a river name was not specified on the command line, then all the river
     * tests would run. But I'm running into complications and I'm not sure what
     * the problem is. 
     */

    //_.each(fs.readdirSync(riverDir), function(name) {
    //    if (fs.statSync(path.join(riverDir, name)).isDirectory()) {
    //        runners.push(function(cb) {
    //            testRiver(name, cb);
    //        });
    //    }
    //});
    //console.log(runners);
    //async.series(runners, function(failures) {
    //    console.log('test runner done');
    //    if (failures) {
    //        console.log('exiting');
    //        process.exit(failures);
    //    } else {
    //        console.log('exiting');
    //        process.exit();
    //    }
    //});
} else {
    testRiver(riverName);
}
