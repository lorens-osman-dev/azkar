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
const { SoundRandomizer } = await import(`file://${path}/core/soundRandomizer.js`);
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
        const switches = rows.map(row => descendants(row).find(widget => widget instanceof Gtk.Switch));
        assert(switches.every(Boolean), 'Every sound needs a playlist enable/disable switch');
        assert(switches.every(widget => widget.active), 'All sounds should be enabled by default');
        const settings = prefs.getSettings();
        const firstFile = manifest.sounds[manifest.soundNames[0]].soundFile;
        const secondFile = manifest.sounds[manifest.soundNames[1]].soundFile;
        switches[0].active = false;
        assert(settings.get_strv('disabled-sounds').includes(firstFile), 'Disabling a sound must be saved');
        assert(buttons[0].sensitive, 'Excluded sounds must remain available for preview');
        settings.set_strv('disabled-sounds', [secondFile]);
        assert(switches[0].active && !switches[1].active, 'External settings changes must update switches');
        const reopened = new Adw.PreferencesWindow({ application: app });
        await prefs.fillPreferencesWindow(reopened);
        const reopenedPage = descendants(reopened).find(widget => widget instanceof Adw.PreferencesPage && widget.title === 'Azkar');
        const reopenedSwitches = descendants(reopenedPage).filter(widget => widget instanceof Gtk.Switch);
        assert(reopenedSwitches[0].active && !reopenedSwitches[1].active, 'Playlist choices must survive reopening Preferences');
        reopened.emit('close-request');
        reopened.destroy();
        settings.reset('disabled-sounds');
        assert(switches.every(widget => widget.active), 'Reset must enable all sounds');

        const played = [];
        const scheduler = new SoundRandomizer({ stop() {}, play(file) { played.push(file); } }, path, settings);
        let preActive = 0;
        scheduler.setListener({ onPreActive() { preActive++; }, onSoundStarted() {}, onRandomizerStopped() {} });
        settings.set_strv('disabled-sounds', [firstFile]);
        for (let i = 0; i < manifest.soundNames.length * 2; i++) {
            scheduler._prepareNextSound();
            scheduler._playPreparedSound();
        }
        assert(played.length > 0 && played.every(file => file !== `src/sounds/${firstFile}`), 'Scheduler must exclude disabled sounds across queue refills');
        scheduler.start(15);
        scheduler._prepareNextSound();
        const pendingFile = scheduler._upcomingSound.soundFile;
        settings.set_strv('disabled-sounds', [firstFile, pendingFile]);
        const playedBeforeChange = played.length;
        scheduler._playPreparedSound();
        assert(played.length === playedBeforeChange, 'Disabling a pending sound must cancel it');
        settings.set_strv('disabled-sounds', manifest.soundNames.map(name => manifest.sounds[name].soundFile));
        const previousPreActive = preActive;
        scheduler._prepareNextSound();
        scheduler._playPreparedSound();
        assert(preActive === previousPreActive && played.length === playedBeforeChange, 'An empty playlist must not count down or play stale audio');
        scheduler.start(0);
        const emptyPlaylistTimer = scheduler._timerId;
        await waitFor(() => scheduler._timerId !== emptyPlaylistTimer, 'Empty-playlist idle timer did not run');
        assert(preActive === previousPreActive && played.length === playedBeforeChange, 'Empty playlist must remain idle when its timer fires');
        switches[0].active = true;
        scheduler._prepareNextSound();
        scheduler._playPreparedSound();
        assert(played.at(-1) === `src/sounds/${firstFile}`, 'Re-enabling a sound must resume playlist selection');
        scheduler.destroy();
        assert(scheduler._playlistSignalId === 0 && scheduler._timerId === null, 'Scheduler cleanup must disconnect playlist changes and remove timers');
        settings.reset('disabled-sounds');
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
        print(`PASS: ${rows.length} sound rows, saved playlist switches, settings sync/reset/reopen, scheduler exclusions/refills/pending/empty/re-enable, and real preview playback/cleanup`);
    })().catch(error => { failure = error; }).finally(() => app.quit());
});
await app.runAsync([]);
if (failure)
    throw failure;
