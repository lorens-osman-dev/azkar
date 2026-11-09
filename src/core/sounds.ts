/**
 * core/sounds.ts — Azkar Audio Manifest
 *
 * Responsibility:
 * - Maintain a strictly typed registry of all bundled MP3 assets.
 * - Safely generate absolute paths and URIs for GStreamer ingestion.
 */

import Gio from "gi://Gio";
import GLib from "gi://GLib";

export interface SoundEntry {
  soundName: string;
  soundFile: string;
  soundPath: string;
  soundUri: string;
}

export interface SoundsData {
  sounds: Record<string, SoundEntry>;
  soundNames: string[];
}

/**
 * Builds an audio manifest from the MP3 files bundled in src/sounds.
 */
export function getSoundsData(extensionPath: string): SoundsData {
  const data: SoundsData = { sounds: {}, soundNames: [] };
  const soundsDirectory = GLib.build_filenamev([extensionPath, "src", "sounds"]);
  const directory = Gio.File.new_for_path(soundsDirectory);
  const enumerator = directory.enumerate_children(
    "standard::name,standard::type",
    Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
    null,
  );
  const files: string[] = [];

  try {
    let fileInfo: Gio.FileInfo | null;
    while ((fileInfo = enumerator.next_file(null)) !== null) {
      const file = fileInfo.get_name();
      if (fileInfo.get_file_type() === Gio.FileType.REGULAR && file.toLowerCase().endsWith(".mp3")) {
        files.push(file);
      }
    }
  } finally {
    enumerator.close(null);
  }

  files.sort();
  if (files.length === 0) {
    throw new Error(`No MP3 sound files found in ${soundsDirectory}`);
  }

  for (const file of files) {
    const name = file.slice(0, -4);
    const soundPath = GLib.build_filenamev([soundsDirectory, file]);
    const [soundUri] = GLib.filename_to_uri(soundPath, null);

    data.sounds[name] = {
      soundName: name,
      soundFile: file,
      soundPath,
      soundUri,
    };

    data.soundNames.push(name);
  }

  return data;
}
