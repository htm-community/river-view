var url = require('url'),
    moment = require('moment'),
    redis = require('redis'),
    _ = require('lodash');

/*
 * Redis sorted set data comes back "WITHSCORES" in every other array element.
 * This zips them together into an object with "data" and "timestamp" keys.
 */
function unzipScores(redisData) {
    var out = [];
    _.each(redisData, function(data, index) {
        if (index % 2 != 0) {
            out[out.length - 1].timestamp = parseInt(data);
        } else {
            out.push({
                data: JSON.parse(data)
            });
        }
    });
    return out.reverse();
}

/**
 * This is a redis client for River View. It contains the persistence and
 * retrieval logic.
 * @param url {string} connection string for the redis instance
 * @class RedisClient
 */
function RedisClient(url) {
    this.url = url;
}

/**
 * This makes the connection to Redis.
 * @param callback {function} handles response
 */
RedisClient.prototype.initialize = function initialize(callback) {
    var redisUrl = this.url,
        connection = url.parse(redisUrl),
        redisClient;
    this.client = redisClient = redis.createClient(
        connection.port, connection.hostname
    );
    if (connection.auth) {
        redisClient.auth(connection.auth.split(":")[1]);
    }
    if (callback) {
        redisClient.on('connect', function() {
            console.log('Connected to Redis at %s', redisUrl);
            callback();
        });
        redisClient.on('error', function(error) {
            callback(error);
        });
    }

};

/*
 * Used to wrap functions that write to redis with another function below that
 * expires the data after a number of seconds.
 */
RedisClient.prototype._expiresWrapper =
    function _expiresWrapper(key, seconds, callback) {
        var me = this;
        return function(err) {
            if (err) return callback(err);
            me.client.expire(key, seconds, callback);
        };
    };

// Write

/**
 * Writes stream metadata to redis
 * @param name {string} River name
 * @param streamId {string} Stream id
 * @param meta {object} data to save
 * @param expires {int} seconds before data expires
 * @param callback {function} handles response
 */
RedisClient.prototype.writeRiverMetaData =
    function writeRiverMetaData(name, streamId, meta, expires, callback) {
        var key = name + ':' + streamId + ':props',
            val = JSON.stringify(meta);
        this.client.set(key, val, this._expiresWrapper(key, expires, callback));
    };

/**
 * Writes temporal data to redis
 * @param name {string} River name
 * @param streamId {string} Stream id
 * @param timestamp {int} UNIX timestamp for the data
 * @param data {array} list of objects to save associated with the timestamp
 * @param expires {int} seconds before data expires
 * @param callback {function} handles response
 */
RedisClient.prototype.writeRiverTemporalData =
    function writeRiverTemporalData(name, streamId, timestamp, data, expires, callback) {
        var key = name + ':' + streamId + ':data',
            score = timestamp,
            val = JSON.stringify(data);
        this.client.zadd(key, score, val, callback);
    };

/**
 * Logs to redis for 6 hours.
 * @param obj {object} thing to log, can be any JSON object
 */
RedisClient.prototype.logObject = function logActivity(obj) {
    var key = 'activity-log',
        val, expires = moment.duration(6, 'hours').asSeconds(),
        now = moment().tz('UTC'),
        dateString = now.format(),
        timestamp = now.unix();

    obj.date = dateString;
    val = JSON.stringify(obj);

    this.client.zadd(key, timestamp, val, this._expiresWrapper(key, expires, function(err) {
        if (err) console.error(err);
    }));
};

// Read

/**
 * Retrieves logs saved by {@link logObject}.
 * @param callback {function} handles response
 */
RedisClient.prototype.getLogs =
    function getLogs(callback) {
        var args = ['activity-log', '+inf', '-inf', 'WITHSCORES', 'LIMIT', 0, 100]
        this.client.zrevrangebyscore(args, function(error, values) {
            if (error) return callback(error);
            callback(null, _.map(values, JSON.parse));
        });
    };

/**
 * Retrieves metadata.
 * @param riverName {string} River name
 * @param streamId {string} Stream id
 * @param callback {function} handles response
 */
RedisClient.prototype.getRiverMetaData =
    function getRiverMetaData(riverName, streamId, callback) {
        var key = riverName + ':' + streamId + ':props';
        this.client.get(key, function(err, resp) {
            if (err) return callback(err);
            callback(null, JSON.parse(resp));
        });
    };

/**
 * Retrieves list of stream ids in a River
 * @param riverName {string} River name
 * @param callback {function} handles response
 */
RedisClient.prototype.getKeys = function getKeys(riverName, callback) {
    this.client.keys(riverName + ':*:data', function(error, keys) {
        var cleanKeys;
        if (error) return callback(error);
        cleanKeys = _.map(keys, function(k) {
            return k.split(':')[1];
        });
        callback(null, cleanKeys);
    });
};

/**
 * Retrieves how many data points are stored in a stream.
 * @param riverName {string} River name
 * @param streamId {string} Stream id
 * @param callback {function} handles response
 */
RedisClient.prototype.getDataCount =
    function getDataCount(riverName, streamId, callback) {
        var key = riverName + ':' + streamId + ':data';
        this.client.zcount(key, '-inf', '+inf', callback);
    };

/**
 * Retrieves temporal data from a River Stream
 * @param riverName {string} River name
 * @param streamId {string} Stream id
 * @param query {Object} Query parameters for retrieval.
 * @param query.limit {int} how many data points to retrieve
 * @param query.since {int} UNIX timestamp, limits query to data after timestamp
 * @param query.until {int} UNIX timestamp, limits query to data before timestamp
 * @param callback {function} handles response
 */
RedisClient.prototype.getRiverData =
    function getRiverData(riverName, streamId, query, callback) {
        var key, since, until, limit, fetchArgs;
        if (!query) {
            query = {};
        }

        since = query.since || '-inf';
        until = query.until || '+inf';
        limit = query.limit;
        key = riverName + ':' + streamId + ':data';

        fetchArgs = [key, until, since, 'WITHSCORES'];

        if (limit) {
            fetchArgs = fetchArgs.concat(['LIMIT', 0, parseInt(limit)])
        }

        this.client.zrevrangebyscore(fetchArgs, function(error, values) {
            if (error) return callback(error);
            callback(null, unzipScores(values));
        });
    };

/**
 * Gets either the earliest or latest timestamp of data stored in a stream.
 * @param riverName {string} River name
 * @param streamId {string} Stream id
 * @param extreme {string} Either 'earliest' or 'latest'
 * @param callback {function} handles response
 */
RedisClient.prototype.getExtremeTimestampForRiverData =
    function getExtremeTimestampForRiverData(riverName, streamId, extreme, callback) {
        var key, since = '-inf',
            until = '+inf',
            limit = 1,
            redisFunctionName = 'zrevrangebyscore',
            fetchArgs;

        if (extreme == 'earliest') {
            redisFunctionName = 'zrangebyscore';
            since = '+inf';
            until = '-inf';
        }

        key = riverName + ':' + streamId + ':data';

        fetchArgs = [key, until, since, 'WITHSCORES', 'LIMIT', 0, limit];

        this.client[redisFunctionName](fetchArgs, function(error, values) {
            var timestamp;
            if (error) return callback(error);
            // Score is 2nd.
            timestamp = values[1];
            callback(null, timestamp);
        });
    };

/**
 * Gets the latest timestamp for a stream's data.
 * @param riverName {string} River name
 * @param streamId {string} Stream id
 * @param callback {function} handles response
 */
RedisClient.prototype.getLatestTimestampForRiverData =
    function getLatestTimestampForRiverData(riverName, streamId, callback) {
        this.getExtremeTimestampForRiverData(riverName, streamId, 'latest', callback);
    };

/**
 * Gets the earliest timestamp for a stream's data.
 * @param riverName {string} River name
 * @param streamId {string} Stream id
 * @param callback {function} handles response
 */
RedisClient.prototype.getEarliestTimestampForRiverData =
    function getEarliestTimestampForRiverData(riverName, streamId, callback) {
        this.getExtremeTimestampForRiverData(riverName, streamId, 'earliest', callback);
    };

/**
 * Retrieves the number of temporal streams in River View.
 * @param callback {function} handles response
 */
RedisClient.prototype.getTemporalStreamCount =
    function getTemporalStreamCount(callback) {
        this.client.keys('*:data', function(err, keys) {
            if (err) callback(err);
            callback(null, keys.length);
        });
    };

module.exports = RedisClient;