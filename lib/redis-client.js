var url = require('url')
  , redis = require('redis')
  , _ = require('lodash')
  ;

// Utility functions

function unzipScores(redisData) {
    var out = [];
    _.each(redisData, function(data, index) {
        if (index % 2 != 0) {
            out[out.length - 1].timestamp = parseInt(data);
        } else {
            out.push({data: JSON.parse(data)});
        }
    });
    return out.reverse();
}


// RedisClient

function RedisClient(url) {
    this.url = url;
}

RedisClient.prototype.initialize = function initialize(callback) {
    var redisUrl = this.url
      , connection = url.parse(redisUrl)
      , redisClient;
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
    return function() {
        me.client.expire(key, seconds)
    };
}

// Write

RedisClient.prototype.writeRiverMetaData =
function writeRiverMetaData(name, id, meta, expires, callback) {
    var key = name + ':' + id + ':props'
      , val = JSON.stringify(meta)
      ;
    this.client.set(key, val, this._expiresWrapper(key, expires, callback));
}

RedisClient.prototype.writeRiverTemporalData =
function writeRiverTemporalData(name, id, timestamp, data, expires, callback) {
    var key = name + ':' + id + ':data'
      , score = timestamp
      , val = JSON.stringify(data)
      ;
    this.client.zadd(key, score, val, callback);
}

// Read

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

RedisClient.prototype.getRiverData =
function getRiverData(riverName, id, query, callback) {
    var key, since, until, limit, fetchArgs;
    if (! query) {
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

RedisClient.prototype.getTemporalStreamCount =
function getTemporalStreamCount(callback) {
    this.client.keys('*:data', function(err, keys) {
        if (err) callback(err);
        callback(null, keys.length);
    });
};

module.exports = RedisClient;
