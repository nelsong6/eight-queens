/**
 * AnimationClock drives a fractional playhead via requestAnimationFrame.
 * floor(playhead) = current generation index.
 * Fractional part = interpolation between generations.
 */
export class AnimationClock {
  private rafId: number | null = null;
  private lastTimestamp = 0;
  private _playhead = -1;
  private _generationsPerMs = 0.002; // speed=1 → 1/500
  private _running = false;

  // Fast-sweep state
  private sweepMode = false;
  private sweepTarget = 0;
  private sweepDuration = 600;
  private sweepStartTime = 0;
  private sweepStartPlayhead = 0;
  private sweepEasing: 'ease-out' | 'ease-in-out' = 'ease-out';

  // Clamping: max playhead the clock is allowed to reach
  maxPlayhead = 0;

  // Speed multiplier (e.g. stepsPerTick) — boundaries fire N× faster
  speedMultiplier = 1;

  // Callbacks
  onBoundary: ((generationIndex: number) => void) | null = null;
  onTick: ((playhead: number, dt: number) => void) | null = null;
  onSweepComplete: (() => void) | null = null;

  get playhead(): number {
    return this._playhead;
  }

  get running(): boolean {
    return this._running;
  }

  /** Convert UI speed (1-500) to internal rate */
  setSpeed(uiSpeed: number): void {
    const delayMs = Math.max(1, 501 - uiSpeed);
    this._generationsPerMs = 1 / delayMs;
  }

  /** Snap playhead to a specific value (for back/redo navigation) */
  setPlayhead(value: number): void {
    this._playhead = value;
  }

  /** Start the rAF loop */
  start(): void {
    if (this._running) return;
    this._running = true;
    this.lastTimestamp = 0;
    this.rafId = requestAnimationFrame(this.tick);
  }

  /** Stop the rAF loop; playhead freezes where it is */
  stop(): void {
    this._running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /** Enter fast-sweep mode: animate playhead to target over duration */
  startSweep(targetGen: number, durationMs = 600, easing: 'ease-out' | 'ease-in-out' = 'ease-out'): void {
    this.sweepMode = true;
    this.sweepTarget = targetGen;
    this.sweepDuration = durationMs;
    this.sweepEasing = easing;
    this.sweepStartTime = 0; // will be set on first tick
    this.sweepStartPlayhead = this._playhead;

    // Ensure the rAF loop is running
    if (!this._running) {
      this._running = true;
      this.lastTimestamp = 0;
      this.rafId = requestAnimationFrame(this.tick);
    }
  }

  /** Immediately complete any in-progress sweep, firing onSweepComplete */
  finishSweepImmediate(): void {
    if (!this.sweepMode) return;
    this.sweepMode = false;
    this._playhead = this.sweepTarget;
    if (this.onTick) this.onTick(this._playhead, 0);
    const cb = this.onSweepComplete;
    this.onSweepComplete = null;
    if (cb) cb();
    this._running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /** Reset playhead to 0 and stop */
  reset(): void {
    this.stop();
    this._playhead = -1;
    this.maxPlayhead = 0;
    this.sweepMode = false;
    this.speedMultiplier = 1;
  }

  private tick = (timestamp: number): void => {
    if (!this._running) return;

    if (this.lastTimestamp === 0) {
      this.lastTimestamp = timestamp;
      if (this.sweepMode && this.sweepStartTime === 0) {
        this.sweepStartTime = timestamp;
      }
      this.rafId = requestAnimationFrame(this.tick);
      return;
    }

    const dt = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;

    const oldPlayhead = this._playhead;
    let newPlayhead: number;

    if (this.sweepMode) {
      // Fast-sweep: ease-out cubic from start to target
      if (this.sweepStartTime === 0) this.sweepStartTime = timestamp;
      const elapsed = timestamp - this.sweepStartTime;
      const t = Math.min(elapsed / this.sweepDuration, 1);
      const eased = this.sweepEasing === 'ease-in-out'
        ? (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
        : 1 - Math.pow(1 - t, 3);
      newPlayhead = this.sweepStartPlayhead + (this.sweepTarget - this.sweepStartPlayhead) * eased;

      if (t >= 1) {
        newPlayhead = this.sweepTarget;
        this.sweepMode = false;
        this._playhead = newPlayhead;
        // Fire tick before completing sweep
        if (this.onTick) this.onTick(this._playhead, dt);
        if (this.onSweepComplete) this.onSweepComplete();
        // Stop the loop after sweep if nothing else needs it
        // (the orchestrator will restart if needed)
        this._running = false;
        return;
      }
    } else {
      // Normal mode: advance at constant rate, clamped to maxPlayhead
      const advance = dt * this._generationsPerMs * this.speedMultiplier;
      newPlayhead = Math.min(oldPlayhead + advance, this.maxPlayhead);
    }

    // Detect boundary crossings (skip during sweep — state already set)
    if (!this.sweepMode && this.onBoundary) {
      const oldFloor = Math.floor(oldPlayhead);
      const newFloor = Math.floor(newPlayhead);
      for (let gen = oldFloor + 1; gen <= newFloor; gen++) {
        this.onBoundary(gen);
      }
    }

    this._playhead = newPlayhead;

    if (this.onTick) {
      this.onTick(this._playhead, dt);
    }

    if (this._running) {
      this.rafId = requestAnimationFrame(this.tick);
    }
  };
}
