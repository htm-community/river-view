var _ = require('lodash'),
    moment = require('moment-timezone');

module.exports = function(config, body, url, temporalDataCallback, metaDataCallback) {
    var data = JSON.parse(body);

    // This is important.
    moment.tz.setDefault("UTC");

    var dtarray = data.query.created.split('T'),
        dateString = dtarray.shift(),
        timeString = dtarray.shift().split('Z').shift(),
        date = moment(dateString + ' ' + timeString, 'YYYY-MM-DD HH:mm:ss'),
        timestamp = date.unix();

    
    var res = data.query.results.quote,
        symbol = res.symbol,
        fieldValues;

    fieldValues = [
        parseFloat(res.Ask), parseFloat(res.Bid), parseFloat(res.Change), parseFloat(res.LastTradePriceOnly), parseFloat(res.LastTradePriceOnly),
    ];

    temporalDataCallback(symbol, timestamp, fieldValues);
};