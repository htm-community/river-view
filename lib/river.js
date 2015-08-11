var moment = require('moment-timezone'),
    _ = require('lodash');

/**
 * River.
 * @param opts {Object} River options in an object.
 * @param opts.config {Object} River config.
 * @param opts.redisClient {RedisClient} Redis client.
 * @param opts.parser {function} Parser function defined by River author.
 * @class
 */
function River(opts) {
    var expires, expiresValue, expiresUnits;
    this.config = opts.config;
    this.name = this.config.name;
    this.redisClient = opts.redisClient;
    this.initialize = opts.initialize;
    this.parse = opts.parse;
    expires = this.config.expires.split(/\s+/);
    expiresValue = parseInt(expires.shift());
    expiresUnits = expires.shift();
    this.expires = moment.duration(expiresValue, expiresUnits).asSeconds();
}

// The "parse" function is provided by the River creator.

/**
 * Saves temporal data.
 * @param streamId {string} stream id
 * @param timestamp {int} UNIX timestamp
 * @param data {Object} Data to be stored for the given timestamp.
 */
River.prototype.saveTemporalData = function(streamId, timestamp, data) {
    this.redisClient.writeRiverTemporalData(this.name, streamId, timestamp, data, this.expires, function(error) {
        // TODO: handle this error properly.
        if (error) throw error;
    });
};

/**
 * Save metadata.
 * @param streamId {string} stream id
 * @param data {Object} Data to be stored.
 */
River.prototype.saveMetaData = function(streamId, data) {
    this.redisClient.writeRiverMetaData(this.name, streamId, data, this.expires, function(error) {
        // TODO: handle this error properly.
        if (error) throw error;
    });
};

/**
 * Retrieve metadata for a stream
 * @param streamId {string} stream id
 * @param callback {function} handles response
 */
River.prototype.getMetaData = function(streamId, callback) {
    this.redisClient.getRiverMetaData(this.name, streamId, function(err, meta) {
        if (err) return callback(err);
        callback(null, meta);
    });
};

/**
 * Retrieve temporal data given query params.
 * @param streamId {string} stream id
 * @param query {Object} Query parameters for retrieval.
 * @param query.limit {int} how many data points to retrieve
 * @param query.since {int} UNIX timestamp, limits query to data after timestamp
 * @param query.until {int} UNIX timestamp, limits query to data before timestamp
 * @param callback {function} handles response
 */
River.prototype.getTemporalData = function(streamId, query, callback) {
    var headers = this.config.fields,
        myQuery = _.extend({}, query),
        field = myQuery.field;
    if (field) {
        delete myQuery.field;
    }
    this.redisClient.getRiverData(this.name, streamId, myQuery, function(err, data) {
        if (err) return callback(err);
        if (field) {
            _.each(data, function(dataPoint) {
                dataPoint.data = [dataPoint.data[headers.indexOf(field)]];
            });
        }
        callback(null, data);
    });
};

/**
 * Returns all stream IDs
 * @param callback {function} handles response
 */
River.prototype.getKeys = function(callback) {
    this.redisClient.getKeys(this.name, callback);
};

/**
 * How many data points are there in one stream?
 * @param streamId {string} stream id
 * @param callback {function} handles response
 */
River.prototype.getDataCount = function(streamId, callback) {
    this.redisClient.getDataCount(this.name, streamId, callback);
};

/**
 * Returns two Dates, the first is the earliest time data was received for the
 * given stream, the second is the last time data was received.
 * @param streamId {string} stream id
 * @param callback {function} handles response
 */
River.prototype.getFirstAndLastUpdatedTimes = function(streamId, callback) {
    var me = this,
        riverName = me.name,
        timezone = me.config.timezone;
    me.redisClient.getLatestTimestampForRiverData(riverName, streamId, function(err, timestamp) {
        var latest;
        if (err) return callback(err);
        latest = moment.unix(timestamp).tz(timezone);

        me.redisClient.getEarliestTimestampForRiverData(riverName, streamId, function(err, timestamp) {
            var earliest;
            if (err) return callback(err);
            earliest = moment.unix(timestamp).tz(timezone);
            callback(null, earliest, latest);
        });
    });
};

River.prototype.toString = function toString() {
    return JSON.stringify(this.config, null, 2);
};
// This is so Node.js will use toString within console.log().
River.prototype.inspect = River.prototype.toString;

module.exports = River;
