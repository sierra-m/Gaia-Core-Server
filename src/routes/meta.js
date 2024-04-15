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
import * as config from '../config'
import {getFlightByUID} from '../util/uid'


const router = express.Router();
router.modemList = undefined;  // type: ModemList

format.extend(String.prototype, {});

router.get('/modems', async (req, res, next) => {
    try {
        const modems = router.modemList.getRedactedSet();
        await res.json(modems);
    } catch (e) {
        console.log(e);
        next(e);
    }
});

router.get('/flights', async (req, res, next) => {
    try {
        if ('modem_name' in req.query && req.query.modem_name !== null && typeof req.query.modem_name === 'string') {
            const modem = router.modemList.getByName(req.query.modem_name);

            if (!modem) {
                await res.status(404).json({err: `Invalid modem name '${req.query.modem_name}'`});
                return;
            }

            let result = await query(
                'SELECT * FROM public."flight-registry" WHERE imei=$1',
                [modem.imei]
            );

            let flights = result.map(x => ({date: x.start_date, uid: x.uid}));
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
        // NOTE: This endpoint takes no user input, so direct query substitution is permitted
        let result = await query('SELECT DISTINCT ON (uid) uid, datetime FROM public."flights" WHERE datetime>=\'{}\' ORDER BY uid ASC, datetime DESC'.format(hoursAgo));

        if (result.length > 0) {
            //console.log(`Active flight tuples: ${result.length}`);

            // Order uids into '1, 2, 3' string format
            const point_identifiers = result.map(point => `('${point.uid}', '${point.datetime}')`).join(', ');

            // Search for partial points from the list of uids
            // NOTE: This endpoint takes no user input, so direct query substitution is permitted
            result = await query(`SELECT uid, datetime, latitude, longitude, altitude FROM public."flights" WHERE (uid, datetime) in (${point_identifiers}) ORDER BY datetime DESC`);
            //console.log(`Full active flights: ${result.length}`);
            for (let partial of result) {
                const {imei, start_date} = await getFlightByUID(partial.uid);
                partial.modem = router.modemList.getRedacted(imei);
                partial.start_date = start_date;
            }
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