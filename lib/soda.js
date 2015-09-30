var soda = require('./soda-js');

module.exports = function(params, callback) {
    var consumer = new soda.Consumer(params.source);
    var query = consumer.query().withDataset(params.dataset);

    if (params.limit) {
        query.limit(params.limit);
    }
    if (params.order) {
        query.order(params.order);
    }
    query.getRows()
        .on('success', function(rows) {
            callback(null, rows);
        })
        .on('error', callback);
};
