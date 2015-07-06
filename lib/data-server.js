var path = require('path')
  , _ = require('lodash')
  , jsonUtils = require('./json')
  , tmpl = require('./tmpl')
  , app
  , redisClient
  , rivers
  , CONFIG
  ;

function renderPage(name, data, format, res) {
    if (format == 'json') {
        jsonUtils.render(data, res);
    } else if (format == 'html') {
        tmpl.renderHtml(name, data, res);
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
    } else {
        throw new Error('Format %s is unsupported!', format);
    }
}

function handleIndex(req, res) {
    var ext = req.params.ext || 'html'
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

function handleKeys(req, res) {
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

function startDataService(opts) {
    app = opts.app;
    redisClient = opts.redisClient;
    rivers = opts.rivers;
    CONFIG = opts.config;

    tmpl.start(path.join(__dirname, '..', 'templates'), CONFIG.baseurl);

    app.use('/index\.:ext?', handleIndex);
    app.use('/:river/keys\.:ext?', handleKeys);
    // app.use('/:river/:id\.:ext?', handleElement);

    app.listen(CONFIG.port, function(err) {
        if (err) throw err;
        console.log(
            'River View data server started on %s:%s'
          , CONFIG.baseurl, CONFIG.port
        );
    });
}

module.exports = startDataService;
