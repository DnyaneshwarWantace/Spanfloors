/**
 * Sunlight falling across product imagery ("gobo" lighting), drawn in SVG — no video files.
 *
 * Two layers:
 * - light  (soft-light blend): a warm sun patch that slowly breathes and drifts
 * - shadow (multiply blend):   one of four scenes, softly blurred, gently moving
 *
 * Scenes: "window" (frame + leafy branches), "blinds" (venetian slats + a sprig),
 * "palm" (large fronds), "canopy" (dappled light through a tree).
 */

export type GoboScene = "window" | "blinds" | "palm" | "canopy";
const SCENES: GoboScene[] = ["window", "blinds", "palm", "canopy"];

/** Stable scene per product, so each floor always gets the same light. */
export function goboSceneFor(id: string, offset = 0): GoboScene {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return SCENES[(h + offset) % SCENES.length];
}

// Deterministic pseudo-random so server and client render identical markup.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

type Leaf = { x: number; y: number; r: number; s: number };

function branch(seed: number, x0: number, y0: number, x1: number, y1: number, count: number) {
  const rand = rng(seed);
  const cx = (x0 + x1) / 2 + (rand() - 0.5) * 60;
  const cy = (y0 + y1) / 2 + (rand() - 0.5) * 60;
  const angle = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI;
  const leaves: Leaf[] = [];
  for (let i = 0; i < count; i++) {
    const t = 0.08 + (i / count) * 0.92;
    const x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t ** 2 * x1;
    const y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t ** 2 * y1;
    const side = i % 2 ? 1 : -1;
    leaves.push({ x: x + side * (4 + rand() * 6), y: y + side * (2 + rand() * 5), r: angle + side * (35 + rand() * 40), s: 0.7 + rand() * 0.7 - t * 0.25 });
  }
  return { path: `M${x0} ${y0} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x1} ${y1}`, leaves };
}

function frond(seed: number, x0: number, y0: number, x1: number, y1: number, count: number) {
  const rand = rng(seed);
  const angle = Math.atan2(y1 - y0, x1 - x0);
  const blades: string[] = [];
  for (let i = 1; i <= count; i++) {
    const t = i / (count + 1);
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    const len = (70 - t * 40) * (0.85 + rand() * 0.3);
    for (const side of [-1, 1]) {
      const a = angle + side * (0.9 + rand() * 0.25);
      const ex = x + Math.cos(a) * len;
      const ey = y + Math.sin(a) * len + 8;
      const mx = (x + ex) / 2 + Math.cos(a + side * 1.57) * 6;
      const my = (y + ey) / 2 + Math.sin(a + side * 1.57) * 6;
      blades.push(`M${x.toFixed(1)} ${y.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`);
    }
  }
  return { rib: `M${x0} ${y0} L${x1} ${y1}`, blades };
}

function dapples(seed: number, n: number) {
  const rand = rng(seed);
  return Array.from({ length: n }, () => ({ x: rand() * 420 - 10, y: rand() * 520 - 10, rx: 8 + rand() * 26, ry: 6 + rand() * 18, r: rand() * 180 }));
}

const W_NEAR = branch(7, 430, -10, 250, 190, 16);
const W_MID = branch(19, 440, 250, 300, 380, 11);
const W_FAR = branch(31, 120, -30, 30, 120, 9);
const B_SPRIG = branch(43, 420, 60, 300, 170, 10);
const P_A = frond(5, 430, -20, 210, 230, 13);
const P_B = frond(11, 440, 260, 260, 420, 10);
const CANOPY_HOLES = dapples(23, 46);
const CANOPY_LEAVES = branch(53, 410, 20, 260, 260, 18);

function Branch({ b, blur, opacity, stroke }: { b: ReturnType<typeof branch>; blur: string; opacity: number; stroke: number }) {
  return (
    <g filter={`url(#${blur})`} opacity={opacity}>
      <path d={b.path} stroke="#000" strokeWidth={stroke} fill="none" strokeLinecap="round" />
      {b.leaves.map((l, i) => (
        <use key={i} href="#gobo-leaf" transform={`translate(${l.x.toFixed(1)} ${l.y.toFixed(1)}) rotate(${l.r.toFixed(1)}) scale(${l.s.toFixed(2)})`} />
      ))}
    </g>
  );
}

function Frond({ f, blur, opacity }: { f: ReturnType<typeof frond>; blur: string; opacity: number }) {
  return (
    <g filter={`url(#${blur})`} opacity={opacity} stroke="#000" fill="none" strokeLinecap="round">
      <path d={f.rib} strokeWidth="4" />
      {f.blades.map((d, i) => (
        <path key={i} d={d} strokeWidth="7" />
      ))}
    </g>
  );
}

function Layer({ cls, children }: { cls: string; children: React.ReactNode }) {
  return (
    <div className={`gobo__layer ${cls}`}>
      <svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" className="size-full">
        {children}
      </svg>
    </div>
  );
}

function Scene({ scene }: { scene: GoboScene }) {
  switch (scene) {
    case "blinds":
      return (
        <>
          <Layer cls="gobo__window">
            <g filter="url(#gobo-blur-mid)" fill="#000" opacity="0.7">
              {Array.from({ length: 16 }, (_, i) => (
                <rect key={i} x="-80" y={-40 + i * 36} width="560" height="17" />
              ))}
              <rect x="-80" y="-60" width="70" height="640" />
            </g>
          </Layer>
          <Layer cls="gobo__leaves">
            <Branch b={B_SPRIG} blur="gobo-blur-near" opacity={0.7} stroke={2.5} />
          </Layer>
        </>
      );
    case "palm":
      return (
        <>
          <Layer cls="gobo__window">
            <g filter="url(#gobo-blur-frame)" fill="#000" opacity="0.55">
              <rect x="-80" y="-60" width="60" height="640" />
            </g>
          </Layer>
          <Layer cls="gobo__leaves gobo__leaves--far">
            <Frond f={P_B} blur="gobo-blur-far" opacity={0.5} />
          </Layer>
          <Layer cls="gobo__leaves">
            <Frond f={P_A} blur="gobo-blur-mid" opacity={0.72} />
          </Layer>
        </>
      );
    case "canopy":
      return (
        <>
          <Layer cls="gobo__dapple">
            <mask id="gobo-canopy-mask">
              <rect width="400" height="500" fill="#fff" />
              <g filter="url(#gobo-blur-mid)" fill="#000">
                {CANOPY_HOLES.map((d, i) => (
                  <ellipse
                    key={i}
                    cx={d.x.toFixed(1)}
                    cy={d.y.toFixed(1)}
                    rx={d.rx.toFixed(1)}
                    ry={d.ry.toFixed(1)}
                    transform={`rotate(${d.r.toFixed(0)} ${d.x.toFixed(1)} ${d.y.toFixed(1)})`}
                  />
                ))}
              </g>
            </mask>
            <rect x="-40" y="-40" width="480" height="580" fill="#000" opacity="0.42" mask="url(#gobo-canopy-mask)" filter="url(#gobo-blur-far)" />
          </Layer>
          <Layer cls="gobo__leaves">
            <Branch b={CANOPY_LEAVES} blur="gobo-blur-near" opacity={0.55} stroke={2.5} />
          </Layer>
        </>
      );
    default:
      return (
        <>
          <Layer cls="gobo__window">
            <g filter="url(#gobo-blur-frame)" fill="#000" opacity="0.8">
              <rect x="-80" y="-60" width="80" height="640" />
              <rect x="172" y="-60" width="15" height="640" />
              <rect x="372" y="-60" width="120" height="640" />
              <rect x="-80" y="232" width="560" height="13" />
            </g>
          </Layer>
          <Layer cls="gobo__leaves gobo__leaves--far">
            <Branch b={W_FAR} blur="gobo-blur-far" opacity={0.45} stroke={2} />
          </Layer>
          <Layer cls="gobo__leaves gobo__leaves--mid">
            <Branch b={W_MID} blur="gobo-blur-mid" opacity={0.6} stroke={2.5} />
          </Layer>
          <Layer cls="gobo__leaves">
            <Branch b={W_NEAR} blur="gobo-blur-near" opacity={0.78} stroke={3} />
          </Layer>
        </>
      );
  }
}

export default function Gobo({ scene = "window", strength = 1 }: { scene?: GoboScene; strength?: number }) {
  return (
    <div className="gobo" aria-hidden="true" data-scene={scene} style={{ ["--gobo" as string]: strength }}>
      <div className="gobo__light" />
      <div className="gobo__shadow">
        <svg width="0" height="0" className="absolute">
          <defs>
            <filter id="gobo-blur-frame" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="10" />
            </filter>
            <filter id="gobo-blur-near" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.6" />
            </filter>
            <filter id="gobo-blur-mid" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4.5" />
            </filter>
            <filter id="gobo-blur-far" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="7.5" />
            </filter>
            <path id="gobo-leaf" d="M0 0 C 9 -9, 27 -9, 38 -1 C 27 7, 10 8, 0 0 Z" />
          </defs>
        </svg>
        <div className="gobo__falloff" />
        <Scene scene={scene} />
      </div>
    </div>
  );
}
