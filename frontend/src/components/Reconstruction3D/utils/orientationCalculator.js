/**
 * TRACE AI - Vehicle Orientation & Heading Engine
 * 
 * Computes cardinal compass headings, navigational bearings, and Three.js Euler yaw rotations
 * from consecutive spatial positions or kinematic velocity vectors.
 * 
 * FORENSIC PRINCIPLES:
 * - All computed headings are strictly classified as ESTIMATED_VALUE.
 * - Angular uncertainty is explicitly attached to each waypoint.
 * - When velocity is below the low-speed threshold (< 5 km/h) or displacement is zero,
 *   heading is marked as INDETERMINATE / clamped to last valid heading rather than fabricating rotation.
 */

import { getHeadingUncertainty } from './uncertaintyModel.js';

const DEG_TO_RAD = Math.PI / 180.0;
const RAD_TO_DEG = 180.0 / Math.PI;

const CARDINAL_POINTS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'
];

/**
 * Computes standard compass bearing (0° to 360°, where 0° = North, 90° = East).
 * @param {number} dx - East delta in meters
 * @param {number} dz - South delta in meters (-dz is North delta)
 */
export function calculateCompassBearing(dx, dz) {
  const dEast = dx;
  const dNorth = -dz;

  if (Math.abs(dEast) < 1e-6 && Math.abs(dNorth) < 1e-6) {
    return 0;
  }

  let angleRad = Math.atan2(dEast, dNorth);
  let angleDeg = angleRad * RAD_TO_DEG;
  if (angleDeg < 0) {
    angleDeg += 360.0;
  }
  return angleDeg % 360.0;
}

/**
 * Converts compass bearing in degrees to a cardinal label (e.g. 334° -> 'NNW').
 */
export function getCardinalDirection(bearingDeg) {
  const normalized = ((bearingDeg % 360) + 360) % 360;
  const index = Math.round(normalized / 22.5) % 16;
  return CARDINAL_POINTS[index];
}

/**
 * Computes Three.js Y-axis rotation (in radians) so that a vehicle model's
 * forward axis (+Z or -Z) points toward (dx, dz).
 * Assumes vehicle model default forward axis is along -Z (standard Three.js convention).
 */
export function calculateThreeYawRotation(dx, dz) {
  return Math.atan2(dx, -dz);
}

/**
 * Computes orientation array along a trajectory of points { x, y, z, time, speedVal }.
 * Attaches explicit ESTIMATED_VALUE classification and heading uncertainty metadata.
 */
export function computeTrajectoryHeadings(points = []) {
  if (!Array.isArray(points) || points.length === 0) return [];
  if (points.length === 1) {
    return [{
      ...points[0],
      bearing: 0,
      cardinal: 'N',
      yaw: 0,
      headingClassification: 'ESTIMATED_VALUE',
      headingUncertaintyDeg: 45.0,
      isHeadingIndeterminate: true
    }];
  }

  const result = [];
  let lastValidBearing = null;
  let lastValidYaw = null;

  for (let i = 0; i < points.length; i++) {
    const cur = points[i];
    let dx = 0;
    let dz = 0;

    if (i < points.length - 1) {
      const next = points[i + 1];
      dx = next.x - cur.x;
      dz = next.z - cur.z;
    } else {
      const prev = points[i - 1];
      dx = cur.x - prev.x;
      dz = cur.z - prev.z;
    }

    const displacementMeters = Math.sqrt(dx * dx + dz * dz);
    const speedKmh = typeof cur.speedVal === 'number' ? cur.speedVal : 0;

    let bearing = 0;
    let yaw = 0;
    let cardinal = 'N';
    let isIndeterminate = false;

    if (displacementMeters > 0.05) {
      bearing = calculateCompassBearing(dx, dz);
      yaw = calculateThreeYawRotation(dx, dz);
      cardinal = getCardinalDirection(bearing);
      lastValidBearing = bearing;
      lastValidYaw = yaw;
    } else if (lastValidBearing !== null) {
      // Clamped to last valid heading when stationary
      bearing = lastValidBearing;
      yaw = lastValidYaw;
      cardinal = getCardinalDirection(bearing);
      isIndeterminate = speedKmh < 1.0;
    } else {
      isIndeterminate = true;
    }

    const uncertainty = getHeadingUncertainty(speedKmh, displacementMeters);

    result.push({
      ...cur,
      bearing: parseFloat(bearing.toFixed(1)),
      cardinal,
      yaw: parseFloat(yaw.toFixed(4)),
      headingClassification: 'ESTIMATED_VALUE',
      headingUncertaintyDeg: uncertainty.headingUncertaintyDeg,
      headingConfidenceBand: uncertainty.confidenceBand,
      isHeadingIndeterminate: isIndeterminate,
      headingProvenance: `Secant forward/backward difference (${displacementMeters.toFixed(2)}m vector)`
    });
  }

  return result;
}
