# River View

> Public Streaming Data Service Framework

![A View of the Mississippi River](https://c1.staticflickr.com/5/4009/4616069553_1740ff78b3_z.jpg)

* * *

## Work In Progress

> The documentation below is a **DRAFT**.

* * *

_**River View**_ is a data streaming framework for public data. It provides a pluggable interface for users to expose public data sources in a transient windowed format that is easily query-able. It was built to provide a longer-lasting historical window for public data sources that provide only real-time data snapshots, especially for sensor data from public government services like weather, traffic, and geological data.

_River View_ fetches data from user-defined [_Rivers_](#Rivers) at regular intervals, populating a local [Redis](http://redis.io) database. This data is provided in a windowed format, so that data older than a certain configured age is lost. But the window should be large enough to provide enough historical data to potentially train machine intelligence models on the data patterns within it.

## Rivers

A _**River**_ is a pluggable public data stream gathered from one or more origins and collected in a query-able temporary temporal pool. _Rivers_ are declared within the [`rivers`](rivers) directory, and consist of:

- a namespace, which is assumed based upon the directory name of the data source within the [`rivers`](rivers) directory
- a YAML configuration file, containing:
  - one or more external URLs where the data is collected, which are public and accessible without authentication
  - the interval at which the data source will be queried
  - when the data should expire
- a JavaScript parser module that is passed the body of an HTTP call to the aforementioned URL(s), which is expected to parse it and return a temporal object representation of the data.

Each _River_ may produce data for many unique data items, but they must have unique identifiers. For example, a city traffic data source may produce data for many traffic paths within the city, each identified with a unique ID. A US state water level data source might have unique sources for each water level sensor in the state, each with a unique ID.

### Creating a River

Please see [Creating a River](https://github.com/rhyolight/river-view/wiki/Creating-a-River) in our wiki.

## Web Services

In addition to collected and storing data from _Rivers_, a simple HTTP API for reading the data is also active on startup. It returns HTML, JSON, and (in some cases) CSV data for each _River_ configured at startup.

### URLs

| URL | Description |
| --- | ----------- |
| `/index.[html|json]` | Current _Rivers_ active in **River View** |
| `/<river-name>/props.[html|json]` | Detailed information about a _river_, including the URL to the river's keys |
| `/<river-name>/keys.[html|json]` | All unique ids for data within _river_ |
| `/<river-name>/<id>/data.[html|json|csv]` | All data for specified key |
| `/<river-name>/<id>/props.[html|json]` | All properties for specified key |
