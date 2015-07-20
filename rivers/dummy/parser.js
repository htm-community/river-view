var moment = require('moment');

module.exports = function(cfg, body, url, cb1, cb2) {
    cb1(123, moment().unix(), [1,2]);
    cb2(123, {});
};