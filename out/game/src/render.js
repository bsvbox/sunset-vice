// Sunset Vice renderer: a top-down canvas view of Palmetto Bay, the HUD with a
// minimap, and the title / pause / game-over screens. All art is drawn in code.
import {
  CAR,
  COLORS,
  MISSIONS,
  PLAYER,
  ROAD_W,
  ROADS_X,
  ROADS_Y,
  WORLD,
} from './config.js';
import { PLACES } from './world.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;

const MINIMAP_W = 190;
const MINIMAP_H = 150;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    return { w, h };
  }

  function cameraFor(player, w, h, pan) {
    let cx = player.x - w / 2;
    let cy = player.y - h / 2;
    if (pan) {
      cx = 1300 - w / 2 + Math.cos(pan) * 260;
      cy = 1000 - h / 2 + Math.sin(pan * 0.7) * 160;
    }
    return {
      x: Math.max(0, Math.min(WORLD.width - w, cx)),
      y: Math.max(0, Math.min(WORLD.height - h, cy)),
      w, h,
    };
  }

  function drawCity(world, cam) {
    const { buildings, trees, parks } = world.city;
    // Ground: grass, with the beach and sea along the south edge.
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(0, 0, cam.w, cam.h);
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(-cam.x, 1760 - cam.y, WORLD.width, 140);
    ctx.fillStyle = COLORS.water;
    ctx.fillRect(-cam.x, 1900 - cam.y, WORLD.width, 100);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let x = 0; x < WORLD.width; x += 180) {
      ctx.fillRect(x - cam.x, 1896 - cam.y + Math.sin(x * 0.01) * 3, 60, 3);
    }
    // Parks.
    ctx.fillStyle = COLORS.park;
    for (const park of parks) {
      ctx.fillRect(park.x - cam.x, park.y - cam.y, park.w, park.h);
    }
    // Roads: asphalt, sidewalks, centre dashes.
    for (const rx of ROADS_X) {
      ctx.fillStyle = COLORS.sidewalk;
      ctx.fillRect(rx - ROAD_W / 2 - 10 - cam.x, -cam.y, ROAD_W + 20, WORLD.height);
      ctx.fillStyle = COLORS.road;
      ctx.fillRect(rx - ROAD_W / 2 - cam.x, -cam.y, ROAD_W, WORLD.height);
      ctx.fillStyle = COLORS.lane;
      for (let y = 0; y < WORLD.height; y += 56) {
        ctx.fillRect(rx - 2 - cam.x, y - cam.y, 4, 26);
      }
    }
    for (const ry of ROADS_Y) {
      ctx.fillStyle = COLORS.sidewalk;
      ctx.fillRect(-cam.x, ry - ROAD_W / 2 - 10 - cam.y, WORLD.width, ROAD_W + 20);
      ctx.fillStyle = COLORS.road;
      ctx.fillRect(-cam.x, ry - ROAD_W / 2 - cam.y, WORLD.width, ROAD_W);
      ctx.fillStyle = COLORS.lane;
      for (let x = 0; x < WORLD.width; x += 56) {
        ctx.fillRect(x - cam.x, ry - 2 - cam.y, 26, 4);
      }
    }
    // Crosswalks at intersections.
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (const rx of ROADS_X) {
      for (const ry of ROADS_Y) {
        for (let i = -3; i <= 3; i += 1) {
          ctx.fillRect(rx + i * 12 - 4 - cam.x, ry - ROAD_W / 2 + 4 - cam.y, 8, 12);
          ctx.fillRect(rx + i * 12 - 4 - cam.x, ry + ROAD_W / 2 - 16 - cam.y, 8, 12);
        }
      }
    }
    // Buildings: roof, edge and windows.
    for (const b of buildings) {
      ctx.fillStyle = COLORS.buildingEdge;
      ctx.fillRect(b.x - 3 - cam.x, b.y - 3 - cam.y, b.w + 6, b.h + 6);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x - cam.x, b.y - cam.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      for (let wx = b.x + 12; wx < b.x + b.w - 12; wx += 26) {
        for (let wy = b.y + 12; wy < b.y + b.h - 12; wy += 26) {
          ctx.fillRect(wx - cam.x, wy - cam.y, 10, 8);
        }
      }
    }
    // Trees.
    for (const t of trees) {
      ctx.fillStyle = '#2d5a34';
      ctx.beginPath();
      ctx.arc(t.x - cam.x, t.y - cam.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#57a05e';
      ctx.beginPath();
      ctx.arc(t.x - 3 - cam.x, t.y - 3 - cam.y, t.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMarker(x, y, color, label, cam, pulse) {
    const r = 16 + (pulse ? Math.sin(Date.now() / 300) * 4 : 0);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x - cam.x, y - cam.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x - cam.x, y - cam.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x - cam.x, y - 26 - cam.y);
  }

  function drawCar(car, cam) {
    ctx.save();
    ctx.translate(car.x - cam.x, car.y - cam.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-CAR.length / 2 + 3, -CAR.width / 2 + 3, CAR.length, CAR.width);
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(20,30,45,0.85)';
    ctx.fillRect(-6, -CAR.width / 2 + 4, 16, CAR.width - 8);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(CAR.length / 2 - 6, -CAR.width / 2 + 3, 3, 5);
    ctx.fillRect(CAR.length / 2 - 6, CAR.width / 2 - 8, 3, 5);
    if (car.kind === 'police') {
      ctx.fillStyle = '#e8e8e8';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PD', 0, 3);
      const blink = Math.floor(Date.now() / 250) % 2 === 0;
      ctx.fillStyle = blink ? '#ff2d2d' : '#2d6bff';
      ctx.beginPath();
      ctx.arc(-10, -CAR.width / 2 + 2, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = blink ? '#2d6bff' : '#ff2d2d';
      ctx.beginPath();
      ctx.arc(-10, CAR.width / 2 - 2, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPerson(x, y, angle, color, cam, radius) {
    ctx.save();
    ctx.translate(x - cam.x, y - cam.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(2, 3, radius, radius * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath();
    ctx.arc(radius * 0.55, 0, radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawHud(world, cam, best, muted) {
    const s = world.state;
    const p = s.player;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    // Top-left: health, cash, score.
    ctx.fillStyle = 'rgba(10,10,16,0.65)';
    ctx.fillRect(12, 12, 250, 86);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(24, 24, 150, 14);
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(24, 24, Math.min(150, 150 * Math.max(0, p.hp / PLAYER.health)), 14);
    ctx.fillStyle = COLORS.hud;
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`HP ${Math.ceil(Math.min(p.hp, PLAYER.health))}`, 182, 36);
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#2ecc71';
    ctx.fillText(`$${s.money}`, 24, 64);
    ctx.fillStyle = COLORS.hud;
    ctx.font = '13px sans-serif';
    ctx.fillText(`Score ${s.earned + s.missionIndex * 1000 + s.kills * 10}   Best ${best}`, 24, 84);
    if (p.inCar) {
      ctx.fillStyle = COLORS.hud;
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(`${Math.abs(Math.round(p.inCar.speed * 0.18))} mph`, 24, 118);
    }
    // Wanted stars, top-right above the minimap.
    const stars = '★'.repeat(s.wanted) + '☆'.repeat(5 - s.wanted);
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = s.wanted > 0 ? '#ffd32a' : 'rgba(245,240,230,0.4)';
    ctx.fillText(stars, cam.w - 16, 36);
    ctx.textAlign = 'left';
    // Mission line.
    ctx.fillStyle = 'rgba(10,10,16,0.65)';
    const mission = world.missionText();
    ctx.font = 'bold 15px sans-serif';
    const mw = ctx.measureText(mission).width + 24;
    ctx.fillRect(12, cam.h - 96, Math.min(mw, cam.w - 24), 30);
    ctx.fillStyle = '#ffd32a';
    ctx.fillText(
      s.missionIndex >= MISSIONS.length ? 'FREE ROAM' : `MISSION ${s.missionIndex + 1}/5: ${MISSIONS[s.missionIndex].title}`,
      24, cam.h - 75,
    );
    ctx.fillStyle = COLORS.hud;
    ctx.font = '14px sans-serif';
    ctx.fillText(mission, 24, cam.h - 56);
    // Message feed.
    ctx.font = 'bold 14px sans-serif';
    s.messages.forEach((m, i) => {
      ctx.fillStyle = `rgba(245,240,230,${Math.max(0, 1 - m.t / 6)})`;
      ctx.fillText(m.text, 24, cam.h - 120 - i * 20);
    });
    // Controls hint.
    ctx.fillStyle = 'rgba(245,240,230,0.6)';
    ctx.font = '12px sans-serif';
    ctx.fillText('WASD move/drive · E enter car · Space punch · Click shoot · P pause · M mute' + (muted ? ' · MUTED' : ''), 24, cam.h - 16);
    // Ammo.
    if (!p.inCar) {
      ctx.fillStyle = COLORS.hud;
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`Ammo ${p.ammo}`, 24, 140);
    }
    drawMinimap(world, cam);
  }

  function drawMinimap(world, cam) {
    const s = world.state;
    const mx = cam.w - MINIMAP_W - 12;
    const my = 48;
    const sx = MINIMAP_W / WORLD.width;
    const sy = MINIMAP_H / WORLD.height;
    ctx.fillStyle = 'rgba(10,10,16,0.75)';
    ctx.fillRect(mx - 4, my - 4, MINIMAP_W + 8, MINIMAP_H + 8);
    ctx.fillStyle = '#22442a';
    ctx.fillRect(mx, my, MINIMAP_W, MINIMAP_H);
    ctx.strokeStyle = '#55555f';
    ctx.lineWidth = 2;
    for (const rx of ROADS_X) {
      ctx.beginPath();
      ctx.moveTo(mx + rx * sx, my);
      ctx.lineTo(mx + rx * sx, my + MINIMAP_H);
      ctx.stroke();
    }
    for (const ry of ROADS_Y) {
      ctx.beginPath();
      ctx.moveTo(mx, my + ry * sy);
      ctx.lineTo(mx + MINIMAP_W, my + ry * sy);
      ctx.stroke();
    }
    ctx.fillStyle = '#2b6cb0';
    ctx.fillRect(mx, my + 1900 * sy, MINIMAP_W, MINIMAP_H - 1900 * sy);
    const target = world.missionTarget();
    if (target) {
      ctx.fillStyle = '#ffd32a';
      ctx.beginPath();
      ctx.arc(mx + target.x * sx, my + target.y * sy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ff5e78';
    ctx.beginPath();
    ctx.arc(mx + s.player.x * sx, my + s.player.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2d6bff';
    for (const car of s.copCars) {
      ctx.beginPath();
      ctx.arc(mx + car.x * sx, my + car.y * sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(245,240,230,0.7)';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx + cam.x * sx, my + cam.y * sy, cam.w * sx, cam.h * sy);
  }

  function overlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(8,8,14,0.72)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 90);
    ctx.fillStyle = COLORS.hud;
    ctx.font = '18px sans-serif';
    lines.forEach((line, i) => {
      ctx.fillText(line, canvas.width / 2, canvas.height / 2 - 30 + i * 28);
    });
    ctx.textAlign = 'left';
  }

  function draw(world, screen, opts) {
    const { w, h } = resize();
    const s = world.state;
    const cam = cameraFor(s.player, w, h, screen === SCREEN_TITLE ? s.time * 0.05 : 0);
    ctx.clearRect(0, 0, w, h);
    drawCity(world, cam);
    // Mission target marker.
    const target = world.missionTarget();
    if (target && screen === SCREEN_PLAY) {
      drawMarker(target.x, target.y, '#ffd32a', target.label, cam, true);
    }
    drawMarker(PLACES.spray.x, PLACES.spray.y, '#2ecc71', 'Spray', cam, false);
    drawMarker(PLACES.hospital.x, PLACES.hospital.y, '#e74c3c', 'Hospital', cam, false);
    // Pickups.
    for (const pk of s.pickups) {
      ctx.save();
      ctx.translate(pk.x - cam.x, pk.y - cam.y);
      ctx.fillStyle = pk.kind === 'health' ? '#e74c3c' : pk.kind === 'ammo' ? '#f39c12' : '#2ecc71';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pk.kind === 'health' ? '+' : pk.kind === 'ammo' ? 'A' : '$', 0, 4);
      ctx.restore();
    }
    // Pedestrians, cops, cars, player.
    for (const ped of s.peds) drawPerson(ped.x, ped.y, ped.angle, ped.color, cam, 10);
    for (const cop of s.cops) drawPerson(cop.x, cop.y, cop.angle, '#2c3e50', cam, 11);
    for (const car of [...s.cars, ...s.copCars]) drawCar(car, cam);
    if (s.player.inCar) drawCar(s.player.inCar, cam);
    else drawPerson(s.player.x, s.player.y, s.player.angle, COLORS.player, cam, PLAYER.radius);
    // Gunfire tracers.
    ctx.strokeStyle = '#ffe27a';
    ctx.lineWidth = 2;
    for (const t of s.tracers) {
      ctx.beginPath();
      ctx.moveTo(t.x1 - cam.x, t.y1 - cam.y);
      ctx.lineTo(t.x2 - cam.x, t.y2 - cam.y);
      ctx.stroke();
    }
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      drawHud(world, cam, opts.best, opts.muted);
    }
    if (screen === SCREEN_TITLE) {
      overlay('SUNSET VICE', [
        'Palmetto Bay is yours. Steal cars, dodge the law, run five jobs for Rico.',
        `Best score: ${opts.best}`,
        '',
        'Press Space or click to start. WASD to move, E to enter a car.',
      ], '#ff5e78');
    } else if (screen === SCREEN_PAUSED) {
      overlay('PAUSED', ['Press P to keep playing.', `Money $${s.money} · Mission ${Math.min(s.missionIndex + 1, 5)}/5`], COLORS.hud);
    } else if (screen === SCREEN_OVER) {
      overlay('WASTED', [
        'The streets of Palmetto Bay got you this time.',
        `You kept half your cash. Score ${s.earned + s.missionIndex * 1000 + s.kills * 10}.`,
        '',
        'Press Space to get back out there.',
      ], '#e74c3c');
    }
    return cam;
  }

  return { draw, resize };
}
