var _ = require('lodash'),
    moment = require('moment-timezone');

module.exports = function(body, options, temporalDataCallback, metaDataCallback) {
    var config = options.config,
        data = JSON.parse(body),
        dtarray = data.query.created.split('T'),
        dateString = dtarray.shift(),
        timeString = dtarray.shift().split('Z').shift(),
        date = moment(dateString + ' ' + timeString, 'YYYY-MM-DD HH:mm:ss'),
        timestamp = date.unix(),
        res = data.query.results.quote,
        symbol = res.symbol,
        fieldValues;

    moment.tz.setDefault(config.timezone);


    fieldValues = [
        parseFloat(res.Ask), parseFloat(res.Bid), parseFloat(res.Change), parseFloat(res.LastTradePriceOnly), parseFloat(res.LastTradePriceOnly)
    ];

    temporalDataCallback(symbol, timestamp, fieldValues);
};