---
workflow: general-video
flow: automation
storyboard: no
message: "Four crew members, one rocket, and the long way to the Moon."
destination: YouTube / itch / web page (16:9), TikTok / Reels / Shorts (9:16)
aspect: "16:9 and 9:16"
language: English
length: 30 seconds
---
# Beyond Earth trailer

## Intent
A 30 s game trailer for Beyond Earth (UI strings currently say "Moonbound"), the Apollo 11 mission game (interactive narrative + Saturn V / LM physics).
Viewers are players browsing a game page or a social feed, often with the sound off, so the type carries the message.
Afterwards they should play the game.

## Source material
- Cutscenes: **not used** (user decision 2026-11-14). launch/flag-planting are uncredited archival film; flag-planting has a third-party "T" watermark. intro.mp4 is the comic explainer.
- Gameplay: scripted local headless capture of the web app (mission control, Saturn V ascent, translunar, LM descent, decisions/endings). Local only, nothing uploaded.
- Stills: `apps/web/public/assets/nasa/*.jpg` (NASA, credit "NASA"), textures (see CREDITS.md)
- SFX: `apps/web/public/assets/audio/crowd-*.mp3` (public domain)
- Copy source: `apps/web/src/i18n/en.ts` (title "Moonbound", tagline above)

## Must show / must say
- Title: BEYOND EARTH (user decision). Tagline from the game.
- Real gameplay only (no archival film): launch, the descent, a narrative decision, an ending.
- Features only as documented in PROJECT.md (multi-stage Saturn V ascent, LM powered descent, branching decisions, multiple endings). No invented numbers, awards or dates.
- CTA: "Play now". URL slot left empty as a single variable; fill in and re-render later.

## Creative direction
- Tone: epic, tense, then triumphant. Hook → proof → escalation (ascent → descent, low fuel) → touchdown on a downbeat → end card.
- Real footage within the first 2 s.
- Type: kinetic slams, one bundled open display font, white text, one accent (to be picked from the game UI palette).
- Effects: punchy but restrained. Shake only at liftoff and touchdown, one consistent grade, subtle vignette, no grain.
- Music: one royalty-free / CC0 cinematic track, sourced locally. No VO. SFX 12–18 dB under the music.

## Deliverables
- `beyond-earth_trailer_16x9.mp4` and `beyond-earth_trailer_9x16.mp4`, 1080p30, H.264 + AAC 48 kHz, −14 LUFS / −1 dBTP.
- SCRIPT_FINAL.md, CLIPS.md. Local files only, no publishing.
- Autonomy: autonomous to final renders (default).
