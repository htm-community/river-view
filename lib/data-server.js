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
            urls: {
                keys: CONFIG.baseurl + '/' + river.name + '/keys.json',
                meta: CONFIG.baseurl + '/' + river.name + '/meta.json'
            }
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
        river = getRiver(riverName),
        data;
    if (! river) {
        return handle404(req, res);
    }
    data = getRiver(riverName).config;
    // The "source" might be a URL, or there might be a "soda" config with an
    // object defining the SODA request.
    if (! data.sources) {
        data.sources = [];
    }
    if (data.soda) {
        data.sources = data.sources.concat(_.map(data.soda, function(sodaSpec) {
            return JSON.stringify(sodaSpec);
        }));
    }
    data = _.extend({
        urls: {
            keys: CONFIG.baseurl + '/' + riverName + '/keys.json',
            meta: CONFIG.baseurl + '/' + riverName + '/meta.json'
        }
    }, data);

    data.tmpl = {};
    // Add email hash for gravatar
    data.tmpl.emailHash = crypto.createHash('md5').update(data.email).digest("hex");
    data.tmpl.title = riverName + ' metadata';
    data.tmpl.poweredBy = river.config.poweredBy;

    data.tmpl.intervalName = getIntervalName(data);
    data.tmpl.intervalString = getIntervalString(data);

    renderPage('riverMeta', data, ext, res, req.query.callback);
}

function getIntervalName(riverConfig) {
    return ((riverConfig.hasOwnProperty('cronInterval')) ? "Cron Interval:" : "Collection Interval");
}

function getIntervalString(riverConfig) {
    return ((riverConfig.hasOwnProperty('cronInterval'))
             ? ((typeof riverConfig.cronInterval === 'string') ? "<code>" + riverConfig.cronInterval + "</code>"
                                                       : "<ul><li><code>" + riverConfig.cronInterval.join("</code></li><li><code>") + "</code></li></ul>")
             : riverConfig.interval);
}

function handleRiverStreamsRequest(req, res) {
    var riverName = req.params.river,
        river = getRiver(riverName),
        includeDetails = req.query.includeDetails,
        ext = req.params.ext || 'json';
    if (! river) {
        return handle404(req, res);
    }
    river.getKeys(function(error, keys) {
        var propertyFetchers = {},
            urls = {
                keys: CONFIG.baseurl + '/' + riverName + '/keys.json',
                meta: CONFIG.baseurl + '/' + riverName + '/meta.json',
                streams: {}
            };

        _.each(keys, function(key) {
            urls.streams[key] = {
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
                dataLimit: CONFIG.defaults.data.html.limit,
                tmpl: {
                    title: riverName + ' keys',
                    poweredBy: river.config.poweredBy
                }
            }, ext, res, req.query.callback);
        }
    });
}

function aggregateTemporalData(periodString, columns, data) {
    var headers = ['datetime', 'count'];
    var dataOut = [];
    var dateIndex = columns.indexOf('datetime');
    var aggregationDuration = moment.duration(
        parseInt(periodString.split(/\s+/).shift()),
        periodString.split(/\s+/).pop()
    );
    var goUntil = moment(data[0][dateIndex], DATE_FORMAT).add(aggregationDuration);
    var count = 0;

    _.each(data, function(point) {
        var time = moment(point[dateIndex], DATE_FORMAT);
        if (time < goUntil) {
            count++;
        } else {
            dataOut.push([goUntil.format(DATE_FORMAT), count]);
            goUntil = goUntil.add(aggregationDuration);
            count = 1;
        }
    });

    return {
        headers: headers,
        data: dataOut
    };
}

function handleTemporalDataRequest(req, res) {
    var riverName = req.params.river,
        river = getRiver(riverName),
        id = req.params.id,
        ext = req.params.ext || 'json';

    if (!river) {
        return handle404(req, res);
    }

    river.getTemporalData(id, req.query, function(error, data) {
        var dataOut = [],
            columns = ['datetime'].concat(river.config.fields),
            templateName = river.config.type + '-data',
            aggregated, jsonRenderOpts,
            threeMonthsAgo = moment().subtract(3, 'months').unix();

        if (error) return renderError(error, ext, res, req.query.callback);

        _.each(data, function(point) {
            var timeString = moment(new Date(parseInt(point.timestamp) * 1000))
                .tz(river.config.timezone).format(DATE_FORMAT);
            dataOut.push([timeString].concat(point.data));
        });

        if (req.query.field) {
            columns = ['datetime', req.query.field];
        }

        if (ext == 'html') {
            river.getFirstAndLastUpdatedTimes(id, function(err, first, last) {
                if (error) return renderError(error, ext, res, req.query.callback);
                river.getDataCount(id, function(err, dataCount) {
                    var htmlRenderOpts;
                    if (error) return renderError(error, ext, res, req.query.callback);
                    htmlRenderOpts = {
                        name: riverName,
                        type: river.config.type,
                        id: id,
                        headers: columns,
                        data: dataOut,
                        timezone: last.format('zz'),
                        threeMonthsAgo: threeMonthsAgo,
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
                    };
                    if (req.query.aggregate) {
                        aggregated = aggregateTemporalData(req.query.aggregate, columns, dataOut);
                        htmlRenderOpts.data = aggregated.data;
                        htmlRenderOpts.headers = aggregated.headers;
                        htmlRenderOpts.aggregated_by = req.query.aggregate;
                    }
                    renderPage(templateName, htmlRenderOpts, ext, res, req.query.callback);
                });
            });
        } else {
            jsonRenderOpts = {
                name: riverName,
                type: river.config.type,
                timezone: river.config.timezone,
                id: id,
                headers: columns,
                data: dataOut
            };
            if (req.query.aggregate) {
                aggregated = aggregateTemporalData(req.query.aggregate, columns, dataOut);
                jsonRenderOpts.data = aggregated.data;
                jsonRenderOpts.headers = aggregated.headers;
                jsonRenderOpts.aggregated_by = req.query.aggregate;
            }
            renderPage(templateName, jsonRenderOpts, ext, res, req.query.callback);
        }
    });
}

function handleStreamMetaDataRequest(req, res) {
    var riverName = req.params.river,
        river = getRiver(riverName),
        id = req.params.id,
        ext = req.params.ext || 'json';
    if (! river) {
        return handle404(req, res);
    }
    river.getMetaData(id, function(error, meta) {
        renderPage('meta', {
            name: riverName,
            id: id,
            metadata: meta,
            dataLimit: CONFIG.defaults.data.html.limit,
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
