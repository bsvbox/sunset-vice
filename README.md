# Sunset Vice

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/bsvbox/sunset-vice/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/bsvbox/sunset-vice/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game in the spirit of GTA 6, built for the [make.fun "Make GTA 6" bounty](https://make.fun/bounty/gta6-01). Everything here is original: the city, the characters, the story, the art and the sound. No Rockstar material.

You are a driver new to Palmetto Bay, a fictional beach city. A fixer named Rico has work for you, and the work pays — if the Palmetto Bay police do not catch you first.

## How to play

Open `game/index.html` in a desktop browser (or serve the folder with `node serve.ts` and visit http://localhost:8080). No network, no install, no account.

| Key | Action |
| --- | --- |
| WASD / arrows | Walk, or drive when in a car |
| Shift | Run |
| E | Enter or exit a car (stealing a parked car raises your wanted level) |
| Mouse + click | Aim and shoot (once you have a gun) |
| F | Punch |
| Space | Start / continue |
| P | Pause |
| M | Mute |

Progress saves to the browser automatically (mission, cash, earned total, gun and ammo).

## Missions

Rico's jobs pay $2,000 in total. A full clean run earns $2,200, counting the Corner Store till.

1. **First Wheels** — $150. Steal a car and drive it to Rico's Garage. Rico hands you a pistol (+24 ammo).
2. **The Pickup** — $250. Stand at the Docks for the drop.
3. **Hot Pursuit** — $300. Raise 2 wanted stars, then lose them all.
4. **The Score** — $500. Rob the Corner Store (hold still for 4 seconds, +$200 from the till), then lose the heat.
5. **Vice King** — $800. Reach the North Gate with the cops still on you.

## Wanted, police and Pay n Spray

Stealing a car, running someone over or shooting at people and cops raises your wanted level, up to 5 stars. The more stars, the more cruisers hunt you. Stay out of sight and a star drops every 26 seconds. A cruiser that catches you on foot drags you in: busted means a $50 fine and a clean record. Get your health to zero and you are wasted — half your cash is gone.

Pay n Spray ($100, while driving) repaints your car and clears your wanted level on the spot.

## The city

Palmetto Bay is a seeded grid: 7 avenues, 6 streets, a beach on the south shore, a plaza, docks, a garage, a corner store, a spray shop and the North Gate. Traffic obeys the lights, pedestrians wander the sidewalks, and pickups (health, ammo, cash) respawn around town. The minimap in the corner always shows the cops in red and your next job in gold.

## Files

- `main.ts` — the dossier entrypoint: copies `game/` and `screenshots/` to the output directory and writes `dossier.json`.
- `game/index.html` — the playable page (canvas + ES modules, no libraries).
- `game/src/sim.js` — the pure simulation: city, missions, police, combat, traffic.
- `game/src/city.js` — the seeded city layout.
- `game/src/render.js` — canvas drawing: city, HUD, minimap.
- `game/src/scenes.js` — the four frozen screenshot scenes.
- `game/src/main.js` — the loop, screens and save.
- `game/src/input.js` — keyboard and mouse.
- `game/src/audio.js` — synthesized sound (WebAudio, no files).
- `serve.ts` — a tiny static server for local play.
- `shots.json` — the four screenshot scenes.

## Credits

Built by the @muse-fun agent for the make.fun bounty. Referral code: `4eqvbahr`. License: MIT.
