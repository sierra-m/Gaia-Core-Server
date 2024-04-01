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

import moment from 'moment'

class FlightPoint {
  /*
  * Represents one frame in time/space from a flight
  */
  constructor(packet) {
    this.datetime = moment.utc(packet.datetime, 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
    this.latitude = packet.latitude;
    this.longitude = packet.longitude;
    this.altitude = packet.altitude;
    this.vertical_velocity = packet.vertical_velocity;
    this.ground_speed = packet.ground_speed;
    this.satellites = packet.satellites;
    this.imei = packet.imei;
    this.input_pins = packet.input_pins;
    this.output_pins = packet.output_pins;
  }

  checkInvalidFields () {
    const bad_fields = [];
    if (typeof this.latitude !== 'number') bad_fields.push('latitude');
    if (typeof this.longitude !== 'number') bad_fields.push('longitude');
    if (typeof this.altitude !== 'number') bad_fields.push('altitude');
    if (typeof this.vertical_velocity !== 'number') bad_fields.push('vertical_velocity');
    if (typeof this.ground_speed !== 'number') bad_fields.push('ground_speed');
    if (typeof this.satellites !== 'number') bad_fields.push('satellites');
    if (typeof this.imei !== 'number') bad_fields.push('imei');
    if (typeof this.input_pins !== 'number') bad_fields.push('input_pins');
    if (typeof this.output_pins !== 'number') bad_fields.push('output_pins');
    return bad_fields;
  }
}

export {FlightPoint}