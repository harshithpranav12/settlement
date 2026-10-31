// test_phase5_reconstruction_model.mjs
// Rigorous Numerical Test Suite for TRACE AI Phase 5.1.3: Final Forensic Validation & Architecture Sign-Off

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  GeoCoordinateSystem,
  computeReferenceOrigin,
  getPrimeVerticalRadius,
  getMeridionalRadius
} from '../src/components/Reconstruction3D/utils/coordinateTransform.js';

import {
  calculateCompassBearing,
  getCardinalDirection,
  calculateThreeYawRotation,
  computeTrajectoryHeadings
} from '../src/components/Reconstruction3D/utils/orientationCalculator.js';

import {
  sampleVehicleStateAtTime,
  formatSecondsToTimestamp
} from '../src/components/Reconstruction3D/utils/trajectoryInterpolation.js';

import {
  getCoordinateQuantizationUncertainty,
  getGpsMeasurementUncertainty,
  getHeadingUncertainty,
  getVehicleDimensionUncertainty,
  getDerivedTrajectoryUncertainty
} from '../src/components/Reconstruction3D/utils/uncertaintyModel.js';

import {
  evaluateBoundingSphereProximity,
  evaluateOrientedBoundingBoxContact,
  assessCollisionEvidence,
  RECONCILED_VEHICLE_DIMENSIONS
} from '../src/components/Reconstruction3D/utils/collisionAssessment.js';

import {
  buildReconstructionSceneData,
  VEHICLE_METADATA
} from '../src/components/Reconstruction3D/services/reconstructionDataAdapter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('========================================================================');
console.log('TRACE AI — PHASE 5.1.3: FINAL FORENSIC VALIDATION & ARCHITECTURE SIGN-OFF');
console.log('========================================================================\n');

// Load CSV
const csvPath = path.resolve(__dirname, '../public/trace_ai_synthetic_road_accident_telemetry.csv');
const rawCsv = fs.readFileSync(csvPath, 'utf8').trim();
const csvLines = rawCsv.split(/\r?\n/);
const headers = csvLines[0].split(',');
const allRows = csvLines.slice(1).map(l => l.split(','));

const mockEvidence = [
  {
    id: 'EVD-SNS-1162-562',
    name: 'Sensor Telemetry CSV',
    fileName: 'trace_ai_synthetic_road_accident_telemetry.csv',
    origin: 'Actual Upload',
    isActualUpload: true,
    type: 'Vehicle Telemetry Sensor Log',
    format: 'CSV',
    headers,
    allRows
  }
];

let testsPassed = 0;
let testsFailed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log(`  ✅ PASS: ${msg}`);
    testsPassed++;
  } else {
    console.error(`  ❌ FAIL: ${msg}`);
    testsFailed++;
  }
}

// -------------------------------------------------------------
// TEST 1: Ingestion & Multi-Vehicle Partitioning
// -------------------------------------------------------------
console.log('TEST 1: Ingestion & Multi-Vehicle Partitioning');
const sceneData = buildReconstructionSceneData({ evidenceSources: mockEvidence });

assert(sceneData.status === 'READY', `Adapter status is READY (got ${sceneData.status})`);
assert(sceneData.totalObservations === 30, `Total observations is 30 (got ${sceneData.totalObservations})`);
assert(sceneData.vehicles.length === 3, `Identified 3 vehicle streams (got ${sceneData.vehicles.length})`);

const v1 = sceneData.vehicles.find(v => v.id === 'V1');
const v2 = sceneData.vehicles.find(v => v.id === 'V2');
const v3 = sceneData.vehicles.find(v => v.id === 'V3');

assert(v1 && v1.records.length === 10, `V1 has exactly 10 records (got ${v1?.records.length})`);
assert(v2 && v2.records.length === 10, `V2 has exactly 10 records (got ${v2?.records.length})`);
assert(v3 && v3.records.length === 10, `V3 has exactly 10 records (got ${v3?.records.length})`);

// -------------------------------------------------------------
// TEST 2: Reference Origin Configuration & Provenance
// -------------------------------------------------------------
console.log('\nTEST 2: Reference Origin Configuration & Provenance');
const refOrigin = sceneData.referenceOrigin;

assert(Math.abs(refOrigin.lat - 37.541565) < 1e-6, `Origin lat is 37.541565 (got ${refOrigin.lat})`);
assert(Math.abs(refOrigin.lon - (-77.437165)) < 1e-6, `Origin lon is -77.437165 (got ${refOrigin.lon})`);
assert(refOrigin.originType === 'PROVISIONAL_LOCAL_REFERENCE_ORIGIN', `Origin type is PROVISIONAL_LOCAL_REFERENCE_ORIGIN (got ${refOrigin.originType})`);
assert(refOrigin.isVerifiedCollisionEpicenter === false, `isVerifiedCollisionEpicenter is FALSE (strict forensic requirement)`);
assert(refOrigin.provenance && typeof refOrigin.provenance.basis === 'string', `Provenance attached: "${refOrigin.provenance.basis}"`);

// Test configurable origin
const customSys = computeReferenceOrigin([], {
  customOrigin: { lat: 37.540000, lon: -77.430000, type: 'SURVEY_BENCHMARK', description: 'Survey Monument #42' }
});
assert(customSys.originType === 'SURVEY_BENCHMARK', `Custom origin type properly respected (${customSys.originType})`);
assert(customSys.originLat === 37.540000, `Custom origin lat respected (${customSys.originLat})`);

// -------------------------------------------------------------
// TEST 3: Coordinate Transformation Bijectivity & Known-Distance Benchmarks
// -------------------------------------------------------------
console.log('\nTEST 3: Coordinate Transformation Bijectivity & Benchmarks');
const geoSys = new GeoCoordinateSystem(37.541565, -77.437165);
let maxError = 0;

sceneData.trajectories.V1.forEach(rec => {
  const three = geoSys.toThreeCoords(rec.lat, rec.lon);
  const back = geoSys.toLatLng(three.x, three.y, three.z);
  const dLat = Math.abs(back.lat - rec.lat);
  const dLon = Math.abs(back.lon - rec.lon);
  if (dLat > maxError) maxError = dLat;
  if (dLon > maxError) maxError = dLon;
});
assert(maxError < 1e-9, `Maximum round-trip geodetic coordinate error < 1e-9 degrees (got ${maxError.toExponential(4)})`);

// Explicit forward/inverse alias test
const fwd = geoSys.forward(37.54155, -77.43715);
const inv = geoSys.inverse(fwd.east, fwd.north);
assert(Math.abs(inv.lat - 37.54155) < 1e-9 && Math.abs(inv.lon - (-77.43715)) < 1e-9, `Independent forward/inverse methods are exact`);

// Known-distance East benchmark (100.000m)
const ptEast = geoSys.inverse(100.0, 0);
const distEast = geoSys.distanceMeters(37.541565, -77.437165, ptEast.lat, ptEast.lon);
assert(Math.abs(distEast - 100.0) < 1e-4, `100.000m East benchmark verified (got ${distEast.toFixed(5)}m)`);

// Known-distance North benchmark (100.000m)
const ptNorth = geoSys.inverse(0, 100.0);
const distNorth = geoSys.distanceMeters(37.541565, -77.437165, ptNorth.lat, ptNorth.lon);
assert(Math.abs(distNorth - 100.0) < 1e-4, `100.000m North benchmark verified (got ${distNorth.toFixed(5)}m)`);

// Known-distance Diagonal benchmark (100.000m at 45°: dx = 70.71068m, dz = 70.71068m)
const ptDiag = geoSys.inverse(70.710678, 70.710678);
const distDiag = geoSys.distanceMeters(37.541565, -77.437165, ptDiag.lat, ptDiag.lon);
assert(Math.abs(distDiag - 100.0) < 1e-3, `100.000m Diagonal benchmark verified (got ${distDiag.toFixed(5)}m)`);

// Altitude assumption verification
assert(geoSys.altitudeAssumption.assumedAltitudeMeters === 0, `Assumed altitude is 0.0m`);
assert(geoSys.altitudeAssumption.classification === 'MODEL_ASSUMPTION', `Altitude tagged as MODEL_ASSUMPTION`);
assert(geoSys.altitudeAssumption.isMeasuredAltitude === false, `Altitude explicitly marked as NOT measured`);

// -------------------------------------------------------------
// TEST 4: Motion Model Decoupling & Classification Tags
// -------------------------------------------------------------
console.log('\nTEST 4: Motion Model Decoupling & Classification Tags');
const v1Rec0 = sceneData.trajectories.V1[0];

assert(v1Rec0.observationClassification === 'DIRECT_OBSERVATION', `GPS/Speed classified as DIRECT_OBSERVATION (got ${v1Rec0.observationClassification})`);
assert(v1Rec0.displacementClassification === 'DERIVED_VALUE', `Cumulative displacement classified as DERIVED_VALUE (got ${v1Rec0.displacementClassification})`);
assert(v1Rec0.coordinateClassification === 'DERIVED_VALUE', `Local ENU coordinates classified as DERIVED_VALUE (got ${v1Rec0.coordinateClassification})`);
assert(v1Rec0.headingClassification === 'ESTIMATED_VALUE', `Trajectory heading classified as ESTIMATED_VALUE (got ${v1Rec0.headingClassification})`);
assert(v1Rec0.displacementMethod === 'TRAPEZOIDAL_INTEGRATION_CAN_SPEED', `Displacement method documented as TRAPEZOIDAL_INTEGRATION_CAN_SPEED`);

// -------------------------------------------------------------
// TEST 5: Trapezoidal Distance Integration
// -------------------------------------------------------------
console.log('\nTEST 5: Trapezoidal Distance Integration vs Recorded CAN Speeds');
const v1Final = sceneData.trajectories.V1[9];
const v2Final = sceneData.trajectories.V2[9];
const v3Final = sceneData.trajectories.V3[9];

assert(v1Final.cumulativeDistanceMeters > 50 && v1Final.cumulativeDistanceMeters < 150, `V1 integrated displacement in plausible range (got ${v1Final.cumulativeDistanceMeters}m)`);
assert(v2Final.cumulativeDistanceMeters > 20 && v2Final.cumulativeDistanceMeters < 80, `V2 integrated displacement in plausible range (got ${v2Final.cumulativeDistanceMeters}m)`);
assert(v3Final.cumulativeDistanceMeters > 5 && v3Final.cumulativeDistanceMeters < 30, `V3 integrated displacement in plausible range (got ${v3Final.cumulativeDistanceMeters}m)`);

// -------------------------------------------------------------
// TEST 6: Compass Bearing & Three.js Yaw Conventions
// -------------------------------------------------------------
console.log('\nTEST 6: Compass Bearing & Three.js Yaw Conventions');
const bearingNorth = calculateCompassBearing(0, -10);
const cardinalNorth = getCardinalDirection(bearingNorth);
const yawNorth = calculateThreeYawRotation(0, -10);
assert(bearingNorth === 0, `Pure North bearing is 0° (got ${bearingNorth}°)`);
assert(cardinalNorth === 'N', `Pure North cardinal is 'N' (got '${cardinalNorth}')`);
assert(Math.abs(yawNorth) < 1e-6, `Pure North Three.js yaw is 0 rad (got ${yawNorth})`);

const bearingEast = calculateCompassBearing(10, 0);
const cardinalEast = getCardinalDirection(bearingEast);
const yawEast = calculateThreeYawRotation(10, 0);
assert(bearingEast === 90, `Pure East bearing is 90° (got ${bearingEast}°)`);
assert(cardinalEast === 'E', `Pure East cardinal is 'E' (got '${cardinalEast}')`);
assert(Math.abs(yawEast - Math.PI / 2) < 1e-6, `Pure East Three.js yaw is +PI/2 rad (got ${yawEast})`);

// -------------------------------------------------------------
// TEST 7: GPS Quantization Mathematics (Cell vs Max Radial Error)
// -------------------------------------------------------------
console.log('\nTEST 7: GPS Quantization Mathematics');
const q5 = getCoordinateQuantizationUncertainty(37.54155, -77.43715); // 5 decimals
const q4 = getCoordinateQuantizationUncertainty(37.5402, -77.4361);   // 4 decimals

// 5-decimal checks
assert(q5.latPrecisionDecimals === 5 && q5.lonPrecisionDecimals === 5, `5-decimal precision correctly identified`);
assert(Math.abs(q5.cellDimensionLatMeters - 1.110) < 0.01, `5-decimal cell lat dimension is ~1.110m (got ${q5.cellDimensionLatMeters}m)`);
assert(Math.abs(q5.cellDimensionLonMeters - 0.884) < 0.01, `5-decimal cell lon dimension is ~0.884m (got ${q5.cellDimensionLonMeters}m)`);
assert(Math.abs(q5.cellDiagonalMeters - 1.419) < 0.01, `5-decimal cell diagonal is ~1.419m (got ${q5.cellDiagonalMeters}m)`);
assert(Math.abs(q5.maxRadialQuantizationErrorMeters - 0.710) < 0.01, `5-decimal max radial error is ~0.710m (got ${q5.maxRadialQuantizationErrorMeters}m)`);
assert(q5.maxRadialQuantizationErrorMeters < q5.cellDiagonalMeters, `Radial error is half diagonal (distinguished from cell dimension)`);

// 4-decimal checks
assert(q4.latPrecisionDecimals === 4 && q4.lonPrecisionDecimals === 4, `4-decimal precision correctly identified`);
assert(Math.abs(q4.cellDimensionLatMeters - 11.098) < 0.05, `4-decimal cell lat dimension is ~11.098m (got ${q4.cellDimensionLatMeters}m)`);
assert(Math.abs(q4.cellDimensionLonMeters - 8.838) < 0.05, `4-decimal cell lon dimension is ~8.838m (got ${q4.cellDimensionLonMeters}m)`);
assert(Math.abs(q4.cellDiagonalMeters - 14.188) < 0.05, `4-decimal cell diagonal is ~14.188m (got ${q4.cellDiagonalMeters}m)`);
assert(Math.abs(q4.maxRadialQuantizationErrorMeters - 7.094) < 0.05, `4-decimal max radial error is ~7.094m (got ${q4.maxRadialQuantizationErrorMeters}m)`);

// -------------------------------------------------------------
// TEST 8: GPS Measurement Accuracy Classification
// -------------------------------------------------------------
console.log('\nTEST 8: GPS Measurement Accuracy Provenance');
const gpsUnc = getGpsMeasurementUncertainty('CAN_BUS_LOGGER');

assert(gpsUnc.cepMeters === 2.5, `Illustrative GPS CEP is 2.5m (got ${gpsUnc.cepMeters}m)`);
assert(gpsUnc.isMeasuredAccuracy === false, `isMeasuredAccuracy is strictly FALSE (strict forensic requirement)`);
assert(gpsUnc.classification === 'CONFIGURABLE_ILLUSTRATIVE_ASSUMPTION', `Classified as CONFIGURABLE_ILLUSTRATIVE_ASSUMPTION (got ${gpsUnc.classification})`);
assert(gpsUnc.provenance.includes('no empirical HDOP'), `Provenance explicitly states absence of empirical HDOP`);

// -------------------------------------------------------------
// TEST 9: Reconciled Vehicle Dimensions (MODEL_ASSUMPTION)
// -------------------------------------------------------------
console.log('\nTEST 9: Reconciled Vehicle Dimensions & Bounding Geometry');
const dimV1 = RECONCILED_VEHICLE_DIMENSIONS.V1;
const dimV2 = RECONCILED_VEHICLE_DIMENSIONS.V2;

assert(dimV1.length === 4.69 && dimV1.width === 1.85, `V1 dimensions reconciled to Tesla Model 3 OEM baseline (4.69m x 1.85m)`);
assert(dimV2.length === 5.05 && dimV2.width === 2.00, `V2 dimensions reconciled to Ford Explorer OEM baseline (5.05m x 2.00m)`);
assert(dimV1.classification === 'MODEL_ASSUMPTION', `V1 dimensions classified as MODEL_ASSUMPTION`);
assert(dimV2.classification === 'MODEL_ASSUMPTION', `V2 dimensions classified as MODEL_ASSUMPTION`);

const sphere = evaluateBoundingSphereProximity(
  { x: 1.326, z: 1.665, dimensions: dimV1 },
  { x: -1.326, z: -1.665, dimensions: dimV2 }
);
assert(Math.abs(sphere.radius1 - 2.521) < 0.01, `V1 bounding radius is 2.521m (got ${sphere.radius1}m)`);
assert(Math.abs(sphere.radius2 - 2.716) < 0.01, `V2 bounding radius is 2.716m (got ${sphere.radius2}m)`);
assert(Math.abs(sphere.sumRadii - 5.237) < 0.01, `Sum of radii is 5.237m (got ${sphere.sumRadii}m)`);
assert(sphere.intersects === true, `Bounding spheres intersect nominally (${sphere.centerDistance}m <= ${sphere.sumRadii}m)`);

const v1ImpactPoint = sceneData.trajectories.V1[5];
const v2ImpactPoint = sceneData.trajectories.V2[5];

const obb = evaluateOrientedBoundingBoxContact(
  { ...v1ImpactPoint, dimensions: dimV1 },
  { ...v2ImpactPoint, dimensions: dimV2 },
  { gpsCepMeters: 2.5 }
);
assert(obb.nominalOverlap === false, `OBB SAT check confirms nominal boxes do NOT intersect`);
assert(Math.abs(obb.nominalGapMeters - 0.309) < 0.01, `Nominal OBB gap is ~0.309m (got ${obb.nominalGapMeters}m)`);
assert(obb.isWithinUncertaintyBand === true, `Nominal gap of 0.309m falls within GPS CEP (±2.5m)`);
assert(obb.gpsContactClassification === 'INDETERMINATE', `OBB contact status is strictly INDETERMINATE`);

// -------------------------------------------------------------
// TEST 10: Five Separated Collision Evidence Channels
// -------------------------------------------------------------
console.log('\nTEST 10: Five Separated Collision Evidence Channels');
const col = sceneData.collisionAssessment;

assert(col !== null, `Collision assessment generated`);

// 1. EDR Source Identification Channel
assert(col.edrSourceIdentification.isEdrVerified === true, `Channel 1: EDR source verified for V2`);
assert(col.edrSourceIdentification.v1Source === 'CAN_BUS_LOGGER', `Channel 1: V1 source identified as CAN_BUS_LOGGER`);

// 2. Crash Event Recording Channel
assert(col.crashEventRecording.significantDecel === true, `Channel 2: Significant deceleration logged for both vehicles`);
assert(col.crashEventRecording.forensicCaveat.includes('does NOT conclusively prove physical contact'), `Channel 2: Deceleration decoupled from physical contact proof`);

// 3. Airbag Deployment Evidence Channel
assert(col.airbagDeploymentEvidence.status === 'UNAVAILABLE_IN_TELEMETRY_STREAM', `Channel 3: Airbag deployment flagged as UNAVAILABLE in telemetry`);
assert(col.airbagDeploymentEvidence.deploymentFlagRecorded === false, `Channel 3: Deployment flag recorded is FALSE`);

// 4. Physical Damage Evidence Channel
assert(col.physicalDamageEvidence.status === 'UNAVAILABLE_IN_TELEMETRY_STREAM', `Channel 4: Physical damage flagged as UNAVAILABLE in telemetry`);
assert(col.physicalDamageEvidence.crushProfile === null, `Channel 4: Crush profile is null`);

// 5. Geometric Collision Assessment Channel
assert(col.geometricCollisionAssessment.gpsContactStatus === 'INDETERMINATE', `Channel 5: GPS contact status is INDETERMINATE`);
assert(col.geometricCollisionAssessment.boundingSphere.intersects === true, `Channel 5: Bounding sphere overlap confirmed`);
assert(col.geometricCollisionAssessment.orientedBoundingBox.nominalOverlap === false, `Channel 5: OBB separation confirmed`);

// -------------------------------------------------------------
// TEST 11: Heading Reliability & Low-Speed Indeterminacy
// -------------------------------------------------------------
console.log('\nTEST 11: Heading Reliability & Low-Speed Indeterminacy');
// High speed (80 km/h, 30m displacement): heading is reliable
const highSpeedH = getHeadingUncertainty(80.0, 30.0, 2.5);
assert(highSpeedH.isIndeterminate === false, `High speed heading is determinate`);
assert(highSpeedH.headingUncertaintyDeg <= 10.0, `High speed heading uncertainty <= 10° (got ${highSpeedH.headingUncertaintyDeg}°)`);

// Low speed (3 km/h): heading is indeterminate
const lowSpeedH = getHeadingUncertainty(3.0, 1.0, 2.5);
assert(lowSpeedH.isIndeterminate === true, `Low speed heading (<5 km/h) flagged as indeterminate`);
assert(lowSpeedH.headingUncertaintyDeg === 45.0, `Low speed heading uncertainty clamped to 45°`);

// Standstill vehicle (V3 Row 26-30): clamped, not invented
const v3Last = sceneData.trajectories.V3[9];
assert(v3Last.isHeadingIndeterminate === true, `V3 standstill heading is flagged as indeterminate`);

// -------------------------------------------------------------
// TEST 12: Missing GPS Handling & Zero Fabrication
// -------------------------------------------------------------
console.log('\nTEST 12: Missing GPS Handling & Zero Fabrication');
const mockMissing = buildReconstructionSceneData({
  evidenceSources: [{
    id: 'EVD-TEST',
    fileName: 'test.csv',
    origin: 'Actual Upload',
    format: 'CSV',
    headers: ['timestamp', 'vehicle_id', 'speed_kmh', 'acceleration_mps2', 'latitude', 'longitude', 'brake_status', 'throttle_position_pct', 'data_source'],
    allRows: [['18:42:09.020 UTC', 'V1', '50.0', '0.0', '', '', 'False', '50', 'CAN_BUS']]
  }]
});

const missRec = mockMissing.trajectories.V1[0];
assert(missRec.isGpsMissing === true, `isGpsMissing is TRUE`);
assert(missRec.lat === null && missRec.lon === null, `Preserved null coordinates without fabricating`);
assert(missRec.qualityClassification === 'UNAVAILABLE', `Quality classified as UNAVAILABLE`);

// -------------------------------------------------------------
// TEST 13: Evidence Provenance Across All 30 Records
// -------------------------------------------------------------
console.log('\nTEST 13: Evidence Provenance Across All 30 Records');
let allProvenanced = true;
let rowNumbersCorrect = true;

['V1', 'V2', 'V3'].forEach(vid => {
  const traj = sceneData.trajectories[vid];
  traj.forEach((r, idx) => {
    if (!r.sourceId || !r.sourceFileName || !r.exactTimestamp) allProvenanced = false;
    const expectedRow = vid === 'V1' ? (idx + 1) : (vid === 'V2' ? (idx + 11) : (idx + 21));
    if (r.rowIndex !== expectedRow) rowNumbersCorrect = false;
  });
});

assert(allProvenanced === true, `All 30 records retain sourceId, sourceFileName, and exactTimestamp`);
assert(rowNumbersCorrect === true, `All 30 records retain exact CSV row indices (1-30)`);

// -------------------------------------------------------------
// TEST 14: Empty State Robustness
// -------------------------------------------------------------
console.log('\nTEST 14: Empty State Robustness');
const emptyScene = buildReconstructionSceneData({ evidenceSources: [] });

assert(emptyScene.status === 'EMPTY', `Empty state returns status EMPTY (got ${emptyScene.status})`);
assert(emptyScene.vehicles.length === 0, `Empty state returns 0 vehicles`);
assert(emptyScene.collisionMarkers.length === 0, `Empty state returns 0 collision markers`);

// -------------------------------------------------------------
// TEST 15: Temporal Sampling & Interpolation
// -------------------------------------------------------------
console.log('\nTEST 15: Trajectory Sampling & Piecewise Interpolation');
const v1Traj = sceneData.trajectories.V1;

const exactState = sampleVehicleStateAtTime(v1Traj, 67329.020);
assert(exactState.classification === 'DIRECT_OBSERVATION', `Exact timestamp match returns DIRECT_OBSERVATION`);
assert(exactState.rowIndex === 1, `Exact match retains Row #1`);

const interpState = sampleVehicleStateAtTime(v1Traj, 67329.270);
assert(interpState.classification === 'INTERPOLATED_VALUE', `Midpoint timestamp returns INTERPOLATED_VALUE`);
assert(interpState.boundingRows[0] === 1 && interpState.boundingRows[1] === 2, `Bounding rows identified as [1, 2]`);
assert(Math.abs(interpState.interpolationAlpha - 0.5) < 1e-3, `Interpolation alpha is exactly 0.50`);

console.log('\n========================================================================');
console.log(`TEST SUITE COMPLETE: ${testsPassed} PASSED, ${testsFailed} FAILED`);
console.log('========================================================================\n');

if (testsFailed > 0) {
  process.exit(1);
}
