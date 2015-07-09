var path = require('path')
  , _ = require('lodash')
  , async = require('async')
  , moment = require('moment-timezone')
  , jsonUtils = require('./json')
  , tmpl = require('./templates')
  , app
  , redisClient
  , rivers
  , DATE_FORMAT = 'YYYY/MM/DD HH:mm:ss'
  , CONFIG
  ;

function getRiver(name) {
    return _.find(rivers, function(river) {
        return river.name == name;
    });
}

function renderDataToCsv(json, res) {
    var csvLines = '';
    csvLines += json.headers.join(',') + '\n';
    _.each(json.data, function(point) {
        csvLines += point.join(',') + '\n';
    });
    res.setHeader('Content-Type', 'text');
    res.end(csvLines);
}

function renderPage(name, data, format, res) {
    if (format == 'json') {
        jsonUtils.render(data, res);
    } else if (format == 'html') {
        tmpl.renderHtml(name, data, res);
    } else if (format == 'csv') {
        renderDataToCsv(data, res);
    } else {
        throw new Error('Format %s is unsupported!', format);
    }
}

function renderError(error, format, res) {
    if (format == 'json') {
        jsonUtils.renderErrors([error], res);
    } else if (format == 'html') {
        tmpl.renderHtml('error', {
            message: error.message
        }, res);
    }
}

function handleIndex(req, res) {
    var ext = req.params.ext || 'json'
      , data;
    data = _.map(rivers, function(river) {
        var riverData = _.extend({
            keysUrl: CONFIG.baseurl + '/' + river.name + '/keys.json'
        }, river.config);
        return riverData;
    });
    renderPage('index', {
        rivers: data
    }, ext, res);
}

function handleRiverPropertiesRequest(req, res) {
    var riverName = req.params.river
      , ext = req.params.ext || 'json'
      , data = getRiver(riverName).config
      ;

    renderPage('riverProps', data, ext, res);
}

function handleRiverKeys(req, res) {
    var riverName = req.params.river
      , includeDetails = req.query.includeDetails
      , ext = req.params.ext || 'json'
      , keysOut
      ;
    redisClient.getKeys(riverName, function(error, keys) {
        var propertyFetchers = {};
        if (error) return renderError(error, ext, res);
        if (ext == 'json' && includeDetails) {
            _.each(keys, function(key) {
                propertyFetchers[key] = function(callback) {
                    redisClient.getRiverMetaData(riverName, key, function(err, meta) {
                        if (err) return callback(err);
                        callback(null, JSON.parse(meta));
                    });
                };
            });
            async.parallel(propertyFetchers, function(err, meta) {
                if (error) return renderError(err, ext, res);
                renderPage('keys', {
                    name: riverName
                  , keys: meta
                }, ext, res);
            });
        } else {
            renderPage('keys', {
                name: riverName
              , keys: keys
            }, ext, res);
        }
    });
}

function handleTemporalDataRequest(req, res) {
    var riverName = req.params.river
      , river = getRiver(riverName)
      , id = req.params.id
      , ext = req.params.ext || 'json';

    redisClient.getRiverData(riverName, id, req.query, function(error, data) {
        var dataOut = []
          , templateName
          ;

        if (error) return renderError(error, ext, res);

        _.each(data, function(point) {
            var timeString = moment(new Date(parseInt(point.timestamp) * 1000))
                                .tz(river.config.timezone).format(DATE_FORMAT);
            dataOut.push([timeString].concat(point.data));
        });

        templateName = river.config.type + '-data';
        renderPage(templateName, {
            name: riverName
          , type: river.config.type
          , id: id
          , headers: ['datetime'].concat(river.config.fields)
          , data: dataOut
        }, ext, res);
    });
}

function handleMetaDataRequest(req, res) {
    var riverName = req.params.river
      , river = getRiver(riverName)
      , id = req.params.id
      , ext = req.params.ext || 'json';
    redisClient.getRiverMetaData(riverName, id, function(error, data) {
        renderPage('meta', {
            name: riverName
          , id: id
          , properties: JSON.parse(data)
        }, ext, res);
    });
}

function startDataService(opts) {
    app = opts.app;
    redisClient = opts.redisClient;
    rivers = opts.rivers;
    CONFIG = opts.config;

    tmpl.start(path.join(__dirname, '..', 'site', 'templates'), CONFIG.baseurl);

    app.use('/index\.:ext?', handleIndex);
    app.use('/:river/meta\.:ext?', handleRiverPropertiesRequest);
    app.use('/:river/keys\.:ext?', handleRiverKeys);
    app.use('/:river/:id/data\.:ext?', handleTemporalDataRequest);
    app.use('/:river/:id/meta\.:ext?', handleMetaDataRequest);
    app.use(/^\/$/, function(req, res) {
        res.redirect('/index.html');
    });

    app.listen(CONFIG.port, function(err) {
        if (err) throw err;
        console.log(
            '  ************************************************************\n' +
            '  * River View Data Server started on %s', CONFIG.baseurl + '\n' +
            '  ************************************************************\n'
        );
    });
}

module.exports = startDataService;
