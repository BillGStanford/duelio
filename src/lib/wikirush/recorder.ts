// Records a WikiRush run to a video file with Duelio branding burned in.
//
// screen: getDisplayMedia of this tab, composited onto a canvas with our overlay.
// reel:   no permissions; a vertical branded scene is drawn from game state (phones, Safari iOS, etc.).
//
// The caller starts it from a click, calls finish(summary) when the game ends (this plays the
// outro card, stops, and resolves the finished file) and can download it straight away.
import { INTRO_MS, OUTRO_MS, SCREEN_STRIP, drawFrame, type OverlayAssets, type OverlayState } from './overlay';
import type { GameSummary } from './types';

export type RecordMethod = 'screen' | 'reel';

export type RecordingResult = {
  blob: Blob;
  url: string;
  filename: string;
  mime: string;
  bytes: number;
  durationMs: number;
};

const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
];

export function pickMime(): string {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return '';
  return MIME_CANDIDATES.find(m => MediaRecorder.isTypeSupported(m)) || '';
}

export function canReel(): boolean {
  return typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined'
    && typeof HTMLCanvasElement !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function';
}

export function canScreen(): boolean {
  return canReel() && typeof navigator !== 'undefined' && !!navigator.mediaDevices
    && typeof navigator.mediaDevices.getDisplayMedia === 'function'
    && !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function loadImage(src: string, cors = false): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    if (cors) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export class RunRecorder {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private video: HTMLVideoElement | null = null;
  private display: MediaStream | null = null;
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private timer: number | null = null;
  private t0 = 0;
  private outroAt: number | null = null;
  private summary: GameSummary | null = null;
  private assets: OverlayAssets = { mark: null, bgLandscape: null, bgVertical: null, targetThumb: null };
  private thumbUrl = '';
  private mime = '';
  private endedEarly = false;
  onEndedEarly?: () => void;

  constructor(private method: RecordMethod, private getState: () => OverlayState) {
    this.canvas = document.createElement('canvas');
    if (method === 'screen') { this.canvas.width = 1280; this.canvas.height = 720; }
    else { this.canvas.width = 720; this.canvas.height = 1280; }
    const ctx = this.canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas is not available in this browser.');
    this.ctx = ctx;
  }

  /** Must be called from a user gesture for screen mode (browsers require it for the picker). */
  async start(): Promise<void> {
    if (!canReel()) throw new Error('This browser cannot record video.');
    this.mime = pickMime();
    if (this.method === 'screen') {
      if (!canScreen()) throw new Error('Screen capture is not available on this device. Try the vertical reel option.');
      const constraints = { video: { frameRate: 30, displaySurface: 'browser' }, audio: false, preferCurrentTab: true, selfBrowserSurface: 'include' } as unknown as DisplayMediaStreamOptions;
      this.display = await navigator.mediaDevices.getDisplayMedia(constraints);
      const video = document.createElement('video');
      video.muted = true; video.playsInline = true; video.srcObject = this.display;
      await video.play().catch(() => {});
      this.video = video;
      // Record at the page's own shape (not a fixed 16:9 box) so everything on screen is in the video.
      const vw = video.videoWidth || 1280; const vh = video.videoHeight || 720;
      const k = Math.min(1, 1920 / vw);
      const w = vw * k; const hh = vh * k;
      // The overlay scales by the shorter side of the finished canvas, so solve for a strip that is SCREEN_STRIP/720 of it.
      const fullH = w >= hh ? hh / (1 - SCREEN_STRIP / 720) : hh + (SCREEN_STRIP * w) / 720;
      this.canvas.width = Math.round(w / 2) * 2;
      this.canvas.height = Math.round(fullH / 2) * 2;
      this.display.getVideoTracks()[0]?.addEventListener('ended', () => {
        this.endedEarly = true;
        this.onEndedEarly?.();
      });
    }
    const [mark, bgLandscape, bgVertical] = await Promise.all([
      loadImage('/wikirush/wr-mark.png'), loadImage('/wikirush/wr-bg-landscape.jpg'), loadImage('/wikirush/wr-bg-vertical.jpg'),
    ]);
    this.assets = { ...this.assets, mark, bgLandscape, bgVertical };
    const stream = this.canvas.captureStream(30);
    const opts: MediaRecorderOptions = { videoBitsPerSecond: this.method === 'screen' ? 5_000_000 : 4_000_000 };
    if (this.mime) opts.mimeType = this.mime;
    this.rec = new MediaRecorder(stream, opts);
    this.rec.ondataavailable = e => { if (e.data && e.data.size) this.chunks.push(e.data); };
    this.t0 = performance.now();
    this.draw();
    this.rec.start(1000);
    // setInterval keeps frames flowing even when rAF is throttled (e.g. while the picker is up).
    this.timer = window.setInterval(() => this.draw(), 1000 / 30);
  }

  get stoppedByUser() { return this.endedEarly; }

  private draw() {
    const base = this.getState();
    const state = this.summary ? { ...base, summary: this.summary } : base;
    drawFrame(this.ctx, this.canvas.width, this.canvas.height, {
      method: this.method,
      source: this.video,
      state,
      assets: this.assets,
      t: performance.now() - this.t0,
      outroT: this.outroAt === null ? null : performance.now() - this.outroAt,
    });
  }

  /** Lets the overlay show the destination photo (needs a CORS-enabled image; Wikimedia allows it). */
  async setTargetThumb(url: string | undefined) {
    if (!url || url === this.thumbUrl) return;
    this.thumbUrl = url;
    this.assets = { ...this.assets, targetThumb: await loadImage(url, true) };
  }

  /** Plays the outro, stops the recorder and resolves the finished file. */
  async finish(summary: GameSummary): Promise<RecordingResult | null> {
    if (!this.rec) return null;
    this.summary = summary;
    this.outroAt = performance.now();
    await sleep(OUTRO_MS);
    return this.stop(`wikirush-${summary.settings.mode}-${summary.total}`);
  }

  /** Stops without an outro and discards the footage. */
  cancel() {
    void this.stop('', true);
  }

  private async stop(name: string, discard = false): Promise<RecordingResult | null> {
    const rec = this.rec;
    if (this.timer !== null) { window.clearInterval(this.timer); this.timer = null; }
    this.rec = null;
    const stopped = new Promise<void>(resolve => {
      if (!rec || rec.state === 'inactive') return resolve();
      rec.onstop = () => resolve();
      try { rec.requestData(); } catch { /* ignore */ }
      rec.stop();
    });
    await stopped;
    this.display?.getTracks().forEach(t => t.stop());
    this.display = null;
    if (this.video) { this.video.srcObject = null; this.video = null; }
    if (discard || !this.chunks.length) { this.chunks = []; return null; }
    const mime = rec?.mimeType || this.mime || 'video/webm';
    const blob = new Blob(this.chunks, { type: mime });
    this.chunks = [];
    const ext = mime.includes('mp4') ? 'mp4' : 'webm';
    return {
      blob,
      url: URL.createObjectURL(blob),
      filename: `${name || 'wikirush-run'}.${ext}`,
      mime,
      bytes: blob.size,
      durationMs: Math.round(performance.now() - this.t0),
    };
  }
}

export function downloadRecording(r: RecordingResult) {
  const a = document.createElement('a');
  a.href = r.url;
  a.download = r.filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export { INTRO_MS, OUTRO_MS };
