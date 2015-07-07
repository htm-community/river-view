# River View

> Public Streaming Data Service Framework

![A View of the Mississippi River](https://c1.staticflickr.com/5/4009/4616069553_1740ff78b3_z.jpg)

* * *

## Work In Progress

> The documentation below is a **DRAFT**.

* * *

_**River View**_ is a data streaming framework for public data. It provides a pluggable interface for users to expose public data sources in a transient windowed format that is easily query-able. It was built to provide a longer-lasting historical window for public data sources that provide only real-time data snapshots, especially for sensor data from public government services like weather, traffic, and geological data.

_River View_ fetches data from public [_data sources_](#data-sources) at regular intervals, populating a local [Redis](http://redis.io) database. This data is provided in a windowed format, so that data older than a certain configured age is lost. But the window is large enough to provide enough historical data to potentially train machine intelligence models on the data patterns within it.

## Data Sources

A River View _data source_ is a pluggable public data stream gathered from one or more origins and collected in a query-able temporary temporal pool. _Data sources_ are declared within the [`data-sources`](data-sources) directory, and consist of:

- a namespace, which is assumed based upon the directory name of the data source within the [`data-sources`](data-sources) directory
- a YAML configuration file, containing:
  - one or more external URLs where the data is collected, which are public and accessible without authentication
  - the interval at which the data source will be queried
- a JavaScript parser module that is passed the body of an HTTP call to the aforementioned URL(s) and is expected to parse it and return a temporal object representation of the data (see [expected data format](#expected-data-format))

Each _data source_ may produce data for many unique data items, but they must have unique identifiers. For example, a city traffic data source may produce data for many traffic paths within the city, each identified with a unique ID. A US state water level data source might have unique sources for each water level sensor in the state, each with a unique ID.

### Data Source Config

Each _data source_ *must* provide a configuration in the form of a YAML file at `data-sources/<namespace>/config.yml`. At the minimum, this file must contain a URL for the data origin. Other configurations are optional. The default data fetch interval is 10 minutes.

### Data Source Parser

Each _data source_ *must* provide parsing logic at `data-sources/<namespace>/parser.js` and export a function named `parse` with the following signature:

```
module.exports = {
    init: function() {},
    parse: function(url, body, callback) {
        var id = getDataId(url, body);
        parseBody(body, function(err, timestamp))
    }
};
```

This parser function will be passed the body of the HTTP response to the origin URL called at the interval defined in the [_data source_ config](#data-source-config). River View expects the parser to parse the body text and call the `callback` function with a properly formatted data object.

#### Expected Data Format

## Web Services

### URLs

http://localhost:8080/

Displays information about this River View instance and its data sources.

- http://localhost:8080/:datasource
- http://localhost:8080/:datasource/:id[.json]
- http://localhost:8080/:datasource/:id.json
- http://localhost:8080/:datasource/:id.html
- http://localhost:8080/:datasource/:id.csv

# Addendum

## Redis Storage Schema

Each _data-source_ will be stored in the same fashion. The following describes this, given the following variable values:

- `<data-source-name>`: The name of the _data-source_, identified by the name of its directory in `/data-sources`.
- `<id>`: The unique identier for a temporal data stream.

### Data Element Properties

Each data element might have static properties that do not change temporally. These are stored in the `<data-source-name>:<id>:props` key, and the value is a one-level JSON object.

### Data Element Stream

Temporal data for a data stream are stored as a sorted set in Redis, keyed by `<id>` and using timestamp as the "score".

`<data-source-name>:<id>`
