var moment = require('moment');

function River(opts) {
    var expires, expiresValue, expiresUnits;
    this.config = opts.config;
    this.name = this.config.name;
    this.redisClient = opts.redisClient;
    this.parse = opts.parser;
    expires = this.config.expires.split(/\s+/)
    expiresValue = parseInt(expires.shift());
    expiresUnits = expires.shift();
    this.expires = moment.duration(expiresValue, expiresUnits).asSeconds();
}

// The "parse" function is provided by the River creator.

River.prototype.saveRiverData = function(err, id, timestamp, data) {
    // TODO: handle this error properly.
    if (err) throw err;
    this.redisClient.writeRiverElementData(this.name, id, timestamp, data, this.expires, function(error) {
        // TODO: handle this error properly.
        if (error) throw error;
    });
};

River.prototype.saveRiverProperties = function(err, id, data) {
    // TODO: handle this error properly.
    if (err) throw err;
    this.redisClient.writeRiverElementProperties(this.name, id, data, this.expires, function(error) {
        // TODO: handle this error properly.
        if (error) throw error;
    });
};

River.prototype.toString = function toString() {
    return JSON.stringify(this.config, null, 2);
};

// This is so Node.js will use toString within console.log().
River.prototype.inspect = River.prototype.toString;

module.exports = River;
