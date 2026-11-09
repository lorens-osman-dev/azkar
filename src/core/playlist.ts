/** Snapshot shared by the Shell scheduler and the separate preferences process. */
export interface PlaylistSnapshot {
  active: boolean;
  previous: string | null;
  current: string | null;
  queue: string[];
}

export function parsePlaylistSnapshot(value: string): PlaylistSnapshot | null {
  try {
    const data = JSON.parse(value);
    if (data === null || typeof data !== "object" ||
        typeof data.active !== "boolean" ||
        (data.previous !== null && typeof data.previous !== "string") ||
        (data.current !== null && typeof data.current !== "string") ||
        !Array.isArray(data.queue) ||
        !data.queue.every((file: unknown) => typeof file === "string")) {
      return null;
    }
    return data as PlaylistSnapshot;
  } catch {
    return null;
  }
}
