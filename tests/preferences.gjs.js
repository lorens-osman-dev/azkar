import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';
import Gst from 'gi://Gst';

function assert(condition, message) {
    if (!condition)
        throw new Error(message);
}

function descendants(widget) {
    const result = [widget];
    for (let child = widget.get_first_child(); child; child = child.get_next_sibling())
        result.push(...descendants(child));
    return result;
}

async function waitFor(predicate, message) {
    const deadline = GLib.get_monotonic_time() + 5_000_000;
    while (!predicate()) {
        assert(GLib.get_monotonic_time() < deadline, message);
        await new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, 20, () => {
            resolve();
            return GLib.SOURCE_REMOVE;
        }));
    }
}

Gio.resources_register(Gio.Resource.load(GLib.getenv('AZKAR_PREFS_RESOURCE') ??
    '/usr/share/gnome-shell/org.gnome.Shell.Extensions.src.gresource'));
const path = ARGV[0];
const { default: Preferences } = await import(`file://${path}/prefs.js`);
const { AudioPlayer } = await import(`file://${path}/core/audioPlayer.js`);
const { getSoundsData } = await import(`file://${path}/core/sounds.js`);
Gst.init(null);
// Exercise real GStreamer decoding without emitting sound on the user's desktop.
const originalPlay = AudioPlayer.prototype.play;
let player;
AudioPlayer.prototype.play = function (relativePath) {
    player = this;
    const audioSink = Gst.ElementFactory.make('fakesink', null);
    audioSink.set_property('sync', true);
    this._playbin.set_property('audio-sink', audioSink);
    this._playbin.set_property('video-sink', Gst.ElementFactory.make('fakesink', null));
    originalPlay.call(this, relativePath);
};

const app = new Adw.Application({ application_id: 'com.lorens.Azkar.PreferencesTest',
    flags: Gio.ApplicationFlags.NON_UNIQUE });
let failure;
app.connect('activate', () => {
    (async () => {
        const metadata = JSON.parse(new TextDecoder().decode(
            Gio.File.new_for_path(`${path}/metadata.json`).load_contents(null)[1]));
        const prefs = new Preferences({ ...metadata, path, dir: Gio.File.new_for_path(path) });
        const window = new Adw.PreferencesWindow({ application: app });
        await prefs.fillPreferencesWindow(window);
        const widgets = descendants(window);
        const page = widgets.find(widget => widget instanceof Adw.PreferencesPage && widget.title === 'Azkar');
        assert(page, 'Missing Azkar preferences page');
        const rows = descendants(page).filter(widget => widget instanceof Adw.ActionRow);
        const manifest = getSoundsData(path);
        assert(rows.length === manifest.soundNames.length, 'Sound row count differs from the bundled MP3 manifest');
        for (const [index, row] of rows.entries()) {
            const filename = manifest.sounds[manifest.soundNames[index]].soundFile;
            assert(row.title === filename, 'Filename/order mismatch');
            assert(row.title_lines === 1, 'Sound filenames must be ellipsized to one line');
            assert(!row.use_markup, 'Filenames must be literal text');
            assert(row.tooltip_text === filename, 'Full filename must be available in tooltip');
        }
        const buttons = rows.map(row => descendants(row).find(widget => widget instanceof Gtk.Button && widget.icon_name === 'media-playback-start-symbolic'));
        assert(buttons.every(Boolean), 'Every sound needs a play button');
        buttons[0].emit('clicked');
        await waitFor(() => player?._playbin.get_state(0)[1] === Gst.State.PLAYING, 'Preview did not reach PLAYING');
        assert(buttons[0].icon_name === 'media-playback-stop-symbolic', 'Playing sound needs a stop button');
        buttons[1].emit('clicked');
        await waitFor(() => player._playbin.get_state(0)[1] === Gst.State.PLAYING, 'Second preview did not play');
        assert(buttons[0].icon_name === 'media-playback-start-symbolic', 'Switching sounds must reset the previous button');
        buttons[1].emit('clicked');
        assert(player._playbin.get_state(0)[1] === Gst.State.NULL, 'Stop must release playback');
        assert(buttons[1].icon_name === 'media-playback-start-symbolic', 'Stop must reset the button');
        buttons[0].emit('clicked');
        await waitFor(() => player._playbin.get_state(0)[1] === Gst.State.PLAYING, 'Preview did not restart');
        player._playbin.get_bus().post(Gst.Message.new_eos(player._playbin));
        await waitFor(() => buttons[0].icon_name === 'media-playback-start-symbolic', 'EOS must reset the play button');
        buttons[0].emit('clicked');
        window.emit('close-request');
        assert(player._playbin === null, 'Closing Preferences must destroy the preview player');
        window.destroy();
        print(`PASS: ${rows.length} sound rows, ellipsis, real decoding, switching, stop, EOS and window-close cleanup`);
    })().catch(error => { failure = error; }).finally(() => app.quit());
});
await app.runAsync([]);
if (failure)
    throw failure;
