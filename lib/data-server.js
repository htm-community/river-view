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

function handleIndex(req, res) {
    var ext = req.params.ext || 'html'
      , data;
    data = _.map(rivers, function(river) {
        return river.config;
    });
    renderPage('index', {rivers: data}, ext, res);
}

function startDataService(opts) {
    app = opts.app;
    redisClient = opts.redisClient;
    rivers = opts.rivers;
    CONFIG = opts.config;

    tmpl.start(path.join(__dirname, '..', 'templates'));

    app.use('/index\.:ext?', handleIndex);

    app.listen(CONFIG.port, function(err) {
        if (err) throw err;
        console.log(
            'River View data server started on %s:%s'
          , CONFIG.baseurl, CONFIG.port
        );
    });
}

module.exports = startDataService;
