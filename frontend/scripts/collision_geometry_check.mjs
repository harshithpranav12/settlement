// collision_geometry_check.mjs
import { fileURLToPath } from 'url';

const DEG_TO_RAD = Math.PI / 180.0;
const WGS84_A = 6378137.0;
const WGS84_F = 1.0 / 298.257223563;
const WGS84_E2 = 2 * WGS84_F - WGS84_F * WGS84_F;

function getPrimeVerticalRadius(latRad) {
  const sinLat = Math.sin(latRad);
  return WGS84_A / Math.sqrt(1.0 - WGS84_E2 * sinLat * sinLat);
}

function getMeridionalRadius(latRad) {
  const sinLat = Math.sin(latRad);
  const denom = 1.0 - WGS84_E2 * sinLat * sinLat;
  return (WGS84_A * (1.0 - WGS84_E2)) / Math.pow(denom, 1.5);
}

const originLat = 37.541565; // Collision midpoint
const originLon = -77.437165;
const latRad = originLat * DEG_TO_RAD;
const N = getPrimeVerticalRadius(latRad);
const M = getMeridionalRadius(latRad);
const cosLat = Math.cos(latRad);

function toENU(lat, lon) {
  const deltaLat = (lat - originLat) * DEG_TO_RAD;
  const deltaLon = (lon - originLon) * DEG_TO_RAD;
  const east = deltaLon * N * cosLat;
  const north = deltaLat * M;
  return { east, north, threeX: east, threeZ: -north };
}

// Impact points at 18:42:11.220 UTC
const v1 = toENU(37.54155, -77.43715);
const v2 = toENU(37.54158, -77.43718);
const v3 = toENU(37.54208, -77.43692);

console.log('Impact coordinates in Local ENU (origin at collision midpoint):');
console.log('V1:', v1, 'dist to origin:', Math.hypot(v1.east, v1.north).toFixed(3));
console.log('V2:', v2, 'dist to origin:', Math.hypot(v2.east, v2.north).toFixed(3));
console.log('V3:', v3, 'dist to origin:', Math.hypot(v3.east, v3.north).toFixed(3));

const dx12 = v2.east - v1.east;
const dy12 = v2.north - v1.north;
const dist12 = Math.hypot(dx12, dy12);
console.log(`V1 to V2 vector: dx(East) = ${dx12.toFixed(3)}m, dy(North) = ${dy12.toFixed(3)}m, distance = ${dist12.toFixed(3)}m`);

// Orientation / Heading analysis:
// V1 heading prior to collision: from R1(37.5402, -77.4361) to R6(37.54155, -77.43715)
// Delta lat = +0.00135, Delta lon = -0.00105
// Heading is North-North-West (~330 degrees)
const v1_dx = (-77.43715 - (-77.4361)) * N * cosLat;
const v1_dy = (37.54155 - 37.5402) * M;
const v1_bearing = (Math.atan2(v1_dx, v1_dy) * 180 / Math.PI + 360) % 360;
console.log(`V1 trajectory vector: dx=${v1_dx.toFixed(2)}m, dy=${v1_dy.toFixed(2)}m, overall bearing = ${v1_bearing.toFixed(1)}°`);

// V2 heading prior to collision: from R11(37.5421, -77.4368) to R16(37.54158, -77.43718)
// Delta lat = -0.00052, Delta lon = -0.00038
// Heading is South-South-West (~215 degrees)
const v2_dx = (-77.43718 - (-77.4368)) * N * cosLat;
const v2_dy = (37.54158 - 37.5421) * M;
const v2_bearing = (Math.atan2(v2_dx, v2_dy) * 180 / Math.PI + 360) % 360;
console.log(`V2 trajectory vector: dx=${v2_dx.toFixed(2)}m, dy=${v2_dy.toFixed(2)}m, overall bearing = ${v2_bearing.toFixed(1)}°`);

// V3 trajectory: from R21(37.5425, -77.4365) to R26(37.54208, -77.43692)
const v3_dx = (-77.43692 - (-77.4365)) * N * cosLat;
const v3_dy = (37.54208 - 37.5425) * M;
const v3_bearing = (Math.atan2(v3_dx, v3_dy) * 180 / Math.PI + 360) % 360;
console.log(`V3 trajectory vector: dx=${v3_dx.toFixed(2)}m, dy=${v3_dy.toFixed(2)}m, overall bearing = ${v3_bearing.toFixed(1)}°`);

// Relative approach angle between V1 and V2:
const approachAngle = Math.abs(v1_bearing - v2_bearing);
console.log(`Relative approach angle between V1 and V2: ${approachAngle.toFixed(1)}° (Near oblique/head-on: 326° vs 213° -> ~113° intersection angle)`);

// Separating Axis Theorem (SAT) / Oriented Bounding Box (OBB) test
// Let's test if oriented bounding boxes of V1 and V2 overlap at impact
function checkOBBOverlap(c1, size1, heading1Deg, c2, size2, heading2Deg) {
  const theta1 = heading1Deg * DEG_TO_RAD;
  const theta2 = heading2Deg * DEG_TO_RAD;
  
  // Axes for Box 1
  const u1_1 = { x: Math.sin(theta1), y: Math.cos(theta1) }; // forward
  const u1_2 = { x: Math.cos(theta1), y: -Math.sin(theta1) }; // right
  
  // Axes for Box 2
  const u2_1 = { x: Math.sin(theta2), y: Math.cos(theta2) };
  const u2_2 = { x: Math.cos(theta2), y: -Math.sin(theta2) };

  const axes = [u1_1, u1_2, u2_1, u2_2];
  const half1 = [size1.length / 2, size1.width / 2];
  const half2 = [size2.length / 2, size2.width / 2];

  // Translation vector from c1 to c2
  const T = { x: c2.east - c1.east, y: c2.north - c1.north };

  for (let i = 0; i < axes.length; i++) {
    const a = axes[i];
    // Project translation vector
    const projT = Math.abs(T.x * a.x + T.y * a.y);
    
    // Project half-extents of box 1
    const r1 = Math.abs(half1[0] * (u1_1.x * a.x + u1_1.y * a.y)) +
               Math.abs(half1[1] * (u1_2.x * a.x + u1_2.y * a.y));
               
    // Project half-extents of box 2
    const r2 = Math.abs(half2[0] * (u2_1.x * a.x + u2_1.y * a.y)) +
               Math.abs(half2[1] * (u2_2.x * a.x + u2_2.y * a.y));

    if (projT > (r1 + r2)) {
      // Separating axis found! No overlap
      return { overlap: false, axisIndex: i, gap: projT - (r1 + r2) };
    }
  }
  return { overlap: true };
}

const obbResult = checkOBBOverlap(
  v1, { length: 4.70, width: 1.85 }, v1_bearing,
  v2, { length: 4.80, width: 1.95 }, v2_bearing
);
console.log('OBB Overlap Check Result at nominal GPS:', obbResult);
