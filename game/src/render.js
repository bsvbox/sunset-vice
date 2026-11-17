// Canvas rendering for Sunset Vice: the city, the people, the cars, the HUD
// and the minimap. All art is drawn shapes; there are no image assets.
import { AVENUES, STREETS, WORLD_W, WORLD_H, ROAD_W, LANDMARKS } from './city.js';
import { MISSIONS, missionObjective } from './sim.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCar(ctx, x, y, angle, color, police) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(ctx, -19, -10, 42, 24, 5);
  ctx.fill();
  ctx.fillStyle = color;
  roundRect(ctx, -20, -11, 40, 22, 6);
  ctx.fill();
  ctx.fillStyle = police ? '#e8e8e8' : '#222831';
  roundRect(ctx, -6, -9, 14, 18, 3);
  ctx.fill();
  ctx.fillStyle = '#ffd94a';
  ctx.fillRect(18, -9, 2, 4);
  ctx.fillRect(18, 5, 2, 4);
  ctx.fillStyle = '#ff5a4a';
  ctx.fillRect(-21, -9, 2, 4);
  ctx.fillRect(-21, 5, 2, 4);
  if (police) {
    ctx.fillStyle = '#3a6fd8';
    ctx.fillRect(-2, -11, 5, 5);
    ctx.fillStyle = '#d83a3a';
    ctx.fillRect(3, -11, 5, 5);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 3);
  }
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, skin, shirt, down) {
  ctx.save();
  ctx.translate(x, y);
  if (down) {
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = shirt;
    ctx.beginPath(); ctx.ellipse(0, 0, 13, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(15, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 2, 9, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = shirt;
  ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(11, 0, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1d2733';
  ctx.fillRect(12, -3, 4, 6);
  ctx.restore();
}

export function render(ctx, s, view) {
  const { w, h, camX, camY, scale } = view;
  ctx.fillStyle = '#0e1420';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(-camX, -camY);

  // Ground: grass, then the beach strip along the south edge.
  ctx.fillStyle = '#3f7a44';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.fillStyle = '#e8d9a0';
  ctx.fillRect(0, WORLD_H - 130, WORLD_W, 130);
  ctx.fillStyle = '#3a7ec2';
  ctx.fillRect(0, WORLD_H - 34, WORLD_W, 34);

  // Roads.
  ctx.fillStyle = '#2c313a';
  for (const ax of AVENUES) ctx.fillRect(ax - ROAD_W / 2, 0, ROAD_W, WORLD_H);
  for (const sy of STREETS) ctx.fillRect(0, sy - ROAD_W / 2, WORLD_W, ROAD_W);
  // Centre dashes.
  ctx.fillStyle = '#d8c95a';
  for (const ax of AVENUES) {
    for (let y = 20; y < WORLD_H; y += 56) ctx.fillRect(ax - 2, y, 4, 28);
  }
  for (const sy of STREETS) {
    for (let x = 20; x < WORLD_W; x += 56) ctx.fillRect(x, sy - 2, 28, 4);
  }
  // Crosswalks at every intersection.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const ax of AVENUES) {
    for (const sy of STREETS) {
      for (let i = -3; i <= 3; i++) {
        ctx.fillRect(ax - 40 + i * 12, sy - ROAD_W / 2 + 6, 6, 14);
        ctx.fillRect(ax - 40 + i * 12, sy + ROAD_W / 2 - 20, 6, 14);
      }
    }
  }

  // Parking lots.
  for (const lot of s.city.lots) {
    ctx.fillStyle = '#3a4048';
    ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    for (let x = lot.x + 16; x < lot.x + lot.w - 20; x += 52) {
      ctx.beginPath(); ctx.moveTo(x, lot.y + 8); ctx.lineTo(x, lot.y + 44); ctx.stroke();
    }
  }

  // Landmark pads.
  const pads = [
    [LANDMARKS.garage, '#7a5a2a', 'GARAGE'],
    [LANDMARKS.docks, '#5a6a7a', 'DOCKS'],
    [LANDMARKS.store, '#7a2a3a', 'STORE'],
    [LANDMARKS.spray, '#2a7a5a', 'SPRAY'],
    [LANDMARKS.gate, '#8a7a2a', 'NORTH GATE'],
    [LANDMARKS.plaza, '#6a6a7a', 'PLAZA'],
  ];
  for (const [lm, color, label] of pads) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(lm.x, lm.y, lm.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, lm.x, lm.y + 4);
  }

  // Buildings with a roof line and a door.
  for (const b of s.city.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    ctx.fillStyle = b.c;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(b.x, b.y, b.w, 8);
    ctx.fillStyle = '#2c313a';
    ctx.fillRect(b.x + b.w / 2 - 9, b.y + b.h - 16, 18, 16);
    ctx.fillStyle = '#ffd94a';
    for (let wx = b.x + 14; wx < b.x + b.w - 14; wx += 34) {
      ctx.fillRect(wx, b.y + 14, 12, 10);
    }
  }

  // Trees.
  for (const t of s.city.trees) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.arc(t.x + 3, t.y + 4, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a6a34';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3f8c46';
    ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, Math.PI * 2); ctx.fill();
  }

  // Pickups.
  for (const pk of s.pickups) {
    const bob = Math.sin(pk.bob * 3) * 3;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    if (pk.kind === 'health') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(-9, -9, 18, 18);
      ctx.fillStyle = '#d83a3a';
      ctx.fillRect(-2, -7, 4, 14);
      ctx.fillRect(-7, -2, 14, 4);
    } else if (pk.kind === 'ammo') {
      ctx.fillStyle = '#e0b13c';
      ctx.fillRect(-8, -5, 16, 10);
      ctx.fillStyle = '#333';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('AMMO', 0, 3);
    } else {
      ctx.fillStyle = '#37b24d';
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', 0, 4);
    }
    ctx.restore();
  }

  // Mission target ring.
  const target = s.missionTarget;
  if (target && s.screen === 'play' && s.missionIndex < MISSIONS.length) {
    const pulse = 1 + Math.sin(s.time * 4) * 0.12;
    ctx.strokeStyle = '#ffd94a';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(target.x, target.y, target.r * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffd94a';
    ctx.beginPath();
    ctx.moveTo(target.x, target.y - target.r - 26);
    ctx.lineTo(target.x - 10, target.y - target.r - 8);
    ctx.lineTo(target.x + 10, target.y - target.r - 8);
    ctx.closePath(); ctx.fill();
  }

  // Cars, then people, then bullets.
  for (const car of s.cars) {
    if (car.kind === 'police') drawCar(ctx, car.x, car.y, car.angle, car.color, true);
    else drawCar(ctx, car.x, car.y, car.angle, car.color, false);
  }
  for (const ped of s.peds) drawPerson(ctx, ped.x, ped.y, ped.angle, ped.skin, ped.shirt, ped.hp <= 0);
  for (const cop of s.cops) {
    if (cop.hp <= 0) { drawPerson(ctx, cop.x, cop.y, cop.angle, '#e8c39e', '#20242c', true); continue; }
    if (!cop.car) drawPerson(ctx, cop.x, cop.y, cop.angle, '#e8c39e', '#20242c', false);
  }
  // Player.
  const p = s.player;
  if (!p.inCar) drawPerson(ctx, p.x, p.y, p.angle, '#e8c39e', '#e07b39', false);
  else {
    // Aim line while driving is not needed; show a small marker above the car.
    ctx.fillStyle = '#ffd94a';
    ctx.beginPath(); ctx.arc(p.x, p.y - 26, 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#ffd94a';
  for (const b of s.bullets) {
    ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  drawHud(ctx, s, view);
}

function drawHud(ctx, s, view) {
  const { w, h } = view;
  const p = s.player;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Top-left: cash, health, gun.
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  roundRect(ctx, 12, 12, 250, 92, 10);
  ctx.fill();
  ctx.fillStyle = '#37b24d';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('$' + p.cash, 24, 44);
  ctx.fillStyle = '#888';
  ctx.font = '13px sans-serif';
  ctx.fillText('earned $' + s.earned, 150, 42);
  // Health bar.
  ctx.fillStyle = '#333';
  ctx.fillRect(24, 54, 150, 12);
  ctx.fillStyle = p.hp > 50 ? '#37b24d' : p.hp > 25 ? '#e0b13c' : '#d83a3a';
  ctx.fillRect(24, 54, 150 * Math.max(0, p.hp) / 100, 12);
  ctx.fillStyle = '#fff';
  ctx.font = '12px sans-serif';
  ctx.fillText('HP ' + Math.max(0, Math.ceil(p.hp)), 182, 65);
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  ctx.fillText(p.gun ? 'Pistol  •  ammo ' + p.ammo : 'No gun yet — finish First Wheels', 24, 90);

  // Wanted stars, top centre.
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  roundRect(ctx, w / 2 - 110, 12, 220, 44, 10);
  ctx.fill();
  ctx.font = '26px sans-serif';
  ctx.textAlign = 'center';
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < p.wanted ? '★' : '☆';
  ctx.fillStyle = '#ffd94a';
  ctx.fillText(stars, w / 2, 44);
  ctx.textAlign = 'left';

  // Mission box, top-left below the stats.
  if (s.missionIndex < MISSIONS.length) {
    const m = MISSIONS[s.missionIndex];
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    roundRect(ctx, 12, 112, 330, 64, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('Mission ' + (s.missionIndex + 1) + '/5: ' + m.name + '  ($' + m.reward + ')', 24, 136);
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.fillText(missionObjective(s), 24, 158);
    if (s.missionIndex === 3 && s.missionPhase === 'rob') {
      ctx.fillStyle = '#333';
      ctx.fillRect(24, 164, 200, 8);
      ctx.fillStyle = '#e0b13c';
      ctx.fillRect(24, 164, 200 * Math.min(1, s.missionProgress / 4), 8);
    }
  } else {
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    roundRect(ctx, 12, 112, 330, 44, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('Vice King of Palmetto Bay', 24, 140);
  }

  // Message toast.
  if (s.msgTimer > 0 && s.msg) {
    ctx.fillStyle = 'rgba(10,14,20,0.8)';
    const tw = ctx.measureText(s.msg).width + 32;
    roundRect(ctx, w / 2 - tw / 2, h - 84, tw, 36, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(s.msg, w / 2, h - 60);
    ctx.textAlign = 'left';
  }

  // Controls hint, bottom-left.
  ctx.fillStyle = 'rgba(10,14,20,0.6)';
  roundRect(ctx, 12, h - 44, 430, 32, 8);
  ctx.fill();
  ctx.fillStyle = '#ccc';
  ctx.font = '12px sans-serif';
  ctx.fillText('WASD move/drive  •  E enter car  •  F punch  •  Click shoot  •  Shift run  •  P pause  •  M mute', 22, h - 23);

  drawMinimap(ctx, s, view);
}

function drawMinimap(ctx, s, view) {
  const { w, h } = view;
  const mw = 210, mh = 158;
  const x0 = w - mw - 12, y0 = 12;
  const sx = mw / WORLD_W, sy = mh / WORLD_H;
  ctx.fillStyle = 'rgba(10,14,20,0.78)';
  roundRect(ctx, x0 - 4, y0 - 4, mw + 8, mh + 8, 10);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, mw, mh);
  ctx.clip();
  ctx.fillStyle = '#3f7a44';
  ctx.fillRect(x0, y0, mw, mh);
  ctx.fillStyle = '#e8d9a0';
  ctx.fillRect(x0, y0 + mh - 10, mw, 10);
  ctx.fillStyle = '#2c313a';
  for (const ax of AVENUES) ctx.fillRect(x0 + ax * sx - 3, y0, 6, mh);
  for (const sy2 of STREETS) ctx.fillRect(x0, y0 + sy2 * sy - 3, mw, 6);
  // Landmarks.
  ctx.fillStyle = '#ffd94a';
  for (const key of Object.keys(LANDMARKS)) {
    const lm = LANDMARKS[key];
    ctx.beginPath(); ctx.arc(x0 + lm.x * sx, y0 + lm.y * sy, 3, 0, Math.PI * 2); ctx.fill();
  }
  // Mission target.
  if (s.missionTarget && s.missionIndex < MISSIONS.length) {
    ctx.strokeStyle = '#ffd94a';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x0 + s.missionTarget.x * sx, y0 + s.missionTarget.y * sy, 7, 0, Math.PI * 2); ctx.stroke();
  }
  // Cops red, player white.
  ctx.fillStyle = '#ff5a4a';
  for (const cop of s.cops) {
    ctx.beginPath(); ctx.arc(x0 + cop.x * sx, y0 + cop.y * sy, 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x0 + s.player.x * sx, y0 + s.player.y * sy, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x0 + s.player.x * sx, y0 + s.player.y * sy, 6, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.font = '11px sans-serif';
  ctx.fillText('PALMETTO BAY', x0, y0 + mh + 16);
}
