"use client";

import { useEffect, useRef, useCallback } from "react";

const TARGET_SPEED = 0.004;
const ACCEL = 0.0002;
const DECEL = 0.0002;

export default function AxesCanvas() {
  const canvasRef = useRef(null);
  const stateRef = useRef({
    angle: 0,
    spinning: false,
    spinSpeed: 0,
    mouse: { x: -9999, y: -9999 },
    rafId: null,
  });

  const handleClick = useCallback(() => {
    stateRef.current.spinning = !stateRef.current.spinning;
  }, []);

  const handleMouseMove = useCallback((e) => {
    stateRef.current.mouse = { x: e.clientX, y: e.clientY };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const s = stateRef.current;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    // Returns the distance from (cx, cy) at angle `rot` to the canvas edge.
    // Uses CSS pixel dimensions so mouse coords map correctly.
    function distToEdge(cx, cy, rot) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      const candidates = [];
      if (Math.abs(cos) > 1e-9) {
        candidates.push(cos > 0 ? (w - cx) / cos : -cx / cos);
      }
      if (Math.abs(sin) > 1e-9) {
        candidates.push(sin > 0 ? (h - cy) / sin : -cy / sin);
      }
      return Math.min(...candidates.filter((v) => v >= 0));
    }

    function drawCross(cx, cy, rot) {
      ctx.save();
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 1;

      // Each of the 4 ray directions
      const directions = [rot, rot + Math.PI, rot + Math.PI / 2, rot - Math.PI / 2];
      directions.forEach((dir) => {
        const d = distToEdge(cx, cy, dir);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(dir) * d, cy + Math.sin(dir) * d);
        ctx.stroke();
      });

      ctx.restore();
    }

    function frame() {
      if (s.spinning) {
        s.spinSpeed = Math.min(s.spinSpeed + ACCEL, TARGET_SPEED);
      } else {
        s.spinSpeed = Math.max(s.spinSpeed - DECEL, 0);
      }
      s.angle += s.spinSpeed;

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

      drawCross(s.mouse.x, s.mouse.y, s.angle);

      // center dot
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.arc(s.mouse.x, s.mouse.y, 3, 0, Math.PI * 2);
      ctx.fill();

      s.rafId = requestAnimationFrame(frame);
    }

    s.rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(s.rafId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-white"
      style={{ cursor: "none" }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        onClick={handleClick}
        onMouseMove={handleMouseMove}
      />
    </div>
  );
}
