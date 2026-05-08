/**
 * extension.ts — Azkar GNOME Shell Extension
 * */

import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import { Logger } from "./utils/logger.js";
import { AzkarIndicator } from "./ui/indicator.js";
import { AudioPlayer } from "./core/audioPlayer.js";
import { SoundRandomizer } from "./core/soundRandomizer.js";


export default class AzkarExtension extends Extension {
  private _indicator: InstanceType<typeof AzkarIndicator> | null = null;
  private _audioPlayer: InstanceType<typeof AudioPlayer> | null = null;
  private _randomizer: SoundRandomizer | null = null;

  /**
   * Called when the extension is enabled.
   */
  override enable(): void {
    const settings = this.getSettings();
    this._audioPlayer = new AudioPlayer(this.path);

    // Initialize the scheduler
    this._randomizer = new SoundRandomizer(this._audioPlayer, this.path, settings);
    this._randomizer.restart();
  }
  /**
   * Called when the extension is disabled.
   * We must ensure strict memory safety here by dropping all references.
   */
  override disable(): void {
    if (this._randomizer) {
      this._randomizer.destroy();
      this._randomizer = null;
    }
    if (this._audioPlayer) {
      this._audioPlayer.destroy();
      this._audioPlayer = null;
    }
  }
}