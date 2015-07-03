function DataSourceRegistrar(config) {
    this.redisClient = config.redisClient;
}

DataSourceRegistrar.prototype.initialize = function initialize(callback) {

}

DataSourceRegistrar.prototype.register = function register(config, callback) {
    callback();
};

module.exports = DataSourceRegistrar;
