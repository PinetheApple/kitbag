# #574 queue mockup: owner questions

Each question gives the recommendation first, then one alternative. Conventions are from the queue research (Spotify, YouTube Music, Apple Music, Pocket Casts); where those apps disagree, or where Kitbag departs from them, the question says so.

1. **Is there one queue for single songs and stem songs?**
   - Recommended: one shared queue, one mini-player and one "Queue" sheet. Only one song holds the mixer at a time, so two queues would mean two "what plays next" answers. Every studied app has one queue. Songs rows get the same Play next / Add to queue menu, and a single song in the queue shows a music-note badge instead of STEMS.
   - Alternative: stem songs only for now (the mockup draws only stem songs), with single songs added later.

2. **Where does the queue open from?**
   - Recommended: three places. A Queue key on the mini-player and a Queue icon in the stem player's app bar, as Pocket Casts does. Spotify and YouTube Music put it in the full player only. The third is a Queue icon with a count in the Stem songs app bar, so a queue can be seen and started (Play queue) with nothing playing (#571). The Up next row in the player also opens it.
   - Alternative: the player and mini-player only, as Spotify does. Then a queue built with nothing playing has no entry point until a song starts.

3. **How does a setlist interact with the queue?**
   - Recommended: three rules.
     - The rest of a setlist shows as "Next from: <setlist>" only if you started that setlist in this listening session. A session ends at Stop, at mini-player close, or when the app is closed. Starting a song from a list (Stem songs, Songs, search) ends the setlist, with "Left <setlist>" and Undo.
     - Starting another setlist replaces the context and keeps your queued songs, as Pocket Casts does. YouTube Music reportedly clears them, and Apple asks.
     - "Clear queue" clears only Next in queue, as Spotify does, and asks first. "Leave setlist" ends the context. Each setlist row can be skipped with ✕, which does not edit the setlist. Apple's single "Clear Queue" clears everything.
   - Starting a song from the Stem songs list starts no context, so playback stops after it unless songs are queued. This departs from Spotify, where the list becomes "Next from: <list>", and from every app's autoplay: a practice app should not choose the next song.
   - Alternative: Apple's model. Starting anything new while songs are queued asks "Clear queue?", and one Clear empties both sections.

4. **How does Repeat work with the setlist and the A-B loop?**
   - Recommended: a chip that cycles Off → Repeat all → Repeat one (the Spotify, YouTube Music and Apple cycle). It is labelled because the A-B loop key already uses the repeat glyph.
     - Repeat all: a queued song goes back to the end of Next in queue after it plays, and the setlist starts again from song 1 after its last song. A metronome song still stops playback.
     - Repeat one: replays the song at its end. While an A-B loop is set the loop wins, because playback never reaches the end. The setting stays until changed.
   - Alternative: no Repeat one. "Loop whole song" becomes a state of the existing A-B loop key, so there is one looping concept. The queue chip toggles only Off and Repeat all.

5. **Previous: placement and the 3-second rule.**
   - Recommended: Previous and Next keys flank the Up next row in the stem player. The transport row (A-B loop, ±10 s, play, click) stays as `kitbag-stems.html` C draws it.
     - Stem songs follow the common rule: past 3 s Previous restarts the song, otherwise it goes to the song before it (session history or the previous setlist entry).
     - The 3 s rule does not apply on the Metronome: a metronome song has no position, so Previous always loads the previous setlist song.
     - D2 already draws Previous and Next in the Metronome app bar. They are flat glyphs, so the proposal draws them with D2's own filled `.skip` keys.
   - Alternative: Previous always goes to the previous entry (no restart), with the ±10 s keys for small moves. Previous and Next replace ±10 s in the transport row, which follows the music-app layout but drops the skip keys.
