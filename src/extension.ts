/**
 * extension.ts — Azkar GNOME Shell Extension
 */

import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import { Logger } from "./utils/logger.js";
import { AzkarIndicator } from "./ui/indicator.js";
import { AudioPlayer } from "./core/audioPlayer.js";
import { SoundRandomizer } from "./core/soundRandomizer.js";

export default class AzkarExtension extends Extension {
  private _indicator: InstanceType<typeof AzkarIndicator> | null = null;
  private _audioPlayer: InstanceType<typeof AudioPlayer> | null = null;
  private _randomizer: InstanceType<typeof SoundRandomizer> | null = null;

  // Track the GSettings listener for memory-safe teardown
  private _enabledSignalId: number = 0;

  override enable(): void {
    Logger.info("Initializing Azkar Audio Scheduler...");


    const settings = this.getSettings("org.gnome.shell.extensions.azkar");

    // 1. Initialize Pipeline
    this._audioPlayer = new AudioPlayer(this.path);

    // 2. Initialize Scheduler
    this._randomizer = new SoundRandomizer(this._audioPlayer, this.path, settings);

    // 3. Initialize UI and inject dependencies
    this._indicator = new AzkarIndicator(
      this._audioPlayer,
      this._randomizer,
      this.path,
      () => {
        Logger.info("Right-click detected. Opening Azkar Preferences...");
        this.openPreferences();
      },
      settings
    );
    // 1. GNOME Shell adds it to the panel (which forces it to be visible)
    Main.panel.addToStatusArea(this.uuid, this._indicator);

    // 2. FIX: Immediately apply our visibility logic AFTER it is mounted
    this._indicator.updateVisibility();

    // 4. LIVE LISTENER: React to the user toggling the switch in Adwaita Prefs
    this._enabledSignalId = settings.connect('changed::scheduler-enabled', () => {
      const isEnabled = settings.get_boolean("scheduler-enabled");
      if (isEnabled) {
        Logger.info("User toggled Preferences: ENABLED. Starting scheduler...");
        this._randomizer?.restart();
      } else {
        Logger.info("User toggled Preferences: DISABLED. Halting scheduler and audio...");
        this._randomizer?.stop();
      }
    });

    // 5. Initial Boot Check
    if (settings.get_boolean("scheduler-enabled")) {
      Logger.info("Extension loaded with scheduler ON. Starting...");
      this._randomizer.restart();
    } else {
      Logger.info("Extension loaded with scheduler OFF. Waiting for user interaction.");
    }
  }

  override disable(): void {
    Logger.info("Tearing down Azkar Extension...");

    const settings = this.getSettings("org.gnome.shell.extensions.azkar");

    // CLEANUP: Disconnect the GSettings signal to prevent memory leaks
    if (this._enabledSignalId > 0) {
      settings.disconnect(this._enabledSignalId);
      this._enabledSignalId = 0;
    }

    // UI Teardown
    if (this._indicator) {
      this._indicator.destroy();
      this._indicator = null;
    }

    // Scheduler Teardown
    if (this._randomizer) {
      this._randomizer.destroy();
      this._randomizer = null;
    }

    // Audio Pipeline Teardown
    if (this._audioPlayer) {
      this._audioPlayer.destroy();
      this._audioPlayer = null;
    }
  }
}