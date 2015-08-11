var zlib = require('zlib'),
    request = require('request'),
    AdmZip = require('adm-zip');


function zippedPathToString(pathToZip, callback) {
    var data = [],
        dataLen = 0;

    request.get({
        url: pathToZip,
        encoding: null
    }).on('error', function(err) {
        callback(err)
    }).on('data', function(chunk) {
        data.push(chunk);
        dataLen += chunk.length;
    }).on('end', function() {
        var buf = new Buffer(dataLen),
            i = 0,
            len, pos, zip, zipEntries;

        for (i = 0, len = data.length, pos = 0; i < len; i++) {
            data[i].copy(buf, pos);
            pos += data[i].length;
        }
        zip = new AdmZip(buf);
        zipEntries = zip.getEntries();

        for (i = 0; i < zipEntries.length; i++) {
            callback(null, zip.readAsText(zipEntries[i]));
        }
    });
}

function gZippedPathToString(pathToGzip, callback) {
    var data = [];
    var dataLen = 0;
    var headers = {
        'Accept-Encoding': 'gzip'
    };
    var response;

    request({
        url:pathToGzip, 'headers': headers
    }, function(err, resp) {
        if (err) {
            return callback(err);
        }
        response = resp;
    })
    .pipe(zlib.createGunzip())
    .on('data', function(chunk) {
        data.push(chunk);
        dataLen += chunk.length;
    })
    .on('end', function() {
        var buf = new Buffer(dataLen), i = 0, len, pos;
        for (i = 0, len = data.length, pos = 0; i < len; i++) {
            data[i].copy(buf, pos);
            pos += data[i].length;
        }
        callback(null, response, buf.toString());
    });
}

module.exports = {
    zippedPathToString: zippedPathToString,
    gZippedPathToString: gZippedPathToString
};