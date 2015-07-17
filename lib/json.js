/**
 *
 * @module lib/
 */

function renderJson(output, res) {
    var out = output;
    if (typeof output == 'object') {
        out = JSON.stringify(output);
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(out);
}

function renderJsonp(output, cbName, res) {
    var out = output,
        textOut;
    if (typeof output == 'object') {
        out = JSON.stringify(output);
    }
    textOut = cbName + '(' + out + ')';
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(textOut);
}

function renderErrors(errs, res, callbackName) {
    var errors = {
        errors: errs.map(function(e) {
            return e.message;
        })
    };
    res.statusCode = 400;
    if (callbackName) {
        renderJsonp(errors, callbackName, res);
    } else {
        renderJson(errors, res);
    }
}

function render(payload, response, callbackName) {
    if (callbackName) {
        return renderJsonp(payload, callbackName, response);
    } else {
        return renderJson(payload, response);
    }
}

module.exports = {
    render: render,
    renderJson: renderJson,
    renderJsonp: renderJsonp,
    renderErrors: renderErrors
};