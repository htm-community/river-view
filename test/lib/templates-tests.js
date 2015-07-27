var expect = require('chai').expect,
    proxyquire = require('proxyquire'),
    httpMocks = require('node-mocks-http'),
    templates = require('../../lib/templates'),
    path = require('path');

describe('when rendering a template', function() {

    var templateDirectory = path.join(__dirname, '../..', 'site', 'templates');
    var baseurl = "";
    var response;
    templates.compile(templateDirectory, baseurl);

    it('renders a default template when it cannot find a template that matches the provided name', function() {
        response = httpMocks.createResponse();
        templates.renderHtml(undefined, {}, response);
        expect(response.statusCode).to.equal(200);
    });

    it('renders a known template (meta)', function() {
        response = httpMocks.createResponse();
        templates.renderHtml("meta", {}, response);
        expect(response.statusCode).to.equal(200);
    });
    
});
