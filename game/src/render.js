// Canvas rendering for Sunset Vice: the city, the cars and people, the HUD
// and the minimap. Pure drawing from a game state; no logic here.
import { WORLD_W, WORLD_H, AVENUES, STREETS, ROAD_W, LANDMARKS } from './city.js';
import { MISSIONS, missionObjective, missionTarget } from './sim.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function render(ctx, s, view) {
  const { camX, camY, scale, W, H } = view;
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.translate(W / 2, H / 2);
  ctx.scale(scale, scale);
  ctx.translate(-camX, -camY);
  drawGround(ctx, s);
  drawLandmarks(ctx, s);
  drawPickups(ctx, s);
  drawMissionTarget(ctx, s);
  drawCars(ctx, s);
  drawCops(ctx, s);
  drawPeds(ctx, s);
  drawBullets(ctx, s);
  drawPlayer(ctx, s);
  ctx.restore();
  drawHud(ctx, s, W, H);
  drawMinimap(ctx, s, W, H);
  drawMessage(ctx, s, W, H);
  drawHint(ctx, s, W, H);
}

function drawGround(ctx, s) {
  // Grass base.
  ctx.fillStyle = '#3f7a3a';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  // Beach strip at the south edge, water beyond it.
  ctx.fillStyle = '#d8c27a';
  ctx.fillRect(0, 2040, WORLD_W, 80);
  ctx.fillStyle = '#2f6fb0';
  ctx.fillRect(0, 2120, WORLD_W, 40);
  // Roads.
  ctx.fillStyle = '#2b2e36';
  for (const ax of AVENUES) ctx.fillRect(ax - ROAD_W / 2, 0, ROAD_W, WORLD_H);
  for (const sy of STREETS) ctx.fillRect(0, sy - ROAD_W / 2, WORLD_W, ROAD_W);
  // Centre dashes.
  ctx.fillStyle = '#e8c33c';
  for (const ax of AVENUES) {
    for (let y = 24; y < WORLD_H; y += 56) ctx.fillRect(ax - 2, y, 4, 28);
  }
  for (const sy of STREETS) {
    for (let x = 24; x < WORLD_W; x += 56) ctx.fillRect(x, sy - 2, 28, 4);
  }
  // Crosswalks at every intersection.
  ctx.fillStyle = '#d8d8d8';
  for (const ax of AVENUES) {
    for (const sy of STREETS) {
      for (let i = -3; i <= 3; i++) {
        ctx.fillRect(ax - 40 + i * 12, sy - ROAD_W / 2 + 6, 6, 16);
        ctx.fillRect(ax - 40 + i * 12, sy + ROAD_W / 2 - 22, 6, 16);
      }
    }
  }
  // Parking lots.
  for (const lot of s.city.lots) {
    ctx.fillStyle = '#3a3d44';
    ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
    ctx.strokeStyle = '#c8c8c8';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      ctx.strokeRect(lot.x + 8 + (i % 2) * 60, lot.y + 8 + Math.floor(i / 2) * 60, 44, 44);
    }
  }
  // Buildings: coloured block, lighter roof, dark door, lit windows.
  for (const b of s.city.buildings) {
    ctx.fillStyle = '#20242c';
    ctx.fillRect(b.x + 4, b.y + 5, b.w, b.h);
    ctx.fillStyle = b.c;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(b.x, b.y, b.w, 8);
    ctx.fillStyle = '#20242c';
    ctx.fillRect(b.x + b.w / 2 - 7, b.y + b.h - 16, 14, 16);
    ctx.fillStyle = '#ffe08a';
    const cols = Math.max(1, Math.floor(b.w / 34));
    const rows = Math.max(1, Math.floor(b.h / 44));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if ((i * 7 + j * 13 + b.x) % 3 === 0) {
          ctx.fillRect(b.x + 10 + i * 34, b.y + 14 + j * 44, 12, 14);
        }
      }
    }
  }
  // Trees.
  for (const t of s.city.trees) {
    ctx.fillStyle = '#1e4d1e';
    ctx.beginPath(); ctx.arc(t.x + 2, t.y + 3, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2f8a2f';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
  }
}

function drawLandmarks(ctx, s) {
  const pads = [
    [LANDMARKS.garage, '#5a6a7a', 'GARAGE'],
    [LANDMARKS.docks, '#7a5a3a', 'DOCKS'],
    [LANDMARKS.store, '#8c2f2f', 'STORE'],
    [LANDMARKS.spray, '#2f8a6a', 'SPRAY'],
    [LANDMARKS.gate, '#6a5a8c', 'GATE'],
    [LANDMARKS.plaza, '#6a6a72', 'PLAZA'],
    [LANDMARKS.beach, '#c8a86a', 'BEACH'],
  ];
  for (const [lm, color, label] of pads) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(lm.x, lm.y, lm.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, lm.x, lm.y + 4);
  }
}

function drawPickups(ctx, s) {
  for (const pk of s.pickups) {
    const bob = Math.sin(pk.bob * 3) * 2;
    if (pk.kind === 'health') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(pk.x - 9, pk.y - 9 + bob, 18, 18);
      ctx.fillStyle = '#d83a3a';
      ctx.fillRect(pk.x - 2, pk.y - 6 + bob, 4, 12);
      ctx.fillRect(pk.x - 6, pk.y - 2 + bob, 12, 4);
    } else if (pk.kind === 'ammo') {
      ctx.fillStyle = '#e8c33c';
      ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#20242c';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('A', pk.x, pk.y + 4 + bob);
    } else {
      ctx.fillStyle = '#3cb371';
      ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', pk.x, pk.y + 4 + bob);
    }
  }
}

function drawMissionTarget(ctx, s) {
  const t = missionTarget(s);
  if (!t) return;
  const pulse = 1 + Math.sin(s.time * 4) * 0.12;
  ctx.strokeStyle = '#ffd23c';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(t.x, t.y, t.r * pulse, 0, Math.PI * 2); ctx.stroke();
  // Off-screen arrow: point toward the target from the player.
  const p = s.player;
  const dx = t.x - p.x, dy = t.y - p.y;
  const d = Math.hypot(dx, dy);
  if (d > 520) {
    const a = Math.atan2(dy, dx);
    const ax = p.x + Math.cos(a) * 70, ay = p.y + Math.sin(a) * 70;
    ctx.fillStyle = '#ffd23c';
    ctx.beginPath();
    ctx.moveTo(ax + Math.cos(a) * 16, ay + Math.sin(a) * 16);
    ctx.lineTo(ax + Math.cos(a + 2.6) * 12, ay + Math.sin(a + 2.6) * 12);
    ctx.lineTo(ax + Math.cos(a - 2.6) * 12, ay + Math.sin(a - 2.6) * 12);
    ctx.closePath(); ctx.fill();
  }
}

function drawCarShape(ctx, x, y, angle, color, police) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRect(ctx, -19, -9, 40, 22, 6);
  ctx.fill();
  ctx.fillStyle = color;
  roundRect(ctx, -20, -11, 40, 22, 6);
  ctx.fill();
  ctx.fillStyle = '#20242c';
  ctx.fillRect(-8, -9, 14, 18);
  if (police) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-20, -11, 40, 8);
    ctx.fillStyle = '#d83a3a';
    ctx.fillRect(-2, -15, 5, 5);
    ctx.fillStyle = '#3a7ad8';
    ctx.fillRect(3, -15, 5, 5);
    ctx.fillStyle = '#20242c';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 5);
  }
  ctx.fillStyle = '#ffe08a';
  ctx.fillRect(18, -9, 3, 4);
  ctx.fillRect(18, 5, 3, 4);
  ctx.restore();
}

function drawCars(ctx, s) {
  for (const c of s.cars) drawCarShape(ctx, c.x, c.y, c.angle, c.color, false);
}

function drawCops(ctx, s) {
  for (const c of s.cops) {
    if (c.inCar) {
      drawCarShape(ctx, c.x, c.y, c.angle, c.color, true);
    } else {
      drawPerson(ctx, c.x, c.y, c.angle, '#20242c', '#3a7ad8', true);
    }
  }
}

function drawPerson(ctx, x, y, angle, skin, shirt, police) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.arc(1, 2, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = shirt;
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(4, 0, 6, 0, Math.PI * 2); ctx.fill();
  if (police) {
    ctx.fillStyle = '#3a7ad8';
    ctx.fillRect(-4, -6, 8, 4);
  }
  ctx.restore();
}

function drawPeds(ctx, s) {
  for (const ped of s.peds) {
    if (ped.state === 'down') {
      ctx.save();
      ctx.translate(ped.x, ped.y);
      ctx.fillStyle = ped.shirt;
      ctx.beginPath(); ctx.ellipse(0, 0, 12, 7, ped.angle, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = ped.skin;
      ctx.beginPath(); ctx.arc(10, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else {
      drawPerson(ctx, ped.x, ped.y, ped.angle, ped.skin, ped.shirt, false);
    }
  }
}

function drawBullets(ctx, s) {
  ctx.fillStyle = '#ffe08a';
  for (const b of s.bullets) {
    ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
  }
}

function drawPlayer(ctx, s) {
  const p = s.player;
  if (p.inCar) {
    drawCarShape(ctx, p.x, p.y, p.angle, p.inCar.color, false);
    // White marker ring so the player's car stands out.
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, 28, 0, Math.PI * 2); ctx.stroke();
    return;
  }
  drawPerson(ctx, p.x, p.y, p.angle, '#e8c39e', '#d8a03c', false);
  if (p.gun) {
    ctx.strokeStyle = '#20242c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.angle) * 10, p.y + Math.sin(p.angle) * 10);
    ctx.lineTo(p.x + Math.cos(p.angle) * 22, p.y + Math.sin(p.angle) * 22);
    ctx.stroke();
  }
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(p.x, p.y, 17, 0, Math.PI * 2); ctx.stroke();
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(10,12,16,0.72)';
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
}

function drawHud(ctx, s, W, H) {
  const p = s.player;
  panel(ctx, 12, 12, 250, 84);
  ctx.fillStyle = '#3cb371';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('$' + p.cash, 24, 40);
  ctx.fillStyle = '#ffffff';
  ctx.font = '13px sans-serif';
  ctx.fillText('earned $' + s.earned, 130, 38);
  ctx.fillStyle = '#20242c';
  ctx.fillRect(24, 48, 150, 10);
  ctx.fillStyle = p.hp > 40 ? '#3cb371' : '#d83a3a';
  ctx.fillRect(24, 48, 150 * Math.max(0, p.hp) / 100, 10);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('HP ' + Math.max(0, Math.ceil(p.hp)), 182, 57);
  ctx.fillText(p.gun ? 'Pistol - ammo ' + p.ammo : 'No gun yet - finish First Wheels', 24, 82);
  // Wanted stars.
  panel(ctx, W / 2 - 110, 12, 220, 34);
  ctx.font = '22px sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < p.wanted ? '#ffd23c' : 'rgba(255,255,255,0.25)';
    ctx.fillText(i < p.wanted ? '★' : '☆', W / 2 - 80 + i * 40, 37);
  }
  // Mission box.
  if (s.missionIndex < MISSIONS.length) {
    const m = MISSIONS[s.missionIndex];
    panel(ctx, 12, 108, 330, 56);
    ctx.fillStyle = '#ffd23c';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Mission ' + (s.missionIndex + 1) + '/5: ' + m.name + '  ($' + m.reward + ')', 22, 128);
    ctx.fillStyle = '#ffffff';
    ctx.font = '13px sans-serif';
    ctx.fillText(missionObjective(s), 22, 148);
    if (s.missionIndex === 3 && s.missionPhase === 'rob') {
      ctx.fillStyle = '#20242c';
      ctx.fillRect(22, 154, 200, 6);
      ctx.fillStyle = '#ffd23c';
      ctx.fillRect(22, 154, 200 * Math.min(1, s.missionProgress / 4), 6);
    }
  } else {
    panel(ctx, 12, 108, 330, 56);
    ctx.fillStyle = '#ffd23c';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Vice King of Palmetto Bay.', 22, 128);
    ctx.fillStyle = '#ffffff';
    ctx.font = '13px sans-serif';
    ctx.fillText('All five missions done. Total earned $' + s.earned + '.', 22, 148);
  }
}

function drawMinimap(ctx, s, W, H) {
  const mw = 210, mh = 158;
  const x0 = W - mw - 12, y0 = 12;
  panel(ctx, x0 - 4, y0 - 4, mw + 8, mh + 8);
  const sx = mw / WORLD_W, sy = mh / WORLD_H;
  ctx.fillStyle = '#2f6b2f';
  ctx.fillRect(x0, y0, mw, mh);
  ctx.fillStyle = '#2b2e36';
  for (const ax of AVENUES) ctx.fillRect(x0 + ax * sx - 2, y0, 4, mh);
  for (const sy2 of STREETS) ctx.fillRect(x0, y0 + sy2 * sy - 2, mw, 4);
  ctx.fillStyle = '#2f6fb0';
  ctx.fillRect(x0, y0 + 2040 * sy, mw, 8);
  const t = missionTarget(s);
  if (t) {
    ctx.strokeStyle = '#ffd23c';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x0 + t.x * sx, y0 + t.y * sy, 6, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = '#ff5a5a';
  for (const c of s.cops) {
    ctx.beginPath(); ctx.arc(x0 + c.x * sx, y0 + c.y * sy, 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(x0 + s.player.x * sx, y0 + s.player.y * sy, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#20242c';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x0 + s.player.x * sx, y0 + s.player.y * sy, 4, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('PALMETTO BAY', x0, y0 + mh + 16);
}

function drawMessage(ctx, s, W, H) {
  if (s.msgTimer <= 0 || !s.msg) return;
  ctx.font = 'bold 16px sans-serif';
  const w = ctx.measureText(s.msg).width + 28;
  panel(ctx, W / 2 - w / 2, H - 64, w, 34);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(s.msg, W / 2, H - 41);
}

function drawHint(ctx, s, W, H) {
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('WASD move/drive  •  E enter car  •  F punch  •  Click shoot  •  Shift run  •  P pause  •  M mute', 14, H - 12);
}

export function drawOverlay(ctx, s, W, H, lines, accent) {
  ctx.fillStyle = 'rgba(8,10,14,0.78)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  let y = H / 2 - (lines.length - 1) * 26;
  for (const [text, size, color] of lines) {
    ctx.font = (size >= 40 ? 'bold ' : '') + size + 'px sans-serif';
    ctx.fillStyle = color || '#ffffff';
    ctx.fillText(text, W / 2, y);
    y += size >= 40 ? 62 : 34;
  }
  if (accent) {
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#ffd23c';
    ctx.fillText(accent, W / 2, y + 8);
  }
}
