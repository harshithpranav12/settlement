/**
 * TRACE AI - Trajectory Interpolation & Temporal Synchronization Engine
 * 
 * Provides rigorous, evidence-grounded temporal interpolation along vehicle trajectory paths.
 * Strictly distinguishes:
 * - DIRECT_OBSERVATION: Exact timestamp match to original sensor telemetry row.
 * - INTERPOLATED_VALUE: Bounded linear interpolation between two verified empirical observations.
 * - ESTIMATED_VALUE: Pre-recording approach or extrapolated state.
 * - UNAVAILABLE: Outside trajectory observation horizon or missing data.
 */

import { calculateCompassBearing, getCardinalDirection, calculateThreeYawRotation } from './orientationCalculator.js';
import { getHeadingUncertainty } from './uncertaintyModel.js';

/**
 * Shortest angular distance interpolation for yaw angles in radians.
 */
function lerpAngle(a, b, t) {
  let diff = (b - a) % (2 * Math.PI);
  if (diff < -Math.PI) diff += 2 * Math.PI;
  if (diff > Math.PI) diff -= 2 * Math.PI;
  return a + diff * t;
}

/**
 * Evaluates a vehicle's spatial and sensor state at an arbitrary timestamp t (in seconds).
 * @param {Array} waypoints - Chronologically sorted array of verified waypoint records.
 * @param {number} currentSeconds - Current playback epoch in seconds.
 */
export function sampleVehicleStateAtTime(waypoints = [], currentSeconds) {
  if (!Array.isArray(waypoints) || waypoints.length === 0) {
    return {
      classification: 'UNAVAILABLE',
      x: 0,
      y: 0,
      z: 0,
      yaw: 0,
      speed_kmh: '0.0 km/h',
      speedVal: 0,
      acceleration_mps2: '0.00 m/s²',
      accelVal: 0,
      brake_status: 'UNAVAILABLE',
      throttle_position: '0%',
      exactTimestamp: '--:--:--.--- UTC',
      lat: null,
      lon: null,
      rowIndex: null,
      sourceId: null,
      cumulativeDistanceMeters: 0,
      classification: 'UNAVAILABLE',
      datasetAuthenticity: 'UNAVAILABLE',
      isMissing: true
    };
  }

  const first = waypoints[0];
  const last = waypoints[waypoints.length - 1];

  // Case 1: Before first recorded observation
  if (currentSeconds < first.seconds - 0.001) {
    return {
      ...first,
      classification: 'ESTIMATED_VALUE',
      datasetAuthenticity: 'SIMULATED / DEMONSTRATION DATA',
      description: 'Pre-recording approach horizon (clamped to earliest observed entry)',
      interpolated: true
    };
  }

  // Case 2: At or after final recorded observation (Vehicle at final rest)
  if (currentSeconds >= last.seconds - 0.001) {
    return {
      ...last,
      classification: 'DIRECT_OBSERVATION',
      datasetAuthenticity: 'SIMULATED / DEMONSTRATION DATA',
      description: `Final rest position confirmed by telemetry baseline (Row #${last.rowIndex})`,
      speed_kmh: '0.0 km/h',
      speedVal: 0,
      acceleration_mps2: '0.00 m/s²',
      accelVal: 0,
      interpolated: false
    };
  }

  // Search for the interval [i, i+1] where waypoints[i].seconds <= currentSeconds < waypoints[i+1].seconds
  for (let i = 0; i < waypoints.length - 1; i++) {
    const p0 = waypoints[i];
    const p1 = waypoints[i + 1];

    if (currentSeconds >= p0.seconds && currentSeconds <= p1.seconds) {
      const dt = p1.seconds - p0.seconds;

      // Exact match to p0 within 5 milliseconds
      if (Math.abs(currentSeconds - p0.seconds) < 0.005) {
        return {
          ...p0,
          classification: 'DIRECT_OBSERVATION',
          datasetAuthenticity: 'SIMULATED / DEMONSTRATION DATA',
          description: `Exact sensor record match (Row #${p0.rowIndex})`,
          interpolated: false
        };
      }

      // Exact match to p1 within 5 milliseconds
      if (Math.abs(currentSeconds - p1.seconds) < 0.005) {
        return {
          ...p1,
          classification: 'DIRECT_OBSERVATION',
          datasetAuthenticity: 'SIMULATED / DEMONSTRATION DATA',
          description: `Exact sensor record match (Row #${p1.rowIndex})`,
          interpolated: false
        };
      }

      // Linear interpolation factor alpha in [0, 1]
      const alpha = dt > 0 ? (currentSeconds - p0.seconds) / dt : 0;

      const x = p0.x + (p1.x - p0.x) * alpha;
      const y = p0.y + (p1.y - p0.y) * alpha;
      const z = p0.z + (p1.z - p0.z) * alpha;

      const speedVal = p0.speedVal + (p1.speedVal - p0.speedVal) * alpha;
      const accelVal = p0.accelVal + (p1.accelVal - p0.accelVal) * alpha;

      const yaw = lerpAngle(p0.yaw, p1.yaw, alpha);
      const dx = p1.x - p0.x;
      const dz = p1.z - p0.z;
      const bearing = calculateCompassBearing(dx, dz);
      const cardinal = getCardinalDirection(bearing);

      // Interpolate GPS coordinates if present
      const lat = p0.lat !== null && p1.lat !== null ? p0.lat + (p1.lat - p0.lat) * alpha : null;
      const lon = p0.lon !== null && p1.lon !== null ? p0.lon + (p1.lon - p0.lon) * alpha : null;

      // Interpolate cumulative distance
      const cumDist = (p0.cumulativeDistanceMeters || 0) + 
        ((p1.cumulativeDistanceMeters || 0) - (p0.cumulativeDistanceMeters || 0)) * alpha;

      // Brake state is True if either bounding point had brakes engaged
      const isBraking = p0.isBrakeActive || p1.isBrakeActive;

      const headingUncertainty = getHeadingUncertainty(speedVal, Math.sqrt(dx * dx + dz * dz));

      return {
        x: parseFloat(x.toFixed(3)),
        y: parseFloat(y.toFixed(3)),
        z: parseFloat(z.toFixed(3)),
        lat: lat !== null ? parseFloat(lat.toFixed(6)) : null,
        lon: lon !== null ? parseFloat(lon.toFixed(6)) : null,
        yaw: parseFloat(yaw.toFixed(4)),
        bearing: parseFloat(bearing.toFixed(1)),
        cardinal,
        vehicleId: p0.vehicleId,
        seconds: currentSeconds,
        exactTimestamp: formatSecondsToTimestamp(currentSeconds),
        speed_kmh: `${speedVal.toFixed(1)} km/h`,
        speedVal: parseFloat(speedVal.toFixed(1)),
        acceleration_mps2: `${accelVal.toFixed(2)} m/s²`,
        accelVal: parseFloat(accelVal.toFixed(2)),
        brake_status: isBraking ? 'True' : 'False',
        isBrakeActive: isBraking,
        throttle_position: p0.throttle_position || '0%',
        sourceId: p0.sourceId,
        sourceFileName: p0.sourceFileName,
        rowIndex: `Between #${p0.rowIndex} & #${p1.rowIndex}`,
        boundingRows: [p0.rowIndex, p1.rowIndex],
        interpolationAlpha: parseFloat(alpha.toFixed(4)),
        cumulativeDistanceMeters: parseFloat(cumDist.toFixed(2)),
        headingUncertaintyDeg: headingUncertainty.headingUncertaintyDeg,
        classification: 'INTERPOLATED_VALUE',
        datasetAuthenticity: 'SIMULATED / DEMONSTRATION DATA',
        description: `Piecewise linear spatial interpolation between Row #${p0.rowIndex} (${p0.exactTimestamp}) and Row #${p1.rowIndex} (${p1.exactTimestamp})`
      };
    }
  }

  return {
    ...last,
    classification: 'ESTIMATED_VALUE',
    datasetAuthenticity: 'SIMULATED / DEMONSTRATION DATA',
    interpolated: true
  };
}

/**
 * Formats seconds back to standard HH:MM:SS.mmm UTC.
 */
export function formatSecondsToTimestamp(seconds) {
  const hours = Math.floor(seconds / 3600);
  const rem1 = seconds % 3600;
  const mins = Math.floor(rem1 / 60);
  const secs = rem1 % 60;
  const intSecs = Math.floor(secs);
  const ms = Math.round((secs - intSecs) * 1000);

  const hh = String(hours).padStart(2, '0');
  const mm = String(mins).padStart(2, '0');
  const ss = String(intSecs).padStart(2, '0');
  const mmm = String(ms).padStart(3, '0');

  return `${hh}:${mm}:${ss}.${mmm} UTC`;
}
