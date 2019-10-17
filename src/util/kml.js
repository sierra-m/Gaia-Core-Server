import format from 'string-format'
import {extractDate, extractIMEI} from '../snowflake'

const fs = require('fs').promises;

format.extend(String.prototype, {});

export default class KmlEncoder {
  /**
   * Generates a KML file from flight db query
   * @param data A database query
   * @param maxAltitude
   * @returns {Promise<String>}
   */
  static async generate (data, maxAltitude) {
    const file = await fs.readFile('./src/res/balloon_flight.kml.tmpt', "utf8");

    let ascendingData = '', descendingData = '';
    let maxPoint;
    let isAscending = true;
    for (let point of data) {
      let coord = `${point.longitude},${point.latitude},${point.altitude}\n`;
      if (isAscending) {
        ascendingData += coord;
      } else {
        descendingData += coord;
      }
      if (point.altitude === maxAltitude) {
        maxPoint = point;
        isAscending = false;
      }
    }

    let firstPoint = data[0];
    let lastPoint = data[data.length - 1];
    const fileData = {
      uid: firstPoint.uid,
      imei: extractIMEI(firstPoint.uid),
      date: extractDate(firstPoint.uid).format('YYYY-MM-DD'),
      ascentCoords: ascendingData,
      descentCoords: descendingData,

      startLong: firstPoint.longitude,
      startLat: firstPoint.latitude,
      startAlt: firstPoint.altitude,

      midLong: maxPoint.longitude,
      midLat: maxPoint.latitude,
      midAlt: maxPoint.altitude,

      endLong: lastPoint.longitude,
      endLat: lastPoint.latitude,
      endAlt: lastPoint.altitude
    };

    return file.format(fileData);
  }
}