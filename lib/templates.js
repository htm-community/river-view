var fs = require('fs')
  , path = require('path')
  , Handlebars = require('handlebars')
  , _ = require('lodash')
  , compiled = {}
  , BASE_URL
  ;

function start(templateDirectory, baseurl) {
    var partialDir;
    BASE_URL = baseurl;
    // console.log('Compiling Handlebars templates in %s...', templateDirectory);
    _.each(fs.readdirSync(templateDirectory), function(file) {
        var filePath = path.join(templateDirectory, file)
          , fstat = fs.statSync(filePath)
          , templateName
          ;
        if (fstat.isFile()) {
            templateName = file.split('.').shift();
            compiled[templateName] = Handlebars.compile(fs.readFileSync(filePath, 'utf8'));
            // console.log('Compiled template: %s', templateName);
        }
    });
    // Assuming that the template directory has partials.
    partialDir = path.join(templateDirectory, 'partials');
    _.each(fs.readdirSync(partialDir), function(file) {
        var filePath = path.join(partialDir, file)
          , fstat = fs.statSync(filePath)
          , templateName
          ;
        if (fstat.isFile()) {
            templateName = file.split('.').shift();
            compiled[templateName] = Handlebars.registerPartial(
                templateName
              , fs.readFileSync(filePath, 'utf8')
            );
            // console.log('Compiled partial: %s', templateName);
        }
    });
    console.log('Template compilation complete.');
}

function renderHtml(name, data, res) {
    if (! compiled[name]) {
        throw new Error('Unknown template "' + name + '"!');
    }
    data.baseurl = BASE_URL;
    res.setHeader('Content-Type', 'text/html');
    res.end(compiled[name](data));
}

module.exports = {
    start: start
  , renderHtml: renderHtml
};
