# Fireline Command — Soundtrack Design Brief

*For the composer. Written 2026-08-02. Game: a deterministic,
server-authoritative multiplayer wargame — 32 combined-arms seats,
two factions, fog of war, rescue-over-kills values. Tagline: "Join
the battle. Turn the front."*

## The sound of the game (read this first)

**The world**: a weathered mid-century-adjacent front — tanks, scout
bikes, logistics trucks, command carriers, artillery. Not WW2 pastiche,
not sci-fi: a *fictional* war with radio chatter, mud roads, farmhands
who flee the fighting, prison compounds with watchmen. The art is
low-poly with faction paint over worn metal.

**The values**: rescue outranks kills. Towing a wreck home, springing a
POW, escorting a carrier — that's the glory here. The music should
carry *duty and camaraderie* more than triumph and menace.

**The established audio direction** is synth-first (an earlier ruling:
SFX are WebAudio-synthesized). The score works best as a **hybrid**:
analog-style synth beds and pulses as the backbone, with one or two
*human* lead voices per theme (a horn, a cello, a twanged guitar, a
whistled line) so the emotional reads stay warm against the synthetic
battlefield. Think "Scandinavian synthwave meets field-radio folk" —
but your instincts win; this is a direction, not a cage.

**The two factions** (for flavour, not separate scores):
- **The Directorate** — order, doctrine, slate-blue. Motifs: square
  rhythms, brass-like pads, confident fourths/fifths.
- **The Outliers** — improvisers, scavengers, terracotta. Motifs:
  syncopation, bent notes, found-percussion textures.
A shared 4-6 note **Fireline motif** that both flavours can quote
would tie the whole score together — it should fit in a 3-second
sting and stretch into a theme.

## Technical constraints

- **Format**: OGG Vorbis preferred (plus source WAV). Target ≤ 5 MB
  per loop; the whole game currently ships with zero runtime
  dependencies and small downloads, and music will be the biggest
  asset class we have.
- **Loops must be seamless** — please author intro→loop structure as
  TWO files (`x_intro.ogg` + `x_loop.ogg`) so we can play the intro
  once and loop cleanly, or a single file with a documented loop
  point in samples.
- Mix for small speakers and headphones both; the game's SFX
  (synthesized shots/engines) sit mid-band, so leave the 300 Hz-2 kHz
  band uncluttered during "war" tracks.
- Stingers must land their point in the stated length with a clean
  tail (we duck/stop music under them).

## Track list

### 1. Core loop (highest priority — the game needs these four first)

| # | Track | Where it plays | Length | Theme & notes |
|---|---|---|---|---|
| 1 | **Fireline Theme (splash/loading)** | The splash screen and loading | 45-70 s, intro + loop | The front at dawn before anything moves. State the Fireline motif fully — restrained, expectant, a slow build that never quite breaks. This is the track players will hear a thousand times: beauty over bombast. |
| 2 | **Briefing** | The join/briefing overlay ("MOVE OUT") | 30-45 s loop | Radio-room urgency: teletype/morse-adjacent percussion textures, a map-table pulse, the motif clipped short. Should make pressing "Move out (Enter)" feel inevitable. |
| 3 | **The Front (frontier_corridor)** | Default map, in-war bed | 2:30-3:30 loop | The workhorse track. Mid-energy, long phrases, room for 20-minute wars — duty, mud, convoys on a road. Must survive hundreds of listens: lean on texture and a patient bassline, quote the motif sparingly. Leave the mix open for gunfire SFX. |
| 4 | **Victory / Defeat pair** | End screen | 12-20 s each, no loop (a 30-45 s looping tail underneath is welcome) | Victory: the motif resolved warmly — *earned*, comradely, not imperial (rescues won this war). Defeat: the same motif unresolved, minor-leaning, respectful — you get another war in 30 seconds, so no despair. |

### 2. Map themes (one per shipped map — each map has a stated identity)

| # | Track | Map & identity | Length | Theme |
|---|---|---|---|---|
| 5 | **Blackwood** | Dense woodland; quiet positional wars, ambushes, fog is king | 2:30-3:30 loop | Hushed and close: low woodwind-like synth, ticking percussion like branches, held dissonances that never resolve. The scariest thing on this map is what you can't see. |
| 6 | **Sawtooth** | Canyon mesas, chokepoints, a western stand-off feel | 2:30-3:30 loop | Wide-open reverb, twang (a guitar or synth-steel lead), drums like distant rockfall. High noon at the gap. |
| 7 | **Riverline** | Water crossings, bridges that get blown and rebuilt, the amphibious Skimmer | 2:30-3:30 loop | Flowing ostinatos, water-glass textures, a theme that "crosses" registers the way the map crosses the river. Slightly melancholy — this map's wars run long. |
| 8 | **Caldera** | The ring road around a crater; fast, brutal, elimination-heavy brawls (13-minute wars) | 2:00-2:30 loop | The arena track: driving, circular chord loop that never cadences (the road has no end), the score's highest sustained energy. Shorter loop is fine — the wars are short. |

### 3. Mode stingers & mission beds (the asymmetric modes)

| # | Track | Where | Length | Theme |
|---|---|---|---|---|
| 9 | **Convoy Escort bed** | MODE=convoy wars (replaces the map bed) | 2:00-3:00 loop | A rolling wheels-on-road pulse that *keeps moving* — the convoy must not stop, and neither does the track. Add a tension layer note (see §4). |
| 10 | **Heist bed** | MODE=heist wars | 2:00-3:00 loop | Slow-burn caper over a war engine: muted pulse, pizzicato-like plucks, the motif played *sneakily*. When the Asset moves, radio pings betray the thief — the track should feel like being hunted. |
| 11 | **Mission clock sting** | Last 60 s of a convoy/heist clock | 8-12 s sting, layerable | A rising radio-alarm figure we can layer over the bed as the timer runs out. |
| 12 | **Mercy / Last Convoy sting** | When the endgame flips (a beaten team runs its last hulls home) | 10-15 s | The saddest, proudest moment in the game: the motif as a retreat hymn. This moment is why the score exists. |

### 4. Optional second round (nice-to-have, after the above)

- **Intensity layer** for tracks 3 and 5-8: a stem (percussion +
  high-string tension) we can fade in when combat density rises near
  the player, and out in quiet phases. If you author the map themes
  as stems anyway, this comes almost free.
- **Vote/postgame interlude** (20-30 s loop): the campfire between
  wars; acoustic-leaning, the motif hummed. Plays under the end
  screen's map+mode vote.
- **POW rescue sting** (5-8 s): a freed-prisoner moment — one bright
  phrase, warm, quick.
- **The Landship horn** (3-5 s): a foghorn-like ident when the
  neutral fortress is claimed. Diegetic — as if the vehicle itself
  sounds it.
- **Weather front layer** (texture, 60 s loop): the seed-scheduled
  storms halve sensors; a wind/static texture we can blend in.

## Delivery priorities

1. Tracks 1-4 (the game feels *scored* the moment these land).
2. Tracks 5-8 (each shipped map gets its identity).
3. Tracks 9-12 (the modes and the big emotional beats).
4. §4 as inspiration strikes.

## Practical notes for integration

- We control playback: fades, ducks under stingers, and per-map
  selection are our job; you never need to author transitions between
  tracks.
- Loudness target around -16 LUFS integrated for beds, stingers may
  peak louder; we'll normalize on import either way.
- Names: `01_fireline_theme_intro.ogg` / `01_fireline_theme_loop.ogg`
  pattern keeps the manifest trivial.
- Anything you deliver will be wired behind the existing audio-cues
  module with per-track volume in settings; the synth SFX bus stays
  separate so your mix survives the battlefield. A player-facing
  Music on/off toggle already ships in the options panel.
