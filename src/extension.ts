/**
 * extension.ts — Azkar GNOME Shell Extension
 * 
 */

import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import { Logger } from "./utils/logger.js";
import { AzkarIndicator } from "./ui/indicator.js";

export default class AzkarExtension extends Extension {
  private _indicator: InstanceType<typeof AzkarIndicator> | null = null;

  /**
   * Called when the extension is enabled.
   */
  override enable(): void {
    Logger.info("Initializing Azkar Audio Scheduler...");

    // Instantiate and inject the indicator into the GNOME top panel
    this._indicator = new AzkarIndicator();
    Main.panel.addToStatusArea(this.uuid, this._indicator);
  }

  /**
   * Called when the extension is disabled.
   * We must ensure strict memory safety here by dropping all references.
   */
  override disable(): void {
    Logger.info("Tearing down Azkar Extension...");

    // CLEANUP: Destroy the UI indicator. This removes it from the panel
    // and triggers the `destroy()` method inside AzkarIndicator.
    if (this._indicator) {
      this._indicator.destroy();
      this._indicator = null;
    }

    // CLEANUP: Future GStreamer pipelines and GLib timeouts 
    // will be explicitly nullified and disconnected here.
  }
}