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
import moment from 'moment'


const router = express.Router();

format.extend(String.prototype, {});

router.get('/imeis', async (req, res, next) => {
    try {
        const result = await query('SELECT DISTINCT imei FROM public."flight-registry"');

        const imeis = result.map(x => x.imei);
        await res.json(imeis);
    } catch (e) {
        console.log(e);
        next(e);
    }
});

router.get('/flights', async (req, res, next) => {
    try {
        if (req.query.imei !== null && typeof req.query.imei === 'string') {
            let result = await query('SELECT * FROM public."flight-registry" WHERE imei={}'.format(req.query.imei));

            /*
            * Mapping turns
            *   `[{start_date: "2018-08-08T06:00:00.000Z
            */
            let flights = result.map(x => x.start_date);
            res.json(flights);
        } else {
            res.sendStatus(400);
        }
    } catch (e) {
        console.log(e);
        next(e);
    }
});

router.get('/active', async (req, res, next) => {
    try {
        // Construct time delta of 12 hours ago, format for db query
        const hoursAgo = moment.utc().subtract(12, 'hours').format('YYYY-MM-DD HH:mm:ss');
        // Selects distinct UIDs but picks the latest datetime of each UID
        let result = await query('SELECT DISTINCT ON (uid) uid, datetime FROM public."flights" WHERE datetime>=\'{}\' ORDER BY uid ASC, datetime DESC'.format(hoursAgo));

        if (result.length > 0) {
            // Order uids into '1, 2, 3' string format
            const point_identifiers = result.map(point => `(${point.uid}, '${point.datetime}')`).join(', ');

            // Search for partial points from the list of uids
            result = await query(`SELECT uid, datetime, latitude, longitude, altitude FROM public."flights" WHERE (uid, datetime) in (${point_identifiers}) ORDER BY datetime DESC`);
            await res.json({
                status: 'active',
                points: result
            })
        } else {
            await res.json({status: 'none'})
        }
    } catch (e) {
        console.log(e);
    }
});

export default router;