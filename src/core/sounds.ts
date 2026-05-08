/**
 * core/sounds.ts — Azkar Audio Manifest
 *
 * Responsibility:
 * - Maintain a strictly typed registry of all bundled MP3 assets.
 * - Safely generate absolute paths and URIs for GStreamer ingestion.
 */

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

// Ensure these match the files bundled by the Makefile[cite: 3, 5].
const BUNDLED_SOUNDS = [
  "al_bahr.mp3", "al_balad.mp3", "al_rahman.mp3", "kaf.mp3",
  "khazayen_1.mp3", "khazayen_2.mp3", "khazayen_3.mp3",
  "mn_kan_yered_al_aza.mp3", "naziat.mp3", "noah.mp3",
  "sabikon_al_sabikon.mp3", "sabr_gamil.mp3", "salat_ful.mp3",
  "salat_tahajud.mp3", "salat.mp3", "w_asber.mp3", "yom_al_kiyama.mp3"
];

/**
 * Hydrates the audio manifest with safe system paths.
 */
export function getSoundsData(extensionPath: string): SoundsData {
  const data: SoundsData = { sounds: {}, soundNames: [] };

  for (const file of BUNDLED_SOUNDS) {
    // Strip extension for the dictionary key
    const name = file.replace('.mp3', '');

    // Safely construct the path via GLib
    const soundPath = GLib.build_filenamev([extensionPath, "src", "sounds", file]);

    // Generate the file:// URI for GStreamer
    const [soundUri] = GLib.filename_to_uri(soundPath, null);

    data.sounds[name] = {
      soundName: name,
      soundFile: file,
      soundPath,
      soundUri
    };

    data.soundNames.push(name);
  }

  return data;
}