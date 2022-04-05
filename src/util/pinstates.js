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

// Size limit built in to prevent ever-expanding object in bug scenario
const maxIMEIs = 100;

/**
 * Stores the recent pin states for up to `maxIMEIs` imeis
 */
export default class PinStates {
  imeis = []; // For order and size tracking
  log = {};  // Parallel obj for storing actual data

  add (imei, input, output) {
    this.log[imei] = {
      input_pins: input,
      output_pins: output
    };
    if (!this.imeis.includes(imei)) {
      this.imeis.push(imei);  // Add new imei to end of queue

      // Check exceeding log length
      if (this.imeis.length > maxIMEIs) {
        delete this.log[this.imeis[0]];  // Delete log entry defined by first imei in queue
        this.imeis.shift();  // Delete first imei in queue
      }
    }
  }

  get (imei) {
    return this.log.hasOwnProperty(imei) ? this.log[imei] : undefined;
  }
}