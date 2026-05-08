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

    // ─── Resolve Asset Paths ───
    const logoPath = `${this.path}/assets/AZKAR-LOGO-300.svg`;

    // ─── Page: General ───
    const page = new Adw.PreferencesPage({
      title: "General",
      icon_name: "preferences-system-symbolic",
    });
    window.add(page);

    // ─── Group: Scheduler ───
    const schedulerGroup = new Adw.PreferencesGroup({
      title: "Azkar settings",
    });
    page.add(schedulerGroup);

    // Row: Enable Toggle
    const enableRow = new Adw.SwitchRow({
      title: "Enable Azkar player",
      subtitle: "When ON, plays a random Azkar sound repeatedly at your chosen time period.",
    });
    settings.bind(
      "scheduler-enabled",
      enableRow as any,
      "active",
      Gio.SettingsBindFlags.DEFAULT
    );
    schedulerGroup.add(enableRow);

    // Row: Interval Dropdown
    const periods = [1, 5, 10, 15, 30, 60];
    const periodLabels = ["1 Minute", "5 Minutes", "10 Minutes", "15 Minutes", "30 Minutes", "1 Hour"];
    const model = Gtk.StringList.new(periodLabels);

    const intervalRow = new Adw.ComboRow({
      title: "Period",
      subtitle: "Time between Azkar.",
      model: model,
    });

    const currentPeriod = settings.get_int("scheduler-period");
    const currentIndex = periods.indexOf(currentPeriod);
    if (currentIndex !== -1) {
      intervalRow.selected = currentIndex;
    }

    intervalRow.connect("notify::selected", () => {
      const selectedMinutes = periods[intervalRow.selected];
      settings.set_int("scheduler-period", selectedMinutes);
    });
    schedulerGroup.add(intervalRow);

    // Row: Hide Indicator Toggle
    const hideIdleRow = new Adw.SwitchRow({
      title: "Hide Extension Icon When Idle",
      subtitle: "Hide the icon if there is no playing azkar, Icon only appears during pre-active (blue countdown) and active (green playing) states",
    });
    settings.bind(
      "hide-indicator-idle",
      hideIdleRow as any,
      "active",
      Gio.SettingsBindFlags.DEFAULT
    );
    schedulerGroup.add(hideIdleRow);


    // ─── Page: About ───
    const aboutPage = new Adw.PreferencesPage({
      title: "About",
      icon_name: "help-about-symbolic",
    });
    window.add(aboutPage);

    // ─── Centered Logo Block ───
    const logoGroup = new Adw.PreferencesGroup();

    const logoBox = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      margin_top: 36,
      margin_bottom: 36,
      halign: Gtk.Align.CENTER,
    });

    const logoImage = new Gtk.Image({
      file: logoPath,
      pixel_size: 128
    });

    logoBox.append(logoImage);

    // FIX: Add the Image to the Box, the Box to the Group, and the Group to the Page
    logoGroup.add(logoBox);
    aboutPage.add(logoGroup);

    // Author Row
    const authorRow = new Adw.ActionRow({
      title: "Author",
      subtitle: "Lorens Osman",
    });
    logoGroup.add(authorRow);

    // Email Row
    const emailRow = new Adw.ActionRow({
      title: "Email",
      subtitle: "lorens.osman.dev@gmail.com",
      activatable: true,
    });
    emailRow.connect("activated", () => {
      Gtk.show_uri(window, "mailto:lorens.osman.dev@gmail.com", 0);
    });
    logoGroup.add(emailRow);

    // Github Row
    const githubRow = new Adw.ActionRow({
      title: "Github",
      subtitle: "https://github.com/lorens-osman-dev",
      activatable: true,
    });
    githubRow.connect("activated", () => {
      Gtk.show_uri(window, "https://github.com/lorens-osman-dev", 0);
    });
    logoGroup.add(githubRow);

    return Promise.resolve();
  }
}