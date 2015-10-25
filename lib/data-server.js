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
    if (! json.headers) {
        return renderError(400, new Error('No CSV data view for this URL.'), 'html', res);
    }
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
            400,
            new Error('Format ' + format + ' is unsupported!'), 'html', res
        );
    }
}

function renderError(code, error, format, res, callback) {
    if (format == 'json') {
        jsonUtils.renderErrors(code, [error], res, callback);
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
        if (error) return renderError(503, error, 'html', res, req.query.callback);
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
    data = _.extend({}, getRiver(riverName).config);
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
        query = req.query,
        includeDetails = query.includeDetails,
        paginationOptions = {},
        streamsUrl = CONFIG.baseurl + '/' + encodeURIComponent(riverName),
        ext = req.params.ext || 'json';

    if (! river) {
        return handle404(req, res);
    }

    if (ext == 'html') {
        paginationOptions.page = parseInt(query.page) || 1;
        paginationOptions.itemsPerPage = 100;
    }

    river.getKeys(paginationOptions, function(error, keys) {
        var propertyFetchers = {},
            urls = {
                keys: streamsUrl + '/keys.json',
                meta: streamsUrl + '/meta.json',
                streams: {}
            },
            keyTemplate = [];

        if (error) return renderError(503, error, ext, res, query.callback);

        _.each(keys, function(key) {
            var streamUrl = streamsUrl + '/' + encodeURIComponent(key);
            urls.streams[key] = {
                data: streamUrl + '/data.json',
                meta: streamUrl + '/meta.json'
            };
        });
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
                if (err) return renderError(503, err, ext, res, query.callback);
                renderPage('keys', {
                    name: riverName,
                    keys: meta,
                    urls: urls,
                    tmpl: {
                        title: riverName + ' keys',
                        poweredBy: river.config.poweredBy
                    }
                }, ext, res, query.callback);
            });
        } else {
            //_.map(keys, function(k) { return encodeURIComponent(k); })
            keyTemplate = _.map(keys, function(k) {
                return {
                    name: k,
                    urlEncodedName: encodeURIComponent(k)
                }
            });
            renderPage('keys', {
                name: riverName,
                keys: keyTemplate,
                urls: urls,
                tmpl: {
                    title: riverName + ' keys',
                    poweredBy: river.config.poweredBy,
                    prevLink: streamsUrl + '/keys.html?page=' + (paginationOptions.page - 1),
                    nextLink: streamsUrl + '/keys.html?page=' + (paginationOptions.page + 1)
                }
            }, ext, res, query.callback);
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

function augmentWithNavigationDetails(payload, query, firstPoint, lastPoint) {
    var out = _.extend({}, payload),
        baseurl = CONFIG.baseurl + '/' + payload.name + '/' + payload.id + '/data.json',
        since,
        until,
        payloadDuration,
        leftBound,
        rightBound,
        nextBound,
        prevBound,
        durationString,
        tmpTimeString;

    function queryHasLimitButNotMaxedOut() {
        // In this case, user defined no limit, and the number of data points
        // within the given date range was below the default limit. This is the
        // most common case.
        return query.limit == undefined && payload.meta.count < CONFIG.maxDataPointsPerRequest;
    }

    function queryHasTemporalBoundsButNoData() {
        // This means the user was looking for data in a specific window, but no
        // data existed there.
        return query.since && query.until && payload.meta.count == 0;
    }

    function isInFuture(timestamp) {
        return timestamp > moment().unix()
    }

    if (queryHasLimitButNotMaxedOut() || queryHasTemporalBoundsButNoData()) {
        // We calculate the temporal bounds of the response use the original
        // user query. In these cases we want to use the user's query to
        // construct the navigation URLs.
        tmpTimeString = moment(new Date(parseInt(query.since) * 1000))
            .tz(payload.timezone).format(DATE_FORMAT);
        since = {
            timestamp: parseInt(query.since),
            timestring: tmpTimeString
        };
        tmpTimeString = moment(new Date(parseInt(query.until) * 1000))
            .tz(payload.timezone).format(DATE_FORMAT);
        until = {
            timestamp: parseInt(query.until),
            timestring: tmpTimeString
        }
    } else {
        // In this case, the database returned the maximum number of results
        // possible, which most likely means the user's query was truncated, so
        // we cannot define the response window in terms of the user query, we
        // must make it match the truncation. This will affect the navigation
        // URLs as well, as it must.
        since = firstPoint;
        until = lastPoint;
    }

    out.meta.since = since;
    out.meta.until = until;

    payloadDuration = until.timestamp - since.timestamp;
    leftBound = since.timestamp;
    rightBound = until.timestamp;
    nextBound = rightBound + payloadDuration;
    prevBound = leftBound - payloadDuration;
    durationString = moment.duration(payloadDuration, 'seconds').humanize();

    out.urls = {};
    // Don't add the next navigation requests that move into the future.
    if (! isInFuture(since.timestamp)) {
        out.urls.next = encodeURI(baseurl + '?since=' + rightBound + '&until=' + nextBound) + '&snapto=since';
    }
    out.urls.prev = encodeURI(baseurl + '?since=' + prevBound + '&until=' + leftBound) + '&snapto=until';

    // Attach the aggregate param if necessary
    if (query.aggregate) {
        out.urls.prev += '&aggregate=' + encodeURIComponent(query.aggregate);
        if (! isInFuture(since.timestamp)) {
            out.urls.next += '&aggregate=' + encodeURIComponent(query.aggregate);
        }
    }
    out.meta.duration = durationString;

    return out;
}

function handleTemporalDataRequest(req, res) {
    var riverName = req.params.river,
        river = getRiver(riverName),
        params = req.params,
        id = params.id,
        ext = params.ext || 'json',
        query = req.query;

    if (! river) {
        return handle404(req, res);
    }

    // Can't have all three of these query params at once.
    if (query.since !== undefined
        && query.until !== undefined
        && query.limit !== undefined) {
        return handleError(
            400,
            'Cannot specify "since" and "until" and "limit" simultaneously.',
            req, res
        );
    }
    // Can't have a limit larger than a certain value.
    if (query.limit && query.limit > CONFIG.maxDataPointsPerRequest) {
        return handleError(
            400,
            'Cannot handle data limit larger than ' + CONFIG.maxDataPointsPerRequest,
            req, res
        );
    }

    // For HTML requests, we'll enforce a maximum data point limit for display.
    if (ext == 'html' && ! query.limit) {
        query.limit = CONFIG.defaults.html.maxPoints;
    }

    river.getTemporalData(id, query, function(error, data) {
        var dataOut = [],
            payload,
            columns = ['datetime'].concat(river.config.fields),
            templateName = river.config.type + '-data',
            aggregated,
            threeMonthsAgo = moment().subtract(3, 'months').unix(),
            firstPoint, lastPoint;

        if (error) return renderError(503, error, ext, res, query.callback);

        _.each(data, function(point) {
            var timeString = moment(new Date(parseInt(point.timestamp) * 1000))
                .tz(river.config.timezone).format(DATE_FORMAT);
            dataOut.push([timeString].concat(point.data));
            if (! firstPoint) {
                firstPoint = {
                    timestamp: point.timestamp, timestring: timeString
                };
            }
            lastPoint = {
                timestamp: point.timestamp, timestring: timeString
            };
        });

        if (! dataOut || ! dataOut.length) {
            console.log('dataOut is %s', dataOut);
            console.log(params);
            console.log(query);
        }

        // If user filtered by field, only include field in columns.
        if (query.field) {
            columns = ['datetime', query.field];
        }

        // Include in the response some meta data that captures the actual since
        // and until values of the query (meaning the first and last data point)
        payload = {
            name: riverName,
            type: river.config.type,
            timezone: river.config.timezone,
            id: id,
            headers: columns,
            data: dataOut,
            meta: {
                count: dataOut.length
            }
        };

        if (dataOut && dataOut.length) {
            payload = augmentWithNavigationDetails(
                payload, query, firstPoint, lastPoint
            );
        }

        if (ext == 'html') {
            river.getFirstAndLastUpdatedTimes(id, function(err, first, last) {
                if (err) return renderError(503, err, ext, res, query.callback);
                river.getDataCount(id, function(err, dataCount) {
                    var htmlRenderOpts, prevLink = '#', nextLink = '#';
                    if (err) return renderError(503, err, ext, res, query.callback);
                    if (payload.urls) {
                        prevLink = payload.urls.prev.replace('data.json', 'data.html');
                        nextLink = payload.urls.next.replace('data.json', 'data.html');
                    }
                    htmlRenderOpts = {
                        name: riverName,
                        type: river.config.type,
                        id: id,
                        headers: columns,
                        dataLimit: query.limit,
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
                            poweredBy: river.config.poweredBy,
                            dataUrl: (req.protocol + '://' + req.get('host') + req.originalUrl).replace('data.html', 'data.json'),
                            prevLink: prevLink,
                            nextLink: nextLink
                        }
                    };
                    if (query.aggregate && dataOut.length) {
                        aggregated = aggregateTemporalData(query.aggregate, columns, dataOut);
                        htmlRenderOpts.data = aggregated.data;
                        htmlRenderOpts.headers = aggregated.headers;
                        htmlRenderOpts.aggregated_by = query.aggregate;
                    }
                    renderPage(templateName, htmlRenderOpts, ext, res, query.callback);
                });
            });
        } else {
            if (query.aggregate && dataOut.length) {
                aggregated = aggregateTemporalData(query.aggregate, columns, dataOut);
                payload.data = aggregated.data;
                payload.headers = aggregated.headers;
                payload.aggregated_by = query.aggregate;
            }
            renderPage(templateName, payload, ext, res, query.callback);
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
            tmpl: {
                title: riverName + ' metadata'
            }
        }, ext, res, req.query.callback);
    });
}

function handle404(req, res) {
    var message = '404: Not found: ' + req.url;
    handleError(404, message, req, res);
}

function handleError(code, message, req, res) {
    res.status(code);
    // respond with html page
    if (req.accepts('html')) {
        renderError(code, new Error(message), 'html', res);
    } else if (req.accepts('json')) {
        renderError(code, new Error(message), 'json', res, req.query.callback);
    } else {
        // default to plain-text. send()
        res.type('txt').send(message);
    }

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
