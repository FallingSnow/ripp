import fs, { promises as fsp } from 'fs';
import { dirname, resolve, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

import { graphql } from "graphql";
const ffprobe = promisify(require('fluent-ffmpeg').ffprobe);
import { makeExecutableSchema } from 'graphql-tools';
import { HTTPError } from "ayyo";

import logger from './logger';

const SCRIPT_PATH = dirname(fileURLToPath(import.meta.url));
const VIDEO_EXTENSIONS = new Set(['webm', 'mkv', 'flv', 'vob', 'ogv', 'ogg', 'drc', 'gifv', 'mng', 'avi', 'mts', 'm2ts', 'ts', 'mov', 'qt', 'wmv', 'yuv', 'rm', 'rmvb', 'asf', 'amv', 'mp4', 'm4p', 'm4v', 'mpg', 'mp2', 'mpeg', 'mpe', 'mpv', 'm4v', 'svi', '3gp', '3g2', 'mxf', 'flv', 'f4v', 'f4p']);

const resolvers = {
  Query: {
    libraries: (obj, {name}, context, info) => {
      return [{name: name || "Movies", path: "/home/ayrton/Videos"}];
    },
    directories: async (obj, {at = '/'}, context, info) => {
      logger.trace(`Getting directories at ${at}`)
      const children = await fsp.readdir(at, {withFileTypes: true});
      const directories = children.filter(dirent => dirent.isDirectory());
      const directoryObjects = directories.map(({name}) => ({path: resolve(at, name), relativePath: name}));
      return directoryObjects;
    }
  },
  Library: {
    videos: async library => {
      const paths = await fsp.readdir(library.path);
      const fullPaths = paths.map(video => resolve(library.path, video));
      const videoPaths = fullPaths.filter(path => {
        const ext = extname(path).substring(1);
        return VIDEO_EXTENSIONS.has(ext);
      });
      return videoPaths;
    },
    count: async library => {
      const paths = await fsp.readdir(library.path);
      const videoPaths = paths.filter(path => {
        const ext = extname(path).substring(1);
        return VIDEO_EXTENSIONS.has(ext);
      });
      return videoPaths.length;
    },
  },
  Video: {
    name: path => basename(path.toString(), extname(path.toString())),
    path: path => path.toString(),
    year: path => 1,
    metadata: async path => {
      const metadata = await ffprobe(path);
      // console.log(JSON.stringify(metadata, null, 2))
      return JSON.stringify(metadata, null, 2);
    }
  },
  Mutation: {
    create: {
      library: async (obj, {library}, context, info) => {
        return {name: name || "Movies", path: "/home/ayrton/Videos"};
      }
    }
  }
};

const schema = makeExecutableSchema({
  typeDefs: fs.readFileSync(resolve(SCRIPT_PATH, "./schema.gql"), "utf8"),
  resolvers,
});

export const query = graphql.bind(graphql, schema);
