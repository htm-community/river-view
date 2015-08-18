var _ = require('lodash'),
    moment = require('moment-timezone');

module.exports = function(body, options, temporalDataCallback, metaDataCallback) {
    var config = options.config,
        data = JSON.parse(body),
        dtarray = data.query.created.split('T'),
        dateString = dtarray.shift(),
        timeString = dtarray.shift().split('Z').shift(),
        date = undefined,
        timestamp = undefined,
        res = data.query.results.quote,
        symbol = res.symbol,
        ebitdaStr = res.EBITDA,
        ebitda = undefined,
        fieldValues = undefined;

    moment.tz.setDefault(config.timezone);

    date = moment(dateString + ' ' + timeString, 'YYYY-MM-DD HH:mm:ss');
    timestamp = date.unix();

    if (_.contains(ebitdaStr, 'M')) {
        ebitda = parseFloat(ebitdaStr.split("M").shift())*1000000;
    } else if (_.contains(ebitdaStr, 'B')) {
        ebitda = parseFloat(ebitdaStr.split("B").shift())*1000000000;
    } else {
        ebitda = parseFloat(ebitdaStr)
    }
    fieldValues = [
        parseInt(res.AverageDailyVolume), parseFloat(res.DaysLow),
        parseFloat(res.DaysHigh), ebitda,
        parseFloat(res.ChangeFromYearLow), parseFloat(res.PercentChangeFromYearLow),
        parseFloat(res.ChangeFromYearHigh), parseFloat(res.PercebtChangeFromYearHigh), //yahoo can't spell...
        parseFloat(res.FiftydayMovingAverage), parseFloat(res.ChangeFromFiftydayMovingAverage),
        parseFloat(res.PercentChangeFromFiftydayMovingAverage),
        parseFloat(res.TwoHundreddayMovingAverage), parseFloat(res.ChangeFromTwoHundreddayMovingAverage),
        parseFloat(res.PercentChangeFromTwoHundreddayMovingAverage), 
        parseFloat(res.Open), parseFloat(res.PreviousClose), parseFloat(res.ShortRatio)
    ];

    temporalDataCallback(symbol, timestamp, fieldValues);
};