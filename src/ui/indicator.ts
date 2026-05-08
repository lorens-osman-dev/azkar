/**
 * ui/indicator.ts — Azkar Panel Indicator
 * * Responsibility:
 * - Display the current status of the Azkar audio scheduler in the top panel.
 * - Provide a dropdown menu for manual interactions (e.g., pause, play next).
 */

import GObject from "gi://GObject";
import St from "gi://St";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";

// ─── Azkar Panel Indicator ───

export const AzkarIndicator = GObject.registerClass(
  class AzkarIndicator extends PanelMenu.Button {
    private _statusItem!: PopupMenu.PopupMenuItem;

    constructor() {
      // Initialize the PanelMenu.Button with:
      // 0.0 (alignment), "AzkarIndicator" (name for accessibility), false (create menu immediately)
      super(0.0, "AzkarIndicator", false);

      this._buildUI();
      this._buildMenu();
    }

    /**
     * Constructs the panel icon.
     */
    private _buildUI(): void {
      const box = new St.BoxLayout({
        style_class: "panel-status-menu-box",
      });

      // We use a built-in Adwaita symbolic icon related to audio playback
      const icon = new St.Icon({
        icon_name: "audio-headphones-symbolic",
        style_class: "system-status-icon",
      });

      box.add_child(icon);
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
      // We keep a reference to this so our future audio manager can update the text
      this._statusItem = new PopupMenu.PopupMenuItem("Status: Waiting for schedule...");
      menu.addMenuItem(this._statusItem);
    }

    /**
     * Safely disposes of the widget.
     * Guaranteed to be called during extension disable() via destroy().
     */
    override destroy(): void {
      // CLEANUP: Disconnect any future signals from the GStreamer Audio Manager here.
      // E.g., if we bind a 'playback-started' signal to this UI, drop it before calling super.

      super.destroy();
    }
  }
);