/**
 * Templates module. Uses Handlebars.
 * @module lib/templates
 */

var fs = require('fs'),
    path = require('path'),
    Handlebars = require('handlebars'),
    _ = require('lodash'),
    compiled = {},
    BASE_URL;

/**
 * Pre-compiles all templates.
 * @param templateDirectory {string} Directory where the templates are.
 * @param baseurl {string} Complete base URL for creating links from this domain.
 */
function compile(templateDirectory, baseurl) {
    var partialDir;
    BASE_URL = baseurl;
    // console.log('Compiling Handlebars templates in %s...', templateDirectory);
    _.each(fs.readdirSync(templateDirectory), function(file) {
        var filePath = path.join(templateDirectory, file),
            fstat = fs.statSync(filePath),
            templateName;
        if (fstat.isFile()) {
            templateName = file.split('.').shift();
            compiled[templateName] = Handlebars.compile(fs.readFileSync(filePath, 'utf8'));
            // console.log('Compiled template: %s', templateName);
        }
    });
    // Assuming that the template directory has partials.
    partialDir = path.join(templateDirectory, 'partials');
    _.each(fs.readdirSync(partialDir), function(file) {
        var filePath = path.join(partialDir, file),
            fstat = fs.statSync(filePath),
            templateName;
        if (fstat.isFile()) {
            templateName = file.split('.').shift();
            compiled[templateName] = Handlebars.registerPartial(
                templateName, fs.readFileSync(filePath, 'utf8')
            );
            // console.log('Compiled partial: %s', templateName);
        }
    });
    console.log('Template compilation complete.');
}

/**
 * Renders data into an HTML template.
 * @param name {string} name of the template.
 * @param data {object} data to push through template.
 * @param res {http.ServerResponse} where the HTML will be written.
 */
function renderHtml(name, data, res) {
    data.baseurl = BASE_URL;
    res.setHeader('Content-Type', 'text/html');
    if (!compiled[name]) {
       res.end(compiled["error"](data));
    } else {
        res.end(compiled[name](data));
    }
}

module.exports = {
    compile: compile,
    renderHtml: renderHtml
};