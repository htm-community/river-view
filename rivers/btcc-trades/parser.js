
var _ = require('lodash');

module.exports = function(body, options, temporalDataCallback, metaDataCallback) {
    var config = options.config,
        fieldNames = config.fields,
        metadataNames = config.metadata,
        data = JSON.parse(body);

    data = _.groupBy(data, 'date');

    _.each(data, function(paths, timestamp) {
      var metaData = {},
          fieldValues = [],
          streamId = 'btcc-trades';

       _.each(metadataNames, function(propName) {
           metaData[propName] = _.map(paths, propName);
       });
       metaDataCallback(streamId, metaData);

      _.each(fieldNames, function(fieldName) {
        var value = _.sum(paths, fieldName);
        if (fieldName === 'price') {
          value = value / paths.length;
        }
        fieldValues.push(value);
      });
      temporalDataCallback(streamId, timestamp, fieldValues);

    });
};
