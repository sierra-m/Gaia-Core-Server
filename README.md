# Gaia Data Server
Gaia is the API server that runs the Aurora react app and handles all
incoming and outgoing flight data. It serves in front of a PostgresSQL
database for flight storage and takes data input primarily from Iris
Dispatcher.

As Aurora and Gaia are one server in production, it will often be referred to
as Aurora Webserver.