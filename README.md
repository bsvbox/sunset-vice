# Sunset Vice

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/bsvbox/sunset-vice/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/bsvbox/sunset-vice/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Top-down open-world crime game set in Palmetto Bay, a fictional beach city.
Built for the [make.fun "Make GTA 6" bounty](https://make.fun/bounty/gta6-01) (gta6-01). All art, story and
sound are original; nothing comes from Rockstar.

## Play

Open `game/index.html` in a desktop browser, or run `node serve.ts --port 8082`
from this repo and visit http://localhost:8082/.

- **WASD / arrows** — walk, or drive when in a car
- **Shift** — run
- **E** — steal / enter a car, or get out
- **Mouse + click** — aim and shoot (needs the pistol)
- **F** — punch
- **Space** — start, continue after Wasted / Busted
- **P** — pause, **M** — mute

## The city

Seven avenues and six streets, 35 buildings, parks, parking lots, a beach
and the docks. Traffic follows lights and turns at intersections; pedestrians
walk the streets. The minimap (top right) shows roads, the mission target,
police in red and you in white.

## Missions — work for Rico

1. **First Wheels** ($150) — steal a car, bring it to the Garage. Rico gives
   you a pistol after this job.
2. **The Pickup** ($250) — collect the package at the Docks.
3. **Hot Pursuit** ($300) — get to 2 wanted stars, then lose the heat.
4. **The Score** ($500) — rob the Corner Store (+$200 in the till), then get clean.
5. **Vice King** ($800) — escape a 3-star manhunt to the North Gate.

Mission rewards total $2,000, plus $200 from the store till = $2,200 total
earned, plus cash dropped by pedestrians and cops you take down.

## Wanted level

Stars rise when you steal cars, run people over or shoot. Police cars chase
and ram; cops get out and chase on foot when you are out of a car. Get
grabbed up close and you are Busted ($50 fine). Stay out of sight for 26
seconds and a star drops. **Pay n Spray** ($100) clears your wanted level
while you are in a car. Getting Wasted costs half your cash.

Progress (mission, cash, pistol) saves to localStorage. The title screen
shows your best earned total.

## Files

- `game/index.html` — the page
- `game/src/main.js` — loop, screens, save/load, camera
- `game/src/sim.js` — all game logic, no DOM (headless-testable)
- `game/src/city.js` — Palmetto Bay layout and buildings
- `game/src/render.js` — canvas drawing, HUD, minimap
- `game/src/scenes.js` — frozen screenshot scenes
- `game/src/input.js` — keyboard and mouse
- `game/src/audio.js` — synthesized WebAudio sound and music
- `game/src/rng.js` — seeded random helpers
- `main.ts`, `serve.ts` — the kit's entrypoint and dev server
- `screenshots/` — four stills (title, driving, police chase, robbery)

Built with Muse for mase (referral code 4eqvbahr).
