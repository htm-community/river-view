var url = require('url')
  , redis = require('redis')
  , _ = require('lodash')
  ;

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

RedisClient.prototype.writeRiverElementProperties =
function writeRiverElementProperties(name, id, props, expires, callback) {
    var key = name + ':' + id + ':props'
      , val = JSON.stringify(props)
      ;
    this.client.set(key, val, this._expiresWrapper(key, expires, callback));
}

RedisClient.prototype.writeRiverElementData =
function writeRiverElementData(name, id, timestamp, data, expires, callback) {
    var key = name + ':' + id + ':data'
      , score = timestamp
      , val = JSON.stringify(data)
      ;
    this.client.zadd(key, score, val, callback);
}

// Read

RedisClient.prototype.getKeys = function getKeys(riverName, callback) {
    this.client.keys(riverName + ':*:props', function(error, keys) {
        var cleanKeys
          ;
        if (error) return callback(error);
        cleanKeys = _.map(keys, function(k) {
            return k.split(':')[1];
        });
        callback(null, cleanKeys);
    });
};

module.exports = RedisClient;
