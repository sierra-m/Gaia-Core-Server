# Gaia Core, Aurora and Helios DB
What are these?

## Gaia Core
"Gaia Core" is the webserver that handles data processing between the database and the end user, as well as
the Iris Dispatcher server.

Gaia servers as the front face of the database and handles all transactions in and out. As of now, the database is
used primarily as an efficient mass storage system for use by Gaia only and should not have any ports open to the
outside Internet. Gaia handles data retrievals from the user, data entries from Iris, and user edits from the Aurora
Flight Tracker.

### Endpoints
Gaia will respond to several endpoints:

##### meta
The **meta** endpoint supplies information about stored data. To get the list of all distinct IMEIs stored, make the
request:
```
GET /meta?q=imeis
```
**Return Format**: A JSON list of IMEIs as integers

To get a list of all unique UTC flight dates for a given imei, make the request:
```
GET /meta?q=flights&imei={the imei}
```
**Return Format**: A JSON list of dates as strings in format "YYYY-MM-DD"

To get a list of ongoing flights, make the request:
```
GET /meta?q=current
```
**Return Format**: A list of flight registry objects
```json
[
  {
    "uid": 237666042108680,
    "start_date": "2013-06-14",
    "imei": 300234060252680
  },
  {...},
  ...
]
```

##### flight
The **flight** endpoint responds with data about a particular flight. To get flight data, make either the UID request:
```
GET /flight?uid={calculated uid}
```
or the date/imei search request:
```
GET /flight?date={YYYY-MM-DD}&imei={your imei}
```
**Return Format**:
```json
{
  "fields": ["fieldName1", "fieldName2"],
  "data": [
    ["corresponding", 1],
    ["data", 2]
  ],
  "stats": {
    "avg_coords": {
      "lat": 45.5,
      "long": 111.2
    },
    "avg_ground": 22.4,
    "max_ground": 68.52,
    "max_vertical": 40.33,
    "max_altitude": 15034,
    "min_altitude": 1435
  }
}
```
When requested from the database, every data point has a corresponding object. To reduce the amount of unnecessarily
repeated field names in JSON transmission, the data is "unzipped", where data fields (aka database columns) are placed
in one list under the key "fields" and each set of data values are placed in a list, with the collection of these
datapoint lists placed in a list under the key "data". Data order is retained so that data may be "zipped" after
transmission seamlessly.

From the example above,
```json
{
"fields": ["fieldName1", "fieldName2"],
  "data": [
    ["corresponding", 1],
    ["data", 2]
  ]
}
```
corresponds to the object:
```json
[
  {
    "fieldName1": "corresponding",
    "fieldName2": 1
  },
  {
    "fieldName1": "data",
    "fieldName2": 2
  }
]
```