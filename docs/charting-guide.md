# YARG / Rock Band Charting Guide

A comprehensive reference for authoring high-quality rhythm-game charts, based on the official C3/RBN documentation. Covers every supported instrument, missing chart-editor features, and a practical workflow for generating charts from a single `.mp3` file using automated tools.
More details [here] (http://docs.c3universe.com/rbndocs/index.php?title=Authoring)

---

## Table of Contents

1. [General Philosophy](#1-general-philosophy)
2. [Guitar & Bass Authoring](#2-guitar--bass-authoring)
3. [Drum Authoring](#3-drum-authoring)
4. [5-Lane Keyboard Authoring](#4-5-lane-keyboard-authoring)
5. [Pro Keyboard Authoring](#5-pro-keyboard-authoring)
6. [Vocal Authoring](#6-vocal-authoring)
7. [Harmony Authoring](#7-harmony-authoring)
8. [Lyrics & Spelling](#8-lyrics--spelling)
9. [Overdrive, Solo Markers & Special Sections](#9-overdrive-solo-markers--special-sections)
10. [Missing Chart-Editor Features](#10-missing-chart-editor-features)
11. [Automated Charting Plan (from .mp3)](#11-automated-charting-plan-from-mp3)

---

## 1. General Philosophy

### The Four-Step Process

1. **Prepare Audio** – Mix your song's multi-track recordings ("stems") for Rock Band. If you do not have stems, use a high-quality mp3 file.
2. **Create Gameplay Data** – Author all gameplay data as a MIDI file (or `.chart` file) inside a DAW or chart editor.
3. **Package the Song** – Combine audio (stems or mp3) and MIDI to create a song package.
4. **Playtest** – Play the song in-game and fix issues.

### Core Principles (all instruments)

| Principle | Description |
|-----------|-------------|
| **Literal Transcription** | Start from Expert and transcribe the actual musical performance. Never make Expert harder than the real part. |
| **Author Intention over Sloppiness** | Rock and roll is often sloppy — clean it up. All authoring should be quantized, typically to 16th notes (sometimes 32nd notes or triplets). |
| **Simplify Downward** | Author Expert first, then simplify to Hard → Medium → Easy. When removing notes during reduction, never stretch the preceding note to fill the gap — the space is as important as the notes. |
| **Note Consistency** | Keep the same gems representing the same notes or chords throughout the song. If an E note uses a Red gem in the verse, keep it Red throughout. |
| **Preserve Motion** | Even if consistency must break, preserve the feeling of ascending/descending melodic lines. A note moving upward should map to a higher-colored gem. |
| **Lane Consistency** | For each lane (color) used in Expert, you must use at least one gem of the same color in every other difficulty. Easy and Medium cannot introduce colors not present in Expert. |

---

## 2. Guitar & Bass Authoring

> When "Guitar" is mentioned, assume it also applies to Bass unless otherwise noted.

### 2.1 The General Philosophy

Expert Guitar should be a **rhythmically literal transcription** of the actual guitar performance. Adjust notes to fit the 5-button layout, then simplify downward for each difficulty.

### 2.2 Note Consistency & Wrapping

- Map the same guitar note to the same gem color throughout a song (e.g., E → Red).
- Maintain chord consistency: if Green/Yellow = E chord, keep it that way.
- When a melodic line has more notes than 5 buttons allow, **wrap**: use patterns like `G-R-Y`, `R-Y-B`, `Y-B-O`.
- Wrapping should be re-adjusted after reducing to each lower difficulty (extra space allows more linear motion at lower BPMs).

### 2.3 Chords

| Type | Example | Use Case |
|------|---------|----------|
| 1-2 | Green/Red | Bar chords, power chords, small or "tight" chords |
| 1-3 | Green/Yellow | Most "normal" chords (majority of Rock Band charts) |
| 1-4 | Green/Blue | Octaves, suspended chords |
| 1-5 | Green/Orange | Octaves — Expert only, use sparingly |
| 3-note | e.g. G/R/Y | Augmented, diminished, 7th chords, or "big" chords |

**Rules:**
- Three-note chords may **not** include both Green and Orange (no G/R/O, G/Y/O, G/B/O).
- 1-5 chords are **Expert-only**.

### 2.4 Sustained Notes

- Any note longer than **1/16** note will display a sustain tail.
- No note should be shorter than **1/64**.
- Leave at least **1/32** (standard: 1/16) between the end of a sustain and the next note.
- Notes must **never overlap**. All notes in a chord begin and end at the same time.
- At >100 BPM: only add sustains to notes longer than a dotted 8th note.
- At <100 BPM: add sustains to notes longer than an 8th note.

### 2.5 Expert Rules

- Expert uses MIDI notes **96–100** (C6–E6).
- Use all 5 buttons freely.
- All chord types are allowed (except G+O three-note chords).
- Transcribe even subtle variations in the guitar part.
- Never intentionally make Expert **harder** than the actual guitar part.

**Expert Tips:**
- Listen to the guitar part all the way through before authoring.
- Start with the central riff/chord progression; build around it.
- For ambient guitar noise (feedback, delay clouds), author **streams of 16th notes** rather than long sustained notes.
- Pitch bends: add a 16th note one button lower just before the target note.
- Muted strums: author as **single notes**, even if the real performance is a muted chord.
- When switching chords, add a pickup single note representing the root of the incoming chord.

### 2.6 Hard Rules

- Hard uses MIDI notes **84–88** (C5–E5).
- Should be a "reasonable" Expert — an expert player should be able to 100% Hard with minimal practice.
- Remove 16th-note motion; keep 8th notes and above (depends on tempo).
- **Retain all Expert chords** unless they represent harmonizing parts or harmonics.
- **No 3-note chords** and no Green/Orange chords.
- Green/Blue and Red/Orange are acceptable replacements.
- Chord-to-chord HOPOs reduce to single-note-to-chord HOPOs.
- At >160 BPM, thin continuous 8th notes by removing every 4th note per half measure.

### 2.7 Medium Rules

- Medium uses MIDI notes **72–75** (C4–D#4).
- Only notes on **strong quarter-note beats**; remove all 8th notes where possible.
- Avoid quick 3-4 button jumps (G→B, G→O, R→O).
- **No 1-4, 1-5, or 3-note chords.** Only 1-2 and 1-3 chords.
- Pull sustains back: leave at least a **quarter note** between sustain end and next note.
- Orange gems must be introduced thoughtfully (priority: unique sections → infrequent sections → rhythm/sonic change → arbitrary).
- Restrict hand positions to 4 lanes at a time.

### 2.8 Easy Rules

- Easy uses MIDI notes **60–62** (C3–D3).
- Leave **half-note spaces** between notes.
- **No chords.**
- Pull sustains back further; leave at least a **quarter note** between sustain and next note.
- Orange/Blue gems should follow same priority system as Medium, restricted to 3 lanes at a time.

### 2.9 Hammer-Ons and Pull-Offs (HOPOs)

- HOPOs are auto-generated when two different-color notes start within **1/16** note of each other.
- Force HOPO **on**: MIDI note F, same duration as note.
- Force HOPO **off**: MIDI note F#, same duration as note.
- Never force HOPOs on Medium or Easy.
- Use sparingly — do not create entire songs without strumming.

### 2.10 Trills & Tremolo

- **Tremolo** (MIDI 126): fast, odd-rhythm strumming on one note or chord. Player can strum freely as long as they maintain ≥160ms interval.
- **Trill** (MIDI 127): rapid alternation between two different frets. Same free-form threshold.
- Use when the original performance is so fast/out-of-time that matching the authored rhythm would feel unfair.

### 2.11 Solo Sections

- MIDI note **103** (G6) marks guitar solo sections.
- As of RB3, solo markers also work on Bass, Drums, and Keys.
- Only mark obvious solos — not small fills or repeated lead lines.
- End solo markers as early as possible if the song ends on a solo (allows score popup to appear).

### 2.12 Bass-Specific Notes

- Bassists often change registers between song sections. Author each section separately to the pattern that feels best for that register; maintain internal consistency within each section.

---

## 3. Drum Authoring

### 3.1 Pad Mapping

| Gem Color | Default Pad | Typical Sound |
|-----------|------------|---------------|
| Green | Crash Cymbal / Floor Tom | Crash, floor tom |
| Blue | Ride Cymbal / Rack Tom 2 | Ride, 2nd rack tom |
| Yellow | Hi-Hat / Rack Tom 1 | Hi-hat, 1st rack tom |
| Red | Snare | Snare drum |
| Orange (pedal) | Kick Drum | Bass drum |

Colors and sounds are **guidelines, not laws**. Fun gameplay > perfect realism.

### 3.2 General Tips

- Solo and listen to each stem before authoring. Learn to distinguish: what does a kick sound like in the cymbal stream? What separates the floor tom from the kick?
- For hi-hats and ride cymbals, keep placement **consistent** since their role in the beat is distinctive.
- **Open hi-hat on Blue**: use only when there's a clear sonic distinction between open and closed hats (e.g., Rush, The Police). Not for subtle variations.
- **Disco beat / 16-beat** (16th note hi-hats): use drum mix event `[mix 3 drums0d]` to swap hi-hat gems to Red and snare to Yellow so the player doesn't need to cross hands.
- **Snare flams**: author as simultaneous Red + Yellow hit to force both hands.
- **Double crashes**: author on two different colors (e.g., Green + Yellow) to replicate emphasis.

### 3.3 Expert Rules

- Expert uses MIDI notes **96–100** (C6–E6).
- Rhythmically, Expert is a **literal transcription** of the actual drum performance.
- Exceptions are allowed when the real part is impossible on the Rock Band kit (e.g., 6-tom fills → wrap back around).
- Ambient hi-hat "open on upbeat" patterns: only author gems on the **upbeats**.
- De-emphasized hits: don't chart every lightly tapped cymbal or subtle accent you can hear in a soloed mix — focus on what's audible in the full mix.

### 3.4 Hard Rules

- Hard uses MIDI notes **84–88** (C5–E5).
- The Hard level introduces: complete limb independence, alternating-hand rolls (≤140 BPM), kick with off-beat crashes, fast 8th-note right-hand timekeeping (≤170 BPM).
- **Reduce by:**
  - Thinning kicks (remove adjacent 8th/16th note kicks first).
  - Removing kicks from fills.
  - Removing ~half of small snare accents consistently.
  - Trimming drum rolls to even 8th/quarter note starts.
  - Un-flipping all disco beats (put hi-hat back on yellow, snare on red, add yellow hi-hat on top of snare).
  - Avoiding double crashes unless there's a quarter note of space around them.

### 3.5 Medium Rules

- Medium uses MIDI notes **72–76** (C4–E4).
- Introduces basics: hands + foot simultaneously. **No kicks/snares between hi-hat timekeeping gems** (no full limb independence expected).
- No 3-limb simultaneous hits.
- At ≥140 BPM: right-hand timekeeping drops to **quarter notes** (not 8th notes).
- At ≥170 BPM: one kick per measure maximum.
- Rolls and fills reduced to **8th notes** (quarter notes at faster tempos).
- Crashes on downbeats should have a kick underneath. Off-beat crashes get no kick.
- Remove gems immediately after crashes to give the player time to reset.

### 3.6 Easy Rules

- Easy uses MIDI notes **60–64** (C3–E3).
- No gem should be paired with a kick. Player uses **at most 2 limbs** in any section.
- General split: less intense sections = kick/snare; more intense sections = 2-hand cymbal beat.
- Crashes should **not** have kicks (save kick/crash pairing for Medium).
- At ≥170 BPM: one kick per measure.

### 3.7 Pro Drums

Pro Drums adds cymbal/tom distinction via modifying notes:

| MIDI Note | Effect |
|-----------|--------|
| 110 (D7) | Yellow gem → Tom (for duration) |
| 111 (D#7) | Blue gem → Tom (for duration) |
| 112 (E7) | Green gem → Tom (for duration) |

Without these modifiers, Yellow/Blue/Green default to cymbal gems.

### 3.8 Drum Rolls

- **Standard roll** (MIDI 126): use for single pads playing too fast for the kit to reliably detect. Start at the first note, end before the last note.
- **Special roll** (MIDI 127): cymbal swells across two pads.
- Never author a drum fill over a drum roll.
- Keep roll contents at 32nd notes or slower for reliable comboing.
- Avoid stretching rolls across multiple pads.

### 3.9 2x Kick Drum

- Create the full 2x chart in `PART DRUMS`.
- Duplicate the track; rename copy to `PART DRUMS_2X`.
- Use CAT's "2x reduction" action to create the 1x version in `PART DRUMS`.
- Magma auto-detects and produces two separate CON files.

### 3.10 Drum Fills

- Fill lanes: MIDI notes **120–124** (C8–E8).
- Typical pacing: **1-measure fill every 4 bars**.
- Fast songs: 2-measure fill every 8 bars. Slow songs: half-measure fill every 2 bars.
- Fills should align with important song transitions (verse → chorus, etc.).
- Fills should end at the exact last hit moment, not past it.
- Fills cannot occur inside Drum Solo sections.
- Overdrive is deployed through drum fills — avoid fills immediately before long drum rests.
- Artistic choice: skip a fill on a particularly great authored drum groove.

### 3.11 Drum Mix Events

Format: `[mix <difficulty> drums<config>]`

- `difficulty`: 0=Easy, 1=Medium, 2=Hard, 3=Expert
- Key configs: `drums0` (single stereo mix), `drums0d` (disco flip), `drums1–4` variants (separate kick/snare/else streams)

Minimum setup (single stereo file, no stems):
```
[mix 0 drums0]
[mix 1 drums0]
[mix 2 drums0]
[mix 3 drums0]
```

Add `d` suffix for disco flip sections: `[mix 3 drums0d]`.

---

## 4. 5-Lane Keyboard Authoring

5-Lane Keys are authored in MIDI track: **PART KEYS**.

### 4.1 Philosophy

Almost identical to 5-Lane Guitar/Bass authoring. Start with Expert as a literal rhythmic transcription of the keyboard performance. We recommend **authoring Pro Keys first** (see Section 5), then using it as a melodic/harmonic reference — do not simply copy Pro Keys to 5-Lane unless the part is very simple.

### 4.2 Chord Types

| Type | Example | Use |
|------|---------|-----|
| 1-2 | G/R | Small/tight chords |
| 1-3 | G/Y | Standard chords |
| 1-4 | G/B | Suspended chords, octaves |
| 1-5 | G/O | Octaves |
| 3-note 1-4 | G/Y/B or G/R/B | Augmented/diminished |
| 3-note G→O | G/R/O, G/Y/O, G/B/O | "Big" chords (bracketed by G and O) |

### 4.3 Overlapping Gems

Keys allow overlapping notes (broken chords). Max **3 overlapping notes** at any time in 5-Lane. Break up longer broken chord sequences.

### 4.4 Sustain Rules

| Chord Gap BPM | Required Gap |
|---------------|-------------|
| ≤60 BPM | 1/16 note gap |
| 61–120 BPM | 1/8 note gap |
| 121–160 BPM | Dotted 1/8 gap |
| 161–239 BPM | 1/4 note gap |
| ≥240 BPM | Dotted 1/4 gap |

- Quarter-note chords: author with **no sustain** (to avoid muting during hand shifts).
- Single notes: at least 1/32 gap between sustain end and next note.

### 4.5 Expert Rules

- Uses MIDI notes **96–100** (C6–E6).
- All chord types allowed.
- Durations only for notes > dotted 8th (>100 BPM) or > 8th (<100 BPM).
- After any sustained chord, leave at least an 8th-note gap.
- Grace notes: add a 16th note one button lower just before the target note.

### 4.6 Hard Rules

- Uses MIDI notes **84–88** (C5–E5).
- 3-note chords permitted but reduce long passages of them.
- Remove extraneous 16th notes and subtle variations.
- Sustains same as Expert.

### 4.7 Medium Rules

- Uses MIDI notes **72–75** (C4–D#4).
- Only 2-note chords, spaced at least a quarter note apart.
- No 3-note chords.
- Avoid fast chord changes. All sustains pulled back to leave a quarter note gap.

### 4.8 Easy Rules

- Uses MIDI notes **60–62** (C3–D3).
- No chords. Single gems only.
- Half-note spaces between notes.

---

## 5. Pro Keyboard Authoring

Pro Keys is an exact transcription of the actual right-hand keyboard part, displayed on a 10-note-wide (10th interval) on-screen track.

### 5.1 Lane Shifts

Because the track only shows 10 semitones at a time, **lane shifts** move the visible window:

| MIDI Note | Visible Range |
|-----------|--------------|
| 0 | C2–E3 (recommended primary) |
| 2 | D2–F3 |
| 4 | E2–G3 |
| 5 | F2–A3 (recommended primary) |
| 7 | G2–B3 |
| 9 | A2–C4 (recommended primary) |

- Only white notes (0, 2, 4, 5, 7, 9) can be lane shift markers; no black notes.
- Every difficulty must have a lane shift marker at the very start.
- Place lane shifts ~1 bar before the first out-of-range note.
- Try to shift during shared notes (notes present in both old and new range).
- Minimize lane shifts — avoid shifting for just 1-2 notes.
- Prefer fudging notes into the current range over adding a very short lane shift.

### 5.2 Overlapping Gems

- Up to **4 overlapping notes** on Expert/Hard (compared to 3 on 5-Lane).
- Overlapping notes must span ≤ one octave.
- No overlapping on Easy; very rare 2-note overlaps (≥ 1/4 note spacing) on Medium.

### 5.3 Expert Pro Keys

- Author between C2 (48) and C4 (72) on `PART REAL_KEYS_X`.
- Exact melodic, harmonic, and rhythmic transcription of the **right-hand** keyboard part.
- Left-hand material may be included if playable with one hand.
- Up to **4-note chords** within 1 octave (12 semitones).
- Transitions between single notes: 1/16 note gap. Between chords or chord-to-different-note: 1/8 note gap.

### 5.4 Hard Pro Keys

- Author on `PART REAL_KEYS_H`.
- Remove extraneous 16th notes, grace notes, and any left-hand material.
- Max **2-3 note chords** within a 7th (11 semitones).
- Avoid interval jumps > a 7th; if unavoidable, double the space between those notes.

### 5.5 Medium Pro Keys

- Author on `PART REAL_KEYS_M`.
- Basic rhythmic core: **1/4 note space** between every gem.
- Max **2-note chords** within a 6th (9 semitones).
- All sustains pulled back to leave a 1/4 note gap.
- **No lane shifts.** Fit everything within a single chosen visible 10th.
- Avoid interval jumps > a 6th.

### 5.6 Easy Pro Keys

- Author on `PART REAL_KEYS_E`.
- **Half-note spacing** between notes.
- **No chords.** Reduce all chords to the most prominent single note.
- Avoid interval jumps > a 5th (7 semitones).
- No lane shifts. Use same range as Medium.

### 5.7 Glissando Lanes

- MIDI note **126** (F#8), Expert only.
- Use for glissandos ≥ 1/4 note in length.
- Notes inside the glissando should be white notes, evenly spaced.
- Do **not** place the glissando marker over the first note — the player should attempt to start the glissando.

### 5.8 Trill Markers

- MIDI note **127** (G8).
- Two-note trills only (three-note trills break the game).
- Player must alternate at ≥160ms to stay in free-form lane.

---

## 6. Vocal Authoring

### 6.1 File Alignment

Before authoring, ensure the vocal stem and dry vocal file are aligned. A difference of 30–40ms is acceptable; anything larger requires manual adjustment of the dry file timing.

### 6.2 Grid Setting

- Use a **1/64 note grid** (snap enabled) for vocal authoring.
- Below 90 BPM: use **1/128 grid**.
- Vocals are **not quantized to the beat** — place note start/end points by ear using the waveform.

### 6.3 Note Range

- Pitched vocal notes: **C1 (36) to B4 (83)**.
- Avoid note 84 (C5) — won't display correctly in Blitz mode.
- Author in the **same octave as the original vocal** for clarity.

### 6.4 Note Tube Placement Rules

- **Don't include consonants** at the start/end of a note tube — pitch content is in vowels.
- Exception: long, loud consonants ("sh", "s") — include the very end of the consonant.
- Note-**on** timing is critical for scoring. Note-**off** timing is less critical.
- If the last tube in a phrase is pitched and the next phrase starts with a non-pitched tube, leave a **1/16 note gap** between them (prevents a scoring bug).
- All vocal notes need **space** between the end of one and the start of the next (slide notes use this gap to draw the connecting line).

### 6.5 Multiple Vocal Parts

- When harmonies exist, always chart the part you would sing along to on the radio.
- Be **consistent** across the song — don't chart lead in verse 1 and harmony in verse 2.
- For call-and-response parts with two singers, including both is acceptable.
- For overlapping phrases (overdubbing), choose the more prominent phrase.

### 6.6 Percussion Sections

- Playable percussion notes: **MIDI C6 (96)**.
- Non-playable (just triggers sample): **MIDI C#6 (97)**.
- Types: tambourine, cowbell, hand clap.
- Use text events: `[tambourine_start]`, `[tambourine_end]`, `[cowbell_start]`, `[cowbell_end]`, `[clap_start]`, `[clap_end]`.
- Only **one type** of percussion per song.
- Percussion sections must be placed inside phrase markers (like regular notes).
- Typical phrase length: **2 measures**.

### 6.7 Phrasing

- Phrase markers dictate how the vocal part is scored.
- For non-pitched notes: standard scoring uses `#`, more generous scoring uses `^`.
- Use `^` for: 1-3 short syllables in a phrase, or vowels/consonants without sharp attacks (e.g., "w", "y").

### 6.8 Overdrive

- Vocal overdrive phrases work the same as other instruments.
- Place phrase markers so that overdrive phrases are reasonably achievable (not during long rests).

### 6.9 Octave & Range

- Rock Band allows singers to use any comfortable octave, but author in the original singer's octave.
- Don't add complexity for tiny vibrato or short lead-ins.

---

## 7. Harmony Authoring

### 7.1 Track Overview

| Track | Color | Role |
|-------|-------|------|
| HARM1 | Blue | Lead vocal (similar to PART VOCALS) |
| HARM2 | Red | 2nd part (high harmony in 3-part songs) |
| HARM3 | Gold | 3rd part (middle or low harmony) |

### 7.2 Authoring Rules

- Authoring is identical to solo vocals.
- For **block harmonies** (same rhythm): author all parts with **exactly the same timing** even if the audio differs slightly.

### 7.3 Phrase Markers

- **HARM1 phrase markers** control scoring for all harmony notes. They must encompass HARM2 and HARM3 notes.
- **HARM2 phrase markers** control static lyrics display and must encompass HARM3 notes.
- **HARM3** uses no phrase markers.
- Copy phrase markers from PART VOCALS to HARM1, then extend to cover any HARM2/3 notes outside those phrases.

### 7.4 Special Lyric Characters

| Character | Meaning |
|-----------|---------|
| `$` | Hide this lyric (used in HARM2/3 when two parts sing simultaneously) |
| `§` | "Galaxy" — used in Spanish lyric authoring for two words across one syllable |

### 7.5 Range Shift & Lyric Shift

- **C-2 (Range Shift)**: reorients the vocal HUD when the song has a large range jump. Use the note duration to control shift speed. Only use for **significant, non-overlapping** range changes.
- **C#-2 (Lyric Shift)**: adds extra shift points in Static Vocals mode. Use very sparingly.

### 7.6 Static Vocals Mode

- Lyrics auto-shift at each phrase marker.
- For most songs: copy HARM1 phrase markers to HARM2 track.
- Tambourine sections go in PART VOCALS only (not harmony tracks).

### 7.7 Overdrive Bug

Due to a Rock Band 3 bug, **VOCALS and HARM1 overdrive phrases must be identical** in practice — the VOCALS phrases' visuals bleed into HARM tracks.

---

## 8. Lyrics & Spelling

### 8.1 Research Priority

1. Official lyrics from the band/label
2. Official band website
3. Physical album booklet
4. Lyric websites / YouTube (use judgment)

### 8.2 Multi-Syllable Words

Break words with hyphens:

```
Hello         → Hel-  lo
Thunderstruck → Thun- der- struck
```

### 8.3 Syllables Across Multiple Notes

Additional notes use `+` lyric events:
```
"Yeah" over 2 notes → Yeah +
"Thunder" over 3 notes → Thun- der- +
```

### 8.4 Hyphenated Words (actual hyphens in text)

Use `=` at end of syllable:
```
Ex-Girlfriend → Ex= Girl- friend
```

### 8.5 Non-Pitched Syllables

- Standard non-pitched: `#` suffix
- Generous non-pitched: `^` suffix (for short phrases, hard-to-detect sounds)
- Do not mix pitched and non-pitched within the same word.

```
All right!  → All# right!#
in- de- fa- ti- ga- bly  (non-pitched) → in-# de-# fa-# ti-# ga-# bly#
```

### 8.6 Capitalization Rules

- **Always** capitalize the first word of every phrase.
- Capitalize proper nouns, God/Jesus (Christian context), Devil/Satan.
- Capitalize band/song/movie/book titles using standard American style guide.
- In Harmony mode: when HARM2 and HARM3 share the lyric bar but sing different things, capitalize the first word of each part's lyric independently.

### 8.7 Punctuation Rules

| Mark | Use |
|------|-----|
| `?` | Ends a question or raised-tone phrase; next word capitalized |
| `!` | Vocalist sings much louder than normal; use sparingly |
| `?!` | Both question and exclamation |
| `-` (hyphen) | Compound words and multi-syllable word breaks |
| `'` | Truncated words or deliberate non-pronunciation |

**Never use:** periods, commas, or quotation marks.

### 8.8 Standard Sound Spellings

| Sound | Spelling |
|-------|---------|
| Hard "E" | Ee |
| Soft "ehh" | Eh |
| Hard "A" | Ay |
| "No" sound | Oh |
| "You" sound | Ooh |
| Open "ahh" | Ah |
| "Aww" | Aw |
| Neutral | Uh |
| Nasal | Mmm (NOT "Nnn") |

---

## 9. Overdrive, Solo Markers & Special Sections

### 9.1 Overdrive (Star Power)

- Overdrive phrases are placed on all instrument tracks.
- For Keyboards: 5-Lane and Expert Pro Keys overdrive must match.
- For Vocals: VOCALS and HARM1 overdrive must match (due to RB3 bug).
- Drummer deploys overdrive through **drum fills** — avoid fills before long drum rests.

### 9.2 Solo Sections

| Instrument | MIDI Note |
|-----------|-----------|
| Guitar/Bass | 103 (G6) |
| Pro Keys | 115 (G7) |

- End solo markers as early as possible at the end of a song.
- Only mark obvious solos — not small fills or repeated lead lines.

### 9.3 Trill & Tremolo Lanes

| Lane | MIDI Note | Use |
|------|-----------|-----|
| Tremolo | 126 (F#8) | Fast single-note strumming or chord strumming |
| Trill | 127 (G8) | Rapid alternation between two frets |

Both allow free-form play as long as the player maintains ≥160ms between hits.

### 9.4 Practice Sections

Practice sections are text events in the EVENTS track. Each section begins with a `[section <name>]` event. Name the sections clearly (e.g., `[section verse]`, `[section chorus]`, `[section solo]`).

### 9.5 Big Rock Endings (BRE)

BRE sections are authored separately in all instrument MIDI tracks. During a BRE, players can freely play any gems to rack up bonus points. All instrument parts must have matching BRE regions.

---

## 10. Missing Chart-Editor Features

The current chart-editor at `/app/admin/chart-editor` is functional for basic charting but is missing numerous features required for professional Rock Band/YARG authoring.

### 10.1 Critical Note Editing Gaps

| Feature | Status | Impact |
|---------|--------|--------|
| **Lyric editing** | ❌ Missing | Cannot author vocals at all |
| **Sustain tail rendering** | ❌ Missing | Can't visually distinguish hold vs. strum notes |
| **Accent/bend/slide/vibrato flags** | ❌ Missing | Limited expressive note types |
| **Open hi-hat note (fret 5) for drums** | ❌ Missing | Drums can't express open hi-hat |
| **Vocal pitch (note tube) editing** | ❌ Missing | No melodic contour for vocals |

### 10.2 Pro Instrument Support

| Feature | Status |
|---------|--------|
| Pro Drums (6-pad layout, tom modifiers 110-112) | ❌ Missing |
| Pro Keys (17-fret piano roll, lane shifts) | ❌ Missing |
| Disco flip (`drums0d`) visualization | ❌ Missing |
| Drum roll lanes (MIDI 126/127) | ❌ Missing (generic tremolo only) |

### 10.3 Missing Phrase/Section Types

| Feature | Status |
|---------|--------|
| Drum Fill lanes (MIDI 120–124) | ❌ Missing |
| Practice Sections (EVENTS track text events) | ❌ Missing |
| Big Rock Endings | ❌ Missing |
| Solo markers per-instrument | ⚠️ Partial (only via generic phrase) |

### 10.4 Audio & Sync

| Feature | Status |
|---------|--------|
| Live audio preview (hear notes as you place them) | ❌ Missing |
| Auto beat detection from audio | ❌ Missing |
| Audio scrubbing during playback seek | ❌ Missing |
| Stem mute/solo controls per instrument | ❌ Missing |
| Automatic vocal pitch extraction | ❌ Missing |

### 10.5 Editing Productivity

| Feature | Status |
|---------|--------|
| Multi-note lasso/range selection | ❌ Missing |
| Copy/paste note patterns | ❌ Missing |
| Quantize tool (snap existing notes to grid) | ❌ Missing |
| Batch transpose / fret remap | ❌ Missing |
| Batch duration change | ❌ Missing |
| Difficulty auto-reduction (Expert → Hard → Medium → Easy) | ❌ Missing |
| Per-note velocity editing | ❌ Missing |

### 10.6 Validation & Quality Control

| Feature | Status |
|---------|--------|
| Chart validation (detect spacing violations, overlapping notes, etc.) | ❌ Missing |
| Note count / density statistics panel | ❌ Missing |
| Difficulty rating calculator | ❌ Missing |
| Gap violation highlighting (e.g., sustain too close to next note) | ❌ Missing |

### 10.7 File Format Gaps

| Feature | Status |
|---------|--------|
| `.sng` (Clone Hero compressed) import/export | ❌ Missing |
| `.rbproj` (Rock Band project) support | ❌ Missing |
| Magma-compatible MIDI export (proper track naming) | ⚠️ Unknown |

### 10.8 BPM & Tempo

| Feature | Status |
|---------|--------|
| Tempo curve visualization | ❌ Missing |
| Batch BPM edit | ❌ Missing |
| Key signature support | ❌ Missing |
| Tempo ramps (gradual BPM changes) | ❌ Missing |
| Beat-detection assisted tempo mapping | ❌ Missing |

### 10.9 UX / Keyboard Shortcuts

| Feature | Status |
|---------|--------|
| Full keyboard shortcut set | ⚠️ Partial (only H/S for HOPO flags) |
| Undo history visualization | ❌ Missing |
| Search/find notes by property | ❌ Missing |
| Video reference track | ❌ Missing |

---

## 11. Automated Charting Plan (from .mp3)

This workflow produces a playable chart from a single `.mp3` file using freely available automated tools, with manual cleanup at each stage.

### Phase 1: Audio Analysis & Stem Separation

**Goal:** Extract per-instrument audio and detect the tempo map.

#### Step 1.1 — Source Separation
Use **Demucs** (by Facebook Research) to separate the mix into stems:

```bash
pip install demucs
demucs --two-stems=vocals "song.mp3"
# Outputs: vocals.wav + no_vocals.wav (or full 4-stem: drums/bass/other/vocals)
demucs -n htdemucs_6s "song.mp3"
# 6-stem: drums, bass, guitar, piano, vocals, other
```

Output stems can be used directly in the chart editor as instrument audio references.

#### Step 1.2 — Beat & BPM Detection
Use **madmom** or **librosa** to extract a BPM map:

```bash
pip install madmom librosa
python3 - <<'EOF'
import librosa
y, sr = librosa.load("song.mp3")
tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
print(f"Estimated BPM: {tempo:.2f}")
beat_times = librosa.frames_to_time(beats, sr=sr)
for i, t in enumerate(beat_times):
    print(f"Beat {i+1}: {t:.3f}s")
EOF
```

For variable-tempo songs, use **BeatNet** or **madmom's DBNBeatTracker**:
```bash
pip install madmom
python3 -c "
from madmom.features.beats import DBNBeatTrackingProcessor, RNNBeatProcessor
proc = DBNBeatTrackingProcessor(fps=100)
act = RNNBeatProcessor()('song.mp3')
beats = proc(act)
print(beats)
"
```

Import the resulting beat timestamps into the chart editor as BPM events.

### Phase 2: Automatic Note Detection

#### Step 2.1 — Guitar/Bass Detection
Use **Basic Pitch** (Spotify) for pitch detection from audio:

```bash
pip install basic-pitch
basic-pitch output_dir/ song.mp3
# Produces a MIDI file with detected pitches
```

The output MIDI can be imported into the chart editor and manually corrected. The automatic transcription gives a useful starting point, especially for the melodic structure.

#### Step 2.2 — Drum Detection
Use **ADTlib** or **DrumTranscriber** for automatic drum transcription:

```bash
pip install adtlib
python3 -c "
import adtlib
transcription = adtlib.transcribe('drums_stem.wav')
transcription.save_midi('drums.mid')
"
```

Alternatively, use **Magenta's onsets-and-frames** model for general onset detection:
```bash
pip install magenta
onsets_frames_transcription_transcribe --acoustic_run_dir=... drums_stem.wav
```

#### Step 2.3 — Vocal Melody Extraction
Use **CREPE** (monophonic pitch estimator) on the vocal stem:

```bash
pip install crepe
python3 -c "
import crepe, soundfile as sf
audio, sr = sf.read('vocals.wav')
time, frequency, confidence, activation = crepe.predict(audio, sr)
# confidence > 0.8 → reliable pitch, output as MIDI note events
import numpy as np
for i, (t, f, c) in enumerate(zip(time, frequency, confidence)):
    if c > 0.8:
        midi_note = round(69 + 12 * np.log2(f / 440))
        print(f'{t:.3f}s: MIDI {midi_note} (confidence {c:.2f})')
"
```

This produces a rough vocal melody that can be imported as a starting point for vocal authoring.

### Phase 3: MIDI Post-Processing

#### Step 3.1 — Quantization
Snap auto-detected notes to the grid:

```bash
pip install pretty_midi
python3 - <<'EOF'
import pretty_midi

pm = pretty_midi.PrettyMIDI('detected.mid')
tempo = 120  # or detected BPM
resolution = pm.resolution
sixteenth_in_ticks = resolution // 4

for instrument in pm.instruments:
    for note in instrument.notes:
        # Snap start to nearest 16th note
        ticks = pm.time_to_tick(note.start)
        snapped = round(ticks / sixteenth_in_ticks) * sixteenth_in_ticks
        note.start = pm.tick_to_time(snapped)

pm.write('quantized.mid')
EOF
```

#### Step 3.2 — Guitar-to-5-Lane Mapping
Map detected guitar pitches to 5 button lanes:

```python
# Simple pitch-to-lane mapping (customize per song key)
def pitch_to_lane(midi_note):
    # Map chromatic scale to 5 lanes by modulo
    chromatic = midi_note % 12
    lane_map = {0: 0, 2: 1, 4: 2, 5: 2, 7: 3, 9: 3, 11: 4}  # C D E F G A B
    return lane_map.get(chromatic, chromatic % 5)
```

This mapping is imperfect — manual correction is always required to maintain consistency and preserve motion.

### Phase 4: Import & Manual Cleanup

#### Step 4.1 — Import into Chart Editor
1. Open the chart editor at `/admin/chart-editor`.
2. Upload the song `.mp3` as the audio reference.
3. Import the `quantized.mid` or export as `.chart` and upload.
4. Set BPM events from the detected tempo map.

#### Step 4.2 — Manual Review Order
Work through each instrument track in this priority order:

1. **Drums (Expert)** — fix pad mapping, remove false detections, add fills.
2. **Guitar (Expert)** → Hard → Medium → Easy — verify consistency and wrapping.
3. **Bass (Expert)** → reduce downward.
4. **Keys (Expert)** → reduce downward.
5. **Vocals (Expert)** — largest manual effort; fix pitch, add lyrics.

#### Step 4.3 — Validation Checklist
Before finalizing:

- [ ] No overlapping notes on any track
- [ ] All sustain gaps ≥ 1/32 note (standard 1/16)
- [ ] Lane consistency: all Expert colors appear in every lower difficulty
- [ ] Overdrive phrases placed and balanced across instruments
- [ ] Drum fills placed at major transitions
- [ ] Solo markers on obvious solos only
- [ ] Lyrics correctly hyphenated and capitalized
- [ ] Practice section text events in EVENTS track
- [ ] Drum mix events set at song start

### Phase 5: Toolchain Summary

| Tool | Purpose | Install |
|------|---------|---------|
| **Demucs** | Stem separation (drums/bass/guitar/vocals) | `pip install demucs` |
| **librosa** | BPM & beat detection | `pip install librosa` |
| **madmom** | Accurate beat tracking (variable tempo) | `pip install madmom` |
| **Basic Pitch** | Melodic pitch detection → MIDI | `pip install basic-pitch` |
| **CREPE** | Vocal melody extraction | `pip install crepe` |
| **pretty_midi** | MIDI post-processing & quantization | `pip install pretty_midi` |
| **Chart Editor** | Manual cleanup & export | This project |

### Phase 6: Realistic Expectations

| Stage | Automation Quality | Manual Work Required |
|-------|--------------------|----------------------|
| BPM detection | ~90% accurate for constant-tempo songs | Minor correction |
| Stem separation | Good quality (Demucs 6-stem) | Some bleed artifacts |
| Drum detection | ~70–80% hit rate | Significant cleanup |
| Guitar/bass MIDI | ~50–60% accuracy | Major cleanup + lane mapping |
| Vocal melody | ~80% for clean vocals | Syllable boundaries, lyrics |
| Difficulty reduction | 0% (no tool exists) | 100% manual per difficulty |

**Total realistic time estimate for a typical 4-minute rock song:**

| With Automation | Without Automation |
|-----------------|-------------------|
| Expert only: ~2–4 hours | Expert only: ~4–8 hours |
| All 4 difficulties: ~6–12 hours | All 4 difficulties: ~12–20 hours |
| Full chart + vocals: ~10–18 hours | Full chart + vocals: ~20–35 hours |

Automation significantly helps with beat detection and provides a first-pass skeleton for note placement, but a high-quality chart always requires skilled manual authoring.
