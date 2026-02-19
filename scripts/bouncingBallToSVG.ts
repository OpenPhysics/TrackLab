import * as fs from "fs";

// ── Magic numbers ─────────────────────────────────────────────────
const SVG_WIDTH = 60; // px
const SVG_HEIGHT = 60; // px

const FLOOR_Y = 57; // px from top where the floor sits

const INITIAL_HEIGHT = 48; // px — height of first bounce above floor
const RESTITUTION = 0.6; // energy retention per bounce (0–1)
const NUM_BOUNCES = 4; // number of parabolic arcs

const TOTAL_SNAPSHOTS = 60; // total number of ball positions (equal Δt)

const X_START = 2; // px — x of first floor contact
const X_END = 58; // px — x of last floor contact

const BALL_RADIUS = 1; // px
const BALL_COLOR = "#1a4fcc";
const BALL_OPACITY = 0.85;

const FLOOR_COLOR = "#444";
const FLOOR_WIDTH = 0.8; // stroke-width
// ─────────────────────────────────────────────────────────────────

/** Build the time axis for each bounce.
 *  Each arc n has peak height h_n = INITIAL_HEIGHT * RESTITUTION^n.
 *  The flight time of a projectile scales as sqrt(h), so
 *  T_n ∝ sqrt(h_n).  We normalise so the total "time" = 1.
 */
function buildBounces(): Array<{ tStart: number; tEnd: number; h: number }> {
  const heights = Array.from(
    { length: NUM_BOUNCES },
    (_, n) => INITIAL_HEIGHT * Math.pow(RESTITUTION, n),
  );

  // flight time ∝ sqrt(h)
  const durations = heights.map((h) => Math.sqrt(h));
  const totalDuration = durations.reduce((a, b) => a + b, 0);

  const bounces: Array<{ tStart: number; tEnd: number; h: number }> = [];
  let t = 0;
  for (let n = 0; n < NUM_BOUNCES; n++) {
    const dt = durations[n] / totalDuration;
    bounces.push({ tStart: t, tEnd: t + dt, h: heights[n] });
    t += dt;
  }
  return bounces;
}

interface Point {
  x: number;
  y: number;
}

function computeSnapshots(): Point[] {
  const bounces = buildBounces();
  const points: Point[] = [];

  // x positions of bounce endpoints (floor contacts) spaced proportionally
  // to flight time (= proportional to normalised duration)
  const xContacts: number[] = bounces.map(
    (b) => X_START + b.tStart * (X_END - X_START),
  );
  xContacts.push(X_END); // final landing

  for (let i = 0; i < TOTAL_SNAPSHOTS; i++) {
    // global normalised time in [0, 1)
    const tGlobal = i / TOTAL_SNAPSHOTS;

    // find which bounce this snapshot falls in
    const bounce = bounces.find((b) => tGlobal >= b.tStart && tGlobal < b.tEnd);
    if (!bounce) continue; // shouldn't happen

    const bounceIdx = bounces.indexOf(bounce);
    // local time within this bounce, in [0, 1]
    const tLocal = (tGlobal - bounce.tStart) / (bounce.tEnd - bounce.tStart);

    // parabolic height above floor: h*(1-(2t-1)^2)
    const heightAboveFloor = bounce.h * (1 - Math.pow(2 * tLocal - 1, 2));

    // x: linearly interpolated between the two floor contacts of this bounce
    const xLeft = xContacts[bounceIdx];
    const xRight = xContacts[bounceIdx + 1];
    const x = xLeft + tLocal * (xRight - xLeft);

    // svg y increases downward
    const y = FLOOR_Y - heightAboveFloor;

    points.push({ x: +x.toFixed(2), y: +y.toFixed(2) });
  }

  return points;
}

function buildSVG(points: Point[]): string {
  const circles = points
    .map(
      (p) =>
        `  <circle cx="${p.x}" cy="${p.y}" r="${BALL_RADIUS}" ` +
        `fill="${BALL_COLOR}" opacity="${BALL_OPACITY}"/>`,
    )
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" \
width="${SVG_WIDTH}" height="${SVG_HEIGHT}" \
viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}">
  <!-- Floor -->
  <line x1="0" y1="${FLOOR_Y}" x2="${SVG_WIDTH}" y2="${FLOOR_Y}" \
stroke="${FLOOR_COLOR}" stroke-width="${FLOOR_WIDTH}"/>
${circles}
</svg>`;
}

const points = computeSnapshots();
const svg = buildSVG(points);

// Write to public/icons/icon.svg (source for PNG icon generation)
const outputPath = "public/icons/icon.svg";
fs.mkdirSync("public/icons", { recursive: true });
fs.writeFileSync(outputPath, svg, "utf8");
console.log(
  `✓ Generated ${outputPath} with ${points.length} bouncing ball snapshots`,
);
