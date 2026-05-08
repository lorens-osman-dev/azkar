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

  override enable(): void {
    Logger.info("Initializing Azkar Audio Scheduler...");

    const settings = this.getSettings("org.gnome.shell.extensions.azkar");

    // 1. Initialize Pipeline
    this._audioPlayer = new AudioPlayer(this.path);

    // 2. Initialize Scheduler
    this._randomizer = new SoundRandomizer(this._audioPlayer, this.path, settings);

    // 3. Initialize UI and inject dependencies
    this._indicator = new AzkarIndicator(this._audioPlayer, this._randomizer, this.path);
    Main.panel.addToStatusArea(this.uuid, this._indicator);

    // 4. Check GSettings to see if we should auto-start on login/enable
    if (settings.get_boolean("scheduler-enabled")) {
      this._randomizer.restart();
    }
  }

  override disable(): void {
    Logger.info("Tearing down Azkar Extension...");

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