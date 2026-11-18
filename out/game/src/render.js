// Sunset Vice — everything the player sees, drawn on one 2D canvas. The
// world is top-down: grass and sand, the road grid, buildings with lit
// windows, cars, people, the mission ring, and a HUD with cash, health,
// wanted stars and a minimap of Palmetto Bay.
import { WORLD_W, WORLD_H, ROAD_W, AVENUES, STREETS, LANDMARKS } from './city.js';
import { MISSIONS } from './sim.js';

const MINIMAP_W = 210;
const MINIMAP_H = 158;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCar(ctx, x, y, angle, color, isCop, flash) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  roundRect(ctx, -17, -9, 38, 22, 5);
  ctx.fill();
  ctx.fillStyle = color;
  roundRect(ctx, -18, -10, 38, 20, 5);
  ctx.fill();
  if (isCop) {
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(-4, -10, 12, 20);
    ctx.fillStyle = '#1c2f5e';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 2, 3);
    ctx.fillStyle = flash ? '#ff2d2d' : '#2d6bff';
    ctx.fillRect(-8, -11, 7, 4);
    ctx.fillStyle = flash ? '#2d6bff' : '#ff2d2d';
    ctx.fillRect(1, -11, 7, 4);
  } else {
    ctx.fillStyle = 'rgba(180,220,255,0.85)';
    ctx.fillRect(2, -8, 8, 16);
    ctx.fillStyle = 'rgba(20,20,20,0.85)';
    ctx.fillRect(-14, -11, 5, 4);
    ctx.fillRect(-14, 7, 5, 4);
    ctx.fillRect(10, -11, 5, 4);
    ctx.fillRect(10, 7, 5, 4);
  }
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, state, hue) {
  ctx.save();
  ctx.translate(x, y);
  if (state === 'down') {
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = '#3a3a3a';
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(12, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.rotate(angle);
  ctx.fillStyle = `hsl(${hue}, 55%, 45%)`;
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(8, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawWorld(ctx, s, cam, scale, now) {
  const viewW = cam.w / scale;
  const viewH = cam.h / scale;
  const x0 = cam.x - viewW / 2;
  const y0 = cam.y - viewH / 2;

  // Ground: grass, then sand and water along the south edge.
  ctx.fillStyle = '#6f9a52';
  ctx.fillRect(x0, y0, viewW, viewH);
  ctx.fillStyle = '#7fae62';
  for (let gx = Math.floor(x0 / 240) * 240; gx < x0 + viewW; gx += 240) {
    for (let gy = Math.floor(y0 / 240) * 240; gy < y0 + viewH; gy += 240) {
      if (((gx + gy) / 240) % 2 === 0) ctx.fillRect(gx, gy, 240, 240);
    }
  }
  ctx.fillStyle = '#e8d9a0';
  ctx.fillRect(x0, 2030, viewW, WORLD_H - 2030);
  ctx.fillStyle = '#3d8fc4';
  ctx.fillRect(x0, 2110, viewW, WORLD_H - 2110);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let wx = Math.floor(x0 / 90) * 90; wx < x0 + viewW; wx += 90) {
    const wob = Math.sin((wx + now * 0.05) / 60) * 5;
    ctx.moveTo(wx, 2116 + wob);
    ctx.quadraticCurveTo(wx + 45, 2108 + wob, wx + 90, 2116 + wob);
  }
  ctx.stroke();

  // Roads: asphalt, edge lines, centre dashes, crosswalks.
  ctx.fillStyle = '#3a3f47';
  for (const ax of AVENUES) ctx.fillRect(ax - ROAD_W / 2, 0, ROAD_W, WORLD_H);
  for (const sy of STREETS) ctx.fillRect(0, sy - ROAD_W / 2, WORLD_W, ROAD_W);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2;
  ctx.setLineDash([22, 18]);
  ctx.beginPath();
  for (const ax of AVENUES) { ctx.moveTo(ax, 0); ctx.lineTo(ax, WORLD_H); }
  for (const sy of STREETS) { ctx.moveTo(0, sy); ctx.lineTo(WORLD_W, sy); }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const ax of AVENUES) {
    for (const sy of STREETS) {
      for (let k = -2; k <= 2; k++) {
        ctx.fillRect(ax - 34 + k * 14, sy - ROAD_W / 2 + 6, 8, 12);
        ctx.fillRect(ax - 34 + k * 14, sy + ROAD_W / 2 - 18, 8, 12);
      }
    }
  }

  // Parking lots.
  for (const lot of s.city.lots) {
    ctx.fillStyle = '#555b66';
    ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    for (let lx = lot.x + 12; lx < lot.x + lot.w - 20; lx += 34) {
      ctx.beginPath();
      ctx.moveTo(lx, lot.y + 8);
      ctx.lineTo(lx, lot.y + lot.h - 8);
      ctx.stroke();
    }
  }

  // Landmark pads.
  for (const key of Object.keys(LANDMARKS)) {
    const lm = LANDMARKS[key];
    ctx.fillStyle = lm.color;
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.arc(lm.x, lm.y, lm.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = lm.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(lm.x, lm.y, lm.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#101418';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(lm.label, lm.x, lm.y - lm.r - 8);
  }

  // Buildings: walls, roof tint, a door and lit windows.
  for (const b of s.city.buildings) {
    ctx.fillStyle = `hsl(${b.hue}, 32%, 62%)`;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = `hsl(${b.hue}, 38%, 48%)`;
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    ctx.fillStyle = '#2c2620';
    ctx.fillRect(b.x + b.w / 2 - 7, b.y + b.h - 12, 14, 12);
    ctx.fillStyle = b.lit > 0.4 ? '#ffe9a3' : '#5a6b7d';
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 30));
    for (let cx = 0; cx < cols; cx++) {
      for (let cy = 0; cy < rows; cy++) {
        if (((cx * 7 + cy * 3 + Math.floor(b.lit * 10)) % 4) === 0) continue;
        ctx.fillRect(b.x + 10 + cx * 26, b.y + 10 + cy * 30, 13, 16);
      }
    }
  }

  // Trees.
  for (const t of s.city.trees) {
    ctx.fillStyle = '#5d4a2f';
    ctx.fillRect(t.x - 2, t.y - 2, 4, 5);
    ctx.fillStyle = t.palm ? '#4da34d' : '#3f7d3a';
    ctx.beginPath();
    ctx.arc(t.x, t.y - 4, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.arc(t.x - 4, t.y - 8, t.r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Pickups.
  for (const pk of s.pickups) {
    if (pk.taken) continue;
    const bob = Math.sin(now / 300 + pk.x) * 2;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    if (pk.kind === 'health') {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#37b24d';
      ctx.fillRect(-2, -8, 4, 16);
      ctx.fillRect(-8, -2, 16, 4);
    } else if (pk.kind === 'ammo') {
      ctx.fillStyle = '#e8c33d';
      ctx.fillRect(-10, -7, 20, 14);
      ctx.fillStyle = '#7a5c00';
      ctx.fillRect(-10, -2, 20, 3);
    } else {
      ctx.fillStyle = '#ffd43b';
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7a5c00';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', 0, 5);
    }
    ctx.restore();
  }

  // Mission target: a pulsing ring where the player has to go.
  const target = missionTargetOf(s);
  if (target) {
    const pulse = 1 + Math.sin(now / 280) * 0.12;
    ctx.strokeStyle = '#ffd43b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(target.x, target.y, target.r * 0.55 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(target.x, target.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd43b';
    ctx.fill();
  }

  // Traffic and parked cars, then the player's car, then cops.
  for (const car of s.cars) {
    if (car.kind === 'traffic' || car.kind === 'parked') drawCar(ctx, car.x, car.y, car.angle, car.color, false, false);
  }
  if (s.player.inCar) drawCar(ctx, s.player.inCar.x, s.player.inCar.y, s.player.inCar.angle, '#e8e8e8', false, false);
  for (const cop of s.cops) {
    if (cop.state === 'car') drawCar(ctx, cop.car.x, cop.car.y, cop.car.angle, '#2b4a8f', true, Math.floor(now / 220) % 2 === 0);
  }

  // People and foot cops.
  const p = s.player;
  for (const ped of s.peds) drawPerson(ctx, ped.x, ped.y, ped.angle, ped.state, 200 + (ped.x % 140));
  for (const cop of s.cops) {
    if (cop.state === 'foot') drawPerson(ctx, cop.x, cop.y, cop.angle, 'walk', 230);
  }

  // The player on foot.
  if (!p.inCar) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#ff922b';
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#343a40';
    ctx.fillRect(6, -3, 8, 6);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Bullets.
  ctx.fillStyle = '#ffe066';
  for (const b of s.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Off-screen arrow toward the mission target.
  if (target) {
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const d = Math.hypot(dx, dy);
    const halfW = viewW / 2 - 40;
    const halfH = viewH / 2 - 40;
    if (Math.abs(dx) > halfW || Math.abs(dy) > halfH) {
      const ax = p.x + (dx / d) * Math.min(halfW, halfH * 1.4);
      const ay = p.y + (dy / d) * Math.min(halfH, halfW * 0.8);
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(Math.atan2(dy, dx));
      ctx.fillStyle = '#ffd43b';
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-10, -10);
      ctx.lineTo(-10, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}

function missionTargetOf(s) {
  if (s.missionIndex === 0) return LANDMARKS.garage;
  if (s.missionIndex === 1) return LANDMARKS.docks;
  if (s.missionIndex === 2) return s.missionPhase === 'lose' ? null : LANDMARKS.plaza;
  if (s.missionIndex === 3) return LANDMARKS.store;
  if (s.missionIndex === 4) return LANDMARKS.gate;
  return null;
}

function objectiveText(s) {
  if (s.missionIndex >= 5) return 'VICE KING — Palmetto Bay is yours.';
  const m = MISSIONS[s.missionIndex];
  if (s.missionIndex === 2 && s.missionPhase === 'lose') return 'Hot Pursuit — lose the cops, get to zero stars.';
  if (s.missionIndex === 3 && s.missionPhase === 'rob') return 'The Score — hold the robbery, stay in the store.';
  if (s.missionIndex === 3 && s.missionPhase === 'lose') return 'The Score — lose the cops, get to zero stars.';
  return `Mission ${s.missionIndex + 1} — ${m.name}: ${m.brief}`;
}

function drawHud(ctx, s, w, h) {
  const p = s.player;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Top-left: cash, earned, health, weapon.
  ctx.fillStyle = 'rgba(10,14,18,0.72)';
  roundRect(ctx, 12, 12, 250, 92, 8);
  ctx.fill();
  ctx.fillStyle = '#7CFC98';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(`$${p.cash}`, 24, 44);
  ctx.fillStyle = '#e8e8e8';
  ctx.font = '14px sans-serif';
  ctx.fillText(`Earned $${s.earned}`, 24, 66);
  ctx.fillStyle = '#343a40';
  ctx.fillRect(24, 74, 150, 10);
  ctx.fillStyle = p.hp > 30 ? '#37b24d' : '#e03131';
  ctx.fillRect(24, 74, 150 * (p.hp / 100), 10);
  ctx.fillStyle = '#e8e8e8';
  ctx.font = '13px sans-serif';
  ctx.fillText(p.gun ? `Pistol  ${p.ammo} ammo` : 'No weapon — F to punch', 24, 98);

  // Top-right: wanted stars.
  ctx.textAlign = 'right';
  ctx.font = '30px sans-serif';
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < p.wanted ? '\u2605' : '\u2606';
  ctx.fillStyle = '#ffd43b';
  ctx.fillText(stars, w - 16, 46);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#e8e8e8';
  ctx.fillText(p.wanted > 0 ? 'WANTED' : 'CLEAN', w - 16, 66);
  ctx.textAlign = 'left';

  // Mission box, top centre.
  const boxW = 460;
  ctx.fillStyle = 'rgba(10,14,18,0.72)';
  roundRect(ctx, (w - boxW) / 2, 12, boxW, 56, 8);
  ctx.fill();
  ctx.fillStyle = '#ffd43b';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(objectiveText(s), w / 2, 34);
  ctx.fillStyle = '#e8e8e8';
  ctx.font = '13px sans-serif';
  const sub = s.missionIndex >= 5 ? `Total earned $${s.earned}` : `Reward $${MISSIONS[s.missionIndex].reward}  •  Missions ${s.missionIndex}/5`;
  ctx.fillText(sub, w / 2, 54);
  ctx.textAlign = 'left';
  if (s.missionIndex === 3 && s.missionPhase === 'rob') {
    ctx.fillStyle = '#343a40';
    ctx.fillRect((w - 300) / 2, 72, 300, 10);
    ctx.fillStyle = '#e03131';
    ctx.fillRect((w - 300) / 2, 72, 300 * Math.min(1, s.missionProgress / 4), 10);
  }

  // Toast message.
  if (s.msg) {
    ctx.fillStyle = 'rgba(10,14,18,0.78)';
    const tw = ctx.measureText(s.msg).width + 28;
    roundRect(ctx, (w - tw) / 2, h - 150, tw, 32, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(s.msg, w / 2, h - 128);
    ctx.textAlign = 'left';
  }

  // Controls hint, bottom-left.
  ctx.fillStyle = 'rgba(10,14,18,0.6)';
  roundRect(ctx, 12, h - 40, 470, 28, 8);
  ctx.fill();
  ctx.fillStyle = '#d8d8d8';
  ctx.font = '13px sans-serif';
  ctx.fillText('WASD walk/drive  •  Shift run  •  E enter car  •  Click shoot  •  F punch  •  P pause  •  M mute', 22, h - 21);

  drawMinimap(ctx, s, w, h);
}

function drawMinimap(ctx, s, w, h) {
  const mx = w - MINIMAP_W - 12;
  const my = h - MINIMAP_H - 12;
  const sx = MINIMAP_W / WORLD_W;
  const sy = MINIMAP_H / WORLD_H;
  ctx.fillStyle = 'rgba(10,14,18,0.78)';
  roundRect(ctx, mx - 6, my - 22, MINIMAP_W + 12, MINIMAP_H + 28, 8);
  ctx.fill();
  ctx.fillStyle = '#8ad8c9';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('PALMETTO BAY', mx, my - 8);
  ctx.save();
  ctx.beginPath();
  ctx.rect(mx, my, MINIMAP_W, MINIMAP_H);
  ctx.clip();
  ctx.fillStyle = '#1c2b1a';
  ctx.fillRect(mx, my, MINIMAP_W, MINIMAP_H);
  ctx.strokeStyle = '#8a8f96';
  ctx.lineWidth = 2;
  for (const ax of AVENUES) {
    ctx.beginPath();
    ctx.moveTo(mx + ax * sx, my);
    ctx.lineTo(mx + ax * sx, my + MINIMAP_H);
    ctx.stroke();
  }
  for (const sy2 of STREETS) {
    ctx.beginPath();
    ctx.moveTo(mx, my + sy2 * sy);
    ctx.lineTo(mx + MINIMAP_W, my + sy2 * sy);
    ctx.stroke();
  }
  for (const key of Object.keys(LANDMARKS)) {
    const lm = LANDMARKS[key];
    ctx.fillStyle = lm.color;
    ctx.beginPath();
    ctx.arc(mx + lm.x * sx, my + lm.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const target = missionTargetOf(s);
  if (target) {
    ctx.strokeStyle = '#ffd43b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx + target.x * sx, my + target.y * sy, 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const cop of s.cops) {
    ctx.fillStyle = '#ff2d2d';
    ctx.beginPath();
    ctx.arc(mx + cop.x * sx, my + cop.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(mx + s.player.x * sx, my + s.player.y * sy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function render(ctx, s, cam, now) {
  const scale = cam.scale;
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(-(cam.x - cam.w / scale / 2), -(cam.y - cam.h / scale / 2));
  drawWorld(ctx, s, cam, scale, now);
  ctx.restore();
  drawHud(ctx, s, cam.w, cam.h);
}

export function renderOverlay(ctx, s, w, h, best) {
  ctx.fillStyle = 'rgba(8,10,14,0.62)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  if (s.screen === 'title') {
    ctx.fillStyle = '#ffd43b';
    ctx.font = 'bold 84px sans-serif';
    ctx.fillText('SUNSET VICE', w / 2, h / 2 - 110);
    ctx.fillStyle = '#fff';
    ctx.font = '28px sans-serif';
    ctx.fillText('PALMETTO BAY', w / 2, h / 2 - 66);
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#d8d8d8';
    ctx.fillText('Work for fixer Rico. Steal cars, dodge the cops, run five jobs, own the city.', w / 2, h / 2 - 26);
    ctx.fillStyle = '#7CFC98';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('Press SPACE to start', w / 2, h / 2 + 30);
    ctx.fillStyle = '#d8d8d8';
    ctx.font = '15px sans-serif';
    ctx.fillText('WASD walk/drive  •  Shift run  •  E enter car  •  Click shoot  •  F punch  •  P pause  •  M mute', w / 2, h / 2 + 66);
    if (best > 0) {
      ctx.fillStyle = '#ffd43b';
      ctx.fillText(`Best score: $${best}`, w / 2, h / 2 + 96);
    }
  } else if (s.screen === 'paused') {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText('PAUSED', w / 2, h / 2 - 10);
    ctx.font = '18px sans-serif';
    ctx.fillText('Press P to keep playing', w / 2, h / 2 + 30);
  } else if (s.screen === 'wasted') {
    ctx.fillStyle = '#e03131';
    ctx.font = 'bold 72px sans-serif';
    ctx.fillText('WASTED', w / 2, h / 2 - 20);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText('You lost half your cash. Press SPACE to try again.', w / 2, h / 2 + 24);
  } else if (s.screen === 'busted') {
    ctx.fillStyle = '#4da3d8';
    ctx.font = 'bold 72px sans-serif';
    ctx.fillText('BUSTED', w / 2, h / 2 - 20);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText('The cops took $50. Press SPACE to try again.', w / 2, h / 2 + 24);
  } else if (s.screen === 'won') {
    ctx.fillStyle = '#ffd43b';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText('VICE KING', w / 2, h / 2 - 40);
    ctx.fillStyle = '#fff';
    ctx.font = '22px sans-serif';
    ctx.fillText(`You own Palmetto Bay. Total earned $${s.earned}.`, w / 2, h / 2 + 6);
    ctx.font = '18px sans-serif';
    ctx.fillText('Press SPACE to play again.', w / 2, h / 2 + 44);
  }
  ctx.textAlign = 'left';
}
