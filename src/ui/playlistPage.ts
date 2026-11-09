import Adw from "gi://Adw";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Gtk from "gi://Gtk";
import { parsePlaylistSnapshot } from "../core/playlist.js";

export function createPlaylistPage(settings: Gio.Settings): {
  page: Adw.PreferencesPage;
  disconnect: () => void;
} {
  const page = new Adw.PreferencesPage({
    title: "Playlist",
    icon_name: "view-list-symbolic",
  });
  const group = new Adw.PreferencesGroup({ title: "Playback queue" });
  page.add(group);
  let rows: Adw.ActionRow[] = [];

  const render = (): void => {
    for (const row of rows) group.remove(row);
    rows = [];
    const state = parsePlaylistSnapshot(settings.get_string("playback-queue"));
    group.description = state?.active
      ? "Live playback order · gray: previously played · green: next · blue: queued"
      : "Scheduler paused · gray: previously played · green: next · blue: queued";

    const addSound = (filename: string, status: string, icon: string, color?: string): void => {
      const title = GLib.markup_escape_text(filename, -1);
      const row = new Adw.ActionRow({
        title: color
          ? `<span foreground="${color}">${title.replace(".mp3", "")}</span>`
          : title.replace(".mp3", ""),
        subtitle: status,
        title_lines: 1,
        tooltip_text: filename.replace(".mp3", ""),
        use_markup: true,
      });
      row.add_prefix(new Gtk.Image({ icon_name: icon }));
      group.add(row);
      rows.push(row);
    };

    if (!state) {
      group.description =
        "Open this page while the Azkar extension is enabled to see its live queue.";
      const row = new Adw.ActionRow({ title: "Waiting for the scheduler" });
      group.add(row);
      rows.push(row);
      return;
    }

    if (state.previous)
      addSound(state.previous, "Previously played", "emblem-ok-symbolic", "#808080");
    if (state.current) addSound(state.current, "Playing now", "media-playback-start-symbolic");
    state.queue.forEach((filename, index) => {
      addSound(
        filename,
        index === 0 ? "Next" : "Queued",
        index === 0 ? "media-skip-forward-symbolic" : "audio-x-generic-symbolic",
        index === 0 ? "#2e9b50" : "#3584e4",
      );
    });
    if (state.queue.length === 0 && !state.current) {
      const row = new Adw.ActionRow({
        title: "Playlist is empty",
        subtitle: "Enable sounds on the Azkar page to add them to the queue.",
      });
      group.add(row);
      rows.push(row);
    }
  };

  render();
  const signalId = settings.connect("changed::playback-queue", render);
  return { page, disconnect: () => settings.disconnect(signalId) };
}
