/**
 * ui/indicator.ts — Azkar Panel Indicator
 * * Responsibility:
 * - Display the current status of the Azkar audio scheduler in the top panel.
 * - Provide a dropdown menu for manual interactions (e.g., pause, play next).
 */

import GObject from "gi://GObject";
import St from "gi://St";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import { AudioPlayer } from "../core/audioPlayer.js";

// ─── Azkar Panel Indicator ───

export const AzkarIndicator = GObject.registerClass(
  class AzkarIndicator extends PanelMenu.Button {
    private _statusItem!: PopupMenu.PopupMenuItem;
    private _playStopItem!: PopupMenu.PopupMenuItem;
    private _icon!: St.Icon;

    private _audioPlayer: InstanceType<typeof AudioPlayer>;
    private _extensionPath: string;
    private _isPlaying: boolean = false;

    private _startedSignalId: number;
    private _stoppedSignalId: number;

    constructor(audioPlayer: InstanceType<typeof AudioPlayer>, extensionPath: string) {
      super(0.0, "AzkarIndicator", false);

      this._audioPlayer = audioPlayer;
      this._extensionPath = extensionPath;

      this._buildUI();
      this._buildMenu();

      this._startedSignalId = this._audioPlayer.connect('playback-started', this._onPlaybackStarted.bind(this));
      this._stoppedSignalId = this._audioPlayer.connect('playback-stopped', this._onPlaybackStopped.bind(this));
    }
    /**
     * Constructs the panel icon.
     */
    private _buildUI(): void {
      const box = new St.BoxLayout({
        style_class: "panel-status-menu-box",
      });

      // UPDATE: Target the -symbolic.svg asset so Clutter creates a recolorable mask
      const iconPath = GLib.build_filenamev([this._extensionPath, "assets", "moon-symbolic.svg"]);
      const iconFile = Gio.File.new_for_path(iconPath);

      const gicon = new Gio.FileIcon({ file: iconFile });

      this._icon = new St.Icon({
        gicon: gicon as any,
        // UPDATE: Use our custom base CSS class
        style_class: "system-status-icon azkar-indicator-icon",
      });

      box.add_child(this._icon);
      this.add_child(box);
    }

    /**
     * Constructs the dropdown menu items.
     */
    private _buildMenu(): void {
      const menu = this.menu as PopupMenu.PopupMenu;

      // Title item (non-interactive)
      const titleItem = new PopupMenu.PopupMenuItem("Azkar Audio Scheduler", { reactive: false });
      menu.addMenuItem(titleItem);

      menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      // Status indicator item
      this._statusItem = new PopupMenu.PopupMenuItem("Status: Waiting for schedule...");
      menu.addMenuItem(this._statusItem);

      // Fix: Use PopupMenuItem instead of MenuItem
      this._playStopItem = new PopupMenu.PopupMenuItem("Play Salat Reminder");
      this._playStopItem.connect('activate', () => {
        if (this._isPlaying) {
          this._audioPlayer.stop();
        } else {
          // Extension relative lookup for bundled assets
          this._audioPlayer.play("src/sounds/salat.mp3");
        }
      });
      menu.addMenuItem(this._playStopItem);
    }

    private _onPlaybackStarted(): void {
      this._isPlaying = true;
      this._playStopItem.label.text = "Stop Salat Reminder";
      this._statusItem.label.text = "Status: Playing audio...";

      // CSS STATE: Add the active class to tint the icon green
      this._icon.add_style_class_name('azkar-indicator-icon-active');
    }

    private _onPlaybackStopped(): void {
      this._isPlaying = false;
      this._playStopItem.label.text = "Play Salat Reminder";
      this._statusItem.label.text = "Status: Waiting for schedule...";

      // CSS STATE: Remove the active class to revert to panel default
      this._icon.remove_style_class_name('azkar-indicator-icon-active');
    }

    /**
     * Safely disposes of the widget.
     * Guaranteed to be called during extension disable() via destroy().
     */
    override destroy(): void {
      // CLEANUP: Disconnect any future signals from the GStreamer Audio Manager here.
      if (this._startedSignalId) this._audioPlayer.disconnect(this._startedSignalId);
      if (this._stoppedSignalId) this._audioPlayer.disconnect(this._stoppedSignalId);

      super.destroy();
    }
  }
);