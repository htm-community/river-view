var _ = require('lodash')
  , moment = require('moment-timezone')
  , csvParse = require('csv-parse')
  ;

module.exports = function(config, body, url, temporalDataCallback, metaDataCallback) {
    var neighborhoods = JSON.parse(body);

    // This is important.
    moment.tz.setDefault(config.timezone);

    _.each(neighborhoods, function(hood) {
        var neighborhood = hood.neighborhood.replace('/', '-')
          , timestamp = moment().tz(config.timezone).unix()
          , fieldValues
          ;

        metaDataCallback(neighborhood, {
            neighborhood: neighborhood
        });

        fieldValues = [
            hood.ac_per,
            hood.res_score,
            hood.pharm_per,
            hood.over65_per,
            hood.emp_per,
            hood.hs_per,
            hood.citz_per,
            hood.dis_per,
            hood.rent_per,
            hood.pov_per,
            hood.under18_per,
            hood.com_score,
            hood.viol_rate,
            hood.pr_score,
            hood.nonwhi_per,
            hood.ec_score,
            hood.under5_per,
            hood.daypopdens,
            hood.oc_per,
            hood.haz_score,
            hood.pm_conc,
            hood.sheltday_rate,
            hood.lat_per,
            hood.eldlival_per,
            hood.over85_per,
            hood.trans_sco,
            hood.black_per,
            hood.liq_per,
            hood.vcrim_rate,
            hood.house_score,
            hood.newsf_per,
            hood.asian_per,
            hood.popdens,
            hood.res_rank,
            hood.lival_per,
            hood.at_min,
            hood.ptrans_sco,
            hood.dem_score,
            hood.food_score,
            hood.flood_per,
            hood.tree_per,
            hood.tox_per,
            hood.prevhos,
            hood.heat_per,
            hood.env_score,
            hood.vot_rate,
            hood.shelt_rate,
            hood.imp_per,
            hood.health_score,
            hood.eng_per
        ];

        temporalDataCallback(neighborhood, timestamp, fieldValues);

    });
};
