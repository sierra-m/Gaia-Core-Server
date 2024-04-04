/*
* The MIT License (MIT)
*
* Copyright (c) 2019 Sierra MacLeod
*
* Permission is hereby granted, free of charge, to any person obtaining a
* copy of this software and associated documentation files (the "Software"),
* to deal in the Software without restriction, including without limitation
* the rights to use, copy, modify, merge, publish, distribute, sublicense,
* and/or sell copies of the Software, and to permit persons to whom the
* Software is furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in
* all copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
* OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
* FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
* DEALINGS IN THE SOFTWARE.
*/

import express from 'express'
import {query} from '../util/pg'
import moment from 'moment'
import format from 'string-format'
import { encodeUID, extractIMEI } from "../snowflake"
import { FlightPoint } from "../util/data"
import {standardizeUID} from '../util/uid';
import * as config from '../config'


const router = express.Router();
router.modemList = undefined;  // type: ModemList
format.extend(String.prototype, {});

// Creates a new point in the database for a given flight
const insertPoint = async (flightPoint, uid) => {
  flightPoint.uid = uid;
  flightPoint.datetime = flightPoint.datetime.format('YYYY-MM-DD HH:mm:ss');
  return await query(
      ('INSERT INTO public."flights"' +
       '(uid, datetime, latitude, longitude, altitude, vertical_velocity, ground_speed, satellites, input_pins, output_pins) ' +
       'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)'),
      [
          flightPoint.uid,
          flightPoint.datetime,
          flightPoint.latitude,
          flightPoint.longitude,
          flightPoint.altitude,
          flightPoint.vertical_velocity,
          flightPoint.ground_speed,
          flightPoint.satellites,
          flightPoint.input_pins,
          flightPoint.output_pins
      ]
  );
};

/**
 * todo: redo this file entirely. well, maybe not entirely, but def move some things into functions
 */

router.post('/', async (req, res) => {
  if ('point' in req.body) {

    const flightPoint = new FlightPoint(req.body.point);

    if (flightPoint.altitude < config.MIN_ALTITUDE) {
      await res.status(400).json({
        status: 'error',
        data: `Altitude invalid: below ${config.MIN_ALTITUDE}m, flight point rejected`
      });
      console.log(`Rejected point: altitude too low`);
      return;
    }
    if (flightPoint.altitude > config.MAX_ALTITUDE) {
      await res.status(400).json({
        status: 'error',
        data: `Altitude invalid: above ${config.MAX_ALTITUDE}m, flight point rejected`
      });
      console.log(`Rejected point: altitude too high`);
      return;
    }

    const bad_fields = flightPoint.checkInvalidFields();
    if (bad_fields.length > 0) {
      await res.status(403).json({
        status: 'error',
        data: `Flight point fields are incorrectly formatted: ${bad_fields}`
      });
      console.log(`Rejected point: bad fields`);
      return;
    }

    // Check IMEI is in allow list
    if (!router.modemList.has(flightPoint.imei)) {
      await res.status(403).json({
        status: 'error',
        data: `Modem IMEI ${flightPoint.imei} not in allowed list, datapoint rejected`
      });
      console.log(`Rejected point: bad imei`);
      return;
    }

    // Check if flight entry exists for this point from the last day (in UTC) specifically. This is
    // a variable time window starting from 00:00:00 and ending at the timestamp of the point.
    const startDate = flightPoint.datetime.clone().startOf('day').format('YYYY-MM-DD HH:mm:ss');
    let result = await query(
        `SELECT * FROM public."flight-registry" WHERE imei=$1 AND start_date=$2`,
        [flightPoint.imei, startDate]);

    if (result.length > 0) {
      try {
        await insertPoint(flightPoint, result[0].uid);
        await res.json({
          status: 'success',
          type: 'today',
          flight: result[0].uid
        });
      } catch (e) {
        if ("code" in e && e.code === "23505") {
          await res.status(400).json({
            status: 'error',
            data: 'flight point violates unique constraint, rejected'
          });
        } else {
          await res.status(500).json({
            status: 'error',
            data: `internal server error when inserting flight point for case 'today'`
          });
          console.log(e);
          console.log('Today error');
        }
      }
    } else {
      // If there are no points from today in the registry, we check if there are any points in the last X number
      // of hours, defined by `CONTIG_FLIGHT_DELTA_HRS`. This allows points spanning across the UTC 24-hour
      // wraparound to be appended to the end of a flight which started the previous day. Once the delta between
      // incoming flight points exceeds `CONTIG_FLIGHT_DELTA_HRS`, a new flight will be created, with the start date
      // recorded as 'today'

      const hoursAgo = moment.utc().subtract(config.CONTIG_FLIGHT_DELTA_HRS, 'hours').format('YYYY-MM-DD HH:mm:ss');
      let result = await query(
          `SELECT uid FROM public."flight-registry" WHERE imei=$1 AND uid IN ` +
          `(SELECT DISTINCT ON (uid) uid FROM public."flights" WHERE datetime>=$2)`,
          [flightPoint.imei, hoursAgo]
      );

      // If we find a matching flight, append this flight point to it
      if (result.length > 0) {
        try {
          await insertPoint(flightPoint, result[0].uid);
          await res.json({
            status: 'success',
            type: 'recent',
            flight: result[0].uid
          });
        } catch (e) {
          if ("code" in e && e.code === "23505") {
            await res.status(400).json({
              status: 'error',
              data: 'flight point violates unique constraint, rejected'
            });
          } else {
            await res.status(500).json({
              status: 'error',
              data: `internal server error when inserting flight point for case 'recent' for uid ${result[0].uid}`
            });
            console.log(e);
            console.log('Recent error');
          }
        }
        return;  // Explicit return to avoid flight creation
      }
      // Recent not found for point. Program flow continues to create
      console.log(`IMEI ${flightPoint.imei} new flight creation.`);
      try {
        const result = await query(
            `INSERT INTO public."flight-registry" (start_date, imei) VALUES ($1, $2) RETURNING uid`,
            [flightPoint.datetime.format('YYYY-MM-DD'), flightPoint.imei]
        );
        await insertPoint(flightPoint, result[0].uid);
        // TODO: change this to 201 CREATED
        await res.json({
          status: 'success',
          type: 'created',
          flight: result[0].uid
        });
      } catch (e) {
        if ("code" in e && e.code === "23505") {
          await res.status(400).json({
            status: 'error',
            data: 'flight point violates unique constraint, rejected'
          });
        } else {
          await res.status(500).json({
            status: 'error',
            data: `internal server error when inserting flight point for case 'created' for imei ${flightPoint.imei}`
          });
          console.log(e);
          console.log('Created error');
        }
      }
    }
  } else {
    res.sendStatus(400);
  }
});

// Does not support GET reqs
router.get('/', async (req, res, next) => {
  res.sendStatus(400);
});

export default router