/**
 * TRACE AI - Spatial & Kinematic Uncertainty Management Engine
 * 
 * Manages uncoupled, scientifically defensible uncertainty budgets:
 * 1. Coordinate Quantization Uncertainty (from finite decimal precision)
 * 2. GPS Measurement Uncertainty (GNSS receiver CEP95 assumption)
 * 3. Heading / Orientation Uncertainty (angular variance)
 * 4. Vehicle Dimension Uncertainty (bodywork tolerances & OEM baselines)
 * 5. Derived Trajectory Uncertainty (cumulative dead-reckoning odometry drift)
 * 
 * FORENSIC PRINCIPLES:
 * - Distinguishes coordinate cell dimensions from maximum radial quantization error.
 * - Assumed GPS accuracy is explicitly tagged as CONFIGURABLE_ILLUSTRATIVE_ASSUMPTION (never measured).
 * - Vehicle dimensions are tagged as MODEL_ASSUMPTION (OEM factory baseline; no laser crush scan exists).
 */

export const DEFAULT_UNCERTAINTY_CONFIG = {
  // Illustrative civilian GNSS Circular Error Probable (CEP95) in meters
  // NOT an empirical measurement from the vehicle logs
  gpsCepMeters: 2.5,
  // Wheel-speed odometry scale-factor error percentage
  wheelSpeedErrorPct: 1.5,
  // Vehicle bodywork dimensional tolerance in meters
  vehicleDimensionToleranceMeters: 0.05,
  // Base heading estimation uncertainty for moving vehicles (degrees)
  baseHeadingUncertaintyDeg: 5.0,
  // Low-speed heading threshold below which orientation becomes indeterminate (km/h)
  lowSpeedHeadingThresholdKmh: 5.0
};

/**
 * Computes spatial quantization uncertainty based on latitude/longitude decimal places.
 * 
 * MATHEMATICAL FORMULATION:
 * - A coordinate truncated or rounded to D decimal places defines a discrete grid cell:
 *     cellDimensionLat = 10^(-D) * metersPerDegreeLat
 *     cellDimensionLon = 10^(-D) * metersPerDegreeLon
 *     cellDiagonal = sqrt(cellDimensionLat^2 + cellDimensionLon^2)
 * - Under standard nearest-value rounding, the true continuous coordinate lies within
 *   ±0.5 * cellDimension of the nominal point.
 * - The maximum radial quantization error (distance from cell center to cell corner) is:
 *     maxRadialQuantizationError = 0.5 * cellDiagonal
 * 
 * At reference latitude ~37.54°:
 * - 4 decimal places (0.0001°):
 *     Cell dimensions: ~11.10m (lat) x ~8.84m (lon), Cell diagonal: ~14.19m
 *     Maximum rounding error: ±5.55m (lat), ±4.42m (lon)
 *     Maximum radial quantization error: ~7.09m
 * - 5 decimal places (0.00001°):
 *     Cell dimensions: ~1.11m (lat) x ~0.88m (lon), Cell diagonal: ~1.42m
 *     Maximum rounding error: ±0.55m (lat), ±0.44m (lon)
 *     Maximum radial quantization error: ~0.71m
 */
export function getCoordinateQuantizationUncertainty(lat, lon) {
  if (lat === null || lon === null || typeof lat !== 'number' || typeof lon !== 'number') {
    return {
      latPrecisionDecimals: 0,
      lonPrecisionDecimals: 0,
      cellDimensionLatMeters: null,
      cellDimensionLonMeters: null,
      cellDiagonalMeters: null,
      maxQuantizationErrorLatMeters: null,
      maxQuantizationErrorLonMeters: null,
      maxRadialQuantizationErrorMeters: null,
      classification: 'UNAVAILABLE',
      provenance: 'No geographic coordinate recorded'
    };
  }

  const getDecimals = (num) => {
    const str = num.toString();
    const dotIdx = str.indexOf('.');
    return dotIdx >= 0 ? str.length - dotIdx - 1 : 0;
  };

  const latDecimals = getDecimals(lat);
  const lonDecimals = getDecimals(lon);

  // Exact WGS-84 metric factors at nominal mid-latitude (~37.541565°)
  const metersPerDegLat = 110979.77; // M(phi) * DEG_TO_RAD
  const metersPerDegLon = 88383.91;  // N(phi) * cos(phi) * DEG_TO_RAD

  // Full grid cell dimensions
  const cellDimLat = Math.pow(10, -latDecimals) * metersPerDegLat;
  const cellDimLon = Math.pow(10, -lonDecimals) * metersPerDegLon;
  const cellDiag = Math.sqrt(cellDimLat * cellDimLat + cellDimLon * cellDimLon);

  // Maximum rounding errors (half-cell extents)
  const maxErrLat = cellDimLat / 2.0;
  const maxErrLon = cellDimLon / 2.0;
  const maxRadialErr = cellDiag / 2.0;

  return {
    latPrecisionDecimals: latDecimals,
    lonPrecisionDecimals: lonDecimals,

    // Full discrete cell dimensions
    cellDimensionLatMeters: parseFloat(cellDimLat.toFixed(3)),
    cellDimensionLonMeters: parseFloat(cellDimLon.toFixed(3)),
    cellDiagonalMeters: parseFloat(cellDiag.toFixed(3)),

    // Maximum quantization error bounds under rounding
    maxQuantizationErrorLatMeters: parseFloat(maxErrLat.toFixed(3)),
    maxQuantizationErrorLonMeters: parseFloat(maxErrLon.toFixed(3)),
    maxRadialQuantizationErrorMeters: parseFloat(maxRadialErr.toFixed(3)),

    // Backward-compatibility aliases
    latQuantizationMeters: parseFloat(cellDimLat.toFixed(2)),
    lonQuantizationMeters: parseFloat(cellDimLon.toFixed(2)),
    radialQuantizationMeters: parseFloat(cellDiag.toFixed(2)),

    classification: 'ESTIMATED_VALUE',
    provenance: `Derived from decimal resolution: ${latDecimals} lat / ${lonDecimals} lon digits (cell: ${cellDimLat.toFixed(2)}m x ${cellDimLon.toFixed(2)}m, max radial error: ±${maxRadialErr.toFixed(2)}m)`
  };
}

/**
 * Returns GPS measurement uncertainty (CEP95) based on data source and configuration.
 * 
 * STRICT PROVENANCE DISCLOSURE:
 * The telemetry dataset does not record satellite count, HDOP, or covariance data.
 * Therefore, CEP95 = 2.5m is a CONFIGURABLE_ILLUSTRATIVE_ASSUMPTION based on
 * typical civilian open-sky GPS receiver performance standards, NOT an empirical measurement.
 */
export function getGpsMeasurementUncertainty(dataSource = '', customCep = null) {
  const isCustom = typeof customCep === 'number' && customCep > 0;
  const cep = isCustom ? customCep : DEFAULT_UNCERTAINTY_CONFIG.gpsCepMeters;

  const isDgpsOrRtk = dataSource.toUpperCase().includes('RTK') || dataSource.toUpperCase().includes('DGPS');
  const finalCep = isDgpsOrRtk ? Math.min(cep, 0.1) : cep;

  return {
    cepMeters: finalCep,
    confidenceLevel: '95% Circular Error Probable (nominal assumption)',
    standardDeviationMeters: parseFloat((finalCep / 2.4477).toFixed(3)), // 1-sigma Rayleigh
    dataSource: dataSource || 'STANDARD_CIVILIAN_GNSS',
    isMeasuredAccuracy: false, // Strictly false: not measured from empirical vehicle DOP
    classification: 'CONFIGURABLE_ILLUSTRATIVE_ASSUMPTION',
    provenance: isCustom
      ? `User-configured illustrative accuracy budget (CEP95: ${finalCep}m)`
      : 'Nominal civilian GNSS open-sky performance standard assumption; no empirical HDOP logged in telemetry'
  };
}

/**
 * Calculates heading uncertainty based on current vehicle speed and displacement.
 * At near-zero speed, GPS displacement heading approaches 180° indeterminacy.
 */
export function getHeadingUncertainty(speedKmh, deltaDistMeters = 10, cepMeters = 2.5) {
  if (typeof speedKmh !== 'number' || speedKmh < DEFAULT_UNCERTAINTY_CONFIG.lowSpeedHeadingThresholdKmh) {
    return {
      headingUncertaintyDeg: 45.0,
      confidenceBand: '±45.0°',
      isIndeterminate: true,
      reason: 'Vehicle speed below 5 km/h; heading cannot be resolved from GPS differentiation alone',
      classification: 'ESTIMATED_VALUE'
    };
  }

  // Geometric angular uncertainty: arctan(2 * CEP / deltaDist)
  const dist = Math.max(deltaDistMeters, 1.0);
  const angularRad = Math.atan2(cepMeters, dist);
  const angularDeg = Math.min(45.0, Math.max(DEFAULT_UNCERTAINTY_CONFIG.baseHeadingUncertaintyDeg, angularRad * (180 / Math.PI)));

  return {
    headingUncertaintyDeg: parseFloat(angularDeg.toFixed(1)),
    confidenceBand: `±${angularDeg.toFixed(1)}°`,
    isIndeterminate: false,
    reason: `Calculated from illustrative GPS CEP (${cepMeters}m) over observed displacement (${dist.toFixed(1)}m)`,
    classification: 'ESTIMATED_VALUE'
  };
}

/**
 * Returns dimensional manufacturing/crush tolerance for a vehicle model.
 * 
 * PROVENANCE DISCLOSURE:
 * Sourced from OEM factory baseline catalog specifications.
 * No post-crash laser scan or physical deformation measurements exist in the numerical telemetry stream.
 */
export function getVehicleDimensionUncertainty(vehicleId, customTolerance = null) {
  const tol = typeof customTolerance === 'number' ? customTolerance : DEFAULT_UNCERTAINTY_CONFIG.vehicleDimensionToleranceMeters;
  return {
    vehicleId,
    lengthToleranceMeters: tol,
    widthToleranceMeters: tol,
    heightToleranceMeters: tol,
    classification: 'MODEL_ASSUMPTION',
    provenance: 'OEM factory exterior dimension baseline; physical vehicle crush/damage scan unavailable in telemetry'
  };
}

/**
 * Computes dead-reckoning trajectory displacement uncertainty accumulated over distance s.
 * sigma_s = sensor_error_rate * s
 */
export function getDerivedTrajectoryUncertainty(cumulativeDistMeters = 0, errorPct = null) {
  const pct = typeof errorPct === 'number' ? errorPct : DEFAULT_UNCERTAINTY_CONFIG.wheelSpeedErrorPct;
  const driftMeters = cumulativeDistMeters * (pct / 100.0);

  return {
    cumulativeDistanceMeters: parseFloat(cumulativeDistMeters.toFixed(2)),
    odometryErrorRatePct: pct,
    positionDriftMeters: parseFloat(driftMeters.toFixed(3)),
    confidenceBandMeters: `±${driftMeters.toFixed(2)}m`,
    classification: 'DERIVED_VALUE',
    provenance: `Trapezoidal CAN bus wheel-speed integration with ±${pct}% scale factor uncertainty`
  };
}
