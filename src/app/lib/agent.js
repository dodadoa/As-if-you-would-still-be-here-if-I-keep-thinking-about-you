import { AGENT, CHAR_W, TEXT } from "../config";
import { playChord } from "./audio";

export function makeAgentCircle(p) {
  const margin = AGENT.RADIUS + AGENT.EDGE_MARGIN;
  return {
    x: p.width / 2,
    y: p.height / 2,
    vx: 0,
    vy: 0,
    targetX: p.random(margin, p.width - margin),
    targetY: p.random(margin, p.height - margin),
    ingestedChars: [],
    lastChordTime: -Infinity,
    chordAnimTime: -Infinity,
    eatAnimTime: -Infinity,
    targetBlock: null,
  };
}

function pickWanderTarget(p, agent) {
  const margin = AGENT.RADIUS + AGENT.EDGE_MARGIN;
  agent.targetX = p.random(margin, p.width - margin);
  agent.targetY = p.random(margin, p.height - margin);
}

function ingestBlock(agent, block, now) {
  block.chars.forEach((char) => {
    agent.ingestedChars.push({ ch: char.ch, orbitAngle: Math.random() * Math.PI * 2, eatTime: now });
    if (agent.ingestedChars.length >= AGENT.MAX_CHARS) {
      playChord(agent.ingestedChars);
      agent.chordAnimTime = now;
      agent.lastChordTime = now;
      agent.ingestedChars = [];
    }
  });
}

export function updateAgent(p, agent, allAgents, blocks, symbols, now, activeBlock) {
  // Drop claim if the block was eaten or emptied
  if (agent.targetBlock && (agent.targetBlock.chars.length === 0 || !blocks.includes(agent.targetBlock))) {
    agent.targetBlock = null;
  }

  // Find the nearest unclaimed block (claimed by another agent)
  const claimed = new Set(allAgents.filter(a => a !== agent).map(a => a.targetBlock).filter(Boolean));
  let bestBlock = null;
  let bestDist = Infinity;
  for (const block of blocks) {
    if (block.chars.length === 0 || block === activeBlock || claimed.has(block)) continue;
    const bx = block.x + (block.chars.length * CHAR_W) / 2;
    const by = block.y;
    const d = Math.hypot(bx - agent.x, by - agent.y);
    if (d < bestDist) { bestDist = d; bestBlock = block; }
  }

  if (bestBlock) {
    agent.targetBlock = bestBlock;
    agent.targetX = bestBlock.x + (bestBlock.chars.length * CHAR_W) / 2;
    agent.targetY = bestBlock.y;
  } else if (agent.targetBlock) {
    agent.targetX = agent.targetBlock.x + (agent.targetBlock.chars.length * CHAR_W) / 2;
    agent.targetY = agent.targetBlock.y;
  } else {
    const tdist = Math.hypot(agent.targetX - agent.x, agent.targetY - agent.y);
    if (tdist < AGENT.TARGET_REACH_DIST) pickWanderTarget(p, agent);
  }

  const tdx = agent.targetX - agent.x;
  const tdy = agent.targetY - agent.y;
  const tdist = Math.max(Math.hypot(tdx, tdy), 0.01);
  const speed = AGENT.BLOB_SPEED;
  agent.vx = p.lerp(agent.vx, (tdx / tdist) * speed, AGENT.STEER_LERP);
  agent.vy = p.lerp(agent.vy, (tdy / tdist) * speed, AGENT.STEER_LERP);

  agent.x += agent.vx;
  agent.y += agent.vy;

  if (agent.x - AGENT.RADIUS < 0) { agent.x = AGENT.RADIUS; agent.vx = Math.abs(agent.vx); }
  if (agent.x + AGENT.RADIUS > p.width) { agent.x = p.width - AGENT.RADIUS; agent.vx = -Math.abs(agent.vx); }
  if (agent.y - AGENT.RADIUS < 0) { agent.y = AGENT.RADIUS; agent.vy = Math.abs(agent.vy); }
  if (agent.y + AGENT.RADIUS > p.height) { agent.y = p.height - AGENT.RADIUS; agent.vy = -Math.abs(agent.vy); }

  // eat any block the agent passes through
  for (let bi = blocks.length - 1; bi >= 0; bi--) {
    const block = blocks[bi];
    if (block === activeBlock) continue;
    const bx = block.x + (block.chars.length * CHAR_W) / 2;
    const by = block.y;
    if (Math.hypot(bx - agent.x, by - agent.y) > AGENT.INGEST_DIST) continue;
    ingestBlock(agent, block, now);
    if (agent.targetBlock === block) agent.targetBlock = null;
    blocks.splice(bi, 1);
    agent.eatAnimTime = now;
  }

  // eat nearby symbols
  for (let si = symbols.length - 1; si >= 0; si--) {
    const sym = symbols[si];
    if (Math.hypot(sym.x - agent.x, sym.y - agent.y) > AGENT.INGEST_DIST) continue;
    agent.ingestedChars.push({ ch: sym.ch, orbitAngle: Math.random() * Math.PI * 2, eatTime: now });
    symbols.splice(si, 1);
    agent.eatAnimTime = now;
    if (agent.ingestedChars.length >= AGENT.MAX_CHARS) {
      playChord(agent.ingestedChars);
      agent.chordAnimTime = now;
      agent.lastChordTime = now;
      agent.ingestedChars = [];
    }
  }
}

export function drawAgent(p, agent, now) {
  const chordElapsed = now - agent.chordAnimTime;
  const chordT = Math.min(chordElapsed / AGENT.CHORD_BLOOM_MS, 1);
  const chordBloom = Math.sin(chordT * Math.PI);

  const eatElapsed = now - agent.eatAnimTime;
  const eatT = Math.min(eatElapsed / AGENT.EAT_ANIM_MS, 1);
  const eatPulse = Math.sin(eatT * Math.PI);

  const orbitOffset = now * AGENT.ORBIT_SPEED;
  const displayR = AGENT.RADIUS * (1 + eatPulse * 0.2);

  p.push();
  p.translate(agent.x, agent.y);

  // chord bloom
  if (chordBloom > 0.01) {
    const maxSpread = AGENT.RADIUS * 9;
    const LAYERS = 28;
    p.noStroke();
    for (let i = LAYERS; i >= 0; i--) {
      const frac = i / LAYERS;
      const r = AGENT.RADIUS + frac * chordBloom * maxSpread;
      const alpha = chordBloom * Math.exp(-frac * frac * 2.8) * 28;
      p.fill(0, alpha);
      p.circle(0, 0, r * 2);
    }
  }

  // eat pulse ring
  if (eatPulse > 0.01) {
    p.noFill();
    p.stroke(0, eatPulse * 160);
    p.strokeWeight(2 * eatPulse);
    p.circle(0, 0, (AGENT.RADIUS + 16) * 2);
  }

  // circle body
  p.noFill();
  p.stroke(0);
  p.strokeWeight(1.2);
  p.circle(0, 0, displayR * 2);

  // center dot
  p.noStroke();
  p.fill(0);
  p.circle(0, 0, 7);

  if (agent.ingestedChars.length > 0) {
    p.textSize(7);
    p.textAlign(p.CENTER, p.CENTER);
    p.textFont(TEXT.FONT_FAMILY);
    p.fill(255);
    p.text(agent.ingestedChars.length, 0, 0.5);
  }

  // orbiting ingested chars
  agent.ingestedChars.forEach((ic, idx) => {
    const baseAngle = (idx / Math.max(agent.ingestedChars.length, 1)) * Math.PI * 2;
    const angle = baseAngle + orbitOffset + ic.orbitAngle * 0.05;
    const ox = Math.cos(angle) * AGENT.ORBIT_RADIUS;
    const oy = Math.sin(angle) * AGENT.ORBIT_RADIUS;
    const ageT = Math.min((now - ic.eatTime) / 280, 1);
    const chordFade = chordBloom > 0.01 ? 0.4 + chordBloom * 0.6 : 1;

    p.push();
    p.translate(ox, oy);
    p.textSize(12);
    p.textFont(TEXT.FONT_FAMILY);
    p.textAlign(p.CENTER, p.CENTER);
    p.noStroke();
    p.fill(0, ageT * chordFade * 210);
    p.text(ic.ch, 0, 0);
    p.pop();
  });

  p.pop();
}
