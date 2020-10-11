import { dirname, resolve, extname, basename, parse, format, join } from 'path';
import { fileURLToPath } from 'url';
import { constants as http2Contants } from 'http2';
import assert from 'assert';
import { tmpdir } from 'os';

import * as Ayyo from "ayyo";

import logger from './logger';
import Transcoder from './transcoder';
import { query } from "./graphql";
import PACKAGE from "../package.json";

const SCRIPT_PATH = dirname(fileURLToPath(import.meta.url));
const filenameParser = /_(?<playlist>[0-9]+?)_(?<chunk>[0-9]+?)\.(ts|fmp4|mp4|webm)$/;

export default class Server extends Ayyo.Server {
  constructor(config) {
    super(config);
    this.router = new Ayyo.Middleware.Router();
    this.eventListeners = {};
    this.transcoders = {};
  }
  onError({req, res, error}) {
      // eslint-disable-next-line no-console
      logger.error(
          `Unable to serve request "${req.url.pathname}"`,
          error.data || error
      );
  }
  async initializeRoutes() {

    const sse = new Ayyo.Middleware.ServerSideEvents({
      method: "GET",
      path: "/sse/{uuid}",
    });
    sse.onConnection = async (client) => {
      this.eventListeners[client.req.params['uuid']] = client;
      logger.trace(`New SSE connection for ${client.req.params['uuid']}`);
      // await client.send('welcome!', 'ping');
    };
    sse.onClose = async (client) => {
      delete this.eventListeners[client.req.params['uuid']];
    };

    const jwt = new Ayyo.Middleware.JsonWebToken({
      secret: '123'
    });

    const routes = [

      new Ayyo.Middleware.Route({
        method: "GET",
        path: "/info",
        handler: async function gql({req, res}) {
          const {name, version} = PACKAGE;
          res.body = {
            name,
            version
          };
        }
      }),
      // Graphql Endpoint
      new Ayyo.Middleware.Route({
        method: "POST",
        path: "/gql",
        handler: async function gql({req, res}) {
          const {data, errors} = await query(req.body.query, null, req.jwt);
          if (errors) {
            throw new Ayyo.HTTPError(http2Contants.HTTP_STATUS_UNPROCESSABLE_ENTITY, {errors});
          }
          res.body = {data};
        }
      }),
      sse,

      new Ayyo.Middleware.Route({
        method: "GET",
        path: "/transcode/subtitle",
        handler: async ({req, res, stream}) => {
          res.file = await Transcoder.getAss({targetPath: req.query.path});
        }
      }),
      new Ayyo.Middleware.Route({
        method: "GET",
        path: "/transcode/video",
        // chain: [jwt],
        handler: async ({req, res, stream}) => {
          if (this.transcoders['123']) {
            this.transcoders['123'].stop();
            delete this.transcoders['123'];
          }

          switch(req.query.type) {
            case 'application/x-mpegURL':
              var mode = 'hls';
              break;
            case 'application/dash+xml':
              var mode = 'dash';
              break;
            default:
              throw new Ayyo.HTTPError(400, `Unknown transcode type: ${req.query.type}`);
          }

          const path = req.query.path;
          const tempFilePath = resolve(tmpdir(), `123_%v`);
          const tempSegmentPath = resolve(tmpdir(), `123_%v_%d`);
          const tempMasterFilePath = resolve(tmpdir(), `123.master`);
          logger.trace('Writing to temp files:', {tempFilePath, tempMasterFilePath});

          try {
            var transcoder = new Transcoder({targetPath: path, masterPath: tempMasterFilePath, playlistPath: tempFilePath, segmentPath: tempSegmentPath, mode});
          } catch (e) {
            throw new Ayyo.HTTPError(500, `Unable to initialize transcoder`, e);
          }
          const masterFilePath = await transcoder.start();
          this.transcoders['123'] = transcoder;

          console.log(masterFilePath)
          res.file = masterFilePath;
        }
      }),
      new Ayyo.Middleware.Route({
        method: "GET",
        path: "/transcode/{file}",
        handler: async ({req, res, stream}) => {
          const transcoder = this.transcoders['123'];
          assert(transcoder, 'No encoder running');
          const file = decodeURIComponent(req.params.file);
          logger.debug(`Request for file:`, file);

          if (file.endsWith('.ts')) {
            const {groups: {playlist, chunk}} = filenameParser.exec(file);
            transcoder.syncStateToSentChunkIdx(parseInt(chunk));
          }

          res.file = resolve(tmpdir(), file);
        }
      }),
      new Ayyo.Middleware.Static({
        directory: tmpdir(),
        path: "/hls"
      }),
      new Ayyo.Middleware.Static({
        directory: resolve(SCRIPT_PATH, "../web/public"),
        path: ""
      })
    ];

    for (const route of routes) {
      await this.router.use(route);
    }

    await this.use(new Ayyo.Middleware.Limiter());
    await this.use(new Ayyo.Middleware.Cors());
    await this.use(this.router);

    logger.trace('Web server routes initialized');
  }
}
