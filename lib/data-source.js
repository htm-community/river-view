

function DataSource(opts) {
    this.config = opts.config;
    this.parse = opts.parser;
}

DataSource.prototype.toString = function toString() {
    return 'Data Source: ' + this.config.name + '\n'
        + '\t' + this.config.description;
};

// This is so Node.js will use toString within console.log().
DataSource.prototype.inspect = DataSource.prototype.toString;

module.exports = DataSource;
