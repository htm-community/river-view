var path = require('path')
  , _ = require('lodash')
  , moment = require('moment-timezone')
  , jsonUtils = require('./json')
  , tmpl = require('./tmpl')
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

function handleRiverProps(req, res) {
    var riverName = req.params.river
      , ext = req.params.ext || 'json'
      , data = getRiver(riverName).config
      ;

    renderPage('riverProps', data, ext, res);
}

function handleRiverKeys(req, res) {
    var riverName = req.params.river
      , ext = req.params.ext || 'json';
    redisClient.getKeys(riverName, function(error, keys) {
        if (error) return renderError(error, ext, res);
        renderPage('keys', {
            name: riverName
          , keys: keys
        }, ext, res);
    });
}

function handleElementData(req, res) {
    var riverName = req.params.river
      , river = getRiver(riverName)
      , id = req.params.id
      , ext = req.params.ext || 'json';

    redisClient.getRiverData(riverName, id, req.query, function(error, data) {
        var dataOut = [];
        if (error) return renderError(error, ext, res);

        _.each(data, function(point) {
            var timeString = moment(new Date(parseInt(point.timestamp) * 1000))
                                .tz(river.config.timezone).format(DATE_FORMAT);
            dataOut.push([timeString].concat(point.data));
        });

        renderPage('data', {
            name: riverName
          , id: id
          , headers: ['datetime'].concat(river.config.fields)
          , data: dataOut
        }, ext, res);
    });
}

function handleElementProperties(req, res) {
    var riverName = req.params.river
      , river = getRiver(riverName)
      , id = req.params.id
      , ext = req.params.ext || 'json';

    redisClient.getRiverProperties(riverName, id, function(error, data) {
        renderPage('props', {
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

    tmpl.start(path.join(__dirname, '..', 'templates'), CONFIG.baseurl);

    app.use('/index\.:ext?', handleIndex);
    app.use('/:river/props\.:ext?', handleRiverProps);
    app.use('/:river/keys\.:ext?', handleRiverKeys);
    app.use('/:river/:id/data\.:ext?', handleElementData);
    app.use('/:river/:id/props\.:ext?', handleElementProperties);
    app.use('/', function(req, res) {
        res.redirect('/index.html');
    });

    app.listen(CONFIG.port, function(err) {
        if (err) throw err;
        console.log(
            'River View data server started on %s', CONFIG.baseurl
        );
    });
}

module.exports = startDataService;
