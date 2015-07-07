var path = require('path')
  , fs = require('fs-extra')
  , _ = require('lodash')
  , Metalsmith = require('metalsmith')
  , templates = require('metalsmith-templates')
  , markdown = require('metalsmith-markdown')
  , permalinks = require('metalsmith-permalinks')

  , source = '../site'
  , destination = '../build'
  , siteDir = path.join(__dirname, source)
  , buildDir = path.join(__dirname, destination)
  ;

module.exports = function(config) {
    var baseurl = config.baseurl;
    if (config.port && _.contains(config.baseurl, 'localhost')) {
        baseurl += ':' + config.port;
    }
    // Ensure clean build.
    fs.removeSync(buildDir);
    Metalsmith(__dirname)
        .source(source)
        .destination(destination)
        .use(markdown())
        .use(templates({
            engine: 'handlebars'
          , directory: path.join(siteDir, 'layouts')
          , partials: {
                header: 'partials/header'
              , footer: 'partials/footer'
          }
          , baseurl: baseurl
        }))
        .use(permalinks({relative: false}))
        .build(function(error) {
            if (error) {
                console.error(error);
                process.exit(-1);
            }
        });
};
