#!/usr/bin/env -S node -r esm

import {Server} from "../lib";
import logger from '../lib/logger';

logger.level = 'trace';
const server = new Server();

(async() => {
  try {
    await server.init();
    await server.listen(1331, true);
    logger.log("Server ready!");
  } catch (error) {
    logger.error(error);
  }
})();
