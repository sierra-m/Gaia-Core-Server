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

import TokenGenerator from 'uuid-token-generator'
import {query} from '../util/pg'
import readline from 'readline'


const rl = readline.createInterface(process.stdin, process.stdout);

const clientName = () => {
  return new Promise((resolve, reject) => {
    rl.question('Client name? ', (answer) => {
      resolve(answer)
    })
  })
};

const tokenSize = () => {
  return new Promise((resolve, reject) => {
    rl.question('Token size? ', (answer) => {
      resolve(parseInt(answer))
    })
  })
};

const main =  async () => {
  const client = await clientName();
  const size = await tokenSize();
  const token = (new TokenGenerator(size, TokenGenerator.BASE62)).generate();
  console.log(`Token ${token} generated for client ${client}.`);
  const result = await query(
      `INSERT INTO public."auth" (client, token) VALUES ($1, $2)`,
      [client, token]
  );
};

main();
