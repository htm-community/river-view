var fs = require('fs');
var path = require('path');
var Mocha = require('mocha');
var riverName = process.argv[2];

if (! riverName) {
    console.log('You must specify a river name as the only argument.');
    printUsage();
    process.exit(-1);
}

global._RIVER_NAME_ = riverName;

// First, you need to instantiate a Mocha instance.
var mocha = new Mocha();
mocha.addFile(path.join('test', 'rivers', 'river-tests.js'));

// Now, you can run the tests.
mocha.run(function(failures){
    process.on('exit', function () {
        process.exit(failures);
    });
});

function printUsage() {
    console.log('> node test-river.js <river-name>\n');
}