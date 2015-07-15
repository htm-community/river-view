
var url = require('url'),
    moment = require('moment'),
    redis = require('redis'),
    _ = require('lodash');

// Utility functions

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


// RedisClient

function RedisClient(url) {
    this.url = url;
}

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

// Utility function

RedisClient.prototype._expiresWrapper =
    function _expiresWrapper(key, seconds, callback) {
        var me = this;
        return function(err) {
            if (err) return callback(err);
            me.client.expire(key, seconds, callback);
        };
    };

// Write

RedisClient.prototype.writeRiverMetaData =
    function writeRiverMetaData(name, id, meta, expires, callback) {
        var key = name + ':' + id + ':props',
            val = JSON.stringify(meta);
        this.client.set(key, val, this._expiresWrapper(key, expires, callback));
    };

RedisClient.prototype.writeRiverTemporalData =
    function writeRiverTemporalData(name, id, timestamp, data, expires, callback) {
        var key = name + ':' + id + ':data',
            score = timestamp,
            val = JSON.stringify(data);
        this.client.zadd(key, score, val, callback);
    };

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

RedisClient.prototype.getLogs =
    function getLogs(callback) {
        var args = ['activity-log', '+inf', '-inf', 'WITHSCORES', 'LIMIT', 0, 100]
        this.client.zrevrangebyscore(args, function(error, values) {
            if (error) return callback(error);
            callback(null, _.map(values, JSON.parse));
        });
    };

RedisClient.prototype.getRiverMetaData =
    function getRiverMetaData(riverName, id, callback) {
        var key = riverName + ':' + id + ':props';
        this.client.get(key, function(err, resp) {
            if (err) return callback(err);
            callback(null, JSON.parse(resp));
        });
    };

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

RedisClient.prototype.getDataCount =
    function getDataCount(riverName, id, callback) {
        var key = riverName + ':' + id + ':data';
        this.client.zcount(key, '-inf', '+inf', callback);
    };

RedisClient.prototype.getRiverData =
    function getRiverData(riverName, id, query, callback) {
        var key, since, until, limit, fetchArgs;
        if (!query) {
            query = {};
        }

        since = query.since || '-inf';
        until = query.until || '+inf';
        limit = query.limit;
        key = riverName + ':' + id + ':data';

        fetchArgs = [key, until, since, 'WITHSCORES'];

        if (limit) {
            fetchArgs = fetchArgs.concat(['LIMIT', 0, parseInt(limit)])
        }

        this.client.zrevrangebyscore(fetchArgs, function(error, values) {
            if (error) return callback(error);
            callback(null, unzipScores(values));
        });
    };

RedisClient.prototype.getExtremeTimestampForRiverData =
    function getExtremeTimestampForRiverData(riverName, id, extreme, callback) {
        var key, since = '-inf',
            until = '+inf',
            limit = 1,
            redisFunctionName = 'zrevrangebyscore',
            fetchArgs;

        if (extreme == 'earliest') {
            redisFunctionName = 'zrangebyscore';
            since = '+inf'
            until = '-inf'
        }

        key = riverName + ':' + id + ':data';

        fetchArgs = [key, until, since, 'WITHSCORES', 'LIMIT', 0, limit];

        this.client[redisFunctionName](fetchArgs, function(error, values) {
            var timestamp;
            if (error) return callback(error);
            // Score is 2nd.
            timestamp = values[1];
            callback(null, timestamp);
        });
    };

RedisClient.prototype.getLatestTimestampForRiverData =
    function getLatestTimestampForRiverData(riverName, id, callback) {
        this.getExtremeTimestampForRiverData(riverName, id, 'latest', callback);
    };

RedisClient.prototype.getEarliestTimestampForRiverData =
    function getEarliestTimestampForRiverData(riverName, id, callback) {
        this.getExtremeTimestampForRiverData(riverName, id, 'earliest', callback);
    };

RedisClient.prototype.getTemporalStreamCount =
    function getTemporalStreamCount(callback) {
        this.client.keys('*:data', function(err, keys) {
            if (err) callback(err);
            callback(null, keys.length);
        });
    };

module.exports = RedisClient;