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


const router = express.Router();
format.extend(String.prototype, {});

// Creates a new point in the database for a given flight
const insertPoint = async (flightPoint, uid) => {
  flightPoint.uid = uid;
  flightPoint.datetime = flightPoint.datetime.format('YYYY-MM-DD HH:mm:ss');
  //console.log(`DATABASE INSERT: ${flightPoint.datetime}`);
  return await query(('INSERT INTO public."flights" (uid, datetime, latitude, longitude, altitude, vertical_velocity, ground_speed, satellites) ' +
  "VALUES ({uid}, '{datetime}', {latitude}, {longitude}, {altitude}, {vertical_velocity}, {ground_speed}, {satellites})" +
  '').format(flightPoint));
};


router.post('/', async (req, res) => {
  if ('point' in req.body) {

    const flightPoint = new FlightPoint(req.body.point);

    req.pinStates.add(flightPoint.imei, flightPoint.input_pins, flightPoint.output_pins);

    /**
     * Why am I adding 6 hours here? Because for some reason the call
     * `flightPoint.datetime.clone().startOf('day')` results in a local time
     * object and I can't reproduce this in testing. It's a true mystery.
     * Adding 6 hours to achieve UTC is the ugly fix :P
     */
    const pointUID = encodeUID(flightPoint.datetime.clone().startOf('day').add(6, 'hours'), flightPoint.imei);

    let result = await query(`SELECT * FROM public."flight-registry" WHERE uid=${pointUID}`);

    if (result.length > 0) {
      try {
        await insertPoint(flightPoint, pointUID);
        await res.json({
          status: 'success',
          type: 'today',
          flight: Number(pointUID)
        });
      } catch (e) {
        await res.json({
          status: 'error',
          data: e.toString()
        });
        console.log(e);
        console.log('Today error');
      }
    } else {
      const hoursAgo = moment.utc().subtract(2, 'hours').format('YYYY-MM-DD HH:mm:ss');
      let result = await query(`SELECT * FROM public."flights" WHERE datetime>='${hoursAgo}'`);

      const pointIMEI = flightPoint.imei.toString();

      if (result.length > 0) {
        let foundImei = result.find(point => extractIMEI(point.uid) === pointIMEI);
        if (foundImei) {
          const flightUID = foundImei.uid;
          try {
            await insertPoint(flightPoint, flightUID);
            await res.json({
              status: 'success',
              type: 'recent',
              flight: Number(flightUID)
            });
          } catch (e) {
            await res.json({
              status: 'error',
              data: e.toString()
            });
            console.log(e);
            console.log('Recent error');
          }
        }
      } else {
        try {
          await query(`INSERT INTO public."flight-registry" (uid, start_date, imei) VALUES (${pointUID}, '${flightPoint.datetime.format('YYYY-MM-DD')}', ${flightPoint.imei})`);
          await insertPoint(flightPoint, pointUID);
          await res.json({
            status: 'success',
            type: 'created',
            flight: Number(pointUID)
          });
        } catch (e) {
          await res.json({
            status: 'error',
            data: e.toString()
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

router.get('/', async (req, res, next) => {
  res.sendStatus(400);
});

export default router