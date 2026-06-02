/**
 * Noise primitives for the sphere orb — the GPU-side GLSL simplex noise the
 * shell vertex shader injects (`${SIMPLEX_GLSL}`), and the CPU-side Perlin/curl
 * field that drives the core particle drift. Split out of the scene module so
 * the long, vendored noise code doesn't drown the orchestration logic. Both
 * are stateless apart from `makePerlin`'s per-instance permutation table.
 */

// ─── GLSL 3D simplex noise (Gustavson / Ashima) ────────────────────────
export const SIMPLEX_GLSL = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(
       i.z+vec4(0.0,i1.z,i2.z,1.0))
     +i.y+vec4(0.0,i1.y,i2.y,1.0))
     +i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
`;

// ─── JS Perlin + curl (used for core particle flow field) ──────────────
// Factory so each sphere instance gets its own permutation table.
export function makePerlin() {
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a: number, b: number, t: number) => a + t * (b - a);
  const grad = (h: number, x: number, y: number, z: number) => {
    const g = h & 15;
    const u = g < 8 ? x : y;
    const v = g < 4 ? y : g === 12 || g === 14 ? x : z;
    return ((g & 1) === 0 ? u : -u) + ((g & 2) === 0 ? v : -v);
  };
  const perlin = (x: number, y: number, z: number) => {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);
    const u = fade(x),
      v = fade(y),
      w = fade(z);
    const A = perm[X] + Y,
      AA = perm[A] + Z,
      AB = perm[A + 1] + Z;
    const B = perm[X + 1] + Y,
      BA = perm[B] + Z,
      BB = perm[B + 1] + Z;
    return lerp(
      lerp(
        lerp(grad(perm[AA], x, y, z), grad(perm[BA], x - 1, y, z), u),
        lerp(grad(perm[AB], x, y - 1, z), grad(perm[BB], x - 1, y - 1, z), u),
        v,
      ),
      lerp(
        lerp(
          grad(perm[AA + 1], x, y, z - 1),
          grad(perm[BA + 1], x - 1, y, z - 1),
          u,
        ),
        lerp(
          grad(perm[AB + 1], x, y - 1, z - 1),
          grad(perm[BB + 1], x - 1, y - 1, z - 1),
          u,
        ),
        v,
      ),
      w,
    );
  };

  const eps = 0.1,
    invE = 1 / (2 * eps);
  const curl = (
    x: number,
    y: number,
    z: number,
    t: number,
  ): [number, number, number] => {
    const tA = t * 0.5,
      tB = tA + 17.3,
      tC = tA + 41.7;
    const Fx1 = perlin(x, y + eps, z + tA),
      Fx2 = perlin(x, y - eps, z + tA);
    const Fz1 = perlin(x, y, z + eps + tA),
      Fz2 = perlin(x, y, z - eps + tA);
    const Gx1 = perlin(x + eps, y + 71.0, z + tB),
      Gx2 = perlin(x - eps, y + 71.0, z + tB);
    const Gz1 = perlin(x, y + 71.0, z + eps + tB),
      Gz2 = perlin(x, y + 71.0, z - eps + tB);
    const Hx1 = perlin(x + eps, y + 131.0, z + tC),
      Hx2 = perlin(x - eps, y + 131.0, z + tC);
    const Hy1 = perlin(x, y + eps + 131.0, z + tC),
      Hy2 = perlin(x, y - eps + 131.0, z + tC);
    const dFdy = (Fx1 - Fx2) * invE;
    const dFdz = (Fz1 - Fz2) * invE;
    const dGdx = (Gx1 - Gx2) * invE;
    const dGdz = (Gz1 - Gz2) * invE;
    const dHdx = (Hx1 - Hx2) * invE;
    const dHdy = (Hy1 - Hy2) * invE;
    return [dHdy - dGdz, dFdz - dHdx, dGdx - dFdy];
  };

  return { curl };
}
