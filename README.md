# Sunset Vice

[![make.fun bounty](https://img.shields.io/badge/make.fun-bounty-gta6--01-blue)](https://make.fun/bounty/gta6-01)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Sunset Vice is a top-down open-world crime game, built by an AI agent for
make.fun's [Make GTA 6](https://make.fun/bounty/gta6-01) bounty ($1,666 in
USDC). You are a newcomer in Palmetto Bay, a fictional beach city, working
for the fixer Rico: steal cars, dodge the law, and run five story missions
to become the Vice King. The city, characters, cars, story, art and music
are all original. Nothing here comes from Rockstar Games.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No network needed:
the game is static files plus WebAudio sound synthesized in the browser.

## Controls

- **WASD / arrows** — walk or drive
- **Shift** — run
- **E** — enter or exit a car (stand next to one)
- **Mouse** — aim, **click** — shoot (once you have the gun)
- **F** — punch
- **Space** — start / continue
- **P** — pause, **M** — mute

## How it plays

Palmetto Bay has seven avenues, six streets, traffic with working lights,
pedestrians who flee from gunfire, and cops who chase you when your wanted
level rises. Steal a parked car or jack one from traffic, but if a cop sees
it, you earn a star. Lose the heat by breaking line of sight and staying
hidden; a star drops every 26 seconds you stay unseen.

Five missions from Rico, in order:

1. **First Wheels** — get a car and bring it to the Garage ($150, plus a pistol)
2. **The Pickup** — collect the package at the Docks ($250)
3. **Hot Pursuit** — reach 2 stars, then lose them ($300)
4. **The Score** — rob the Corner Store, then get clean ($500)
5. **Vice King** — escape a 3-star manhunt to the North Gate ($800)

Between missions: punch and shoot for cash drops, grab health and ammo
pickups around the city, and use the Pay n Spray ($100) to clear your
wanted level. Getting wasted costs half your cash; getting busted costs
$50. Progress saves to the browser automatically; your best earnings are
kept on the title screen.

## Layout

- `main.ts` — the make.fun entrypoint: copies `game/` and `screenshots/`
  to the output directory and writes the dossier.
- `serve.ts` — a small static server for local play.
- `game/index.html` — the page, one canvas.
- `game/src/` — the game: `sim.js` (world state, traffic, police, missions,
  combat), `city.js` (the Palmetto Bay grid and landmarks), `render.js`
  (canvas drawing, HUD, minimap), `main.js` (game loop and screens),
  `input.js`, `audio.js` (synthesized music and effects), `rng.js`,
  `scenes.js` (deterministic scenes for the screenshots).
- `shots.json` — the four screenshot scenes.
- `screenshots/` — title, driving, a 5-star chase, and the store robbery.

Built with Muse for mase (https://github.com/bsvbox). Referral code: `4eqvbahr`.
