
var yaml = require('js-yaml'),
    fs = require('fs');

function parseYaml(filePath) {
    var contents = fs.readFileSync(filePath, 'utf8');
    return yaml.safeLoad(contents);
}

module.exports = {
    parseYaml: parseYaml
};