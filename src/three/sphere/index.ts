/**
 * sphere/index.ts — Three.js AI agent orb, vendored from vshslv/sphere2.0
 *
 * Scene orchestration + state machine. Stateless primitives are split into
 * sibling modules: ./noise (GLSL simplex + JS Perlin/curl), ./geometry (point
 * distributions + sprite texture), ./responses (chat vocabulary, re-exported
 * below). Public import path is unchanged — `../three/sphere`.
 *
 * Adapted for embed inside a fixed-size container (the navbar widget),
 * not a fullscreen demo. Each initSphere() call creates its own renderer,
 * scene, particle systems, and post-processing pipeline. The caller drives
 * the state machine (normal / listening / thinking / speaking) via the
 * returned handle.
 *
 * Changes vs the source demo (axiom — keep visuals 1:1, only adapt host):
 *   - WebGLRenderer mounts into `container` instead of document.body.
 *   - Size + DPR follow the container via ResizeObserver, not window.resize.
 *   - Pointer tracking is scoped to the container (orb tilts only when
 *     the cursor is over the nav, returns to centre on pointerleave).
 *   - The CSS `--glow-amp` edge-glow is dropped — the orb sits inside a
 *     ~100px widget, the ambient aura would be invisible at that size.
 *   - The demo's chat/state-switcher DOM wiring is removed — the navbar
 *     drives setState/applyTargetParams/speakPulse from its own script.
 *
 * Reduced motion: applyTargetParams dampens motion-heavy params (spin,
 * vortex, breath) — the orb still renders but reads as a calm avatar.
 */
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import {
  createParticleTexture,
  fibonacciSphere,
  gaussian,
  randomInBall,
  randomUnitVector,
} from "./geometry";
import { SIMPLEX_GLSL, makePerlin } from "./noise";

export type SphereState = "normal" | "listening" | "thinking" | "speaking";

export interface SphereHandle {
  /** Switch state (lerps over ~0.9 s). Idempotent on re-entry. */
  setState: (name: SphereState) => void;
  /** Apply a state's targets WITHOUT marking active — used by streamMessage
   *  tail to start easing toward 'normal' while still in 'speaking'. */
  applyTargetParams: (name: SphereState) => void;
  /** Micro-burst — per-word brightness spike during speaking. Decays in ~220 ms. */
  speakPulse: () => void;
  /** Stop the rAF loop. State, uniforms, GPU buffers all stay; the next
   *  `resume()` continues from the last frame. Cheap idle-saver — no GPU
   *  context teardown. Idempotent. */
  pause: () => void;
  /** Restart the rAF loop after `pause()`. Discards accumulated clock-delta
   *  so the first frame doesn't jolt every lerp by the gap duration. */
  resume: () => void;
  /** Aim the orb toward normalized cursor coordinates (nx, ny in [-1, 1]).
   *  Internal MAX_ROTATION constants clamp the actual tilt. Caller is
   *  responsible for normalization relative to whatever area they want
   *  the orb to "watch" (the sphere doesn't assume cursor is over it).
   *  Pass (0, 0) to centre. Cheap — only updates the lerp target. */
  aim: (nx: number, ny: number) => void;
  /** Tear down renderer, listeners, GPU resources. Idempotent. */
  dispose: () => void;
}

export interface SphereOptions {
  /**
   * Distance of the perspective camera from the orb on the Z axis. Lower
   * values = larger orb on screen. Default 5 (orb dominates a ~120px widget).
   * The source demo used 18 to make the orb avatar-sized inside a fullscreen
   * viewport; we want it filling a small container so the default is closer.
   */
  cameraZ?: number;
  /**
   * Multiplier applied to UnrealBloomPass strength (per-state + frame-level).
   * Default 1.0 (1:1 with the source demo). Lower (~0.7) inside a small
   * widget where the default bloom halo dissolves the shell detail.
   */
  bloomScale?: number;
  /**
   * UnrealBloomPass radius. Default 0.6 (source demo). Smaller values produce
   * a tighter halo hugging the orb (better at small viewport sizes).
   */
  bloomRadius?: number;
}

// ─── Tunable constants (copied verbatim from sphere2.0) ────────────────
const SPHERE_RADIUS = 1.5;
const SHELL_PARTICLE_COUNT = 15000;
const CORE_PARTICLE_COUNT = 1200;
const CORE_RADIUS = 1.0;
const HAZE_PARTICLE_COUNT = 450;
const BLOOM_STRENGTH = 1.4;
const BLOOM_THRESHOLD = 0.3;
/* BLOOM_RADIUS is now exposed via SphereOptions.bloomRadius (default 0.6) */
const PULSE_DURATION = 0.4;
const PULSE_EXPAND = 0.3;
const PULSE_HAZE_DURATION = 0.6;
const ROTATION_LERP = 0.04;
const MAX_ROTATION_Y = THREE.MathUtils.degToRad(15);
const MAX_ROTATION_X = THREE.MathUtils.degToRad(10);
const CAMERA_FOV = 40;
const DEFAULT_CAMERA_Z = 4.5; // tuned for ~120px widget; demo used 18 for fullscreen
const DEFAULT_BLOOM_SCALE = 1.0;
const DEFAULT_BLOOM_RADIUS = 0.6;
const STATE_LERP = 0.08;
const SPEAK_PULSE_DECAY = 4.5;

interface StateParams {
  coreSpeed: number;
  coreGlow: number;
  shellBrightness: number;
  shellFlowAmp: number;
  shellFlowFreq: number;
  hazeBrightness: number;
  hazeRate: number;
  bloomStrength: number;
  spinSpeed: number;
  tiltAmp: number;
  coreRadialFlow: number;
  coreVortex: number;
  breathAmp: number;
  breathRate: number;
  jellyAmp: number;
}

const STATES: Record<SphereState, StateParams> = {
  normal: {
    coreSpeed: 0.7,
    coreGlow: 1.15,
    shellBrightness: 0.72,
    shellFlowAmp: 0.32,
    shellFlowFreq: 1.1,
    hazeBrightness: 1.05,
    hazeRate: 1.5708,
    bloomStrength: 1.5,
    spinSpeed: 0.025,
    tiltAmp: 0.008,
    coreRadialFlow: 0,
    coreVortex: 0,
    breathAmp: 0.025,
    breathRate: 1.3,
    jellyAmp: 0,
  },
  listening: {
    coreSpeed: 0.35,
    coreGlow: 1.5,
    shellBrightness: 0.4,
    shellFlowAmp: 0.3,
    shellFlowFreq: 0.8,
    hazeBrightness: 1.4,
    hazeRate: 2.1,
    bloomStrength: 1.7,
    spinSpeed: 0.02,
    tiltAmp: 0.01,
    coreRadialFlow: -0.45,
    coreVortex: 0,
    breathAmp: 0,
    breathRate: 0,
    jellyAmp: 0.1,
  },
  thinking: {
    coreSpeed: 1.1,
    coreGlow: 2.9,
    shellBrightness: 0.38,
    shellFlowAmp: 0.45,
    shellFlowFreq: 2.6,
    hazeBrightness: 2.1,
    hazeRate: 4.3,
    bloomStrength: 2.15,
    spinSpeed: 0.7,
    tiltAmp: 0.04,
    coreRadialFlow: 0,
    coreVortex: 2.6,
    breathAmp: 0.085,
    breathRate: 2.2,
    jellyAmp: 0,
  },
  speaking: {
    coreSpeed: 1.55,
    coreGlow: 2.0,
    shellBrightness: 1.15,
    shellFlowAmp: 0.35,
    shellFlowFreq: 1.8,
    hazeBrightness: 1.8,
    hazeRate: 6.2,
    bloomStrength: 1.8,
    spinSpeed: 0.065,
    tiltAmp: 0.02,
    coreRadialFlow: 0.4,
    coreVortex: 0,
    breathAmp: 0,
    breathRate: 0,
    jellyAmp: 0,
  },
};

// ─── Public init ──────────────────────────────────────────────────────
export function initSphere(
  container: HTMLElement,
  options: SphereOptions = {},
): SphereHandle {
  const cameraZ = options.cameraZ ?? DEFAULT_CAMERA_Z;
  const bloomScale = options.bloomScale ?? DEFAULT_BLOOM_SCALE;
  const bloomRadius = options.bloomRadius ?? DEFAULT_BLOOM_RADIUS;
  const REDUCED_MOTION = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  const getSize = () => {
    const rect = container.getBoundingClientRect();
    return {
      w: Math.max(1, Math.round(rect.width)),
      h: Math.max(1, Math.round(rect.height)),
    };
  };
  let { w, h } = getSize();

  // ─ Renderer / scene / camera ─────────────────────────────
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    premultipliedAlpha: false,
  });
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(w, h);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.display = "block";
  renderer.domElement.style.inlineSize = "100%";
  renderer.domElement.style.blockSize = "100%";

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, w / h, 0.1, 100);
  camera.position.set(0, 0, cameraZ);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.AmbientLight(0x0a1428, 0.1));

  const orbGroup = new THREE.Group();
  // No vertical offset — the source demo lifted the orb above a chat card;
  // here the orb sits in its own square widget, so centre it.
  orbGroup.position.y = 0;
  scene.add(orbGroup);

  const sharedUniforms = {
    uTime: { value: 0 },
    uPulse: { value: 0 },
    uPixelRatio: { value: pixelRatio },
    uViewportH: { value: h },
  };
  const particleTexture = createParticleTexture();
  const { curl } = makePerlin();

  // ─ Shell particles (Fibonacci-distributed, GLSL noise breathing) ─
  const shellPoints = (() => {
    const geometry = new THREE.BufferGeometry();
    const positions = fibonacciSphere(SHELL_PARTICLE_COUNT, SPHERE_RADIUS);
    const phases = new Float32Array(SHELL_PARTICLE_COUNT);
    const sizes = new Float32Array(SHELL_PARTICLE_COUNT);
    const colors = new Float32Array(SHELL_PARTICLE_COUNT * 3);
    const cWhite = [1.0, 1.0, 1.0];
    const cBlue = [0.659, 0.784, 1.0];
    for (let i = 0; i < SHELL_PARTICLE_COUNT; i++) {
      phases[i] = Math.random() * Math.PI * 2;
      sizes[i] = 1.5 + Math.random() * 2.0;
      const c = Math.random() < 0.9 ? cWhite : cBlue;
      colors[i * 3] = c[0];
      colors[i * 3 + 1] = c[1];
      colors[i * 3 + 2] = c[2];
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: sharedUniforms.uTime,
        uPulse: sharedUniforms.uPulse,
        uPixelRatio: sharedUniforms.uPixelRatio,
        uViewportH: sharedUniforms.uViewportH,
        uTexture: { value: particleTexture },
        uShellBrightness: { value: 1.0 },
        uShellFlowAmp: { value: 0.2 },
        uShellFlowFreq: { value: 1.2 },
        uBreathAmp: { value: 0.0 },
        uBreathPhase: { value: 0.0 },
        uJellyAmp: { value: 0.0 },
      },
      vertexShader: /* glsl */ `
        attribute float aPhase;
        attribute float aSize;
        attribute vec3  aColor;
        uniform float uTime;
        uniform float uPulse;
        uniform float uPixelRatio;
        uniform float uViewportH;
        uniform float uBreathAmp;
        uniform float uBreathPhase;
        uniform float uJellyAmp;
        varying float vPhase;
        varying float vAnchorY;
        varying float vFinalY;
        ${SIMPLEX_GLSL}
        void main() {
          vPhase = aPhase;
          vAnchorY = position.y;
          vec3 basePos = position;
          vec3 normalDir = normalize(basePos);
          float n = snoise(basePos * 0.5 + vec3(uTime * 0.15));
          vec3 spherePos = basePos + normalDir * n * 0.04;
          float jelly = snoise(basePos * 0.4 + vec3(uTime * 0.35));
          spherePos += normalDir * jelly * uJellyAmp;
          spherePos += normalDir * uPulse * ${PULSE_EXPAND.toFixed(3)};
          spherePos += normalDir * sin(uBreathPhase) * uBreathAmp;
          vFinalY = spherePos.y;
          vec4 mvPosition = modelViewMatrix * vec4(spherePos, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          vec3 viewN = normalize(normalMatrix * normalDir);
          float facing = max(viewN.z, 0.0);
          float facingBoost = 1.0 + facing * 0.4;
          float attenuation = uViewportH * 0.011 / -mvPosition.z;
          gl_PointSize = max(aSize * uPixelRatio * attenuation * facingBoost, uPixelRatio);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uShellBrightness;
        uniform float uShellFlowAmp;
        uniform float uShellFlowFreq;
        uniform sampler2D uTexture;
        varying float vPhase;
        varying float vAnchorY;
        varying float vFinalY;
        void main() {
          vec4 tex = texture2D(uTexture, gl_PointCoord);
          if (tex.a < 0.01) discard;
          float flicker = 0.7 + 0.3 * sin(uTime * 2.0 + vPhase);
          float flow = sin(vAnchorY * uShellFlowFreq * 1.5 + uTime * uShellFlowFreq * 0.4) * uShellFlowAmp;
          float bright = uShellBrightness * (1.0 + flow);
          vec3 warmTone = vec3(1.00, 0.62, 0.28);
          vec3 coolTone = vec3(0.95, 0.97, 1.05);
          float t = smoothstep(-0.85, 0.95, vFinalY);
          vec3 grad = mix(coolTone, warmTone, t);
          gl_FragColor = vec4(grad * flicker * bright * tex.a, 1.0);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geometry, material);
    orbGroup.add(points);
    return points;
  })();

  // ─ Core particles (interior, curl-noise drift, wrap on exit) ─
  const coreSpeeds = new Float32Array(CORE_PARTICLE_COUNT);
  const corePoints = (() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(CORE_PARTICLE_COUNT * 3);
    const phases = new Float32Array(CORE_PARTICLE_COUNT);
    const sizes = new Float32Array(CORE_PARTICLE_COUNT);
    const colors = new Float32Array(CORE_PARTICLE_COUNT * 3);
    const cAmber = [1.0, 0.78, 0.48];
    const cWhite = [1.0, 0.96, 0.9];
    for (let i = 0; i < CORE_PARTICLE_COUNT; i++) {
      const [x, y, z] = randomInBall(CORE_RADIUS);
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      phases[i] = Math.random() * Math.PI * 2;
      sizes[i] = 2.0 + Math.random() * 2.0;
      coreSpeeds[i] = 0.2 * (0.5 + Math.random());
      const c = Math.random() < 0.55 ? cAmber : cWhite;
      colors[i * 3] = c[0];
      colors[i * 3 + 1] = c[1];
      colors[i * 3 + 2] = c[2];
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: sharedUniforms.uTime,
        uPixelRatio: sharedUniforms.uPixelRatio,
        uViewportH: sharedUniforms.uViewportH,
        uTexture: { value: particleTexture },
        uGlow: { value: 1.0 },
      },
      vertexShader: /* glsl */ `
        attribute float aPhase;
        attribute float aSize;
        attribute vec3  aColor;
        uniform float uTime;
        uniform float uPixelRatio;
        uniform float uViewportH;
        uniform float uGlow;
        varying vec3  vColor;
        varying float vPhase;
        void main() {
          vColor = aColor;
          vPhase = aPhase;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          float glowSize = mix(1.0, 1.18, clamp(uGlow - 1.0, 0.0, 1.0));
          float attenuation = uViewportH * 0.011 / -mvPosition.z;
          gl_PointSize = max(aSize * uPixelRatio * attenuation * glowSize, uPixelRatio);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uGlow;
        uniform sampler2D uTexture;
        varying vec3  vColor;
        varying float vPhase;
        void main() {
          vec4 tex = texture2D(uTexture, gl_PointCoord);
          if (tex.a < 0.01) discard;
          float speedMul = mix(1.0, 1.6, clamp(uGlow - 1.0, 0.0, 1.0));
          float flicker = 0.55 + 0.45 * sin(uTime * 1.7 * speedMul + vPhase);
          gl_FragColor = vec4(vColor * flicker * uGlow * tex.a, 1.0);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geometry, material);
    orbGroup.add(points);
    return points;
  })();

  // ─ Haze particles (gaussian cloud near origin, heartbeat) ─
  const hazePoints = (() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(HAZE_PARTICLE_COUNT * 3);
    const phases = new Float32Array(HAZE_PARTICLE_COUNT);
    const sizes = new Float32Array(HAZE_PARTICLE_COUNT);
    for (let i = 0; i < HAZE_PARTICLE_COUNT; i++) {
      positions[i * 3] = gaussian(0.35);
      positions[i * 3 + 1] = gaussian(0.35);
      positions[i * 3 + 2] = gaussian(0.35);
      phases[i] = Math.random() * Math.PI * 2;
      sizes[i] = 4.0 + Math.random() * 4.0;
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: sharedUniforms.uTime,
        uPixelRatio: sharedUniforms.uPixelRatio,
        uViewportH: sharedUniforms.uViewportH,
        uHazeBoost: { value: 1.0 },
        uHazePhase: { value: 0.0 },
        uTexture: { value: particleTexture },
      },
      vertexShader: /* glsl */ `
        attribute float aPhase;
        attribute float aSize;
        uniform float uTime;
        uniform float uPixelRatio;
        uniform float uViewportH;
        varying float vPhase;
        void main() {
          vPhase = aPhase;
          vec3 pos = position;
          pos.x += sin(uTime * 0.18 + aPhase)         * 0.05;
          pos.y += cos(uTime * 0.14 + aPhase * 1.3)   * 0.05;
          pos.z += sin(uTime * 0.10 + aPhase * 0.7)   * 0.05;
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          float attenuation = uViewportH * 0.011 / -mvPosition.z;
          gl_PointSize = max(aSize * uPixelRatio * attenuation, uPixelRatio);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uHazeBoost;
        uniform float uHazePhase;
        uniform sampler2D uTexture;
        varying float vPhase;
        void main() {
          vec4 tex = texture2D(uTexture, gl_PointCoord);
          if (tex.a < 0.01) discard;
          float heartbeat = 0.5 + 0.5 * sin(uHazePhase + vPhase * 0.3);
          float opacity = (0.15 + 0.15 * heartbeat) * uHazeBoost;
          vec3 color = vec3(1.00, 0.88, 0.72);
          gl_FragColor = vec4(color * opacity * tex.a, 1.0);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geometry, material);
    orbGroup.add(points);
    return points;
  })();

  // ─ Post-processing: bloom is what makes the orb feel luminous ─
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(w, h);
  const renderPass = new RenderPass(scene, camera);
  renderPass.clearAlpha = 0;
  composer.addPass(renderPass);
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(w, h),
    BLOOM_STRENGTH * bloomScale,
    bloomRadius,
    BLOOM_THRESHOLD,
  );
  // Force RGB-only additive — default alpha-add smears bloom across the canvas
  // and makes the supposed-transparent areas opaque.
  // biome-ignore lint/suspicious/noExplicitAny: bloomPass.blendMaterial typing in three/addons is loose
  const bm: any = bloomPass.blendMaterial;
  bm.blending = THREE.CustomBlending;
  bm.blendEquation = THREE.AddEquation;
  bm.blendSrc = THREE.OneFactor;
  bm.blendDst = THREE.OneFactor;
  bm.blendEquationAlpha = THREE.AddEquation;
  bm.blendSrcAlpha = THREE.ZeroFactor;
  bm.blendDstAlpha = THREE.OneFactor;
  composer.addPass(bloomPass);
  const outputPass = new OutputPass();
  outputPass.material.transparent = true;
  composer.addPass(outputPass);

  // ─ State machine ─
  const currentParams: StateParams = { ...STATES.normal };
  const targetParams: StateParams = { ...STATES.normal };
  let activeState: SphereState = "normal";

  function applyTargetParams(name: SphereState) {
    const base = STATES[name];
    if (!base) return;
    if (REDUCED_MOTION) {
      Object.assign(targetParams, base, {
        spinSpeed: base.spinSpeed * 0.15,
        tiltAmp: base.tiltAmp * 0.1,
        coreVortex: base.coreVortex * 0.1,
        breathAmp: base.breathAmp * 0.2,
        coreRadialFlow: base.coreRadialFlow * 0.25,
      });
    } else {
      Object.assign(targetParams, base);
    }
  }
  function setState(name: SphereState) {
    if (!STATES[name] || activeState === name) return;
    activeState = name;
    applyTargetParams(name);
  }

  let speakPulseValue = 0;
  function speakPulseTrigger() {
    speakPulseValue = 1.0;
  }

  // ─ Pointer tracking — scoped to container so the orb tilts only
  //   while the cursor is over the nav; releases to centre on leave.
  const targetRotation = { x: 0, y: 0 };
  const currentRotation = { x: 0, y: 0 };
  let pulseStartTime: number | null = null;
  let hazePulseStartTime: number | null = null;
  let hazePhase = 0;
  let breathPhase = 0;
  let spinAngle = 0;
  let elapsedTime = 0;

  const onPointerMove = (e: PointerEvent) => {
    const rect = renderer.domElement.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    targetRotation.y = nx * MAX_ROTATION_Y;
    targetRotation.x = -ny * MAX_ROTATION_X;
  };
  const onPointerLeave = () => {
    targetRotation.x = 0;
    targetRotation.y = 0;
  };

  /** External aim — caller normalizes cursor coords against whatever
      "watch area" they choose (e.g. the whole navbar panel, not just
      the sphere canvas). Same target update as the local pointermove
      handler — lerp picks it up on the next frame. */
  function aim(nx: number, ny: number): void {
    targetRotation.y = nx * MAX_ROTATION_Y;
    targetRotation.x = -ny * MAX_ROTATION_X;
  }
  const onCanvasClick = () => {
    pulseStartTime = elapsedTime;
    hazePulseStartTime = elapsedTime;
  };
  container.addEventListener("pointermove", onPointerMove, { passive: true });
  container.addEventListener("pointerleave", onPointerLeave, { passive: true });
  renderer.domElement.addEventListener("click", onCanvasClick);

  // ─ Resize via ResizeObserver on the container ─
  const resizeObserver = new ResizeObserver(() => {
    const next = getSize();
    w = next.w;
    h = next.h;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    bloomPass.setSize(w, h);
    sharedUniforms.uViewportH.value = h;
  });
  resizeObserver.observe(container);

  // ─ Core particle update (curl-noise + vortex + radial flow) ─
  function updateCoreParticles(dt: number, t: number) {
    const positions = corePoints.geometry.attributes.position
      .array as Float32Array;
    const speedMul = currentParams.coreSpeed;
    const flow = currentParams.coreRadialFlow;
    const flowStep = flow * dt;
    const vortexAngle = currentParams.coreVortex * dt;
    const cosV = Math.cos(vortexAngle);
    const sinV = Math.sin(vortexAngle);
    for (let i = 0; i < CORE_PARTICLE_COUNT; i++) {
      let x = positions[i * 3];
      let y = positions[i * 3 + 1];
      let z = positions[i * 3 + 2];

      const v = curl(x * 0.9, y * 0.9, z * 0.9, t * 0.15);
      const s = coreSpeeds[i] * speedMul * dt;
      x += v[0] * s;
      y += v[1] * s;
      z += v[2] * s;

      const rx = x * cosV - z * sinV;
      const rz = x * sinV + z * cosV;
      x = rx;
      z = rz;

      if (flow !== 0) {
        const r = Math.sqrt(x * x + y * y + z * z);
        if (r > 1e-4) {
          const k = flowStep / r;
          x += x * k;
          y += y * k;
          z += z * k;
        }
      }

      const r2sq = x * x + y * y + z * z;
      if (r2sq < 0.0025 && flow < 0) {
        const [nx, ny, nz] = randomUnitVector();
        x = nx * CORE_RADIUS;
        y = ny * CORE_RADIUS;
        z = nz * CORE_RADIUS;
      } else if (r2sq > CORE_RADIUS * CORE_RADIUS) {
        const [nx, ny, nz] = randomInBall(CORE_RADIUS * 0.2);
        x = nx;
        y = ny;
        z = nz;
      }

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
    }
    corePoints.geometry.attributes.position.needsUpdate = true;
  }

  // ─ Animation loop ─
  const clock = new THREE.Clock();
  let rafId = 0;
  let disposed = false;
  let paused = false;

  const lerp = (a: number, b: number, t: number) => a + t * (b - a);

  // Material handles for the inner-loop hot path (avoid per-frame `as` casts).
  const shellMat = shellPoints.material as THREE.ShaderMaterial;
  const coreMat = corePoints.material as THREE.ShaderMaterial;
  const hazeMat = hazePoints.material as THREE.ShaderMaterial;

  function tick() {
    if (disposed || paused) return;
    rafId = requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 1 / 30);
    elapsedTime += dt;
    sharedUniforms.uTime.value = elapsedTime;

    // Click pulse — sin envelope over PULSE_DURATION
    if (pulseStartTime !== null) {
      const age = elapsedTime - pulseStartTime;
      if (age >= PULSE_DURATION) {
        pulseStartTime = null;
        sharedUniforms.uPulse.value = 0;
      } else {
        sharedUniforms.uPulse.value = Math.sin(
          (age / PULSE_DURATION) * Math.PI,
        );
      }
    }

    // Smooth state transitions — lerp every tunable toward target each frame
    currentParams.coreSpeed = lerp(
      currentParams.coreSpeed,
      targetParams.coreSpeed,
      STATE_LERP,
    );
    currentParams.coreGlow = lerp(
      currentParams.coreGlow,
      targetParams.coreGlow,
      STATE_LERP,
    );
    currentParams.shellBrightness = lerp(
      currentParams.shellBrightness,
      targetParams.shellBrightness,
      STATE_LERP,
    );
    currentParams.shellFlowAmp = lerp(
      currentParams.shellFlowAmp,
      targetParams.shellFlowAmp,
      STATE_LERP,
    );
    currentParams.shellFlowFreq = lerp(
      currentParams.shellFlowFreq,
      targetParams.shellFlowFreq,
      STATE_LERP,
    );
    currentParams.hazeBrightness = lerp(
      currentParams.hazeBrightness,
      targetParams.hazeBrightness,
      STATE_LERP,
    );
    currentParams.hazeRate = lerp(
      currentParams.hazeRate,
      targetParams.hazeRate,
      STATE_LERP,
    );
    currentParams.bloomStrength = lerp(
      currentParams.bloomStrength,
      targetParams.bloomStrength,
      STATE_LERP,
    );
    currentParams.spinSpeed = lerp(
      currentParams.spinSpeed,
      targetParams.spinSpeed,
      STATE_LERP,
    );
    currentParams.tiltAmp = lerp(
      currentParams.tiltAmp,
      targetParams.tiltAmp,
      STATE_LERP,
    );
    currentParams.coreRadialFlow = lerp(
      currentParams.coreRadialFlow,
      targetParams.coreRadialFlow,
      STATE_LERP,
    );
    currentParams.coreVortex = lerp(
      currentParams.coreVortex,
      targetParams.coreVortex,
      STATE_LERP,
    );
    currentParams.breathAmp = lerp(
      currentParams.breathAmp,
      targetParams.breathAmp,
      STATE_LERP,
    );
    currentParams.breathRate = lerp(
      currentParams.breathRate,
      targetParams.breathRate,
      STATE_LERP,
    );
    currentParams.jellyAmp = lerp(
      currentParams.jellyAmp,
      targetParams.jellyAmp,
      STATE_LERP,
    );

    speakPulseValue = Math.max(0, speakPulseValue - dt * SPEAK_PULSE_DECAY);

    shellMat.uniforms.uShellBrightness.value =
      currentParams.shellBrightness + speakPulseValue * 0.15;
    shellMat.uniforms.uShellFlowAmp.value = currentParams.shellFlowAmp;
    shellMat.uniforms.uShellFlowFreq.value = currentParams.shellFlowFreq;
    shellMat.uniforms.uBreathAmp.value = currentParams.breathAmp;
    shellMat.uniforms.uJellyAmp.value = currentParams.jellyAmp;
    coreMat.uniforms.uGlow.value =
      currentParams.coreGlow + speakPulseValue * 0.35;
    bloomPass.strength =
      (currentParams.bloomStrength + speakPulseValue * 0.12) * bloomScale;

    hazePhase += dt * currentParams.hazeRate;
    breathPhase += dt * currentParams.breathRate;
    hazeMat.uniforms.uHazePhase.value = hazePhase;
    shellMat.uniforms.uBreathPhase.value = breathPhase;

    let clickAdd = 0;
    if (hazePulseStartTime !== null) {
      const age = elapsedTime - hazePulseStartTime;
      if (age >= PULSE_HAZE_DURATION) {
        hazePulseStartTime = null;
      } else {
        clickAdd = 1.0 - age / PULSE_HAZE_DURATION;
      }
    }
    hazeMat.uniforms.uHazeBoost.value =
      currentParams.hazeBrightness + clickAdd + speakPulseValue * 0.5;

    updateCoreParticles(dt, elapsedTime);

    currentRotation.x += (targetRotation.x - currentRotation.x) * ROTATION_LERP;
    currentRotation.y += (targetRotation.y - currentRotation.y) * ROTATION_LERP;
    spinAngle += dt * currentParams.spinSpeed;
    const tilt = Math.sin(elapsedTime * 0.45) * currentParams.tiltAmp;
    orbGroup.rotation.x = currentRotation.x + tilt;
    orbGroup.rotation.y = spinAngle + currentRotation.y;

    composer.render();
  }
  tick();

  // ─ Pause / resume — cheap CPU/GPU saver when the navbar is closed
  // or the tab is backgrounded. Doesn't tear down WebGL state, so re-
  // opening the navbar is instant (no shader recompile, no buffer
  // re-upload). The single rAF is the only per-frame cost; cancelling
  // it lets the GPU driver park the context.
  function pause() {
    if (paused || disposed) return;
    paused = true;
    cancelAnimationFrame(rafId);
  }
  function resume() {
    if (!paused || disposed) return;
    paused = false;
    // Drain the time accumulated while paused — otherwise the next
    // `clock.getDelta()` returns ~the whole pause duration and every
    // lerp / phase advances in one giant jump on frame 1.
    clock.getDelta();
    tick();
  }

  // ─ Dispose ─
  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(rafId);
    resizeObserver.disconnect();
    container.removeEventListener("pointermove", onPointerMove);
    container.removeEventListener("pointerleave", onPointerLeave);
    renderer.domElement.removeEventListener("click", onCanvasClick);
    shellPoints.geometry.dispose();
    shellMat.dispose();
    corePoints.geometry.dispose();
    coreMat.dispose();
    hazePoints.geometry.dispose();
    hazeMat.dispose();
    particleTexture.dispose();
    composer.dispose();
    renderer.dispose();
    if (renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement);
    }
  }

  return {
    setState,
    applyTargetParams,
    speakPulse: speakPulseTrigger,
    pause,
    resume,
    aim,
    dispose,
  };
}

// Chat-flow vocabulary lives in ./responses (kept beside the sphere so the
// demo "voice" travels with the demo visual). Re-exported here so the public
// import site — `../three/sphere` — is unchanged by the split.
export { GREETINGS, pickResponse, RESPONSES, THANKS } from "./responses";
