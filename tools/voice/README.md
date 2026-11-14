# Voice lines

Every line the game says aloud (briefings, decisions, aftermath, assembly hall, launch radio, Moon-trip
narration, descent calls, endings) is recorded in English and Vietnamese with
[AIMAX Studio](https://www.aimaxstudio.com), and the game plays the recording that matches the player's
language. The browser's speech synthesis is only a safety net, used if the voice library itself cannot be
loaded; a line that simply has no recording stays silent.

```
tools/voice/voices.json   which voice reads which role (edit this to change a voice)
tools/voice/lines.json    every line + its role, extracted from the game's own data (generated)
apps/web/public/assets/voice/manifest.json    recording lookup used by the game (generated)
apps/web/public/assets/voice/{en,vi}/*.m4a    the recordings (generated)
```

## How a line finds its recording

The game never passes ids around. A recording is looked up by **language + the exact words** (a hash,
`apps/web/src/game/voiceKey.ts`), so anything that calls `speak(text, locale)` or the `useVoiceLine(text)`
hook gets the recorded voice automatically. Roles (who says it) are only used when recording.

## Change a voice

1. Edit the voice name for the role in `voices.json` (names are matched exactly; browse them in the AIMAX
   dashboard, or use the audition page).
2. `pnpm voice:generate -- --only-role=kranz` re-records just that role.

## Add or reword a line

1. Add the text where the game keeps it (script, decisions, i18n...). If it is a new *kind* of line,
   add it to `tools/voice/extract-lines.ts` with its role.
2. `pnpm voice:lines` refreshes `lines.json`.
3. `pnpm voice:generate` records only the new / changed lines. `pnpm test` fails (in
   `voicePlayer.test.ts`) if a line in `lines.json` has no recording.

A line with a **live number** on screen (a countdown, a speed) cannot be recorded as is: give it a number-free
twin, show that on screen or pass it as `as` to `useVoiceLine` (see `lunarDescent.callVoice`).

## Needs

- `AIMAX_API_KEY` in the environment or in the gitignored `.env.local` (never commit it).
- `ffmpeg` on the PATH (or `FFMPEG=path/to/ffmpeg`), only to cut the recordings and make them small
  (mono AAC, about 6 KB a second). `VOICE_BITRATE=64k` for higher quality.

Recording is slow per request (about two minutes whatever the length), so `generate` sends all the lines of a
voice in one request and cuts the result by sentence timings; a line it cannot match is recorded on its own.
`--dry-run` counts what would be recorded without spending anything.
