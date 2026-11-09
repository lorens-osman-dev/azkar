// Test-only producer: exercise the real scheduler in a separate process.
import Gio from 'gi://Gio';
const path = ARGV[0];
const { SoundRandomizer } = await import(`file://${path}/core/soundRandomizer.js`);
const schemaSource = Gio.SettingsSchemaSource.new_from_directory(`${path}/src/schemas`,
    Gio.SettingsSchemaSource.get_default(), false);
const settings = new Gio.Settings({ settings_schema: schemaSource.lookup('org.gnome.shell.extensions.azkar', true) });
let stopped;
const audio = {
    connect(_signal, callback) { stopped = callback; return 1; },
    disconnect() {},
    stop() { stopped?.(); },
    play() { this.stop(); },
};
const scheduler = new SoundRandomizer(audio, path, settings);
scheduler._prepareNextSound();
scheduler._playPreparedSound();
audio.stop();
Gio.Settings.sync();
print(`SNAPSHOT:${settings.get_string('playback-queue')}`);
// Leave the snapshot available for the consumer test; no compositor is running.
