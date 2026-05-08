/**
 * prefs.ts — Azkar Preferences
 * Runs in a separate GTK4/Adwaita process.
 */

import Adw from "gi://Adw";
import Gio from "gi://Gio";
import Gtk from "gi://Gtk";
import GObject from "gi://GObject";
import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";


export default class AzkarPreferences extends ExtensionPreferences {
  override fillPreferencesWindow(window: Adw.PreferencesWindow): Promise<void> {
    const settings = this.getSettings("org.gnome.shell.extensions.azkar");

    const page = new Adw.PreferencesPage({
      title: "General",
      icon_name: "preferences-system-symbolic",
    });
    window.add(page);

    // ─── Group: Scheduler ───
    const schedulerGroup = new Adw.PreferencesGroup({
      title: "Audio Scheduler",
      description: "Manage randomized playback intervals.",
    });
    page.add(schedulerGroup);

    // ─── Row: Enable Toggle ───
    const enableRow = new Adw.SwitchRow({
      title: "Enable Automatic Reminders",
      subtitle: "Starts or stops the random audio scheduler.",
    });

    //   2: Cast enableRow to satisfy gi-ts strict object inheritance missing the GJS 'connectObject' patch
    settings.bind(
      "scheduler-enabled",
      enableRow as any,
      "active",
      Gio.SettingsBindFlags.DEFAULT
    );
    schedulerGroup.add(enableRow);

    // ─── Row: Interval Dropdown ───
    const periods = [1, 5, 10, 15, 30, 60];
    const periodLabels = ["1 Minute", "5 Minutes", "10 Minutes", "15 Minutes", "30 Minutes", "1 Hour"];

    //   1: Use GTK4's native StringList for optimized memory management
    const model = Gtk.StringList.new(periodLabels);

    const intervalRow = new Adw.ComboRow({
      title: "Playback Interval",
      subtitle: "Time between reminders.",
      model: model,
    });

    // Synchronize UI dropdown with current GSettings value
    const currentPeriod = settings.get_int("scheduler-period");
    const currentIndex = periods.indexOf(currentPeriod);
    if (currentIndex !== -1) {
      intervalRow.selected = currentIndex;
    }

    // Listen for UI changes and update GSettings
    intervalRow.connect("notify::selected", () => {
      const selectedMinutes = periods[intervalRow.selected];
      settings.set_int("scheduler-period", selectedMinutes);
    });

    schedulerGroup.add(intervalRow);

    // ─── Row: Hide Indicator Toggle ───
    const hideIdleRow = new Adw.SwitchRow({
      title: "Hide Indicator When Idle",
      subtitle: "Only show the top panel icon during countdowns and playback.",
    });

    // Cast to GObject.Object to satisfy gi-ts strict typing
    settings.bind(
      "hide-indicator-idle",
      hideIdleRow as any,
      "active",
      Gio.SettingsBindFlags.DEFAULT
    );
    schedulerGroup.add(hideIdleRow);

    return Promise.resolve();
  }
}