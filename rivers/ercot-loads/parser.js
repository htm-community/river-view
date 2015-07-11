var fs = require('fs')
  , nodeUrl = require('url')
  , http = require('http')
  , request = require('request')
  , _ = require('lodash')
  , csvParse = require('csv-parse')
  , async = require('async')
  , AdmZip = require('adm-zip')
  , moment = require('moment-timezone')
  , cheerio = require('cheerio')
  ;

function dateStringToTimestampWithZone(dateString, timeString, zone) {
    // 07/09/2015
    // 0100
    var datePieces = dateString.split('/')
      , timeObject = {}
      , timestamp
      ;
    timeObject.month = parseInt(datePieces.shift()) - 1
    timeObject.day = parseInt(datePieces.shift())
    timeObject.year = parseInt(datePieces.shift())
    timeObject.hour = parseInt(timeString.substr(0,2));
    timeObject.minute = parseInt(timeString.substr(2,2))
    timestamp = moment.tz(timeObject, zone).unix();
    return timestamp;
}

module.exports = function(config, body, url, temporalDataCallback, metaDataCallback) {
    var $ = cheerio.load(body)
      , columnNames = []
      , id = 'actual_loads_of_weather_zones'
      ;

    // This is important.
    moment.tz.setDefault(config.timezone);

    $('#today tr').each(function(i, tr) {
        var row = []
          , dateString
          , timeString
          , timestamp
          ;

        $(tr).find('td').each(function(j, td) {
            var string = $(td).html().trim()
              , value;

            if (i == 0 || columnNames[j] == 'Oper Day' || columnNames[j] == 'Hour Ending') {
                value = string;
            } else {
                value = parseFloat(string);
            }
            row.push(value);

        });

        if (i == 0) {
            columnNames = row;
        } else {
            dateString = row[columnNames.indexOf('Oper Day')];
            timeString = row[columnNames.indexOf('Hour Ending')];
            timestamp = dateStringToTimestampWithZone(dateString, timeString, config.timezone);
            // Shift off the first two values, which are date and time strings.
            row.shift();
            row.shift();
            temporalDataCallback(id, timestamp, row);
        }
    });
};
