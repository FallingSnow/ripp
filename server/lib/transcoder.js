import { dirname, resolve, extname, basename, parse, format, join } from 'path';
import { spawn } from 'child_process';
import assert from 'assert';
import { tmpdir } from 'os';
import { existsSync } from 'fs';
import { promisify } from 'util';
const ffprobe = promisify(require('fluent-ffmpeg').ffprobe);

import logger from './logger';

const streamFilenameRegex = /Opening.+?_(?<playlist>[0-9]+?)_(?<chunk>[0-9]+?)\.(ts|fmp4|mp4|webm)/g;

export default class Transcoder {
  constructor({targetPath, masterPath, playlistPath, segmentPath, mode = 'hls'}) {

    switch(mode) {
      case 'hls':
        masterPath += '.m3u8';
        playlistPath += '.m3u8';
        segmentPath += '.ts';
        break;
      case 'dash':
        masterPath += '.$ext$';
        masterPath = masterPath.replace(/%v/g, '$RepresentationID$').replace(/%d/g, '$Number$');
        playlistPath += '.mpd';
        segmentPath += '.$ext$';
        segmentType = segmentType.replace(/%v/g, '$RepresentationID$').replace(/%d/g, '$Number$');
        break;
      default:
        throw new Error(`Unknown transcoder mode: ${mode}`);
    }

    Object.assign(this, {
      targetPath, masterPath, playlistPath, segmentPath, mode,
      startTime: 0,
      chunkTarget: 10,
      segmentTime: 4,
      readAheadThrottle: 20,
      state: 'initialized',
      ffmpeg: null
    });
  }

  async capabilities() {
    const hardware = new Set();
    const encoders = [
      {
        type: 'intel',
        path: '/dev/dri/renderD128'
      }
    ].filter(({type, path}) => {
      const exists = existsSync(path);
      logger.debug(`Hardware device (${type}) at ${path} was ${exists ? 'found' : 'not found'}.`);
      return exists;
    });
    encoders.map(({type}) => hardware.add(type));

    const filters = {
      scalers: [
        {
          type: 'intel',
          name: 'scale_vaapi'
        }
      ]
      .filter(({type}) => hardware.has(type))
      .concat([{
        type: 'software',
        name: 'scale',
      }]),
      deinterlacers: [
        {
          type: 'intel',
          name: 'deinterlace_vaapi',
          command: 'deinterlace_vaapi=rate=field:auto=1'
        }
      ]
      .filter(({type}) => hardware.has(type))
      .concat([{
        type: 'software',
        name: 'yadif',
        command: 'yadif'
      }]),
    };

    return {
      filters,
      encoders,
      hardware
    };
  }

  async probe() {
    const {streams, format} = await ffprobe(this.targetPath);
    this.metadata = {
      videoStreams: [],
      audioStreams: [],
      subtitleStreams: [],
      attachmentStreams: [],
      format
    };
    for (let stream of streams) {
      switch (stream.codec_type) {
        case 'video':
          stream.bit_depth = stream.pix_fmt === 'yuv420p' ?
          8 :
            stream.pix_fmt === 'yuv420p10le' ?
            10 :
            0
          this.metadata.videoStreams.push(stream);
        break;
        case 'audio':
          this.metadata.audioStreams.push(stream);
        break;
        case 'subtitle':
          this.metadata.subtitleStreams.push(stream);
        break;
        case 'attachment':
          this.metadata.attachmentStreams.push(stream);
        break;
      }
    }

    return this.metadata;
  }

  static async getAss({targetPath, outputDirPath = tmpdir(), subtitleIdx = 0} = {}) {
    const outputPath = resolve(outputDirPath, `subtitle-${subtitleIdx}.ass`);
    const ffmpegInstance = spawn('ffmpeg', ['-i', targetPath, ...`-c:s ass -map 0:s:${subtitleIdx} -y`.split(' '), outputPath]);

    await new Promise((resolve, reject) => {
      const closeListener = async (code, signal) => {
        logger.debug('FFMPEG ASS CLOSE:', code, signal);
        if (code !== 0 && code !== null)
          return reject(code);
        return resolve();
      };
      ffmpegInstance.stderr.on('data', chunk => logger.trace(chunk.toString()));
      ffmpegInstance.once('close', closeListener.bind(this));
    });

    return outputPath;
  }

  async start() {
    assert(this.state !== 'running');
    this.state = "running";

    await this.probe();

    if (this.mode === 'hls')
      var mode_args = [...`-hls_time ${this.segmentTime} -hls_list_size ${20 + this._calculateTargetChunkLead()} -hls_delete_threshold 5 -hls_flags delete_segments -c:a aac -b:a 128k -b:a:0 96k`.split(' '), '-var_stream_map', 'v:0,a:0 v:1,a:1 v:2,a:2', '-master_pl_name', basename(this.masterPath), '-hls_segment_filename', this.segmentPath];
    else if (this.mode === 'dash')
      var mode_args = [...`-seg_duration ${this.segmentTime} -use_timeline 1 -use_template 1 -window_size ${20 + this._calculateTargetChunkLead()} -extra_window_size 5 -dash_segment_type mp4 -c:a libopus -b:a 80k -b:a:0 32k`.split(' '), '-adaptation_sets', 'id=0,streams=v id=1,streams=a', '-init_seg_name', basename(this.masterPath), '-media_seg_name', basename(this.segmentPath)];


    let args = [...`-probesize 50M -analyzeduration 5M -hwaccel vaapi -init_hw_device vaapi=va:/dev/dri/renderD128 -hwaccel_output_format vaapi -hwaccel_device va -filter_hw_device va -y -i`.split(' '), this.targetPath, '-ss', this.startTime, ...`-c:v h264_vaapi -filter_complex [0:a:0]pan=stereo|FL=FC+0.30*FL+0.30*BL|FR=FC+0.30*FR+0.30*BR,loudnorm=I=-16:TP=-1.5:LRA=11,asplit=3[aud0][aud1][aud2];[0:v]${this.metadata.videoStreams[0].bit_depth === 10 ? 'format=nv12,hwupload,' : ''}deinterlace_vaapi=rate=field:auto=1,split=3[deinter1][deinter2][deinter3];[deinter1]scale_vaapi=w=-16:h=720[medium];[deinter2]scale_vaapi=w=-16:h=360[low] -qp:v:0 24 -qp:v:1 20 -qp:v:2 17 -map [low] -map [aud0] -map: [medium] -map [aud1] -map [deinter3] -map [aud2] -g ${this.segmentTime * 23}`.split(' '), ...`-flags -global_header+low_delay -max_muxing_queue_size 1024 -fflags +genpts`.split(' '), ...mode_args, '-f', this.mode, '-strict', 'experimental', this.playlistPath];

    // logger.trace(args);

    logger.debug(`Starting ffmpeg transcode for ${this.targetPath}`);
    logger.trace(`ffmpeg ${args.join(' ')}`);
    this.ffmpeg = spawn('ffmpeg', args);

    await new Promise((resolve, reject) => {
      const startListener = chunk => {
        logger.trace('FFMPEG STDERR:', chunk.toString());
        if (chunk.toString().includes(`Opening '${this.masterPath}' for writing`)) {
          resolve();
          // Stop listening to ffmpeg stdout
          this.ffmpeg.stderr.off('data', startListener.bind(this));
          this.ffmpeg.stderr.off('close', failListener.bind(this));
        }
      };
      const failListener = async (code, signal) => {
        logger.debug('FFMPEG CLOSE:', code, signal);
        try {
          await this.stop();
        } catch (error) {
          logger.error(error);
        } finally {
          if (code !== 0 && code !== null)
            return reject(code);
          return resolve();
        }
      };
      this.ffmpeg.stderr.on('data', startListener.bind(this));
      this.ffmpeg.once('close', failListener.bind(this));
    });

    this.ffmpeg.stderr.on('data', this.statusListener.bind(this));
    this.ffmpeg.once('close', (code, signal) => {
      logger.debug('FFMPEG CLOSE:', code, signal);
      this.state = 'stopped';
    });

    return this.masterPath;
  }

  _calculateTargetChunkLead() {
    return Math.ceil(this.readAheadThrottle / this.segmentTime);
  }

  syncStateToSentChunkIdx(lastSentChunk) {
    assert(!isNaN(lastSentChunk), "You must send a number to syncStateToSentChunkIdx");
    this.chunkTarget = Math.max(this.chunkTarget, lastSentChunk + this._calculateTargetChunkLead());
    const target = lastSentChunk;
    if (this.lastChunkWritten <= this.chunkTarget) {
      this.resume();
      logger.trace(`Transcoder resumed. ${this.lastChunkWritten} <= ${this.chunkTarget}`)
    }
  }

  statusListener(feed) {
    const data = feed.toString();
    if (streamFilenameRegex.test(data)) {
      streamFilenameRegex.lastIndex = 0;
      const {groups: {chunk}} = streamFilenameRegex.exec(data);
      this.lastChunkWritten = chunk;
      logger.debug("Transcoder: Last written chunk:", this.lastChunkWritten, '\tTarget:', this.chunkTarget);
      if (this.lastChunkWritten >= this.chunkTarget) {
        this.pause();
        logger.trace(`Transcoder throttled. ${this.lastChunkWritten} >= ${this.chunkTarget}`)
      }
    }
  }

  set state(state) {
    logger.debug("Setting transcoder state to", state);
    switch (state) {
      case 'stopped':
        this.ffmpeg.removeAllListeners();
      break;
      case 'paused':
        if (this.state === 'running')
          this.ffmpeg.kill('SIGTSTP');
      break;
      case 'running':
        if (this.state === 'paused')
          this.ffmpeg.kill('SIGCONT');
      break;
    }
    this._state = state;
    logger.trace(`Transcoder ${state}!`);
  }
  get state() {
    return this._state;
  }
  pause() {
    this.state = 'paused';
  }
  resume() {
    this.state = 'running';
  }
  stop() {
    // Killing ffmpeg will trigger the close listener, thus causing the state change
    this.ffmpeg.kill();
  }
}
