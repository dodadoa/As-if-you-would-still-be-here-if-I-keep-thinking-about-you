import { RADAR, CIRCLES, SHOCKWAVE, TEXT } from "../config";
import { playCircPing } from "./audio";

export function distToEdge(p, cx, cy, rot) {
  const cosA = Math.cos(rot);
  const sinA = Math.sin(rot);
  const candidates = [];
  if (Math.abs(cosA) > 1e-9)
    candidates.push(cosA > 0 ? (p.width - cx) / cosA : -cx / cosA);
  if (Math.abs(sinA) > 1e-9)
    candidates.push(sinA > 0 ? (p.height - cy) / sinA : -cy / sinA);
  return Math.min(...candidates.filter((v) => v >= 0));
}

export function drawCross(p, cx, cy, rot) {
  p.stroke(0);
  p.strokeWeight(1.5);
  [rot, rot + p.PI, rot + p.HALF_PI, rot - p.HALF_PI].forEach((dir) => {
    const d = distToEdge(p, cx, cy, dir);
    p.line(cx, cy, cx + Math.cos(dir) * d, cy + Math.sin(dir) * d);
  });
}

export function addPulse(pulses, objX, objY, mx, my, angle) {
  const dx = objX - mx;
  const dy = objY - my;
  const perpAxis1 = Math.abs(dx * Math.sin(angle) - dy * Math.cos(angle));
  const perpAxis2 = Math.abs(dx * Math.cos(angle) + dy * Math.sin(angle));
  const axisOffset = perpAxis1 < perpAxis2 ? 0 : Math.PI / 2;
  const cosA = Math.cos(angle + axisOffset);
  const sinA = Math.sin(angle + axisOffset);
  const t0 = dx * cosA + dy * sinA;
  pulses.push({ t0, axisOffset, birthTime: performance.now() });
}

export function drawLinePulses(p, pulses, angle, smoothX, smoothY) {
  const now = performance.now();
  for (let i = pulses.length - 1; i >= 0; i--) {
    const pulse = pulses[i];
    const elapsed = (now - pulse.birthTime) / 1000;
    if (elapsed > RADAR.PULSE_DURATION / 1000) { pulses.splice(i, 1); continue; }

    const progress = elapsed / (RADAR.PULSE_DURATION / 1000);
    const alpha = (1 - progress) * 255;
    const dist = elapsed * RADAR.PULSE_SPEED;
    const currentAngle = angle + pulse.axisOffset;
    const cosA = Math.cos(currentAngle);
    const sinA = Math.sin(currentAngle);

    [1, -1].forEach((dir) => {
      const t = pulse.t0 + dir * dist;
      const px = smoothX + t * cosA;
      const py = smoothY + t * sinA;
      if (px < 0 || px > p.width || py < 0 || py > p.height) return;

      const half = p.lerp(10, 3, progress);
      p.push();
      p.noFill();
      p.stroke(255, alpha);
      p.strokeWeight(3.5);
      p.line(px - cosA * half, py - sinA * half, px + cosA * half, py + sinA * half);
      p.stroke(0, alpha * 0.5);
      p.strokeWeight(0.8);
      p.line(px - cosA * half, py - sinA * half, px + cosA * half, py + sinA * half);
      p.pop();
    });
  }
}

export function makeCircle(p) {
  const r = p.random(3, 9);
  return {
    x: p.random(r, p.width - r),
    y: p.random(r, p.height - r),
    r,
    vx: p.random(0.04, 0.12) * (p.random() > 0.5 ? 1 : -1),
    vy: p.random(0.04, 0.12) * (p.random() > 0.5 ? 1 : -1),
    filled: p.random() > 0.5,
    prevD1: null,
    prevD2: null,
    lastTrigger: 0,
    hitTime: -Infinity,
    lastShockId: -1,
  };
}

export function updateAndDrawCircles(p, circles, angle, mx, my, pulses, shockwaves) {
  const A = angle;
  const now = performance.now();

  circles.forEach((c) => {
    c.x += c.vx;
    c.y += c.vy;
    if (c.x - c.r < 0) { c.x = c.r; c.vx *= -1; }
    if (c.x + c.r > p.width) { c.x = p.width - c.r; c.vx *= -1; }
    if (c.y - c.r < 0) { c.y = c.r; c.vy *= -1; }
    if (c.y + c.r > p.height) { c.y = p.height - c.r; c.vy *= -1; }

    const dx = c.x - mx;
    const dy = c.y - my;
    const d1 = dx * Math.sin(A) - dy * Math.cos(A);
    const d2 = dx * Math.cos(A) + dy * Math.sin(A);

    if (now - c.lastTrigger > TEXT.TRIGGER_COOLDOWN_MS) {
      const crossed =
        (c.prevD1 !== null && Math.sign(d1) !== Math.sign(c.prevD1)) ||
        (c.prevD2 !== null && Math.sign(d2) !== Math.sign(c.prevD2));
      if (crossed) {
        playCircPing(c.y, p.height);
        c.lastTrigger = now;
        c.hitTime = now;
        addPulse(pulses, c.x, c.y, mx, my, A);
      }
    }
    c.prevD1 = d1;
    c.prevD2 = d2;

    for (let i = 0; i < shockwaves.length; i++) {
      const wave = shockwaves[i];
      if (c.lastShockId === wave.id) continue;
      const r = ((now - wave.birthTime) / 1000) * SHOCKWAVE.SPEED;
      const centerDist = Math.hypot(c.x - mx, c.y - my);
      if (Math.abs(centerDist - r) <= SHOCKWAVE.WINDOW + c.r) {
        c.lastShockId = wave.id;
        c.hitTime = now;
        playCircPing(c.y, p.height);
        addPulse(pulses, c.x, c.y, mx, my, A);
      }
    }

    const elapsed = now - c.hitTime;
    const t = Math.min(elapsed / CIRCLES.HIT_ANIM_MS, 1);
    const bloom = Math.sin(t * Math.PI);

    p.push();
    p.translate(c.x, c.y);

    if (bloom > 0.02) {
      const maxSpread = c.r * 7;
      const LAYERS = 32;
      p.noStroke();
      for (let i = LAYERS; i >= 0; i--) {
        const frac = i / LAYERS;
        const r = c.r + frac * bloom * maxSpread;
        const falloff = Math.exp(-frac * frac * 3.5);
        const col = Math.round(255 * frac);
        const alpha = bloom * falloff * 22;
        p.fill(col, alpha);
        p.circle(0, 0, r * 2);
      }
    }

    const isHit = bloom > 0.02;
    if (c.filled) {
      if (isHit) { p.fill(255); p.stroke(0); p.strokeWeight(1.5); }
      else { p.fill(0); p.noStroke(); }
    } else {
      if (isHit) { p.fill(0); p.noStroke(); }
      else { p.noFill(); p.stroke(0); p.strokeWeight(1.5); }
    }
    p.circle(0, 0, c.r * 2);
    p.pop();
  });
}

export function drawShockwaves(p, shockwaves, mx, my) {
  const now = performance.now();
  const maxR = Math.hypot(p.width, p.height);
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const wave = shockwaves[i];
    const elapsed = (now - wave.birthTime) / 1000;
    const r = elapsed * SHOCKWAVE.SPEED;
    if (r > maxR) {
      shockwaves.splice(i, 1);
      continue;
    }
    const alpha = 255 * (1 - r / maxR);
    p.push();
    p.noFill();
    p.stroke(0, alpha);
    p.strokeWeight(SHOCKWAVE.STROKE);
    p.circle(mx, my, r * 2);
    p.pop();
  }
}
