/**
 * TRACE AI - Coordinate Transformation Engine
 * 
 * Geographic (WGS84 Lat/Lon) to Local Tangent Plane (ENU - East North Up)
 * and Three.js 3D Cartesian coordinates.
 * 
 * COORDINATE SYSTEM CONVENTION:
 * - Reference Origin: (lat0, lon0, alt0) configured as a PROVISIONAL LOCAL REFERENCE ORIGIN.
 * - East (meters)  -> Three.js +X
 * - Up (meters)    -> Three.js +Y (road plane at Y = 0)
 * - North (meters) -> Three.js -Z (standard Three.js right-handed orientation where -Z is North)
 * 
 * FORENSIC PRINCIPLES:
 * - Origin is explicitly tagged with provenance and classified as PROVISIONAL, never verified collision epicenter.
 * - Original GPS coordinates are strictly preserved without mutation.
 * - Mathematical round-trip precision (< 1e-12m) is strictly distinguished from real-world geographic accuracy (limited by GPS CEP).
 * - Explicitly documents the planar tangent altitude assumption (alt = 0m).
 */

const WGS84_A = 6378137.0; // WGS84 semi-major axis in meters
const WGS84_F = 1.0 / 298.257223563; // flattening
const WGS84_E2 = 2 * WGS84_F - WGS84_F * WGS84_F; // eccentricity squared

const DEG_TO_RAD = Math.PI / 180.0;
const RAD_TO_DEG = 180.0 / Math.PI;

/**
 * Prime vertical radius of curvature N(phi)
 */
export function getPrimeVerticalRadius(latRad) {
  const sinLat = Math.sin(latRad);
  return WGS84_A / Math.sqrt(1.0 - WGS84_E2 * sinLat * sinLat);
}

/**
 * Meridional radius of curvature M(phi)
 */
export function getMeridionalRadius(latRad) {
  const sinLat = Math.sin(latRad);
  const denom = 1.0 - WGS84_E2 * sinLat * sinLat;
  return (WGS84_A * (1.0 - WGS84_E2)) / Math.pow(denom, 1.5);
}

export class GeoCoordinateSystem {
  constructor(originLat, originLon, originAlt = 0, metadata = {}) {
    this.originLat = originLat;
    this.originLon = originLon;
    this.originAlt = originAlt;

    this.originType = metadata.originType || 'PROVISIONAL_LOCAL_REFERENCE_ORIGIN';
    this.isVerifiedCollisionEpicenter = false; // Strictly false per forensic standard
    this.provenance = metadata.provenance || {
      basis: 'Provisional local reference origin',
      uncertaintyMeters: 2.5,
      classification: 'ESTIMATED_VALUE',
      disclaimer: 'Provisional reference frame origin only; not a verified physical contact point.'
    };

    // Explicit Altitude Assumption Documentation
    this.altitudeAssumption = {
      assumedAltitudeMeters: originAlt,
      classification: 'MODEL_ASSUMPTION',
      isMeasuredAltitude: false,
      provenance: 'Telemetry dataset lacks GNSS elevation/altitude; local planar tangent approximation assumes road surface at Y = 0 (alt = 0.0m). Earth curvature vertical deflection over 500m radius is ~2 cm, deemed negligible for local road vehicle kinematics.'
    };

    const latRad = originLat * DEG_TO_RAD;
    this.N = getPrimeVerticalRadius(latRad);
    this.M = getMeridionalRadius(latRad);
    this.cosLat = Math.cos(latRad);

    // Meters per degree
    this.metersPerDegreeLat = this.M * DEG_TO_RAD;
    this.metersPerDegreeLon = this.N * this.cosLat * DEG_TO_RAD;
  }

  /**
   * Converts WGS84 (lat, lon, alt) to Local ENU (east, north, up) in meters.
   * Forward transformation from ellipsoidal geodetic to local metric tangent plane.
   */
  toENU(lat, lon, alt = 0) {
    if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
      return { east: 0, north: 0, up: 0, isMissing: true };
    }

    const deltaLat = (lat - this.originLat) * DEG_TO_RAD;
    const deltaLon = (lon - this.originLon) * DEG_TO_RAD;

    const east = deltaLon * this.N * this.cosLat;
    const north = deltaLat * this.M;
    const up = alt - this.originAlt;

    return { east, north, up, isMissing: false };
  }

  /**
   * Converts Local ENU (east, north, up) to Three.js Cartesian (x, y, z).
   * Three.js convention: +X = East, +Y = Up, -Z = North
   */
  toThreeCoords(lat, lon, alt = 0) {
    const enu = this.toENU(lat, lon, alt);
    return {
      x: enu.east,
      y: enu.up,
      z: -enu.north, // North is -Z in Three.js standard
      isMissing: enu.isMissing
    };
  }

  /**
   * Converts Three.js Cartesian (x, y, z) back to WGS84 (lat, lon, alt).
   * Inverse transformation from local metric tangent plane back to ellipsoidal geodetic.
   */
  toLatLng(x, y, z = 0) {
    const east = x;
    const north = -z;
    const up = y;

    const deltaLatDeg = north / this.metersPerDegreeLat;
    const deltaLonDeg = east / this.metersPerDegreeLon;

    return {
      lat: this.originLat + deltaLatDeg,
      lon: this.originLon + deltaLonDeg,
      alt: this.originAlt + up
    };
  }

  /**
   * Explicit forward transformation alias.
   */
  forward(lat, lon, alt = 0) {
    return this.toENU(lat, lon, alt);
  }

  /**
   * Explicit inverse transformation alias.
   */
  inverse(east, north, up = 0) {
    const deltaLatDeg = north / this.metersPerDegreeLat;
    const deltaLonDeg = east / this.metersPerDegreeLon;
    return {
      lat: this.originLat + deltaLatDeg,
      lon: this.originLon + deltaLonDeg,
      alt: this.originAlt + up
    };
  }

  /**
   * Calculate distance in meters between two lat/lon pairs using Local ENU projection.
   */
  distanceMeters(lat1, lon1, lat2, lon2) {
    const p1 = this.toENU(lat1, lon1);
    const p2 = this.toENU(lat2, lon2);
    const dx = p2.east - p1.east;
    const dy = p2.north - p1.north;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

/**
 * Computes an optimal reference origin from a collection of records.
 * Default behavior: Retains V1/V2 midpoint (37.541565, -77.437165) as a
 * PROVISIONAL LOCAL REFERENCE ORIGIN, fully configurable and decoupled from
 * physical collision contact claims.
 */
export function computeReferenceOrigin(records = [], options = {}) {
  // Option 1: Explicit custom origin passed
  if (options.customOrigin && typeof options.customOrigin.lat === 'number' && typeof options.customOrigin.lon === 'number') {
    return new GeoCoordinateSystem(
      options.customOrigin.lat,
      options.customOrigin.lon,
      options.customOrigin.alt || 0,
      {
        originType: options.customOrigin.type || 'USER_DEFINED_ORIGIN',
        provenance: {
          basis: options.customOrigin.description || 'Configured custom coordinate origin',
          uncertaintyMeters: options.customOrigin.uncertaintyMeters || 0.0,
          classification: 'CONFIGURED_VALUE',
          disclaimer: 'User-specified reference origin'
        }
      }
    );
  }

  // Option 2: Default Provisional Midpoint (V1/V2 Impact Observations)
  // V1 Row #6: 37.54155, -77.43715
  // V2 Row #16: 37.54158, -77.43718
  // Midpoint: 37.541565, -77.437165
  const defaultProvisionalLat = 37.541565;
  const defaultProvisionalLon = -77.437165;

  if (options.preferCentroid) {
    const validRecords = records.filter(
      (r) => typeof r.lat === 'number' && !isNaN(r.lat) && typeof r.lon === 'number' && !isNaN(r.lon)
    );
    if (validRecords.length > 0) {
      const sumLat = validRecords.reduce((acc, r) => acc + r.lat, 0);
      const sumLon = validRecords.reduce((acc, r) => acc + r.lon, 0);
      return new GeoCoordinateSystem(
        sumLat / validRecords.length,
        sumLon / validRecords.length,
        0,
        {
          originType: 'CENTROID_FALLBACK',
          provenance: {
            basis: `Arithmetic mean of ${validRecords.length} observed GPS coordinates`,
            uncertaintyMeters: 25.0,
            classification: 'ESTIMATED_VALUE',
            disclaimer: 'Mathematical centroid; does not correspond to an empirical observation'
          }
        }
      );
    }
  }

  // Default standard: Provisional Local Reference Origin
  return new GeoCoordinateSystem(
    defaultProvisionalLat,
    defaultProvisionalLon,
    0,
    {
      originType: 'PROVISIONAL_LOCAL_REFERENCE_ORIGIN',
      provenance: {
        basis: 'Midpoint of V1 Row #6 (37.54155, -77.43715) and V2 Row #16 (37.54158, -77.43718) at 18:42:11.220 UTC',
        uncertaintyMeters: 2.5,
        classification: 'ESTIMATED_VALUE',
        disclaimer: 'Provisional local reference origin for spatial alignment; not a verified physical collision epicenter.'
      }
    }
  );
}
