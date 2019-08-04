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
import {query} from '../util/pg'
import {extractIMEI} from '../snowflake'
import moment from 'moment'
import ElevationAPI from '../util/elevation'

const router = express.Router();

format.extend(String.prototype, {});

const elevationAPI = new ElevationAPI();

router.post('/', async (req, res, next) => {
  try {
    if ('uid' in req.body && 'datetime' in req.body) {
      let uid = req.body.uid;
      let lastTime = moment.utc(req.body.datetime, 'X').format('YYYY-MM-DD HH:mm:ss');

      let result = await query(`SELECT * FROM public."flights" WHERE uid=${uid} AND datetime>'${lastTime}'`);
      //console.log(`uid: ${uid} time: ${lastTime} result: ${result}`);

      for (let row of result) {
        row.datetime = moment.utc(row.datetime, 'YYYY-MM-DD HH:mm:ss').unix();
      }

      let pins = req.pinStates.get(extractIMEI(uid));

      let content = {
        update: result.length > 0,
        result: result,
        pin_states: pins
      };

      //console.log(`Pin states: ${JSON.stringify(req.pinStates)}`);
      if (result.length > 0) {
        const point = result[result.length -1];
        if (point.altitude < 3000 && point.vertical_velocity < 0) {
          content.ground_elevation = elevationAPI.request(point.latitude, point.longitude);
        }
      }
      await res.json(content)
    } else {
      res.sendStatus(400)
    }
  } catch (e) {
    console.log(e);
  }
});

export default router