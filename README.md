[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/bsvbox/sunset-vice/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/bsvbox/sunset-vice/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Sunset Vice — Palmetto Bay

An open-world crime game in the spirit of GTA 6, built for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01). It runs offline in a desktop browser from static files: no server, no network requests, no libraries. Everything in it is original — the city, the names, the story, the art and the sound.

You are a wheelman working for Rico, a fixer in Palmetto Bay, a fictional sun-soaked beach city. Steal cars, outrun the police, rob the Corner Store, and finish all five jobs to become Vice King.

## Play

Serve the game locally and open it in a desktop browser:

```
node serve.ts --port 8082
```

Then open http://localhost:8082. Or open `game/index.html` through any static file server.

## Controls

- WASD / arrow keys — walk or drive
- Shift — run
- E — enter or exit a car
- Mouse aim + click — shoot (once you have the pistol)
- F — punch
- Space — start / continue
- P — pause
- M — mute

## Missions

1. **First Wheels** ($150) — steal a car and drive it to Rico's Garage. Rico hands you a pistol (+24 ammo).
2. **The Pickup** ($250) — wait at the Docks for Rico's contact.
3. **Hot Pursuit** ($300) — get the heat to two stars, then lose the cops.
4. **The Score** ($500) — rob the Corner Store till (+$200) and lose the cops.
5. **Vice King** ($800) — with three stars on you, reach the North Gate.

Mission rewards total $2,000; a full clean run earns $2,200 including the till cash.

## Wanted, police and Pay n Spray

Stealing a car, running over pedestrians and shooting raise your wanted level. Cops chase in cars, ram you, and on foot they drag you in — get busted and you pay a $50 fine. A star drops every 26 seconds no cop can see you. A Pay n Spray visit costs $100 and clears your wanted level on the spot.

Wasted costs half your cash. Progress saves to the browser (localStorage), so your missions, cash and best score survive a reload.

## What is in the game

- A drivable city on foot and by car: avenues, streets, traffic lights, traffic cars and pedestrians
- Cars to steal, police who respond to your wanted level, combat, pickups
- A HUD with cash, health, weapon, wanted stars, mission objectives and a minimap of Palmetto Bay
- A story told through five missions, with a title screen, pause, wasted, busted and win screens
- Synthesised sound: a bass loop plus effects, no audio files

## Files

- `main.ts` — the dossier entrypoint: stages the game and screenshots and writes `dossier.json`
- `game/index.html` — the playable game
- `game/src/sim.js` — the whole simulation, pure logic with no DOM
- `game/src/city.js` — Palmetto Bay: the road grid, landmarks, buildings, trees and lots
- `game/src/render.js` — the canvas renderer, HUD and minimap
- `game/src/scenes.js` — the four staged screenshot setups
- `game/src/main.js` — the browser shell: loop, screens and save file
- `game/src/input.js` — keyboard and mouse
- `game/src/audio.js` — WebAudio synth
- `game/src/rng.js` — the seeded random generator
- `screenshots/` — four screenshots of the game itself
- `vendor/makefun-game.ts` — the make.fun dossier library, unchanged from the kit

## License

MIT. Referral code: 4eqvbahr.
