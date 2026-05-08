/**
 * core/soundRandomizer.ts — Randomized Audio Scheduler
 */

import GLib from "gi://GLib";
import Gio from "gi://Gio";
import { Logger } from "../utils/logger.js";
import { AudioPlayer } from "./audioPlayer.js";
import { getSoundsData, type SoundsData, type SoundEntry } from "./sounds.js";

export interface RandomizerListener {
  onPreActive(sound: SoundEntry, timeUntilPlay: number): void;
  onSoundStarted(sound: SoundEntry): void;
  onSoundCompleted(sound: SoundEntry): void;
  onRandomizerStopped(): void;
}

export class SoundRandomizer {
  private readonly _audioPlayer: InstanceType<typeof AudioPlayer>;
  private readonly _soundsData: SoundsData;
  private readonly _settings: Gio.Settings;

  private _unplayedSounds: string[] = [];
  private _timerId: number | null = null;
  private _isActive: boolean = false;
  private _settingsSignalId: number = 0;
  private _listener: RandomizerListener | null = null;
  private _upcomingSound: SoundEntry | null = null;
  private _periodMinutes: number = 60;

  private readonly PRE_ACTIVE_LEAD_TIME_SEC = 10;

  constructor(audioPlayer: InstanceType<typeof AudioPlayer>, extensionPath: string, settings: Gio.Settings) {
    this._audioPlayer = audioPlayer;
    this._settings = settings;
    this._soundsData = getSoundsData(extensionPath);
    this._resetQueue();

    this._settingsSignalId = this._settings.connect('changed::scheduler-period', () => {
      if (this._isActive) {
        Logger.info("Interval changed. Restarting scheduler pipeline...");
        this.restart();
      }
    });
  }

  public setListener(listener: RandomizerListener): void {
    this._listener = listener;
  }

  private _resetQueue(): void {
    this._unplayedSounds = [...this._soundsData.soundNames];
    // Fisher-Yates Shuffle
    for (let i = this._unplayedSounds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this._unplayedSounds[i], this._unplayedSounds[j]] =
        [this._unplayedSounds[j], this._unplayedSounds[i]];
    }
  }

  public restart(): void {
    const periodMinutes = this._settings.get_int("scheduler-period");
    this.start(periodMinutes);
  }

  /**
   * Manual start invoked by UI/Extension Init. Clears all existing state.
   */
  public start(periodMinutes: number): void {
    this.stop();
    this._isActive = true;
    this._periodMinutes = periodMinutes;

    Logger.info(`Scheduler started: Next Azkar in ${periodMinutes} min.`);
    this._scheduleIdleWait();
  }

  /**
   * Phase 1: Idle Wait (Period minus 10 seconds)
   */
  private _scheduleIdleWait(): void {
    const periodSeconds = this._periodMinutes * 60;
    const waitTimeSeconds = Math.max(1, periodSeconds - this.PRE_ACTIVE_LEAD_TIME_SEC);

    this._timerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, waitTimeSeconds, () => {
      if (!this._isActive) return GLib.SOURCE_REMOVE;

      this._prepareNextSound();
      this._schedulePreActive();

      return GLib.SOURCE_REMOVE;
    }, null);
  }

  /**
   * Phase 2: Pre-Active Countdown (10 seconds)
   */
  private _schedulePreActive(): void {
    this._timerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, this.PRE_ACTIVE_LEAD_TIME_SEC, () => {
      if (!this._isActive) return GLib.SOURCE_REMOVE;

      this._playPreparedSound();

      // Start the next cycle's waiting period IMMEDIATELY, 
      // but DO NOT call stop() on the currently playing audio!
      this._scheduleIdleWait();

      return GLib.SOURCE_REMOVE;
    }, null);
  }

  public stop(): void {
    this._isActive = false;

    // CLEANUP: Unregister GLib source
    if (this._timerId !== null) {
      GLib.Source.remove(this._timerId);
      this._timerId = null;
    }

    this._audioPlayer.stop();
    if (this._listener) this._listener.onRandomizerStopped();
    Logger.info("Scheduler stopped.");
  }

  private _prepareNextSound(): void {
    if (this._unplayedSounds.length === 0) this._resetQueue();

    const nextSoundName = this._unplayedSounds.pop();
    if (!nextSoundName) return;

    this._upcomingSound = this._soundsData.sounds[nextSoundName];
    Logger.info(`Entering Pre-Active state. Scheduled: ${this._upcomingSound.soundName}`);

    if (this._listener) {
      this._listener.onPreActive(this._upcomingSound, this.PRE_ACTIVE_LEAD_TIME_SEC);
    }
  }

  private _playPreparedSound(): void {
    if (!this._upcomingSound) return;

    Logger.info(`Playback Started: ${this._upcomingSound.soundName}`);
    if (this._listener) this._listener.onSoundStarted(this._upcomingSound);

    this._audioPlayer.play(`src/sounds/${this._upcomingSound.soundFile}`);
    this._upcomingSound = null; // Clear the buffer
  }

  public destroy(): void {
    this.stop();
    if (this._settingsSignalId > 0) {
      this._settings.disconnect(this._settingsSignalId);
      this._settingsSignalId = 0;
    }
    this._unplayedSounds = [];
    this._listener = null;
  }
}