# Images

Every image comes from an installed release build, not a mockup (#61). F-Droid
accepts png, jpg or jpeg here, strips their metadata and may recompress them.

| Asset | Size | Source |
|---|---|---|
| `icon.png` | 512×512 | The launcher icon, rendered by `scripts/build-icons.sh`. |
| `featureGraphic.png` | 1024×500 | Needs a design pass. |
| `phoneScreenshots/*.png` | Device resolution | The list below. |

F-Droid states no screenshot count or size. QUESTION: does a submission with
no images get flagged at review or rejected?

## Phone screenshots

PNG, named in display order. Theme follows the system setting, so set the
system theme before each shot.

| File | Screen | State | Theme |
|---|---|---|---|
| `01-metronome.png` | Metronome | Playing at 120 BPM in 4/4, accent on beat 1, beat lights mid-bar | Dark |
| `02-metronome-poly.png` | Metronome | Playing at 90 BPM with the polyrhythm row on, 3 against 4 | Light |
| `03-metronome-setlist.png` | Metronome | A setlist of at least four songs loaded, second song playing | Dark |
| `04-setlist.png` | Setlist detail | The same setlist, every song listed | Light |
| `05-tuner.png` | Tuner | Standard guitar tuning, a held A2 tone into the mic, needle settled in tune | Dark |
| `06-songs.png` | Songs | At least five imported songs, analysis finished, tempos shown | Light |
| `07-stem-player.png` | Stem player | A four-stem song playing, one stem muted, faders at different levels | Dark |
| `08-home.png` | Home | The metronome used last, so the Continue card points at it | Light |
