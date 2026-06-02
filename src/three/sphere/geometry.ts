/**
 * Particle-construction primitives for the sphere orb — point distributions
 * (Fibonacci shell, uniform ball, gaussian cloud, random unit vector) and the
 * procedural radial-gradient sprite every particle system samples. All pure /
 * stateless; no scene or closure coupling.
 */
import * as THREE from "three";

// ─── Pure distribution helpers ────────────────────────────────────────
export function fibonacciSphere(count: number, radius: number) {
  const out = new Float32Array(count * 3);
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = phi * i;
    out[i * 3] = Math.cos(theta) * r * radius;
    out[i * 3 + 1] = y * radius;
    out[i * 3 + 2] = Math.sin(theta) * r * radius;
  }
  return out;
}
export function randomInBall(radius: number): [number, number, number] {
  while (true) {
    const x = Math.random() * 2 - 1;
    const y = Math.random() * 2 - 1;
    const z = Math.random() * 2 - 1;
    if (x * x + y * y + z * z <= 1) return [x * radius, y * radius, z * radius];
  }
}
export function gaussian(stdDev: number) {
  let u = 0,
    v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return stdDev * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
export function randomUnitVector(): [number, number, number] {
  const u = Math.random(),
    w = Math.random();
  const theta = u * Math.PI * 2;
  const phi = Math.acos(2 * w - 1);
  return [
    Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta),
  ];
}

// ─── Procedural circular particle sprite ──────────────────────────────
export function createParticleTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx)
    throw new Error("Failed to acquire 2D context for particle texture");
  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  g.addColorStop(0.0, "rgba(255,255,255,1.0)");
  g.addColorStop(0.25, "rgba(255,255,255,0.7)");
  g.addColorStop(0.55, "rgba(255,255,255,0.18)");
  g.addColorStop(1.0, "rgba(255,255,255,0.0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
