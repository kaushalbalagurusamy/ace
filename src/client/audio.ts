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
  private motor?: { saw: OscillatorNode; sub: OscillatorNode; gain: GainNode };
  /** Electric whir of the cart (synthesised, PRD/07): pitch and level follow speed; level 0 is silent. */
  whir(level: number) {
    const c = this.ctx; if (!c || c.state !== 'running') return;
    if (!this.motor) {
      const saw = c.createOscillator(), sub = c.createOscillator(), lp = c.createBiquadFilter(), gain = c.createGain();
      saw.type = 'sawtooth'; sub.type = 'sine'; lp.type = 'lowpass'; lp.frequency.value = 900; gain.gain.value = 0;
      saw.connect(lp); sub.connect(lp); lp.connect(gain).connect(this.master!); saw.start(); sub.start();
      this.motor = { saw, sub, gain };
    }
    const t = c.currentTime, f = 110 + 420 * level;
    this.motor.saw.frequency.setTargetAtTime(f, t, 0.08); this.motor.sub.frequency.setTargetAtTime(f / 2, t, 0.08);
    this.motor.gain.gain.setTargetAtTime(level > 0.01 ? 0.03 + 0.07 * level : 0, t, 0.1);
  }
  /** Bump: a short noise burst over a falling thump (synthesised). strength 0..1. */
  bump(strength: number) {
    const c = this.ctx; if (!c || c.state !== 'running') return;
    const t = c.currentTime, n = Math.floor(c.sampleRate * 0.18), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (n / 6));
    const noise = c.createBufferSource(), thump = c.createOscillator(), g = c.createGain(), v = 0.25 + 0.55 * Math.min(1, strength);
    noise.buffer = buf; thump.frequency.setValueAtTime(95, t); thump.frequency.exponentialRampToValueAtTime(40, t + 0.2);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    noise.connect(g); thump.connect(g); g.connect(this.master!); noise.start(t); thump.start(t); thump.stop(t + 0.25);
  }
  stopLoops() { for (const { src } of this.loops.values()) { try { src.stop(); } catch { /* already stopped */ } } this.loops.clear(); }
  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 1; }
}
