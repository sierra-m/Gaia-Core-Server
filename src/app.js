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

import createError from 'http-errors'
import express from 'express'
import path from 'path'
import cookieParser from 'cookie-parser'
import {program} from 'commander';
import {query} from './util/pg'
import logger from 'morgan'
import helmet from 'helmet'
import parseUrl from 'parseurl'
import {redirectToHTTPS} from 'express-http-to-https'
import PinStates from './util/pinstates'
import ModemList from "./util/modems";

// Routes for various endpoints
import metaRouter from './routes/meta'
import flightRouter from './routes/flight'
import assignRouter from './routes/assign'
import updateRouter from './routes/update'
import lastRouter from './routes/last'

async function buildApp (){

  program
      .name('www.js')
      .description('Starts the aurora webserver')
      .version('0.1.0')
      .option('-m, --modems <file>', 'Whitelist of modems in CSV format');

  program.parse();

  const options = program.opts();

  const modemList = new ModemList();
  await modemList.loadModems(options.modems);
  assignRouter.modemList = modemList;
  metaRouter.modemList = modemList;
  flightRouter.modemList = modemList;

  const app = express();

  // For security
  app.use(helmet());

  const useProduction = process.env.NODE_ENV === 'production';

  // TODO: remove this when we know it's working
  console.log(`Starting server with modem list:\n${modemList}`);

  // view engine setup
  app.set('views', path.join(__dirname, 'views'));
  app.set('view engine', 'jade');

  app.use(logger(useProduction ? 'common' : 'dev'));
  app.use(express.json());
  app.use(express.urlencoded({extended: false}));
  app.use(cookieParser());
  app.use(express.static(path.join(__dirname, 'public')));

  /**
   * Checks whether request contains a valid API key param
   * @param req
   * @param res
   * @param next
   * @returns {Promise<void>}
   */
  const authRouter = async (req, res, next) => {
    if (req.query.key) {
      //console.log(`key: ${req.query.key}`);
      const result = await query(`SELECT * FROM public."auth" WHERE token=$1`, [req.query.key]);
      if (result.length > 0) {
        next();
      } else {
        res.status(403);
        res.send('Invalid token.')
      }
    } else {
      res.status(400);
      res.send('Please supply a key');
    }
  };

  /**
   * A global pin states object passed to endpoints `assign` and `update`
   * to pass pin states from Iris to each client
   */
  const pinStates = new PinStates();

  const attachPinStates = async (req, res, next) => {
    req.pinStates = pinStates;
    next();
  };

  app.use('/api/meta', metaRouter);
  app.use('/api/flight', flightRouter);
  app.use('/api/assign', authRouter, attachPinStates, assignRouter);
  app.use('/api/update', attachPinStates, updateRouter);
  app.use('/api/last', authRouter, lastRouter);

  /*
  * REACT APP
  * =========
  * Production build intended to run aurora from directory adjacent
  */
  if (useProduction) {
    app.use(express.static(path.join(__dirname, '/../../Aurora-React/build')));
    app.use(['/tracking', '/404'], async (req, res) => {
      res.sendFile(path.join(__dirname, '/../../Aurora-React/build', 'index.html'));
    });
    app.use('/', function (req, res, next) {
      if (parseUrl.original(req).pathname !== req.baseUrl) return next(); // skip this for strictness
      res.sendFile(path.join(__dirname, '/../../Aurora-React/build', 'index.html'));
    });
  }

  // catch 404 and forward to error handler
  app.use(async (req, res, next) => {
    if (useProduction) {
      res.redirect('/404');
    } else {
      next(createError(404));
    }
  });

  // error handler
  app.use(async (err, req, res, next) => {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
  });
  return app;
}

export default buildApp;
