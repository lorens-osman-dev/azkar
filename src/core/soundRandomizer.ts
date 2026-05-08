/**
 * core/soundRandomizer.ts — Randomized Audio Scheduler
 *
 * Responsibility:
 * - Schedule periodic non-repeating playback of bundled audio assets.
 * - Manage GLib source timers and GSettings state safely.
 */

import GLib from "gi://GLib";
import Gio from "gi://Gio";
import { Logger } from "../utils/logger.js";
import { AudioPlayer } from "./audioPlayer.js";
import { getSoundsData, type SoundsData } from "./sounds.js";

export class SoundRandomizer {
  private readonly _audioPlayer: InstanceType<typeof AudioPlayer>;
  private readonly _soundsData: SoundsData;
  private readonly _settings: Gio.Settings;

  private _unplayedSounds: string[] = [];
  private _timerId: number | null = null;
  private _isActive: boolean = false;
  private _settingsSignalId: number = 0;

  constructor(audioPlayer: InstanceType<typeof AudioPlayer>, extensionPath: string, settings: Gio.Settings) {
    this._audioPlayer = audioPlayer;
    this._settings = settings;
    this._soundsData = getSoundsData(extensionPath);

    this._resetQueue();

    // Bind to GSettings to automatically restart the timer if the user changes the interval
    this._settingsSignalId = this._settings.connect('changed::scheduler-period', () => {
      if (this._isActive) {
        Logger.info("Interval changed by user. Restarting scheduler pipeline...");
        this.restart();
      }
    });
  }

  /**
   * Refills and shuffles the playlist to prevent repetitions.
   */
  private _resetQueue(): void {
    this._unplayedSounds = [...this._soundsData.soundNames];

    // Fisher-Yates Shuffle
    for (let i = this._unplayedSounds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this._unplayedSounds[i], this._unplayedSounds[j]] =
        [this._unplayedSounds[j], this._unplayedSounds[i]];
    }
  }

  /**
   * Reads the current period from GSettings and (re)starts the scheduling loop.
   */
  public restart(): void {
    const periodMinutes = this._settings.get_int("scheduler-period");
    this.start(periodMinutes);
  }

  /**
   * Starts the indefinite randomized scheduler.
   * @param periodMinutes - Playback interval (1, 5, 10, 15, 30, 60)
   */
  public start(periodMinutes: number): void {
    this.stop(); // CLEANUP: Prevent duplicate timers from overlapping

    this._isActive = true;
    const periodSeconds = periodMinutes * 60;

    Logger.info(`Scheduler started: playing random sound every ${periodMinutes} min.`);

    // Schedule playback loop via GLib event loop
    this._timerId = GLib.timeout_add_seconds(
      GLib.PRIORITY_DEFAULT,
      periodSeconds,
      () => {
        if (this._isActive) {
          this._playNextSound();
          return GLib.SOURCE_CONTINUE; // Reschedules the timer
        }
        return GLib.SOURCE_REMOVE;
      },
      null // FIX: Satisfy gi-ts DestroyNotify requirement
    );
  }

  /**
   * Halts the scheduler and stops active audio.
   */
  public stop(): void {
    this._isActive = false;

    // CLEANUP: Unregister GLib source from the main event loop
    if (this._timerId !== null) {
      GLib.Source.remove(this._timerId);
      this._timerId = null;
    }

    this._audioPlayer.stop();
    Logger.info("Scheduler stopped.");
  }

  private _playNextSound(): void {
    if (this._unplayedSounds.length === 0) {
      Logger.info("Deck empty. Reshuffling Azkar queue.");
      this._resetQueue();
    }

    const nextSoundName = this._unplayedSounds.pop();
    if (!nextSoundName) return;

    const soundEntry = this._soundsData.sounds[nextSoundName];
    Logger.info(`Scheduled Playback: ${soundEntry.soundName}`);

    // Relative path for the AudioPlayer context
    this._audioPlayer.play(`src/sounds/${soundEntry.soundFile}`);
  }

  /**
   * Called during extension disable() to free memory.
   */
  public destroy(): void {
    // CLEANUP: Drop timers, disconnect GSettings signals, and flush arrays
    this.stop();

    if (this._settingsSignalId > 0) {
      this._settings.disconnect(this._settingsSignalId);
      this._settingsSignalId = 0;
    }

    this._unplayedSounds = [];
  }
}