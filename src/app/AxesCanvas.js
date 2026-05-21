"use client";

import { useEffect, useRef } from "react";
import { Tone } from "./lib/audio";
import {
  drawPerformance,
  keyPressedPerformance,
  mouseClickedPerformance,
  resetPerformance,
  setupPerformance,
} from "./scenes/performance";

function createSketchState(p) {
  return {
    p,
    arcMode: 0,
    arcModeStart: 0,
    pendingArcMode: null,
    sceneTitleText: "",
    sceneTitleShownAt: 0,
    angle: 0,
    spinning: false,
    spinSpeed: 0,
    blocks: [],
    activeBlock: null,
    circles: [],
    symbols: [],
    lastSymbolTime: -Infinity,
    smoothX: p.windowWidth / 2,
    smoothY: p.windowHeight / 2,
    linePulses: [],
    shockwaves: [],
    nextShockwaveId: 1,
    showInfo: false,
    infoT: 0,
    mode: "default",
    agentCircle: null,
    writeBackQueue: [],
    lastAutoShock: 0,
    captionText: "",
    captionShownAt: 0,
    scriptedSpawned: new Set(),
  };
}

export default function AxesCanvas() {
  const containerRef = useRef(null);

  useEffect(() => {
    let sketch;

    import("p5").then(({ default: P5 }) => {
      sketch = new P5((p) => {
        const ctx = createSketchState(p);

        p.setup = () => {
          p.createCanvas(p.windowWidth, p.windowHeight);
          p.pixelDensity(window.devicePixelRatio || 1);
          p.noCursor();
          setupPerformance(ctx);
          ctx.arcModeStart = performance.now();
        };

        p.windowResized = () => {
          p.resizeCanvas(p.windowWidth, p.windowHeight);
        };

        p.draw = () => {
          drawPerformance(ctx, performance.now());
        };

        p.mouseClicked = () => {
          Tone.start();
          mouseClickedPerformance(ctx);
        };

        p.keyPressed = () => {
          Tone.start();

          if (p.key >= "0" && p.key <= "4") {
            ctx.pendingArcMode = parseInt(p.key, 10);
            return false;
          }

          keyPressedPerformance(ctx, p);
          return false;
        };
      }, containerRef.current);
    });

    return () => {
      if (sketch) sketch.remove();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ width: "100vw", height: "100vh", overflow: "hidden" }}
    />
  );
}
