var path = require('path')
  , crypto = require('crypto')
  , _ = require('lodash')
  , async = require('async')
  , moment = require('moment-timezone')
  , jsonUtils = require('./json')
  , tmpl = require('./templates')
  , redisClient
  , app
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
          , title: 'Error!'
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
    redisClient.getTemporalStreamCount(function(err, count) {
        renderPage('index', {
            rivers: data
          , title: 'River View'
          , totalStreams: count
        }, ext, res);
    });
}

function handleLogRequest(req, res) {
    redisClient.getLogs(function(error, logs) {
        if (error) return renderError(error, ext, res);
        console.log(logs);
        renderPage('activity', {
            logs: logs
          , title: 'River Stream Activity Log'
        }, 'html', res);
    });
}

function handleRiverPropertiesRequest(req, res) {
    var riverName = req.params.river
      , ext = req.params.ext || 'json'
      , data = getRiver(riverName).config
      ;

    // Add email hash for gravatar
    data.emailHash = crypto.createHash('md5').update(data.email).digest("hex");

    data.keysUrl = CONFIG.baseurl + '/'
      + encodeURIComponent(riverName) + '/keys.json'

    data.title = riverName + ' metadata';

    renderPage('riverProps', data, ext, res);
}

function handleRiverKeys(req, res) {
    var riverName = req.params.river
      , river = getRiver(riverName)
      , includeDetails = req.query.includeDetails
      , ext = req.params.ext || 'json'
      , keysOut
      ;
    river.getKeys(function(error, keys) {
        var propertyFetchers = {}
          , urls = {};

        _.each(keys, function(key) {
            urls[key] = {
                data: CONFIG.baseurl + '/'
                      + encodeURIComponent(riverName) + '/'
                      + encodeURIComponent(key) + '/data.json'
              , meta: CONFIG.baseurl + '/'
                      + encodeURIComponent(riverName) + '/'
                      + encodeURIComponent(key) + '/meta.json'
            };
        });
        if (error) return renderError(error, ext, res);
        if (ext == 'json' && includeDetails) {
            _.each(keys, function(key) {
                propertyFetchers[key] = function(callback) {
                    river.getMetaData(key, function(err, meta) {
                        if (err) return callback(err);
                        callback(null, meta);
                    });
                };
            });
            async.parallel(propertyFetchers, function(err, meta) {
                if (error) return renderError(err, ext, res);
                renderPage('keys', {
                    name: riverName
                  , keys: meta
                  , urls: urls
                  , title: riverName + ' keys'
                }, ext, res);
            });
        } else {
            renderPage('keys', {
                name: riverName
              , keys: keys
              , urls: urls
              , title: riverName + ' keys'
            }, ext, res);
        }
    });
}

function handleTemporalDataRequest(req, res) {
    var riverName = req.params.river
      , river = getRiver(riverName)
      , id = req.params.id
      , ext = req.params.ext || 'json';

    river.getTemporalData(id, req.query, function(error, data) {
        var dataOut = []
          , columns = ['datetime'].concat(river.config.fields)
          ;

        if (error) return renderError(error, ext, res);

        _.each(data, function(point) {
            var timeString = moment(new Date(parseInt(point.timestamp) * 1000))
                                .tz(river.config.timezone).format(DATE_FORMAT);
            dataOut.push([timeString].concat(point.data));
        });

        if (req.query.field) {
            columns = ['datetime', req.query.field];
        }

        river.getFirstAndLastUpdatedTimes(id, function(err, first, last) {
            if (error) return renderError(error, ext, res);
            river.getDataCount(id, function(err, dataCount) {
                if (error) return renderError(error, ext, res);
                var templateName = river.config.type + '-data';
                renderPage(templateName, {
                    name: riverName
                  , type: river.config.type
                  , id: id
                  , headers: columns
                  , data: dataOut
                  , splitCharts: river.config.fields.length > 2
                  , title: riverName + ' data'
                  , firstData: first.format('YYYY/MM/DD HH:mm:ss')
                  , lastData: last.format('YYYY/MM/DD HH:mm:ss')
                  , lastDataLabel: last.fromNow()
                  , timezone: last.format('zz')
                  , dataCount: dataCount
                }, ext, res);
            });
        });
    });
}

function handleMetaDataRequest(req, res) {
    var riverName = req.params.river
      , river = getRiver(riverName)
      , id = req.params.id
      , ext = req.params.ext || 'json';
    river.getMetaData(id, function(error, meta) {
        renderPage('meta', {
            name: riverName
          , id: id
          , metadata: meta
          , title: riverName + ' metadata'
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
    app.use('/activity/?', handleLogRequest);
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
