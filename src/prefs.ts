/**
 * prefs.ts — Azkar Preferences
 *
 * Runs in a separate GTK4/Adwaita process.
 * Debug: journalctl -f -o cat /usr/bin/gjs
 */

import Adw from "gi://Adw";
import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

export default class AzkarPreferences extends ExtensionPreferences {
  /**
   * Populates the Adwaita Preferences Window.
   */
  override fillPreferencesWindow(window: Adw.PreferencesWindow): Promise<void> {

    // ─── Page: General ───
    const page = new Adw.PreferencesPage({
      title: "General",
      icon_name: "preferences-system-symbolic",
    });
    window.add(page);

    // ─── Group: Status ───
    const statusGroup = new Adw.PreferencesGroup({
      title: "Extension Status",
      description: "GNOME 45+ Adwaita Preferences",
    });
    page.add(statusGroup);

    // ─── Row: Hello World ───
    const helloRow = new Adw.ActionRow({
      title: "Hello from Azkar",
      subtitle: "The user interface has been successfully reset.",
    });
    statusGroup.add(helloRow);

    return Promise.resolve();
  }
}