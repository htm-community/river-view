/**
 * Data Server
 * @module lib/data-server
 */

var path = require('path'),
    crypto = require('crypto'),
    _ = require('lodash'),
    async = require('async'),
    moment = require('moment-timezone'),
    jsonUtils = require('./json'),
    tmpl = require('./templates'),
    redisClient, app, rivers, DATE_FORMAT = 'YYYY/MM/DD HH:mm:ss',
    CONFIG;

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

function renderPage(name, data, format, res, callback) {
    if (format == 'json') {
        delete data.tmpl;
        jsonUtils.render(data, res, callback);
    } else if (format == 'html') {
        tmpl.renderHtml(name, data, res);
    } else if (format == 'csv') {
        renderDataToCsv(data, res);
    } else {
        renderError(
            new Error('Format ' + format + ' is unsupported!'), 'html', res
        );
    }
}

function renderError(error, format, res, callback) {
    if (format == 'json') {
        jsonUtils.renderErrors([error], res, callback);
    } else if (format == 'html') {
        tmpl.renderHtml('error', {
            message: error.message,
            title: 'Error!'
        }, res);
    }
}

function handleIndex(req, res) {
    var ext = req.params.ext || 'json',
        data;
    data = _.map(rivers, function(river) {
        var riverData = _.extend({
            keysUrl: CONFIG.baseurl + '/' + river.name + '/keys.json'
        }, river.config);
        return riverData;
    });
    redisClient.getTemporalStreamCount(function(err, count) {
        renderPage('index', {
            rivers: data,
            tmpl: {
                title: 'River View',
                totalStreams: count
            }
        }, ext, res, req.query.callback);
    });
}

function handleLogRequest(req, res) {
    redisClient.getLogs(function(error, logs) {
        if (error) return renderError(error, 'html', res, req.query.callback);
        renderPage('activity', {
            logs: logs,
            title: 'River Stream Activity Log'
        }, 'html', res, req.query.callback);
    });
}

function handleRiverMetaDataRequest(req, res) {
    var riverName = req.params.river,
        ext = req.params.ext || 'json',
        data = getRiver(riverName).config;
    data.tmpl = {};
    // Add email hash for gravatar
    data.tmpl.emailHash = crypto.createHash('md5').update(data.email).digest("hex");
    data.tmpl.title = riverName + ' metadata';

    data.tmpl.intervalName = getIntervalName(data),
    data.tmpl.intervalString = getIntervalString(data)

    renderPage('riverMeta', data, ext, res, req.query.callback);
}

function getIntervalName(riverConfig) {
    console.log(riverConfig)
    return ((riverConfig.hasOwnProperty('cronInterval')) ? "Cron Interval:" : "Collection Interval");
}

function getIntervalString(riverConfig) {
    return ((riverConfig.hasOwnProperty('cronInterval'))
             ? ((riverConfig.cronInterval.length == 1) ? "<code>" + riverConfig.cronInterval[0] + "</code>"
                                                       : "<ul><li><code>" + riverConfig.cronInterval.join("</code></li><li><code>") + "</code></li></ul>")
             : riverConfig.interval);
}

function handleRiverStreamsRequest(req, res) {
    var riverName = req.params.river,
        river = getRiver(riverName),
        includeDetails = req.query.includeDetails,
        ext = req.params.ext || 'json',
        keysOut;
    river.getKeys(function(error, keys) {
        var propertyFetchers = {},
            urls = {};

        _.each(keys, function(key) {
            urls[key] = {
                data: CONFIG.baseurl + '/' + encodeURIComponent(riverName) + '/' + encodeURIComponent(key) + '/data.json',
                meta: CONFIG.baseurl + '/' + encodeURIComponent(riverName) + '/' + encodeURIComponent(key) + '/meta.json'
            };
        });
        if (error) return renderError(error, ext, res, req.query.callback);
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
                if (error) return renderError(err, ext, res, req.query.callback);
                renderPage('keys', {
                    name: riverName,
                    keys: meta,
                    urls: urls,
                    tmpl: {
                        title: riverName + ' keys',
                        poweredBy: river.config.poweredBy
                    }
                }, ext, res, req.query.callback);
            });
        } else {
            renderPage('keys', {
                name: riverName,
                keys: keys,
                urls: urls,
                tmpl: {
                    title: riverName + ' keys',
                    poweredBy: river.config.poweredBy
                }
            }, ext, res, req.query.callback);
        }
    });
}

function handleTemporalDataRequest(req, res) {
    var riverName = req.params.river,
        river = getRiver(riverName),
        id = req.params.id,
        ext = req.params.ext || 'json';

    if (!river) {
        // Bad request, no river exists.
        return renderError(
            new Error('River "' + riverName + '" does not exist.'), 'html', res, req.query.callback
        );
    }

    river.getTemporalData(id, req.query, function(error, data) {
        var dataOut = [],
            columns = ['datetime'].concat(river.config.fields);

        if (error) return renderError(error, ext, res, req.query.callback);

        _.each(data, function(point) {
            var timeString = moment(new Date(parseInt(point.timestamp) * 1000))
                .tz(river.config.timezone).format(DATE_FORMAT);
            dataOut.push([timeString].concat(point.data));
        });

        if (req.query.field) {
            columns = ['datetime', req.query.field];
        }

        river.getFirstAndLastUpdatedTimes(id, function(err, first, last) {
            if (error) return renderError(error, ext, res, req.query.callback);
            river.getDataCount(id, function(err, dataCount) {
                if (error) return renderError(error, ext, res, req.query.callback);
                var templateName = river.config.type + '-data';
                renderPage(templateName, {
                    name: riverName,
                    type: river.config.type,
                    id: id,
                    headers: columns,
                    data: dataOut,
                    timezone: last.format('zz'),
                    tmpl: {
                        dataCount: dataCount,
                        splitCharts: river.config.fields.length > 2,
                        title: riverName + ' data',
                        firstData: first.format('YYYY/MM/DD HH:mm:ss'),
                        lastData: last.format('YYYY/MM/DD HH:mm:ss'),
                        lastDataLabel: last.fromNow(),
                        dataJson: JSON.stringify(dataOut),
                        poweredBy: river.config.poweredBy
                    }
                }, ext, res, req.query.callback);
            });
        });
    });
}

function handleStreamMetaDataRequest(req, res) {
    var riverName = req.params.river,
        river = getRiver(riverName),
        id = req.params.id,
        ext = req.params.ext || 'json';
    river.getMetaData(id, function(error, meta) {
        renderPage('meta', {
            name: riverName,
            id: id,
            metadata: meta,
            tmpl: {
                title: riverName + ' metadata'
            }
        }, ext, res, req.query.callback);
    });
}

function handle404(req, res) {
    var message = '404: Not found: ' + req.url;
    res.status(404);

    // respond with html page
    if (req.accepts('html')) {
        renderError(new Error(message), 'html', res);
        return;
    }

    // respond with json
    if (req.accepts('json')) {
        renderError(new Error(message), 'json', res, req.query.callback);
        return;
    }

    // default to plain-text. send()
    res.type('txt').send(message);
}

/**
 * Starts up the data service that handles all HTTP traffic to River View. This
 * includes the River View web UI as well as all JSON/CSV/etc data requests.
 * @param opts {object}
 * @param opts.app {object} Express js application
 * @param opts.rivers {array} List of Rivers
 * @param opts.config {object} Application configuration
 * @param opts.redisClient {RedisClient} Redis client.
 */
function startDataService(opts) {
    app = opts.app;
    redisClient = opts.redisClient;
    rivers = opts.rivers;
    CONFIG = opts.config;

    tmpl.compile(path.join(__dirname, '..', 'site', 'templates'), CONFIG.baseurl);

    app.use('/index\.:ext?', handleIndex);
    app.use('/activity/?', handleLogRequest);
    app.use('/:river/meta\.:ext?', handleRiverMetaDataRequest);
    app.use('/:river/keys\.:ext?', handleRiverStreamsRequest);
    app.use('/:river/:id/data\.:ext?', handleTemporalDataRequest);
    app.use('/:river/:id/meta\.:ext?', handleStreamMetaDataRequest);
    app.use(/^\/$/, function(req, res) {
        res.redirect('/index.html');
    });
    app.use(handle404);

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