import selfSigned from "selfsigned";
import level from 'level';
import {Client as NatClient} from 'nat-upnp-2';
import { promisify } from 'util';

import WebServer from "./webServer";
import logger from './logger';

export class Server {
  constructor(config = {}) {
    this.config = config;
  }
  async init() {
    const {web = {}, db = {path: '/tmp/rippdb'}, autoSSL = false, external = false} = this.config;

    const database = await level(db.path, { valueEncoding: 'json' });

    if (external) {
      var natClient = new NatClient();
      const ip = await natClient.externalIp();
      try {
        const mapping = await natClient.portMapping({
          public: port,
          private: {
            port
          },
          description: "Reast in Peace Plex Server",
          ttl: 3600,
        });
        logger.warn(`Opened service to the world at ${ip}:${port}`)
      } catch (error) {
        logger.warn(`Unable to map Upnp port:`, error);
      }
    }

    // if (useLetsEncrypt)

    if ((!web.cert && web.certPath) || (!web.privKey && !web.privKeyPath)) {
      let ssl;
      try {
        ssl = await database.get('ssl-key-cert')
      } catch (error) {
        logger.info("Generating self signed certificate.");
        ssl = generateSelfSigned();
        await database.put('ssl-key-cert', ssl);
      }

      Object.assign(web, ssl);
    }

    this.webServer = new WebServer(web);
    await this.webServer.initializeRoutes();
  }
  async listen(port = 1331) {
    await this.webServer.listen(port);
  }
}


function generateSelfSigned() {
  const attrs = [{ name: 'commonName', value: 'localhost' }];
  const {private: privKey, cert} = selfSigned.generate(attrs, { days: 365 });
  return {privKey, cert};
}
