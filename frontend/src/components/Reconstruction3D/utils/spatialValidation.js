/**
 * TRACE AI - Spatial Validation Utilities
 * 
 * Validates geographic telemetry observations and kinematic inputs
 * to prevent NaN, infinite, or fabricated values from entering the 3D scene.
 */

export const CoordinateQuality = {
  VALID_GEOGRAPHIC: 'VALID_GEOGRAPHIC',
  INSUFFICIENT_SPREAD: 'INSUFFICIENT_SPREAD',
  INVALID_COORDINATES: 'INVALID_COORDINATES',
  EMPTY: 'EMPTY'
};

/**
 * Validates a single GPS coordinate pair.
 */
export function isValidLatLng(lat, lon) {
  if (typeof lat !== 'number' || typeof lon !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (isNaN(lat) || isNaN(lon)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lon < -180 || lon > 180) return false;
  // Exclude null island (0, 0) if unexpected
  if (lat === 0 && lon === 0) return false;
  return true;
}

/**
 * Validates a trajectory array of raw records.
 */
export function validateTrajectoryObservations(records = []) {
  if (!Array.isArray(records) || records.length === 0) {
    return {
      quality: CoordinateQuality.EMPTY,
      validRecords: [],
      errorCount: 0,
      message: 'No trajectory records provided.'
    };
  }

  let errorCount = 0;
  const validRecords = [];

  records.forEach((r, idx) => {
    const lat = typeof r.lat === 'number' ? r.lat : parseFloat(r.latitude || r.lat);
    const lon = typeof r.lon === 'number' ? r.lon : parseFloat(r.longitude || r.lon);

    if (isValidLatLng(lat, lon)) {
      validRecords.push({
        ...r,
        lat,
        lon,
        originalIndex: idx
      });
    } else {
      errorCount++;
    }
  });

  if (validRecords.length === 0) {
    return {
      quality: CoordinateQuality.INVALID_COORDINATES,
      validRecords: [],
      errorCount,
      message: 'Zero records contained valid geographic coordinates.'
    };
  }

  // Check spatial spread (prevent treating static single-point GPS as a moving trajectory)
  const lats = validRecords.map((r) => r.lat);
  const lons = validRecords.map((r) => r.lon);
  const latSpan = Math.max(...lats) - Math.min(...lats);
  const lonSpan = Math.max(...lons) - Math.min(...lons);

  // Approximately 1e-5 degrees is ~1 meter
  if (latSpan < 0.00001 && lonSpan < 0.00001 && validRecords.length > 1) {
    return {
      quality: CoordinateQuality.INSUFFICIENT_SPREAD,
      validRecords,
      errorCount,
      message: 'Identical coordinates detected across time. Geographic movement cannot be verified.'
    };
  }

  return {
    quality: CoordinateQuality.VALID_GEOGRAPHIC,
    validRecords,
    errorCount,
    latSpan,
    lonSpan,
    message: `Validated ${validRecords.length} geographic observations (${errorCount} invalid rejected).`
  };
}
