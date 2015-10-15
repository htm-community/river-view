$(function() {

    function getUrlQueryString() {
        var questionMarkIndex = window.location.href.indexOf('?');
        var queryString = '';
        if (questionMarkIndex > 1) {
            queryString = window.location.href.slice(window.location.href.indexOf('?') + 1);
        }
        return queryString;
    }

    // Read a page's GET URL variables and return them as an associative array.
    function getUrlVars() {
        var vars = [], hash;
        var hashes = getUrlQueryString().split('&');
        for(var i = 0; i < hashes.length; i++)
        {
            hash = hashes[i].split('=');
            vars.push(hash[0]);
            vars[hash[0]] = hash[1];
        }
        return vars;
    }

    window.RV = {
        utils: {
            getUrlQueryString: getUrlQueryString,
            getUrlVars: getUrlVars
        }
    };
});
