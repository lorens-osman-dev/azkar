/**
 * core/audioPlayer.ts — Azkar Audio Manager
 *
 * Responsibility:
 * - Handle low-latency audio playback of bundled MP3 assets using GStreamer.
 * - Ensure strict memory safety and Wayland-native compatibility.
 * * Does NOT:
 * - Access arbitrary user files or prompt file pickers.
 */

import GObject from "gi://GObject";
import Gst from "gi://Gst";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import { Logger } from "../utils/logger.js"; // Adjust import path if necessary

// Fix 1: Type-cast null to satisfy the strict string[] | undefined GI typings 
// while retaining standard GJS runtime behavior for GStreamer initialization.
Gst.init(null as unknown as string[]);

// ─── Audio Manager ───

export const AudioPlayer = GObject.registerClass({
  Signals: {
    'playback-started': {},
    'playback-stopped': {},
  }
}, class AudioPlayer extends GObject.Object {
  private _playbin: Gst.Element | null = null;
  private _bus: Gst.Bus | null = null;
  private _busWatchId: number = 0;
  private readonly _extensionPath: string;

  constructor(extensionPath: string) {
    super();
    this._extensionPath = extensionPath;
    this._initPlayer();
  }

  /**
   * Initializes the GStreamer pipeline and message bus.
   */
  private _initPlayer(): void {
    this._playbin = Gst.ElementFactory.make("playbin", "azkar-playbin");
    if (!this._playbin) {
      Logger.error("AudioPlayer: Failed to create GStreamer playbin.");
      return;
    }

    this._bus = this._playbin.get_bus();
    if (this._bus) {
      this._bus.add_signal_watch();
      this._busWatchId = this._bus.connect("message", this._onBusMessage.bind(this));
    }
  }

  /**
   * Listens for GStreamer state transitions and errors.
   */
  private _onBusMessage(_bus: Gst.Bus, message: Gst.Message): void {
    if (!this._playbin) return;

    switch (message.type) {
      case Gst.MessageType.EOS: // End of Stream
        this.stop();
        break;
      case Gst.MessageType.ERROR:
        // Fix 2: Destructure with safe null handling.
        const [err, debug] = message.parse_error();
        const errorMessage = err?.message ?? debug ?? "Unknown GStreamer error";
        Logger.error(`AudioPlayer GStreamer Error: ${errorMessage}`);
        this.stop();
        break;
    }
  }

  /**
   * Plays a relative audio path bundled within the extension.
   */
  public play(relativePath: string): void {
    if (!this._playbin) return;

    // Safely construct the path using GLib and Gio portal compatibility patterns
    const audioPath = GLib.build_filenamev([this._extensionPath, relativePath]);
    const file = Gio.File.new_for_path(audioPath);

    if (!file.query_exists(null)) {
      Logger.error(`AudioPlayer: Bundled asset not found at ${audioPath}`);
      return;
    }

    this.stop(); // Gracefully reset pipeline before starting new media

    this._playbin.set_property("uri", file.get_uri());
    this._playbin.set_state(Gst.State.PLAYING);
    this.emit('playback-started');
    Logger.info(`Playing bundled audio: ${relativePath}`);
  }

  /**
   * Stops playback and resets the GStreamer state.
   */
  public stop(): void {
    if (!this._playbin) return;

    // Fix 3: Gst.Element.get_state() returns a tuple of [StateChangeReturn, CurrentState, PendingState]
    const [ret, currentState] = this._playbin.get_state(0);

    if (currentState !== Gst.State.NULL) {
      this._playbin.set_state(Gst.State.NULL);
      this.emit('playback-stopped');
      Logger.info("Stopped audio playback.");
    }
  }

  /**
   * Safely queries the GStreamer pipeline for remaining playback time.
   * @returns Remaining time in seconds, or -1 if unknown/unavailable.
   */
  public getRemainingTime(): number {
    if (!this._playbin) return -1;

    // Gst.Format.TIME returns nanoseconds
    const [durSuccess, durationNs] = this._playbin.query_duration(Gst.Format.TIME);
    const [posSuccess, positionNs] = this._playbin.query_position(Gst.Format.TIME);

    if (durSuccess && posSuccess && durationNs > 0) {
      const remainingSeconds = (durationNs - positionNs) / 1_000_000_000;
      return Math.max(0, Math.ceil(remainingSeconds));
    }

    return -1; // Fallback if GStreamer is still negotiating state
  }

  /**
   * Called during extension disable() to free resources.
   */
  public destroy(): void {
    // CLEANUP: Drop GStreamer references and disconnect bus signals
    this.stop();

    if (this._bus) {
      if (this._busWatchId > 0) {
        this._bus.disconnect(this._busWatchId);
        this._busWatchId = 0;
      }
      this._bus.remove_signal_watch();
      this._bus = null;
    }

    this._playbin = null;
  }
});