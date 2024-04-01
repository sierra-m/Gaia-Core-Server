
import {Buffer} from 'buffer'
import {query} from './pg'
import moment from "moment";


const validateUID = (uid) => {
    return uid.match(/[0-9a-f]{8}\-[0-9a-f]{4}\-4[0-9a-f]{3}\-[89ab][0-9a-f]{3}\-[0-9a-f]{12}/i);
}


const standardizeUID = (uid) => {
    let standardUid;
    if (uid.length === 22) {
        const asHex = Buffer.from(uid, 'base64').toString('hex');
        standardUid = `${asHex.slice(0,8)}-${asHex.slice(8,12)}-${asHex.slice(12,16)}-${asHex.slice(16,20)}-${asHex.slice(20)}`;
    } else {
        standardUid = uid;
    }
    if (typeof standardUid === 'string' && validateUID(standardUid)) {
        return standardUid;
    }
}


const compressUID = (uid) => {
    let asBase64 = Buffer.from(uid.replaceAll('-', ''), 'hex').toString('base64');
    // Buffer in node v12 does not support url-safe b64 encoding, so we need to manually format this
    // as per https://datatracker.ietf.org/doc/html/rfc4648#section-5
    return asBase64.replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}


const getFlightByUID = async (uid) => {
    if (uid) {
        let result = await query(
            'SELECT imei, start_date FROM public."flight-registry" WHERE uid=$1',
            [uid]
        );
        if (result.length > 0) {
            return {
                imei: parseInt(result[0].imei),  // pg returns bigint as string
                start_date: moment.utc(result[0].start_date, 'YYYY-MM-DD HH:mm:ss')
            }
        }
    }
}


const getUIDByFlight = async (imei, start_date) => {
    if (moment.isMoment(start_date)) {
        const isoDate = start_date.format('YYYY-MM-DD HH:mm:ss');
        let result = await query(
            'SELECT uid FROM public."flight-registry" WHERE imei=$1 AND start_date=$2',
            [imei, isoDate]
        );
        if (result.length > 0) {
            return result[0].uid;
        }
    }
}

export {standardizeUID, compressUID, getFlightByUID, getUIDByFlight};