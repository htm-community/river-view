var _ = require('lodash'),
    riverUtils = require('../../lib/river-utilities'),
    moment = require('moment-timezone'),
    xml2js = require('xml2js'),
    stationsUrl = 'http://data.dot.state.mn.us/iris_xml/metro_config.xml.gz',
    stationMap = {},
    detectorMap = {},
    detectorToStation = {};

function getStationDetails(options, callback) {
    riverUtils.gZippedPathToString(stationsUrl, function(error, resp, xml) {
        if (error) {
            return callback(error);
        }
        xml2js.parseString(xml, function(err, result) {
            if (err) {
                return callback(err);
            }
            _.each(result.tms_config.corridor, function(corridor) {
                var corridorData = corridor['$'];
                _.each(corridor.r_node, function(station) {
                    var stationData = station['$'];
                    var stationId = stationData.station_id || stationData.name;
                    stationData.corridor = corridorData;
                    if (station.detector) {
                        _.each(station.detector, function(detector) {
                            var detectorData = detector['$'];
                            var detectorId = detectorData.name;
                            detectorMap[detectorId] = detectorData;
                            detectorToStation[detectorId] = stationId;
                        });
                    }
                    stationMap[stationId] = stationData;
                });
            });
            callback();
        });
    });
}

function parse(body, options, temporalDataCallback, metaDataCallback) {
    var config = options.config;

    // This is important.
    moment.tz.setDefault(config.timezone);

    xml2js.parseString(body, function(err, result) {
        var fields, metadata = {};

        if (err) {
            return console.error(err);
        }

        var timeString = result.traffic_sample['$'].time_stamp;
        var timestamp = moment(new Date(timeString)).unix();

        _.each(result.traffic_sample.sample, function(detector) {
            var data = detector['$'],
                streamId = data.sensor,
                station = stationMap[detectorToStation[data.sensor]],
                stashedDetector = detectorMap[data.sensor];

            if (station) {

                metadata = {
                    latitude: parseFloat(station.lat),
                    longitude: parseFloat(station.lon),
                    sensorId: streamId,
                    stationId: station.station_id,
                    stationLabel: station.label,
                    sensorLabel: stashedDetector.label,
                    lane: stashedDetector.lane,
                    category: stashedDetector.category
                };

                metaDataCallback(streamId, metadata);

                fields = [
                    parseInt(data.flow),
                    parseInt(data.speed),
                    parseFloat(data.occ)
                ];

                temporalDataCallback(streamId, timestamp, fields);

            }

        });

    });

}

module.exports = {
    initialize: getStationDetails,
    parse: parse
};
