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
import format from 'string-format'
import { query } from '../util/pg'
import moment from 'moment'
import { encodeUID, extractIMEI, extractDate } from "../snowflake"
import Stats from '../stats'
import json2csv from 'json2csv'
import KMLEncoder from '../util/kml'

const router = express.Router();

const MIN_SATELLITES = 6;

format.extend(String.prototype, {});

const exists = (thing) => thing !== null;

/**
 * Data is retrieved from postgres as an array of
 * full javascript objects. Sending these via json results
 * in many repetitive, unnecessary field names.
 *
 * Before sending flight data, we use this function to turn
 * a list of objects:
 *    [ {altitude=1000, latitude=52, ...}, {altitude=1001, latitude=53, ...} ]
 *
 * to a CSV-like object optimized for json transmission:
 *    {
 *      fields: ['altitude', 'latitude', ...],
 *      data: [
 *        [1000, 52, ...],
 *        [1001, 53, ...]
 *      ]
 *    }
 *
 * The `datetime` property is also converted to a unix integer
 *
 * @param {Array} data
 * @returns {Promise<Object>}
 */
const reformatData = async (data) => {
  const output = {
    fields: [],
    data: []
  };
  // Data must have at least one point
  if (data[0] === null || data[0] === undefined) return output;

  // Reformat datetime as unix
  for (let point of data) {
    point.datetime = moment.utc(point.datetime, 'YYYY-MM-DD HH:mm:ss').unix();
  }

  // Build point-to-point velocities
  for (let i = 0; i < data.length - 1; i++) {
    const nextPoint = data[i + 1];
    const thisPoint = data[i];
    const offsetLat = nextPoint.latitude - thisPoint.latitude;
    const offsetLong = nextPoint.longitude - thisPoint.longitude;
    const offsetSecs = nextPoint.datetime - thisPoint.datetime;
    // build the vector in degrees per second
    data[i].velocity_vector = [offsetLat / offsetSecs, offsetLong / offsetSecs];
  }
  data[data.length - 1].velocity_vector = [0, 0];

  // Unzip keys from values
  output.fields = Object.keys(data[0]);
  output.data = await data.map(point => Object.values(point));

  return output;
};

/**
 * Takes a database result and returns a JSON packet optimized for
 * transmission to client website
 * @param data
 * @returns {Promise<Object>}
 */
const jsvFormatter = async (data) => {
  const stats = await Stats.build(data);
  const jsv = await reformatData(data);
  jsv.stats = stats;
  return jsv;
};

const csvFormatter = async (data) => {
  const fields = ['uid', 'datetime', 'latitude', 'longitude', 'altitude', 'vertical_velocity', 'ground_speed', 'satellites'];
  const opts = { fields };

  return await json2csv.parseAsync(data, opts);
};

router.get('/', async (req, res, next) => {
  try {
    let uid = null;
    // For filenames
    let imei, date;
    if (req.query.uid) {
      uid = req.query.uid;

      imei = extractIMEI(uid);
      date = extractDate(uid).format('YYYY-MM-DD');
    } else if (req.query.imei && req.query.date) {
      let start_date = moment.utc(req.query.date, 'YYYY-MM-DD');
      uid = encodeUID(start_date, req.query.imei);

      imei = req.query.imei;
      date = req.query.date;
    }
    let result = await query('SELECT * FROM public."flights" WHERE uid={} AND satellites>={} ORDER BY datetime ASC'.format(uid, MIN_SATELLITES));

    if (req.query.format === 'csv') {
      const csv = await csvFormatter(result);

      res.type('csv');
      res.setHeader('Content-Disposition', `attachment; filename=flight-${imei}-${date}.csv`);
      res.setHeader('Content-Transfer-Encoding', 'binary');
      await res.send(csv)
    } else if (req.query.format === 'kml') {
      const stats = await Stats.build(result);
      const kml = await KMLEncoder.generate(result, stats.max_altitude);

      res.setHeader('Content-Type', `application/kml`);
      res.setHeader('Content-Disposition', `attachment; filename=flight-${imei}-${date}.kml`);
      res.setHeader('Content-Transfer-Encoding', 'binary');
      await res.send(kml);
    } else {
      const jsv = await jsvFormatter(result);
      await res.json(jsv);
    }
  } catch (e) {
    console.log(e);
    next(e)
  }
});

export default router;