var _ = require('lodash'),
    moment = require('moment');

module.exports = function(body, options, temporalDataCallback, metaDataCallback) {
    var config = options.config,
        payload = JSON.parse(body),
        metadata = payload.metadata,
        streamId = 'usgs-earthquakes';

    moment.tz.setDefault(config.timezone);

    metadata.bbox = payload.bbox;

    metaDataCallback(streamId, payload.metadata);

    _.each(payload.features, function(quake) {
        var props = quake.properties,
            geo = quake.geometry,
            timestamp = Math.round(props.time / 1000),
            values;

        values = [
            geo.coordinates[1],    // lat
            geo.coordinates[0],    // lon
            geo.coordinates[2],    // depth
            quake.id,
            props.mag,
            props.place,
            props.updated,
            props.tz,
            props.url,
            props.detail,
            props.felt,
            props.cdi,
            props.mmi,
            props.alert,
            props.status,
            props.tsunami,
            props.sig,
            props.net,
            props.code,
            props.ids,
            props.sources,
            props.types,
            props.nst,
            props.dmin,
            props.rms,
            props.gap,
            props.magType,
            props.type,
            props.title
        ];

        temporalDataCallback(streamId, timestamp, values);
    });
};
