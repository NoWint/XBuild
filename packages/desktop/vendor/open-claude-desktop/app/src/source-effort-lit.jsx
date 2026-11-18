import React, { memo, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { useReducedMotion } from "./use-reduced-motion.js";

// The lit top-tier slider overlay: a port of c992c8428-DwnKAaOy.js (2.2553.1; prettified scratch lit.js) — the
// WebGL2 cell field x/S/y/v that the effort popover hands its Slider as sliderOverlay when the model's last effort
// is the purple tier (c360a9e1c:5257 uf; effort.js:153 render({atMax})). The GLSL, constants, INKS and PARAMS are
// verbatim (lit.js:13-366); the controller (lit.js:367-745) keeps its order and timing with readable names. No
// WebGL2 (or a failed link) reports live=false, which hides the ground at once, so the slider looks normal.
export const LIT_VERTEX = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
uniform vec2 u_resolution;
void main() {
  // pixel-space UV so fragment can do floor(uv / gap) without aspect distortion
  v_uv = (a_position * 0.5 + 0.5) * u_resolution;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;
export const LIT_FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_fg;   // hot ink (INKS.hot) \u2014 the brightest thing in the bar
uniform vec3 u_fg2;  // cool ink (INKS.cool) \u2014 the low-energy end of
                     // the ramp: luminous lavender in light, white in dark \u2014
                     // ALWAYS brighter than the ground it sits on, so every
                     // recruited cell reads as emitting, not as ink
uniform float u_seed; // re-rolled every press \u2014 fresh jitter and recruitment each run

// Burst ring buffer. Each slot is a one-shot burst: time it fired (in the
// u_time clock) and the origin in framebuffer pixels. Slots start far in the
// past so nothing plays on mount; old bursts age out via the cutoff below.
const int MAX_BURSTS = 8;
uniform float u_burstTime[MAX_BURSTS];
uniform vec2  u_burstCenter[MAX_BURSTS];
uniform float u_burstGain[MAX_BURSTS];   // strength k \u2208 [0,1] \u2014 first stop \u2192 0, top stop \u2192 1


// Master envelope: 1 while pressed, eased to 0 after release so the whole
// field cools down on mouse-up instead of trailing per-burst afterglows.
uniform float u_fade;

// The charged surface, folded into the same texture: a left-edge\u2192handle
// gradient (u_charge0 \u2192 u_charge1) that lives in the same cells as the
// energy and arrives with the same wavefront, so surface and energy read as
// one thing on one clock. u_pos is the handle fraction (0..1). The colors
// carry their token's alpha \u2014 light runs it opaque (the charge is the
// field's own ground there), and a transparent token would remove the
// surface entirely while the cells still paint.
uniform float u_pos;
uniform vec4 u_charge0;
uniform vec4 u_charge1;

// How much of the charged surface paints in the GAPS between cells (0..1).
// Light mode runs this high so the charge reads as a continuous dark ground
// for the bright cells to emit against; dark mode keeps 0 \u2014 its charge stays
// cell-masked exactly as before.
uniform float u_bedFill;

// Per-cell hue scatter (alpha channel = mix amount): a minority of cells
// lean toward each tint so the field reads rich instead of monochrome.
// Amount 0 (dark mode) leaves the ink ramp bit-identical.
uniform vec4 u_tintA; // accent blue lean
uniform vec4 u_tintB; // pink lean

in vec2 v_uv;
out vec4 fragColor;

// \u2500\u2500\u2500 the grid \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// The bar is a field of small rounded cells \u2014 a grid / activity-heatmap
// visual language, packed denser for intricacy inside a 24px bar. At rest it is invisible \u2014 only energy makes it exist.
const float CELL_PITCH = 4.0;  // px between cell centers (cell + gap) \u2014 nominal; the
                               // grid re-derives the exact pitch so rows tile the bar height
const float CELL_SIZE  = 3.0;  // px square
const float CELL_R     = 0.9;  // corner radius, px

// \u2500\u2500\u2500 the energy \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// A burst is a wavefront racing outward from the press point in Manhattan
// distance, quantized to whole cells: each cell flips on as the front reaches
// it (per-cell jitter keeps the front ragged and alive), then cools back down
// through the discrete ramp behind it.
//
// Per-burst strength k (u_burstGain) slides speed, reach, brightness and
// afterglow between the _LO (faint stop) and _HI (full blast) ends.
const float SPEED_LO   = 20.0;  // wavefront speed, cells/sec
const float SPEED_HI   = 36.0;  //   full blast crosses the bar in well under 2s
const float RANGE_LO   = 10.0;  // a faint pulse stays local to the handle, cells
const float RANGE_HI   = 55.0;  //   the full blast carries to the far end of the fill
const float DENSITY_LO = 0.30;  // fraction of cells a faint pulse recruits \u2014 sparse sketch
const float DENSITY_HI = 0.85;  //   full blast is busy but keeps dark gaps
const float JITTER     = 0.10;  // per-cell arrival scatter, sec \u2014 the organic part
const float HEAD_GAIN  = 1.25;  // arrival flash strength
const float HEAD_DECAY = 5.0;   // arrival flash fade, 1/s (fast)
const float BODY_GAIN  = 0.65;  // afterglow strength
const float BODY_LO    = 3.3;   // afterglow fade for the faint stop, 1/s \u2014 quick cool-down
const float BODY_HI    = 0.77;  //   full blast lingers ~1.3s behind the front
const float AMP_LO     = 0.55;  // overall brightness of the faintest stop
const float MAX_AGE    = 5.0;   // past this a slot is dead \u2014 skip the math

// \u2500\u2500\u2500 the rendering (discrete ramp + breathing top step) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Cell intensity quantizes to a 5-step ramp (never a continuous gradient),
// the ink walks from the cool ink toward the hot ink as the step rises \u2014
// energy always reads brighter than its ground \u2014 and only top-step cells
// breathe: slow, shallow, per-cell phase so neighbours never sync up (the app
// grid's own pulse). Defaults dialed in on
// shader-explorations/grid/03-cellular-ripple.html, then packed denser.
const float RAMP_POW    = 1.4;   // ink ramp curve \u2014 keeps the cool end longer
const float INK_MAX     = 0.85;  // historical ink ceiling \u2014 now the dark-mode value of u_inkCeil
const float BREATH_DIP  = 0.28;  // top-step breath depth
const float BREATH_BASE = 2.4;   // breath period floor, sec
const float BREATH_VARY = 1.4;   // per-cell period spread, sec
// Charged-surface shape, per mode (see u_bedFill/u_tint* for the rest of the
// mode split). Dark keeps the original constants (0.85 ceiling, 1.1 ramp \u2014
// a tint that deepens linearly toward the handle); light runs the ceiling to
// 1 with a much flatter ramp so the bed reads as a solid dark ground across
// the energized region, fading only at its left edge.
uniform float u_chargeMax;   // alpha ceiling of the charged surface at the handle
uniform float u_chargeRamp;  // exponent on the left-edge\u2192handle deepening

// Alpha of the LOWEST ramp step (the top step is u_inkCeil). Dark keeps the
// original 0.08 \u2014 over a dark fill with additive blending, alpha IS
// brightness, so the climb from 0.08 reads as the intensity ramp. Light
// raises the floor so every recruited cell paints near-solid and the
// intensity ramp is carried by the ink COLOR (lavender \u2192 white-hot) \u2014 a
// translucent chip over the vibrant bed would just read as bed.
uniform float u_inkFloor;

// Alpha of the TOP ramp step. Dark pins the historical INK_MAX (0.85 \u2014
// under additive blending a fully-opaque white cell blows out); light runs
// it to 1.0 so the sparse hot minority genuinely sparkles against the
// field's darker ground (measured headroom: hot cells capped at 0.61 luma
// over a 0.28 ground with the shared ceiling).
uniform float u_inkCeil;

// Multiplier on quantized cell energy. The per-cell brightness lottery is
// tuned for dark's additive regime, where even a faint white cell sparkles;
// in light's opaque regime the same distribution never reaches the hot end
// of the ink ramp, so light boosts it to put a white-hot minority on the
// board. Dark pins 1 \u2014 identical output.
uniform float u_energyGain;

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  // Fit a whole number of rows into the bar height so no row is clipped at
  // the edges; cells stay square, so the right edge (hidden under the
  // handle / rounded end) absorbs any fractional column instead.
  float pitch = u_resolution.y / max(round(u_resolution.y / CELL_PITCH), 1.0);
  float cellScale = pitch / CELL_PITCH;
  vec2 cell = floor(v_uv / pitch);
  vec2 cellCenter = (cell + 0.5) * pitch;

  // Rounded-rect cell mask, anti-aliased \u2014 the gaps between cells never paint.
  float cellHalf = CELL_SIZE * 0.5 * cellScale;
  float cellR = CELL_R * cellScale;
  vec2 q = abs(v_uv - cellCenter) - vec2(cellHalf - cellR);
  float distC = length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0) - cellR;
  float aa = min(fwidth(v_uv.x), 1.5);
  float cellMask = 1.0 - smoothstep(-aa, aa, distC);
  // Gaps can only exit early when the charged surface is strictly
  // cell-masked (u_bedFill 0); a continuous bed must keep painting them.
  if (cellMask <= 0.0 && u_bedFill <= 0.0) {
    fragColor = vec4(0.0);
    return;
  }

  float jitter = (hash21(cell + 41.7 + u_seed) - 0.5) * 2.0 * JITTER;
  float vary   = 0.35 + 0.65 * hash21(cell + 13.7 + u_seed); // some cells catch much brighter than others

  float energy = 0.0;
  float charged = 0.0;
  for (int i = 0; i < MAX_BURSTS; i++) {
    float age = u_time - u_burstTime[i];
    if (age < 0.0 || age > MAX_AGE) continue;
    float k = clamp(u_burstGain[i], 0.0, 1.0);

    vec2 originCell = floor(u_burstCenter[i] / pitch);
    float manh = abs(cell.x - originCell.x) + abs(cell.y - originCell.y);

    // Gentle falloff so the field carries to the ends of the revealed bar at
    // full blast instead of dying out mid-bar.
    float range   = mix(RANGE_LO, RANGE_HI, k);
    float falloff = exp(-manh / (range * 0.85));
    float reach   = exp(-max(manh - range, 0.0) * 0.12);
    float speed   = mix(SPEED_LO, SPEED_HI, k);
    float t = age - manh / speed - jitter;
    // The charged surface arrives with the same front: once any burst has
    // reached this cell it stays charged for as long as the press lives.
    charged = max(charged, smoothstep(0.0, 0.15, t) * reach);
    if (t < 0.0) continue;

    // The recruitment lottery re-rolls per burst (the burst's own timestamp
    // is part of the ticket), so every pulse lights a different subset of
    // cells \u2014 a held press keeps tracing new patterns instead of re-lighting
    // the same ones. The lottery only gates the bright energy cells; the
    // charged surface below recruits every cell the front reaches.
    float rank = hash21(cell + 7.3 + u_seed + u_burstTime[i]);
    if (rank > mix(DENSITY_LO, DENSITY_HI, k)) continue;

    float head = HEAD_GAIN * exp(-t * HEAD_DECAY);
    float body = BODY_GAIN * exp(-t * mix(BODY_LO, BODY_HI, k));
    energy += (head + body) * mix(AMP_LO, 1.0, k) * falloff * reach * vary;
  }


  // The master envelope scales energy BEFORE quantization, so on release the
  // whole field cools down through the ramp instead of fading in place. The
  // per-cell brightness lottery is applied here too \u2014 after saturation \u2014 so
  // it spreads cells across the whole ramp instead of being washed out once
  // energy pegs: most cells sit dim-to-mid, a minority run hot, the darkest
  // stay barely lit. Skew (pow) pushes the distribution toward dark.
  // Each cell drifts between two personal brightness identities on its own
  // slow, randomly-phased cycle, so which cells read bright or dark keeps
  // redistributing \u2014 the mosaic never freezes into a fixed pattern.
  float lumA = hash21(cell + 8.8 + u_seed);
  float lumB = hash21(cell + 88.8 + u_seed);
  float lumDrift = 0.5 + 0.5 * sin(u_time * 0.35 + lumA * 6.2832);
  float lum = pow(mix(lumA, lumB, lumDrift), 1.9);
  // A faint coherent wave keeps drifting right\u2192left between pulses, with a
  // touch of per-cell phase scatter so it reads as current, not as a bar.
  float stream = 0.9 + 0.16 * sin(u_time * 1.3 + cell.x * 0.45 + lumB * 2.0);
  float e = clamp(energy, 0.0, 1.0) * u_fade * mix(0.16, 1.0, lum) * stream
    * u_energyGain;

  // The charged surface: a left-edge\u2192handle gradient living in the same
  // cells, revealed by the same wavefront and the same envelope. Deeper
  // toward the handle; nothing where the front hasn't reached.
  float g = clamp(v_uv.x / max(u_pos * u_resolution.x, 1.0), 0.0, 1.0);
  vec3 chargeColor = mix(u_charge0.rgb, u_charge1.rgb, g);
  // The bed factor lets the charge spill into the gaps (light mode's
  // continuous dark ground) while the cells still sit a notch deeper, so the
  // grid stays legible inside the bed without bright gap-lines cutting it up.
  float bedMask = mix(u_bedFill, 1.0, cellMask);
  float chargeA = u_chargeMax * pow(g, u_chargeRamp) * charged * u_fade
    * bedMask * mix(u_charge0.a, u_charge1.a, g);

  // Discrete 5-step ramp for the energy on top \u2014 never a continuous gradient.
  // Empty at rest: energy IS visibility.
  float lv = step(0.04, e) + step(0.2, e) + step(0.4, e) + step(0.6, e) + step(0.8, e);
  // Linear alpha climb from the mode's floor \u2014 every step participates, so
  // the right-to-left intensity progression reads in both modes.
  float alpha = lv <= 0.0 ? 0.0 : mix(u_inkFloor, u_inkCeil, (lv - 1.0) / 4.0);

  // Only the hottest cells breathe \u2014 slow, shallow, never in unison.
  if (lv >= 5.0) {
    float period = BREATH_BASE + BREATH_VARY * hash21(cell + 3.1 + u_seed);
    float phase = hash21(cell + 5.5 + u_seed) * 6.2832;
    alpha *= 1.0 - BREATH_DIP * 0.5 * (1.0 + sin(u_time * 6.2832 / period + phase));
  }

  // Energy over charge (premultiplied), on a transparent canvas \u2014 the slider
  // fill shows through wherever neither paints.
  vec3 ink = mix(u_fg2, u_fg, pow(lv / 5.0, RAMP_POW));
  // Hue scatter: each cell draws a stable lottery ticket; the top of the
  // range leans blue, the bottom leans pink, the middle keeps the base
  // purple ramp. Tint alphas of 0 bypass this entirely.
  float hueSel = hash21(cell + 27.9 + u_seed);
  ink = mix(ink, u_tintA.rgb, u_tintA.a * smoothstep(0.62, 0.95, hueSel));
  // Pink leans the bottom of the range. Written as an inverted forward
  // smoothstep (1 - smoothstep(0.05, 0.38, \u2026)) rather than a descending one
  // (smoothstep(0.38, 0.05, \u2026)): GLSL leaves smoothstep undefined when
  // edge0 >= edge1, and a NaN here would survive the alpha-0 multiply in dark
  // mode and corrupt the ink. The polynomial's S(1-t) = 1-S(t) symmetry makes
  // this form bit-identical to the intended descending ramp.
  ink = mix(ink, u_tintB.rgb, u_tintB.a * (1.0 - smoothstep(0.05, 0.38, hueSel)));
  float eA = alpha * cellMask;
  vec3 col = ink * eA + chargeColor * chargeA * (1.0 - eA);
  float a = eA + chargeA * (1.0 - eA);
  if (a <= 0.0) {
    fragColor = vec4(0.0);
    return;
  }
  fragColor = vec4(col, a);
}
`;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  return shader ? (gl.shaderSource(shader, source), gl.compileShader(shader), shader) : null;
}
function linkProgram(gl, vertex, fragment) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertex), fs = compileShader(gl, gl.FRAGMENT_SHADER, fragment);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program); gl.deleteShader(vs); gl.deleteShader(fs);
  return program;
}
// lit.js ee: any computed CSS colour (color(srgb …) included) → 0..1 RGBA through a 1×1 2D canvas; a value the
// canvas cannot parse leaves the sentinel in fillStyle and reads as null (the caller's fallback).
function colorReader(doc) {
  const canvas = doc.createElement("canvas");
  canvas.width = 1; canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true }), sentinel = "#010203";
  return (value) => {
    if (!context) return null;
    context.fillStyle = sentinel; context.fillStyle = value;
    if (context.fillStyle === sentinel && value.trim().toLowerCase() !== sentinel) return null;
    context.clearRect(0, 0, 1, 1); context.fillRect(0, 0, 1, 1);
    const data = context.getImageData(0, 0, 1, 1).data;
    return [(data[0] ?? 0) / 255, (data[1] ?? 0) / 255, (data[2] ?? 0) / 255, (data[3] ?? 0) / 255];
  };
}

// lit.js:323-330 te/g/re/ie/ae/oe.
export const LIT_LIMITS = { maxPixels: 4147200, maxBursts: 8, maxAge: 5, fadeIn: 0.7, fadeOut: 0.85, holdRamp: 1.6 };
const { maxPixels: MAX_PIXELS, maxBursts: MAX_BURSTS, maxAge: MAX_AGE, fadeIn: FADE_IN, fadeOut: FADE_OUT, holdRamp: HOLD_RAMP } = LIT_LIMITS;
const QUAD = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
// lit.js:331-349 _: the inks ride on the canvas as inline colours (hot = color, cool = outline-color, charge =
// border-top/bottom, tints = text-decoration / column-rule) so getComputedStyle resolves tokens per mode.
export const LIT_INKS = {
  light: { chargedStart: "#888edd", chargedEnd: "#8964c4", cool: "#c6c0f3", hot: "#fbedf1", tintBlue: "rgba(191, 214, 243, 0.28)", tintPink: "rgba(240, 188, 204, 0.28)" },
  dark: { chargedStart: "color(srgb 0.62 0.5 0.92)", chargedEnd: "color(srgb 0.35 0.25 0.6)", cool: "#ffffff", hot: "var(--cds-text-pro)", tintBlue: "transparent", tintPink: "transparent" },
};
// lit.js:351-366 se.
export const LIT_PARAMS = {
  light: { bedFill: 1, chargeMax: 0.92, chargeRamp: 0.5, inkFloor: 0.28, inkCeil: 1, gain: 1.18 },
  dark: { bedFill: 0, chargeMax: 0.85, chargeRamp: 1.1, inkFloor: 0.08, inkCeil: 0.85, gain: 1 },
};

// lit.js:367-745 v(canvas, actionsRef, getMode, recolorRef, setLive). Until the program links, pressStart/pressEnd
// queue (last 8) and replay once live; compile waits two frames (KHR_parallel_shader_compile polled per frame);
// the rAF loop runs only while held or while a burst still glows, and stops when the document is hidden or
// motion is reduced. Context loss tears down and re-queues a held press for the restore.
export function createLitController(canvas, actionsRef, getMode, recolorRef, setLive) {
  const queue = [];
  const enqueue = (name, value) => { if (queue.length >= 8) queue.shift(); queue.push([name, value]); };
  const stub = { pressStart: (value) => enqueue("pressStart", value), pressEnd: (value) => enqueue("pressEnd", value) };
  actionsRef.current = stub;
  let held = false, position = 0;
  const view = canvas.ownerDocument.defaultView ?? window;
  let teardown = null, firstFrame = 0, secondFrame = 0, compileFrame = 0, startTimer, compileTimer, context = null;
  const start = () => {
    const gl = canvas.getContext("webgl2", { alpha: true, antialias: false, depth: false, stencil: false });
    if (!gl) { actionsRef.current = null; setLive(false); return; }
    context = gl;
    const parallel = gl.getExtension("KHR_parallel_shader_compile");
    const program = linkProgram(gl, LIT_VERTEX, LIT_FRAGMENT);
    if (!program) { if (!gl.isContextLost()) { actionsRef.current = null; setLive(false); } return; }
    const setup = () => {
      gl.useProgram(program);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);
      const attribute = gl.getAttribLocation(program, "a_position");
      gl.enableVertexAttribArray(attribute); gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
      const at = (name) => gl.getUniformLocation(program, name);
      const uTime = at("u_time"), uResolution = at("u_resolution"), uSeed = at("u_seed"), uPos = at("u_pos"), uCharge0 = at("u_charge0"), uCharge1 = at("u_charge1"),
        uBedFill = at("u_bedFill"), uChargeMax = at("u_chargeMax"), uChargeRamp = at("u_chargeRamp"), uInkFloor = at("u_inkFloor"), uInkCeil = at("u_inkCeil"),
        uEnergyGain = at("u_energyGain"), uTintA = at("u_tintA"), uTintB = at("u_tintB"), uFg = at("u_fg"), uFg2 = at("u_fg2"),
        uBurstTime = at("u_burstTime[0]"), uBurstCenter = at("u_burstCenter[0]"), uBurstGain = at("u_burstGain[0]"), uFade = at("u_fade");
      gl.clearColor(0, 0, 0, 0);
      gl.uniform3fv(uFg, [0.72, 0.59, 1]); gl.uniform3fv(uFg2, [1, 1, 1]); gl.uniform1f(uFade, 0); gl.uniform1f(uSeed, 0); gl.uniform1f(uPos, 1);
      gl.uniform4f(uCharge0, 0.62, 0.5, 0.92, 1); gl.uniform4f(uCharge1, 0.35, 0.25, 0.6, 1); gl.uniform1f(uBedFill, 0); gl.uniform1f(uChargeMax, 0.85);
      gl.uniform1f(uChargeRamp, 1.1); gl.uniform1f(uInkFloor, 0.08); gl.uniform1f(uInkCeil, 0.85); gl.uniform1f(uEnergyGain, 1);
      gl.uniform4f(uTintA, 0, 0, 0, 0); gl.uniform4f(uTintB, 0, 0, 0, 0);
      const burstTimes = new Float32Array(MAX_BURSTS).fill(-1e3), burstCenters = new Float32Array(MAX_BURSTS * 2), burstGains = new Float32Array(MAX_BURSTS);
      gl.uniform1fv(uBurstTime, burstTimes); gl.uniform2fv(uBurstCenter, burstCenters); gl.uniform1fv(uBurstGain, burstGains);
      let slot = 0, pressed = false, envelope = 0, heldFor = 0;
      position = 0;
      const doc = canvas.ownerDocument, win = doc.defaultView ?? window;
      const raf = win.requestAnimationFrame.bind(win), cancel = win.cancelAnimationFrame.bind(win);
      let dirty = true, width = 1, height = 1;
      const resize = (cssWidth, cssHeight, ratio) => {
        const w = Math.max(1, cssWidth), h = Math.max(1, cssHeight);
        if (w !== width || h !== height) {
          const sx = w / width, sy = h / height;
          for (let i = 0; i < MAX_BURSTS; i++) { burstCenters[i * 2] *= sx; burstCenters[i * 2 + 1] *= sy; }
          gl.uniform2fv(uBurstCenter, burstCenters); width = w; height = h; dirty = true;
        }
        let pw = Math.max(1, Math.round(cssWidth * ratio)), ph = Math.max(1, Math.round(cssHeight * ratio));
        const area = pw * ph;
        if (area > MAX_PIXELS) { const scale = Math.sqrt(MAX_PIXELS / area); pw = Math.max(1, Math.round(pw * scale)); ph = Math.max(1, Math.round(ph * scale)); }
        if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; dirty = true; }
      };
      let clock = 0, lastFrame = -1, frameId = 0, running = false, lastBurst = -Infinity, lastBurstWall = -Infinity, interval = 0.45;
      held = false;
      const gainFor = (pos, ramp) => Math.min((0.15 + 0.7 * pos) * (0.45 + 0.55 * ramp), 1);
      const draw = () => {
        if (dirty) { gl.viewport(0, 0, canvas.width, canvas.height); gl.uniform2f(uResolution, width, height); dirty = false; }
        gl.uniform1f(uTime, clock); gl.uniform1f(uPos, Math.max(position, 0.02)); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 6);
      };
      const glowing = () => clock - lastBurst < MAX_AGE;
      const frame = (now) => {
        const dt = lastFrame < 0 ? 0 : Math.max(0, (now - lastFrame) * 0.001);
        clock += dt; lastFrame = now;
        envelope = pressed ? Math.min(envelope + dt / FADE_IN, 1) : Math.max(envelope - dt / FADE_OUT, 0);
        heldFor = pressed ? heldFor + dt : 0;
        if (pressed && clock - lastBurst > interval) {
          const ramp = Math.min(heldFor / HOLD_RAMP, 1);
          interval = 0.3 + Math.random() * 0.45;
          fire(gainFor(position, ramp) * (0.85 + Math.random() * 0.3), position + (Math.random() - 0.5) * 0.08);
        }
        gl.uniform1f(uFade, envelope * envelope * (3 - 2 * envelope));
        draw();
        if ((pressed || (glowing() && envelope > 0)) && !doc.hidden) frameId = raf(frame); else running = false;
      };
      const startLoop = () => { if (!running) { running = true; lastFrame = -1; frameId = raf(frame); } };
      const stopLoop = () => { if (running) { running = false; cancel(frameId); } };
      const sizeObserver = new (win.ResizeObserver ?? ResizeObserver)((entries) => {
        const entry = entries[0], device = entry.devicePixelContentBoxSize?.[0];
        if (device) { const ratio = win.devicePixelRatio || 1; resize(device.inlineSize / ratio, device.blockSize / ratio, ratio); }
        else { const box = entry.borderBoxSize?.[0] ?? entry.contentBoxSize?.[0]; resize(box?.inlineSize ?? canvas.clientWidth, box?.blockSize ?? canvas.clientHeight, win.devicePixelRatio || 1); }
        draw();
      });
      sizeObserver.observe(canvas);
      // Z: the OS query or the in-app switch (html[data-reduce-motion=true]; data-local-motion=reduce is its local alias).
      const reduceQuery = win.matchMedia("(prefers-reduced-motion: reduce)"), root = doc.documentElement;
      const reduced = () => reduceQuery.matches || root?.getAttribute("data-reduce-motion") === "true" || root?.getAttribute("data-local-motion") === "reduce";
      const halt = () => {
        pressed = false; lastBurst = -Infinity; lastBurstWall = -Infinity; envelope = 0;
        burstTimes.fill(-1e3); gl.uniform1fv(uBurstTime, burstTimes); stopLoop(); gl.uniform1f(uFade, 0); draw();
      };
      const resume = () => { readColors(); pressed = true; heldFor = 0; fire(gainFor(position, 0), position); };
      const onVisibility = () => { if (doc.hidden) halt(); else if (held && !pressed && !reduced()) resume(); else if (glowing()) startLoop(); };
      doc.addEventListener("visibilitychange", onVisibility);
      const onReduce = () => { if (doc.hidden) return; if (reduced()) { if (pressed || running) halt(); } else if (held && !pressed) resume(); };
      reduceQuery.addEventListener("change", onReduce);
      const reduceObserver = root ? new win.MutationObserver(onReduce) : null;
      reduceObserver?.observe(root, { attributes: true, attributeFilter: ["data-reduce-motion", "data-local-motion"] });
      const recolor = () => { if (pressed) { readColors(); if (!running) draw(); } };
      const modeObserver = new win.MutationObserver(recolor);
      modeObserver.observe(doc.documentElement, { attributes: true, attributeFilter: ["data-mode"], subtree: true });
      const schemeQuery = win.matchMedia("(prefers-color-scheme: dark)");
      schemeQuery.addEventListener("change", recolor);
      recolorRef.current = recolor;
      function fire(gain, pos) {
        burstTimes[slot] = clock; burstCenters[slot * 2] = pos * width; burstCenters[slot * 2 + 1] = height * (0.35 + Math.random() * 0.3); burstGains[slot] = gain;
        slot = (slot + 1) % MAX_BURSTS;
        gl.uniform1fv(uBurstTime, burstTimes); gl.uniform2fv(uBurstCenter, burstCenters); gl.uniform1fv(uBurstGain, burstGains);
        lastBurst = clock; lastBurstWall = win.performance.now();
        if (!doc.hidden) startLoop();
      }
      let reader = null;
      function readColors() {
        reader ??= colorReader(canvas.ownerDocument);
        const style = win.getComputedStyle(canvas), read = (value, fallback) => reader?.(value) ?? fallback;
        const hot = read(style.color, [0.72, 0.59, 1, 1]), cool = read(style.outlineColor, [1, 1, 1, 1]);
        gl.uniform3f(uFg, hot[0], hot[1], hot[2]); gl.uniform3f(uFg2, cool[0], cool[1], cool[2]);
        gl.uniform4f(uCharge0, ...read(style.borderTopColor, [0.62, 0.5, 0.92, 1]));
        gl.uniform4f(uCharge1, ...read(style.borderBottomColor, [0.35, 0.25, 0.6, 1]));
        gl.uniform4f(uTintA, ...read(style.textDecorationColor, [0, 0, 0, 0]));
        gl.uniform4f(uTintB, ...read(style.columnRuleColor, [0, 0, 0, 0]));
        const scheme = style.colorScheme ?? "";
        const params = LIT_PARAMS[scheme.includes("dark") ? "dark" : scheme.includes("light") ? "light" : getMode()];
        gl.uniform1f(uBedFill, params.bedFill); gl.uniform1f(uChargeMax, params.chargeMax); gl.uniform1f(uChargeRamp, params.chargeRamp);
        gl.uniform1f(uInkFloor, params.inkFloor); gl.uniform1f(uInkCeil, params.inkCeil); gl.uniform1f(uEnergyGain, params.gain);
      }
      setLive(true);
      actionsRef.current = {
        pressStart: (value) => {
          held = true; position = value;
          if (reduced()) return;
          readColors();
          // A fresh press after 5s of rest re-rolls the seed (new jitter and recruitment).
          if (win.performance.now() - lastBurstWall > 5e3 && envelope <= 0) { burstTimes.fill(-1e3); gl.uniform1fv(uBurstTime, burstTimes); gl.uniform1f(uSeed, Math.random() * 512); }
          pressed = true; heldFor = 0; fire(gainFor(value, 0), value);
        },
        pressEnd: (value) => { held = false; if (pressed) { pressed = false; position = value; if (!doc.hidden) startLoop(); } },
      };
      resize(canvas.clientWidth || 1, canvas.clientHeight || 1, win.devicePixelRatio || 1);
      draw();
      for (const [name, value] of queue) actionsRef.current?.[name](value);
      queue.length = 0;
      return () => {
        actionsRef.current = null; recolorRef.current = null; setLive(false); stopLoop();
        sizeObserver.disconnect(); modeObserver.disconnect(); schemeQuery.removeEventListener("change", recolor);
        reduceQuery.removeEventListener("change", onReduce); reduceObserver?.disconnect(); doc.removeEventListener("visibilitychange", onVisibility);
        gl.deleteProgram(program); gl.deleteBuffer(buffer);
      };
    };
    const finish = () => {
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        gl.deleteProgram(program); teardown = null;
        if (!gl.isContextLost()) { actionsRef.current = null; queue.length = 0; setLive(false); }
        return;
      }
      teardown = setup();
    };
    if (!parallel) { finish(); return; }
    const poll = () => {
      compileFrame = 0; compileTimer = undefined;
      if (gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR) === true) { finish(); return; }
      schedule();
    };
    const schedule = () => { if (canvas.ownerDocument.hidden) compileTimer = setTimeout(poll, 64); else compileFrame = view.requestAnimationFrame(poll); };
    teardown = () => { if (compileFrame !== 0) view.cancelAnimationFrame(compileFrame); if (compileTimer !== undefined) clearTimeout(compileTimer); gl.deleteProgram(program); };
    schedule();
  };
  if (canvas.ownerDocument.hidden) startTimer = setTimeout(start, 0);
  else firstFrame = view.requestAnimationFrame(() => { secondFrame = view.requestAnimationFrame(start); });
  let lost = false;
  const onLost = (event) => {
    if (lost || actionsRef.current === null) return;
    lost = true; event.preventDefault();
    const replay = actionsRef.current !== stub && held, at = position;
    teardown?.(); teardown = null; actionsRef.current = stub; held = false; position = 0;
    if (replay) enqueue("pressStart", at);
  };
  const onRestored = () => { if (lost) { lost = false; start(); } };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);
  return () => {
    canvas.removeEventListener("webglcontextlost", onLost); canvas.removeEventListener("webglcontextrestored", onRestored);
    view.cancelAnimationFrame(firstFrame); view.cancelAnimationFrame(secondFrame);
    if (startTimer !== undefined) clearTimeout(startTimer);
    actionsRef.current = null; teardown?.();
    // Local addition (the source stops at deleteProgram/deleteBuffer): the popover remounts this canvas on every
    // open, so release the context on the real unmount instead of waiting for Chromium's ~16-context eviction.
    // The controller runs once per canvas (stable deps, no StrictMode), so nothing reuses the dead context.
    context?.getExtension("WEBGL_lose_context")?.loseContext();
  };
}

// shared-frame Ts: the resolved app mode; main.jsx writes html[data-mode] as light or dark.
const modeOf = () => typeof document !== "undefined" && document.documentElement.dataset.mode === "dark" ? "dark" : "light";
function subscribeMode(listener) {
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode"] });
  return () => observer.disconnect();
}
const useDocumentMode = () => useSyncExternalStore(subscribeMode, modeOf, () => "light");
// shared-0 Wb: a stable function that always calls the latest render's callback (safe in effect deps).
function useStableCallback(callback) {
  const latest = useRef(callback);
  useLayoutEffect(() => { latest.current = callback; });
  return useState(() => (...args) => latest.current(...args))[0];
}

// lit.js:746-781 y: the canvas; a mode change re-reads the inks (d.current), a window without WebGL2 reports
// live=false before the controller tries.
function LitCanvas({ actionsRef, mode, onLiveChange }) {
  const canvas = useRef(null), recolor = useRef(null);
  const getMode = useStableCallback(() => mode);
  useEffect(() => { recolor.current?.(); }, [mode]);
  const reportLive = useStableCallback((live) => { onLiveChange?.(live); });
  useLayoutEffect(() => {
    if ((canvas.current?.ownerDocument.defaultView ?? window).WebGL2RenderingContext === undefined) reportLive(false);
  }, [reportLive]);
  useEffect(() => {
    const node = canvas.current;
    if (node) return createLitController(node, actionsRef, getMode, recolor, reportLive);
  }, [actionsRef, getMode, reportLive]);
  const ink = LIT_INKS[mode];
  return <canvas ref={canvas} aria-hidden="true" style={{ color: ink.hot, outlineColor: ink.cool, borderTopColor: ink.chargedStart, borderBottomColor: ink.chargedEnd,
    textDecorationColor: ink.tintBlue, columnRuleColor: ink.tintPink, borderWidth: 0, borderStyle: "none" }} />;
}

// lit.js:815-822 S: lit presses at the top stop (position 1) and releases on un-lit or unmount.
function LitPress({ lit, mode, onLiveChange }) {
  const actions = useRef(null);
  useEffect(() => {
    if (lit) { actions.current?.pressStart(1); return () => actions.current?.pressEnd(1); }
  }, [lit]);
  return <LitCanvas actionsRef={actions} mode={mode} onLiveChange={onLiveChange} />;
}

// lit.js:782-813 x: the ground (bg-surface-3 over bg-alpha-2) fades in with the press (700ms ease-out) and out
// (850ms linear); it is lit on the first render when mounted lit (live still null), and switches off with no
// transition once reduced motion or a missing WebGL2 is known. The field masks the canvas in from the left
// (45%, dark 60% + plus-lighter at .65) and mounts the canvas lazily, the first time the slider is lit.
export const EffortLitOverlay = memo(function EffortLitOverlay({ lit }) {
  const mode = useDocumentMode(), reduced = useReducedMotion();
  const [live, setLive] = useState(null);
  const [initialLit] = useState(lit);
  const [mounted, setMounted] = useState(lit);
  if (lit && !mounted) setMounted(true);
  const on = lit && !reduced && (live === true || (live === null && initialLit));
  return <>
    <span className="sc-effort-lit-ground" data-on={on ? "" : undefined}
      style={{ transition: reduced || live === false ? "none" : on ? "opacity 700ms ease-out" : "opacity 850ms linear" }}>
      <span className="sc-effort-lit-ground-inner" />
    </span>
    <span className="sc-effort-lit-field">{mounted && <LitPress lit={lit} mode={mode} onLiveChange={setLive} />}</span>
  </>;
});
