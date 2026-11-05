// Plays the generated audio (assets/audio, ElevenLabs) through Web Audio. Silent, never throwing, when a file is missing or the
// browser has not yet allowed audio (the context is created on the first click or key press).
export class GameAudio {
  private ctx?: AudioContext;
  private master?: GainNode;
  private bufs = new Map<string, Promise<AudioBuffer | null>>();
  private loops = new Map<string, { src: AudioBufferSourceNode; gain: GainNode }>();
  private muted = false;

  constructor() {
    const unlock = () => this.ensure();
    addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);
  }
  private ensure(): AudioContext | undefined {
    try {
      if (!this.ctx) { this.ctx = new AudioContext(); this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 1; this.master.connect(this.ctx.destination); }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch { /* no audio: stay silent */ }
    return this.ctx;
  }
  private load(id: string): Promise<AudioBuffer | null> {
    if (!this.bufs.has(id)) this.bufs.set(id, fetch(`/assets/audio/${id}.mp3`).then(r => (r.ok ? r.arrayBuffer() : Promise.reject())).then(b => this.ctx!.decodeAudioData(b)).catch(() => null));
    return this.bufs.get(id)!;
  }
  /** One-shot. Levels (0..1): effects about 0.8, voice 0.9, so nothing clips and ambience sits underneath. */
  async play(id: string, vol = 0.8) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const b = await this.load(id); if (!b || !this.ctx) return;
    const src = this.ctx.createBufferSource(), g = this.ctx.createGain(); src.buffer = b; g.gain.value = vol; src.connect(g).connect(this.master!); src.start();
  }
  async loop(id: string, vol = 0.2) {
    if (!this.ctx || this.ctx.state !== 'running' || this.loops.has(id)) return;
    const b = await this.load(id); if (!b || !this.ctx || this.loops.has(id)) return;
    const src = this.ctx.createBufferSource(), g = this.ctx.createGain(); src.buffer = b; src.loop = true; g.gain.value = vol; src.connect(g).connect(this.master!); src.start();
    this.loops.set(id, { src, gain: g });
  }
  stopLoops() { for (const { src } of this.loops.values()) { try { src.stop(); } catch { /* already stopped */ } } this.loops.clear(); }
  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 1; }
}
