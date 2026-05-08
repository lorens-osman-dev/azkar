import GObject from "gi://GObject";
import St from "gi://St";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Clutter from "gi://Clutter";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import { AudioPlayer } from "../core/audioPlayer.js";
import { SoundRandomizer, type RandomizerListener } from "../core/soundRandomizer.js";
import type { SoundEntry } from "../core/sounds.js";

export const AzkarIndicator = GObject.registerClass(
  class AzkarIndicator extends PanelMenu.Button implements RandomizerListener {
    private _icon!: St.Icon;
    private _timerLabel!: St.Label;

    private _audioPlayer: InstanceType<typeof AudioPlayer>;
    private _randomizer: InstanceType<typeof SoundRandomizer>;
    private _extensionPath: string;

    private _preActiveTimerId: number | null = null;
    private _playbackTimerId: number | null = null;

    private _stoppedSignalId: number;

    constructor(
      audioPlayer: InstanceType<typeof AudioPlayer>,
      randomizer: InstanceType<typeof SoundRandomizer>,
      extensionPath: string
    ) {
      super(0.0, "AzkarIndicator", false);

      this._audioPlayer = audioPlayer;
      this._randomizer = randomizer;
      this._extensionPath = extensionPath;

      this._buildUI();

      // Register this indicator as the listener for scheduler events
      this._randomizer.setListener(this);

      // Listen to AudioPlayer for unexpected stops (e.g., user manual stop)
      this._stoppedSignalId = this._audioPlayer.connect('playback-stopped', this._onPlaybackStopped.bind(this));
    }

    private _buildUI(): void {
      const box = new St.BoxLayout({
        style_class: "panel-status-menu-box azkar-indicator-box",
        vertical: false,
      });

      const iconPath = GLib.build_filenamev([this._extensionPath, "assets", "moon-symbolic.svg"]);
      const iconFile = Gio.File.new_for_path(iconPath);
      const gicon = new Gio.FileIcon({ file: iconFile });

      this._icon = new St.Icon({
        gicon: gicon as any,
        style_class: "system-status-icon azkar-indicator-icon",
      });

      // Implement the numeric timer label per specs
      this._timerLabel = new St.Label({
        text: "",
        y_align: Clutter.ActorAlign.CENTER,
        style_class: "azkar-indicator-timer",
        visible: false, // Hidden in Idle state
      });

      box.add_child(this._icon);
      box.add_child(this._timerLabel);
      this.add_child(box);
    }

    // ─── State Transitions ───

    public onPreActive(sound: SoundEntry, timeUntilPlay: number): void {
      this._clearTimers();
      this._resetStyles();

      let timeLeft = timeUntilPlay;
      this._timerLabel.text = `${timeLeft}`;
      this._timerLabel.visible = true;
      this._icon.add_style_class_name('azkar-indicator-icon-pre-active');

      // Pre-active 10s countdown
      this._preActiveTimerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
        timeLeft -= 1;
        if (timeLeft > 0) {
          this._timerLabel.text = `${timeLeft}`;
          return GLib.SOURCE_CONTINUE;
        }
        return GLib.SOURCE_REMOVE;
      }, null);
    }

    public onSoundStarted(sound: SoundEntry): void {
      this._clearTimers();
      this._resetStyles();

      this._icon.add_style_class_name('azkar-indicator-icon-active');
      this._timerLabel.visible = true;

      // Active state duration polling
      this._playbackTimerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
        const remaining = this._audioPlayer.getRemainingTime();

        if (remaining > 0) {
          this._timerLabel.text = `${remaining}`;
        } else if (remaining === -1) {
          this._timerLabel.text = "?"; // GStreamer recovery/fallback
        } else {
          // If 0, audio is finishing up. We let 'playback-stopped' handle the state teardown.
          this._timerLabel.text = "0";
        }

        return GLib.SOURCE_CONTINUE;
      }, null);
    }

    public onSoundCompleted(sound: SoundEntry): void {
      this._returnToIdle();
    }

    public onRandomizerStopped(): void {
      this._returnToIdle();
    }

    private _onPlaybackStopped(): void {
      // Catch-all for when GStreamer EOS fires or the user clicks "Stop"
      this._returnToIdle();
    }

    // ─── Memory Safety & Teardown ───

    private _returnToIdle(): void {
      this._clearTimers();
      this._resetStyles();
      this._timerLabel.visible = false;
      this._timerLabel.text = "";
    }

    private _resetStyles(): void {
      this._icon.remove_style_class_name('azkar-indicator-icon-pre-active');
      this._icon.remove_style_class_name('azkar-indicator-icon-active');
    }

    private _clearTimers(): void {
      if (this._preActiveTimerId !== null) {
        GLib.Source.remove(this._preActiveTimerId);
        this._preActiveTimerId = null;
      }
      if (this._playbackTimerId !== null) {
        GLib.Source.remove(this._playbackTimerId);
        this._playbackTimerId = null; GLib.PRIORITY_DEFAULT, 1, () => {
          const remaining = this._audioPlayer.getRemainingTime();

          if (remaining > 0) {
            this._timerLabel.text = `${remaining}`;
          } else if (remaining === -1) {
            this._timerLabel.text = "?"; // GStreamer recovery/fallback
          } else {
            // If 0, audio is finishing up. We let 'playback-stopped' handle the state teardown.
            this._timerLabel.text = "0";
          }

          return GLib.SOURCE_CONTINUE;
        }
      }
    }

    override destroy(): void {
      // CLEANUP: Drop all GLib sources and GObject signals
      this._clearTimers();
      if (this._stoppedSignalId) {
        this._audioPlayer.disconnect(this._stoppedSignalId);
      }
      super.destroy();
    }
  }
);