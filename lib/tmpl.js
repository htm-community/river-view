var fs = require('fs')
  , path = require('path')
  , Handlebars = require('handlebars')
  , _ = require('lodash')
  , compiled = {}
  ;

function start(templateDirectory) {
    console.log('Compiling Handlebars templates in %s...', templateDirectory);
    _.each(fs.readdirSync(templateDirectory), function(file) {
        var filePath = path.join(templateDirectory, file)
          , templateName = file.split('.').shift();
        compiled[templateName] = Handlebars.compile(fs.readFileSync(filePath, 'utf8'));
        console.log('Compiled %s', templateName);
    });
    console.log('Template compilation complete.');
}

function renderHtml(name, data, res) {
    if (! compiled[name]) {
        throw new Error('Unknown template "' + name + '"!');
    }
    res.setHeader('Content-Type', 'text/html');
    res.end(compiled[name](data));
}

module.exports = {
    start: start
  , renderHtml: renderHtml
};
