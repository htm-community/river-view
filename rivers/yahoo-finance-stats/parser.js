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
        EBITDAStr = res.EBITDA,
        fieldValues;

    if (EBITDAStr.indexOf('M') != -1) {
        var EBDITA = parseFloat(EBITDAStr.split("M").shift())*1000000;
    } else if (EBITDAStr.indexOf('B') != -1) {
        var EBDITA = parseFloat(EBITDAStr.split("B").shift())*1000000000;
    } else {
        var EBDITA = parseFloat(EBITDAStr)
    }
    fieldValues = [
        parseInt(res.AverageDailyVolume), parseFloat(res.DaysLow),
        parseFloat(res.DaysHigh), EBDITA,
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