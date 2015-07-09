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

River.prototype.saveTemporalData = function(id, timestamp, data) {
    this.redisClient.writeRiverTemporalData(this.name, id, timestamp, data, this.expires, function(error) {
        // TODO: handle this error properly.
        if (error) throw error;
    });
};

River.prototype.saveGeotemporalData = function(id, timestamp, data) {
    this.redisClient.writeRiverTemporalData(this.name, id, timestamp, data, this.expires, function(error) {
        // TODO: handle this error properly.
        if (error) throw error;
    });
};

River.prototype.saveMetaData = function(id, data) {
    this.redisClient.writeRiverMetaData(this.name, id, data, this.expires, function(error) {
        // TODO: handle this error properly.
        if (error) throw error;
    });
};

River.prototype.getMetaData = function(key, callback) {
    this.redisClient.getRiverMetaData(this.name, key, function(err, meta) {
        if (err) return callback(err);
        callback(null, meta);
    });
};

River.prototype.getTemporalData = function(key, query, callback) {
    this.redisClient.getRiverData(this.name, key, query, function(err, data) {
        if (err) return callback(err);
        callback(null, data);
    });
};

River.prototype.getKeys = function(callback) {
    this.redisClient.getKeys(this.name, function(err, keys) {
        if (err) return callback(err);
        callback(null, keys);
    });

};

River.prototype.toString = function toString() {
    return JSON.stringify(this.config, null, 2);
};

// This is so Node.js will use toString within console.log().
River.prototype.inspect = River.prototype.toString;

module.exports = River;
