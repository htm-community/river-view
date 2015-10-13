var url = require('url'),
    moment = require('moment'),
    redis = require('redis'),
    _ = require('lodash'),
    async = require('async'),
    DEFAULT_SNAPTO = 'until';

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
    return out;
}

/**
 * This is a redis client for River View. It contains the persistence and
 * retrieval logic.
 * @param url {string} connection string for the redis instance
 * @class RedisClient
 */
function RedisClient(url, maxDataPointsPerRequest) {
    this.url = url;
    this.maxDataPointsPerRequest = maxDataPointsPerRequest;
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

////////////////////////////////////////////////////////////////////////////////
// Write
////////////////////////////////////////////////////////////////////////////////

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

////////////////////////////////////////////////////////////////////////////////
// Read
////////////////////////////////////////////////////////////////////////////////

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
 * Retrieves temporal data from a River Stream.
 * @param riverName {string} River name
 * @param streamId {string} Stream id
 * @param query {Object} Query parameters for retrieval. There should never be
 *                       all three parameters (since, until, limit) sent to this
 *                       function.
 * @param query.limit {int} how many data points to retrieve
 * @param query.since {int} UNIX timestamp, limits query to data after timestamp
 * @param query.until {int} UNIX timestamp, limits query to data before timestamp
 * @param callback {function} handles response
 */
RedisClient.prototype.getRiverData =
    function getRiverData(riverName, streamId, query, callback) {
        var key, since, until, limit, snapto, fetchArgs;
        if (!query) {
            query = {};
        }

        since = query.since || '-inf';
        until = query.until || '+inf';
        limit = query.limit || this.maxDataPointsPerRequest;
        snapto = query.snapto || DEFAULT_SNAPTO;
        key = riverName + ':' + streamId + ':data';

        if (snapto == 'until') {
            fetchArgs = [
                key, until, since,
                'WITHSCORES',
                'LIMIT', 0, parseInt(limit)
            ];
            this.client.zrevrangebyscore(fetchArgs, function(error, values) {
                if (error) return callback(error);
                callback(null, unzipScores(values).reverse());
            });
        } else {
            fetchArgs = [
                key, since, until,
                'WITHSCORES',
                'LIMIT', 0, parseInt(limit)
            ];
            this.client.zrangebyscore(fetchArgs, function(error, values) {
                if (error) return callback(error);
                callback(null, unzipScores(values));
            });
        }

    };

/**
 * Gets either the earliest or latest timestamp of data stored in a stream.
 * @param riverName {string} River name
 * @param streamId {string} Stream id
 * @param extreme {string} Either 'earliest' or 'latest'
 * @param callback {function} handles response
 */
RedisClient.prototype.getExtremeTimestampForRiverStream =
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
RedisClient.prototype.getLatestTimestampForRiverStream =
    function getLatestTimestampForRiverData(riverName, streamId, callback) {
        this.getExtremeTimestampForRiverStream(riverName, streamId, 'latest', callback);
    };

/**
 * Gets the earliest timestamp for a stream's data.
 * @param riverName {string} River name
 * @param streamId {string} Stream id
 * @param callback {function} handles response
 */
RedisClient.prototype.getEarliestTimestampForRiverStream =
    function getEarliestTimestampForRiverData(riverName, streamId, callback) {
        this.getExtremeTimestampForRiverStream(riverName, streamId, 'earliest', callback);
    };

RedisClient.prototype.getEarliestTimestampForRiver =
    function getEarliestTimestampForRiver(riverName, callback) {
        var me = this, since = '+inf',
            until = '-inf',
            limit = 1,
            redisFunctionName = 'zrangebyscore',
            fetchArgs;

        me.client.keys(riverName + ':*:data', function(err, keys) {
            var fetchers = {};

            _.each(keys, function(key) {

                fetchers[key] = function(localCallback) {
                    fetchArgs = [key, until, since, 'WITHSCORES', 'LIMIT', 0, limit];

                    me.client[redisFunctionName](fetchArgs, function(error, values) {
                        var timestamp;
                        if (error) return callback(error);
                        // Score is 2nd.
                        timestamp = values[1];
                        localCallback(null, timestamp);
                    });
                };

            });

            async.parallel(fetchers, function(err, data) {
                if (err) return callback(err);
                // Get the earliest updated date
                var earliest = undefined;
                _.each(data, function(ts) {
                    if (earliest == undefined) {
                        earliest = ts;
                    } else if (ts < earliest) {
                        earliest = ts;
                    }
                });
                callback(null, earliest);
            });
        });

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
