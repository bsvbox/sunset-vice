// Sunset Vice — canvas renderer. Draws the city, the actors, the HUD and
// the minimap. It reads the simulation state and never mutates it.
import { WORLD_W, WORLD_H, ROAD_W, AVENUES, STREETS, LANDMARKS } from './city.js';
import { MISSIONS, missionObjective, missionTarget } from './sim.js';

const ROOFS = ['#b0563a', '#7a6a53', '#5d7a9e', '#8a7a9e', '#6a8a5d', '#a08a5d'];
const MAP_W = 210;
const MAP_H = 158;

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ------------------------------------------------------------------ world

function drawGround(ctx, s) {
  ctx.fillStyle = '#4d7a3d';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  // Mown patches for variety, deterministic by position.
  ctx.fillStyle = '#55853f';
  for (let gx = 0; gx < 12; gx++) {
    for (let gy = 0; gy < 9; gy++) {
      if ((gx * 7 + gy * 13) % 3 === 0) ctx.fillRect(gx * 240, gy * 240, 240, 240);
    }
  }
  // Sand and water along the south edge: Palmetto Beach.
  ctx.fillStyle = '#e0c98f';
  ctx.fillRect(0, 2064, WORLD_W, WORLD_H - 2064);
  ctx.fillStyle = '#2e6f9e';
  ctx.fillRect(0, 2128, WORLD_W, WORLD_H - 2128);
  ctx.fillStyle = '#3a86b5';
  for (let x = 0; x < WORLD_W; x += 160) {
    ctx.fillRect(x + ((s.time * 30 + x) % 160), 2136, 70, 4);
  }
}

function drawRoads(ctx) {
  ctx.fillStyle = '#33363d';
  for (const ax of AVENUES) ctx.fillRect(ax - ROAD_W / 2, 0, ROAD_W, WORLD_H);
  for (const sy of STREETS) ctx.fillRect(0, sy - ROAD_W / 2, WORLD_W, ROAD_W);
  // Centre dashes.
  ctx.fillStyle = '#e8c93c';
  for (const ax of AVENUES) {
    for (let y = 0; y < WORLD_H; y += 64) ctx.fillRect(ax - 2, y, 4, 34);
  }
  for (const sy of STREETS) {
    for (let x = 0; x < WORLD_W; x += 64) ctx.fillRect(x, sy - 2, 34, 4);
  }
  // Crosswalks at every crossing.
  ctx.fillStyle = '#d8d8d8';
  for (const ax of AVENUES) {
    for (const sy of STREETS) {
      for (let k = -2; k <= 2; k++) {
        ctx.fillRect(ax - 30 + k * 12, sy - ROAD_W / 2 + 6, 6, 16);
        ctx.fillRect(ax - 30 + k * 12, sy + ROAD_W / 2 - 22, 6, 16);
      }
    }
  }
}

function drawLots(ctx, s) {
  for (const lot of s.city.lots) {
    ctx.fillStyle = '#4a4f58';
    ctx.fillRect(lot.x - lot.w / 2, lot.y - lot.h / 2, lot.w, lot.h);
    ctx.strokeStyle = '#d8d8d8';
    ctx.lineWidth = 2;
    ctx.strokeRect(lot.x - lot.w / 2, lot.y - lot.h / 2, lot.w, lot.h);
    ctx.fillStyle = '#d8d8d8';
    for (let k = -2; k <= 2; k++) {
      ctx.fillRect(lot.x + k * 40 - 1, lot.y - lot.h / 2 + 8, 2, 22);
      ctx.fillRect(lot.x + k * 40 - 1, lot.y + lot.h / 2 - 30, 2, 22);
    }
  }
}

const PAD_COLORS = {
  garage: '#e07b39',
  docks: '#3d7bd9',
  store: '#43b581',
  spray: '#c05fc0',
  gate: '#e8b93c',
  beach: '#e0c98f',
  plaza: '#8a9aa8',
};

function drawLandmarks(ctx, s) {
  ctx.textAlign = 'center';
  for (const [key, lm] of Object.entries(LANDMARKS)) {
    ctx.fillStyle = PAD_COLORS[key];
    ctx.globalAlpha = 0.55;
    circle(ctx, lm.x, lm.y, lm.r);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = PAD_COLORS[key];
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(lm.x, lm.y, lm.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#101418';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(lm.label, lm.x, lm.y + 5);
  }
}

function drawBuildings(ctx, s) {
  for (const b of s.city.buildings) {
    ctx.fillStyle = ROOFS[b.hue % ROOFS.length];
    ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 3;
    ctx.strokeRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
    // Roof line and door.
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x - b.w / 2 + 8, b.y - b.h / 2 + 8, b.w - 16, b.h - 16);
    ctx.fillStyle = '#2e2620';
    ctx.fillRect(b.x - 7, b.y + b.h / 2 - 16, 14, 16);
    // Lit windows.
    ctx.fillStyle = '#ffe9a8';
    const cols = Math.max(1, Math.floor(b.w / 34));
    const rows = Math.max(1, Math.floor(b.h / 34));
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if ((c * 3 + r * 5 + b.hue) % 4 === 0) {
          ctx.fillRect(b.x - b.w / 2 + 12 + c * 34, b.y - b.h / 2 + 12 + r * 34, 12, 12);
        }
      }
    }
  }
}

function drawTrees(ctx, s) {
  for (const t of s.city.trees) {
    ctx.fillStyle = '#2f6b2a';
    circle(ctx, t.x, t.y, t.r);
    ctx.fillStyle = '#3f8a35';
    circle(ctx, t.x - 3, t.y - 3, t.r * 0.65);
  }
}

function drawPickups(ctx, s) {
  for (const pk of s.pickups) {
    if (!pk.active) continue;
    const bob = Math.sin(s.time * 3 + pk.x) * 2;
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    circle(ctx, pk.x, pk.y + bob, 18);
    if (pk.kind === 'health') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(pk.x - 11, pk.y - 11 + bob, 22, 22);
      ctx.fillStyle = '#d93a3a';
      ctx.fillRect(pk.x - 3, pk.y - 8 + bob, 6, 16);
      ctx.fillRect(pk.x - 8, pk.y - 3 + bob, 16, 6);
    } else if (pk.kind === 'ammo') {
      ctx.fillStyle = '#e8b93c';
      ctx.fillRect(pk.x - 11, pk.y - 8 + bob, 22, 16);
      ctx.fillStyle = '#101418';
      ctx.fillRect(pk.x - 7, pk.y - 4 + bob, 3, 8);
      ctx.fillRect(pk.x - 1, pk.y - 4 + bob, 3, 8);
      ctx.fillRect(pk.x + 5, pk.y - 4 + bob, 3, 8);
    } else {
      ctx.fillStyle = '#43b581';
      ctx.fillRect(pk.x - 12, pk.y - 8 + bob, 24, 16);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', pk.x, pk.y + 5 + bob);
    }
  }
}

function drawCar(ctx, car, isPlayer, isCop, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Wheels.
  ctx.fillStyle = '#101418';
  ctx.fillRect(-14, -17, 12, 7);
  ctx.fillRect(6, -17, 12, 7);
  ctx.fillRect(-14, 10, 12, 7);
  ctx.fillRect(6, 10, 12, 7);
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -22, -13, 44, 26, 6);
  ctx.fill();
  // Roof and windshield.
  if (isCop) {
    ctx.fillStyle = '#f2f2f2';
    roundRect(ctx, -6, -12, 14, 24, 4);
    ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    roundRect(ctx, -4, -11, 12, 22, 4);
    ctx.fill();
  }
  ctx.fillStyle = '#1a2a3a';
  ctx.fillRect(8, -11, 5, 22);
  ctx.fillRect(-20, -11, 3, 22);
  if (isCop) {
    // Flashing light bar.
    const on = Math.floor(time * 4) % 2 === 0;
    ctx.fillStyle = on ? '#ff2e2e' : '#2e7bff';
    ctx.fillRect(-2, -13, 6, 6);
    ctx.fillStyle = on ? '#2e7bff' : '#ff2e2e';
    ctx.fillRect(-2, 7, 6, 6);
    ctx.fillStyle = '#101418';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 3);
  }
  if (isPlayer) {
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 2;
    roundRect(ctx, -24, -15, 48, 30, 7);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, color, down) {
  ctx.save();
  ctx.translate(x, y);
  if (down) {
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.75;
    roundRect(ctx, -13, -6, 26, 12, 6);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
    return;
  }
  ctx.rotate(angle);
  ctx.fillStyle = color;
  roundRect(ctx, -8, -7, 16, 14, 5);
  ctx.fill();
  ctx.fillStyle = '#f2c89b';
  circle(ctx, 10, 0, 6);
  ctx.fillStyle = '#101418';
  ctx.fillRect(14, -2, 6, 4);
  ctx.restore();
}

function drawMissionRing(ctx, s) {
  const target = missionTarget(s);
  if (!target) return;
  const pulse = 8 + Math.sin(s.time * 4) * 5;
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(target.x, target.y, target.r + pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffe9a8';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('▼', target.x, target.y - target.r - pulse - 6);
}

function drawWorld(ctx, s) {
  drawGround(ctx, s);
  drawRoads(ctx);
  drawLots(ctx, s);
  drawLandmarks(ctx, s);
  drawBuildings(ctx, s);
  drawTrees(ctx, s);
  drawPickups(ctx, s);
  drawMissionRing(ctx, s);
  for (const car of s.cars) {
    const isPlayerCar = s.player.inCar === car;
    drawCar(ctx, car, isPlayerCar, false, s.time);
  }
  for (const cop of s.cops) {
    if (!cop.onFoot) {
      drawCar(ctx, { x: cop.x, y: cop.y, angle: cop.angle, color: '#22406e' }, false, true, s.time);
    }
  }
  for (const ped of s.peds) {
    drawPerson(ctx, ped.x, ped.y, ped.angle, ped.color, ped.state === 'down');
  }
  for (const cop of s.cops) {
    if (cop.onFoot) drawPerson(ctx, cop.x, cop.y, cop.angle, '#22406e', cop.hp <= 0);
  }
  // Player on foot.
  if (!s.player.inCar) {
    drawPerson(ctx, s.player.x, s.player.y, s.player.angle, '#f2f2f2', false);
    // Aim tick.
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(s.player.x + Math.cos(s.player.angle) * 14, s.player.y + Math.sin(s.player.angle) * 14);
    ctx.lineTo(s.player.x + Math.cos(s.player.angle) * 22, s.player.y + Math.sin(s.player.angle) * 22);
    ctx.stroke();
  }
  // Bullets.
  ctx.fillStyle = '#ffe93c';
  for (const b of s.bullets) {
    circle(ctx, b.x, b.y, 4);
    ctx.strokeStyle = 'rgba(255,233,60,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x - Math.cos(b.angle) * 14, b.y - Math.sin(b.angle) * 14);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

// ------------------------------------------------------------------ HUD

function drawHud(ctx, s, view) {
  const p = s.player;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // Top-left panel: cash, earned, health, ammo.
  ctx.fillStyle = 'rgba(10,14,18,0.72)';
  roundRect(ctx, 12, 12, 250, 96, 8);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(`$${p.cash}`, 24, 40);
  ctx.fillStyle = '#9fe8a8';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText(`earned $${s.earned}`, 24, 62);
  // Health bar.
  ctx.fillStyle = '#333333';
  ctx.fillRect(24, 72, 150, 12);
  ctx.fillStyle = p.hp > 40 ? '#43b581' : '#d93a3a';
  ctx.fillRect(24, 72, Math.max(0, 150 * (p.hp / 100)), 12);
  ctx.fillStyle = '#ffffff';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(`HP ${Math.ceil(p.hp)}`, 182, 83);
  if (p.gun) {
    ctx.fillStyle = '#e8b93c';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(`Ammo ${p.ammo}`, 24, 100);
  }
  // Wanted stars, top-right.
  ctx.textAlign = 'right';
  ctx.font = '30px system-ui, sans-serif';
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < p.wanted ? '★' : '☆';
  ctx.fillStyle = '#e8b93c';
  ctx.fillText(stars, view.w - 16, 46);
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(p.wanted > 0 ? 'WANTED' : 'CLEAN', view.w - 16, 66);
  // Mission box, top-centre.
  const idx = Math.min(s.missionIndex, MISSIONS.length - 1);
  const m = MISSIONS[idx];
  ctx.textAlign = 'center';
  const boxW = 460;
  ctx.fillStyle = 'rgba(10,14,18,0.72)';
  roundRect(ctx, (view.w - boxW) / 2, 12, boxW, 62, 8);
  ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText(s.missionIndex >= MISSIONS.length ? 'VICE KING' : `Mission ${s.missionIndex + 1}: ${m.name}  ($${m.reward})`, view.w / 2, 36);
  ctx.fillStyle = '#ffffff';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText(missionObjective(s), view.w / 2, 58);
  // Robbery progress bar.
  if (s.missionIndex === 3 && s.missionPhase === 'rob') {
    ctx.fillStyle = '#333333';
    ctx.fillRect((view.w - 200) / 2, 80, 200, 10);
    ctx.fillStyle = '#e8b93c';
    ctx.fillRect((view.w - 200) / 2, 80, 200 * Math.min(1, s.missionProgress / 4), 10);
  }
  // Toast message.
  if (s.msg && s.msgTimer > 0) {
    ctx.fillStyle = 'rgba(10,14,18,0.8)';
    const tw = Math.min(560, ctx.measureText(s.msg).width + 32);
    roundRect(ctx, (view.w - tw) / 2, view.h - 96, tw, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText(s.msg, view.w / 2, view.h - 73);
  }
  // Controls hint.
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('WASD move/drive · E steal car · Click shoot · F punch · Shift run · P pause · M mute', 14, view.h - 14);
}

// ------------------------------------------------------------------ minimap

function drawMinimap(ctx, s, view) {
  const mx = view.w - MAP_W - 14;
  const my = view.h - MAP_H - 14;
  const sx = MAP_W / WORLD_W;
  const sy = MAP_H / WORLD_H;
  ctx.fillStyle = 'rgba(10,14,18,0.78)';
  roundRect(ctx, mx - 6, my - 24, MAP_W + 12, MAP_H + 30, 8);
  ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('PALMETTO BAY', mx, my - 10);
  ctx.save();
  ctx.beginPath();
  ctx.rect(mx, my, MAP_W, MAP_H);
  ctx.clip();
  ctx.fillStyle = '#2c4a26';
  ctx.fillRect(mx, my, MAP_W, MAP_H);
  ctx.strokeStyle = '#8a8a8a';
  ctx.lineWidth = 2;
  for (const ax of AVENUES) {
    ctx.beginPath();
    ctx.moveTo(mx + ax * sx, my);
    ctx.lineTo(mx + ax * sx, my + MAP_H);
    ctx.stroke();
  }
  for (const sy2 of STREETS) {
    ctx.beginPath();
    ctx.moveTo(mx, my + sy2 * sy);
    ctx.lineTo(mx + MAP_W, my + sy2 * sy);
    ctx.stroke();
  }
  for (const lm of Object.values(LANDMARKS)) {
    ctx.fillStyle = '#ffffff';
    circle(ctx, mx + lm.x * sx, my + lm.y * sy, 2.5);
  }
  const target = missionTarget(s);
  if (target) {
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx + target.x * sx, my + target.y * sy, 6 + Math.sin(s.time * 4) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#ff2e2e';
  for (const cop of s.cops) circle(ctx, mx + cop.x * sx, my + cop.y * sy, 3);
  ctx.fillStyle = '#ffffff';
  circle(ctx, mx + s.player.x * sx, my + s.player.y * sy, 4);
  ctx.restore();
}

// ------------------------------------------------------------------ entry

export function render(ctx, s, view) {
  const { w, h, camX, camY, scale } = view;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#101418';
  ctx.fillRect(0, 0, w, h);
  ctx.setTransform(scale, 0, 0, scale, w / 2 - camX * scale, h / 2 - camY * scale);
  drawWorld(ctx, s);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (s.screen === 'play' || s.screen === 'paused') {
    drawHud(ctx, s, view);
    drawMinimap(ctx, s, view);
    // Off-screen mission arrow, at the screen edge toward the target.
    const target = missionTarget(s);
    if (target && s.screen === 'play') {
      const dx = target.x - s.player.x;
      const dy = target.y - s.player.y;
      const d = Math.hypot(dx, dy);
      const viewR = Math.hypot(w, h) / 2 / scale;
      if (d > viewR * 0.8) {
        const a = Math.atan2(dy, dx);
        const ax = w / 2 + Math.cos(a) * (Math.min(w, h) / 2 - 60);
        const ay = h / 2 + Math.sin(a) * (Math.min(w, h) / 2 - 60);
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(a);
        ctx.fillStyle = '#ffe9a8';
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
}
