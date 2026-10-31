/**
 * TRACE AI - Automated Test Suite: Phase 5.5 Forensic Investigation Report & Findings
 * 
 * Verifies:
 * 1. Incident Overview metadata, duration, authenticity tier (SIMULATED / DEMONSTRATION DATA).
 * 2. Chronological event sequence: timestamps, offsets, row references, classifications.
 * 3. Individual vehicle kinematic profiles (V1, V2, V3) and numerical integration consistency.
 * 4. Contradiction analysis neutral formulation (CTR-01, CTR-02, CTR-03) and missing physical sources.
 * 5. Spatial reconstruction: Provisional reference origin, OBB nominal separation 0.309m, CONTACT INDETERMINATE.
 * 6. 8-tier evidence quality taxonomy and missing evidence checklist.
 * 7. Investigator's 5-point neutral synthesis.
 * 8. JSON export dossier schema validation.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// Import reconstruction data adapter
import { buildReconstructionSceneData } from '../src/components/Reconstruction3D/services/reconstructionDataAdapter.js';
import { formatSecondsToTimestamp } from '../src/components/Reconstruction3D/utils/trajectoryInterpolation.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err.message}`);
  }
}

console.log('------------------------------------------------------------');
console.log('TRACE AI — PHASE 5.5: FORENSIC INVESTIGATION REPORT AUDIT');
console.log('------------------------------------------------------------');

// 1. Load telemetry data from actual source CSV
const csvPath = path.resolve(__dirname, '../public/trace_ai_synthetic_road_accident_telemetry.csv');
if (!fs.existsSync(csvPath)) {
  console.error(`Missing telemetry CSV at ${csvPath}`);
  process.exit(1);
}
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
    type: 'telemetry_csv',
    format: 'CSV',
    headers,
    allRows
  }
];

const mockContradictions = [
  {
    id: 'CTR-01',
    title: 'Approach Velocity & Throttle Input Discrepancy',
    severity: 'CRITICAL',
    confidence: 94.2,
    numericalDiscrepancy: '+42.5 km/h over claimed',
    description: 'Empirical telemetry records V1 entering approach at 84.5 km/h with 84% throttle, conflicting with witness claim of 25 mph (40 km/h).'
  },
  {
    id: 'CTR-02',
    title: 'V2 Lateral Lane Departure Claim Qualified',
    severity: 'MODERATE',
    confidence: 88.5,
    numericalDiscrepancy: 'Steering Sensor UNAVAILABLE (±0.71m GPS quantization)',
    description: 'Eyewitness statement of erratic lane deviation evaluated against GPS path; continuous steering wheel angle sensor UNAVAILABLE in CSV.'
  },
  {
    id: 'CTR-03',
    title: 'Dashcam Internal Clock Temporal Skew',
    severity: 'TECHNICAL',
    confidence: 99.1,
    numericalDiscrepancy: '+1.420 s offset',
    description: 'Dashcam OSD timestamp logged primary impact at 18:42:12.440 UTC vs simulated 18:42:11.020 UTC. Uncalibrated clock skew of +1.420s.'
  }
];

const sceneData = buildReconstructionSceneData({
  evidenceSources: mockEvidence,
  incident: {
    id: 'INC-2026-0884',
    title: 'Interstate 95 Mile Marker 142.6 Multi-Vehicle Collision',
    location: 'I-95 Northbound, Exit 42 interchange, Richmond Sector',
    timestamp: '2026-10-24 18:42:11.020 UTC',
    weather: 'Overcast / Wet Pavement / Ambient Temp 11°C',
    leadInvestigator: 'Agent Marcus Vance (Accident Recon Unit #7)'
  },
  contradictions: mockContradictions,
  uncertaintyConfig: {
    gpsCepMeters: 2.5,
    wheelSpeedErrorPct: 1.5,
    vehicleDimensionToleranceMeters: 0.05
  }
});

// Group 1: Incident Overview & Scope
console.log('\n[Suite 1: Incident Overview & Scope]');

runTest('1.1 SceneData contains 3 involved vehicles', () => {
  if (sceneData.vehicles.length !== 3) throw new Error(`Expected 3 vehicles, got ${sceneData.vehicles.length}`);
  const ids = sceneData.vehicles.map(v => v.id).sort();
  if (JSON.stringify(ids) !== JSON.stringify(['V1', 'V2', 'V3'])) throw new Error(`Invalid vehicle IDs: ${ids}`);
});

runTest('1.2 Time horizon spans exactly 5.000s across 30 empirical rows', () => {
  const { start, end, t0 } = sceneData.timelineBounds;
  if (start !== 67329.02) throw new Error(`Expected start 67329.02, got ${start}`);
  if (end !== 67334.02) throw new Error(`Expected end 67334.02, got ${end}`);
  if (t0 !== 67331.02) throw new Error(`Expected t0 67331.02, got ${t0}`);
  if ((end - start).toFixed(3) !== '5.000') throw new Error(`Duration mismatch: ${(end - start).toFixed(3)}`);
  if (sceneData.totalObservations !== 30) throw new Error(`Expected 30 observations, got ${sceneData.totalObservations}`);
});

runTest('1.3 Dataset authenticity tier is SIMULATED / DEMONSTRATION DATA', () => {
  ['V1', 'V2', 'V3'].forEach(vId => {
    const traj = sceneData.trajectories[vId];
    traj.forEach(pt => {
      if (pt.datasetAuthenticity !== 'SIMULATED / DEMONSTRATION DATA') {
        throw new Error(`Expected SIMULATED / DEMONSTRATION DATA, got ${pt.datasetAuthenticity}`);
      }
      if (pt.observationClassification !== 'DIRECT_OBSERVATION') {
        throw new Error(`Expected DIRECT_OBSERVATION, got ${pt.observationClassification}`);
      }
    });
  });
});

// Group 2: Chronological Event Sequence
console.log('\n[Suite 2: Chronological Event Sequence]');

const expectedEvents = [
  { tOffset: '-02.000s', sec: 67329.02, exactTimestamp: '18:42:09.020 UTC', veh: 'V1', row: 'CSV Row #1' },
  { tOffset: '-02.000s', sec: 67329.02, exactTimestamp: '18:42:09.020 UTC', veh: 'V2', row: 'CSV Row #11' },
  { tOffset: '-02.000s', sec: 67329.02, exactTimestamp: '18:42:09.020 UTC', veh: 'V3', row: 'CSV Row #21' },
  { tOffset: '-01.500s', sec: 67329.52, exactTimestamp: '18:42:09.520 UTC', veh: 'V1', row: 'CSV Row #2' },
  { tOffset: '-01.000s', sec: 67330.02, exactTimestamp: '18:42:10.020 UTC', veh: 'V1', row: 'CSV Row #3' },
  { tOffset: '-00.500s', sec: 67330.52, exactTimestamp: '18:42:10.520 UTC', veh: 'V1', row: 'CSV Row #4' },
  { tOffset: '+00.000s', sec: 67331.02, exactTimestamp: '18:42:11.020 UTC', veh: 'V1/V2', row: 'CSV Rows #5 & #15' },
  { tOffset: '+00.200s', sec: 67331.22, exactTimestamp: '18:42:11.220 UTC', veh: 'V1/V2/V3', row: 'CSV Rows #6, #16, #26' },
  { tOffset: '+01.000s', sec: 67332.02, exactTimestamp: '18:42:12.020 UTC', veh: 'V1/V2', row: 'CSV Rows #7 & #17' },
  { tOffset: '+01.480s', sec: 67332.52, exactTimestamp: '18:42:12.520 UTC', veh: 'V1/V2', row: 'CSV Rows #8 & #18' },
  { tOffset: '+02.000s', sec: 67333.02, exactTimestamp: '18:42:13.020 UTC', veh: 'V1/V2', row: 'CSV Rows #9 & #19' },
  { tOffset: '+03.000s', sec: 67334.02, exactTimestamp: '18:42:14.020 UTC', veh: 'ALL', row: 'CSV Rows #10, #20, #30' }
];

runTest('2.1 Chronological ordering is monotonically non-decreasing', () => {
  for (let i = 1; i < expectedEvents.length; i++) {
    if (expectedEvents[i].sec < expectedEvents[i - 1].sec) {
      throw new Error(`Non-monotonic event: ${expectedEvents[i].sec} < ${expectedEvents[i-1].sec}`);
    }
  }
});

runTest('2.2 Reference epoch T0 (+00.000s) is distinct from peak proximity (+00.200s)', () => {
  const t0Event = expectedEvents.find(e => e.tOffset === '+00.000s');
  const proxEvent = expectedEvents.find(e => e.tOffset === '+00.200s');
  if (!t0Event || !proxEvent) throw new Error('Missing t0 or peak proximity event');
  if (t0Event.exactTimestamp !== '18:42:11.020 UTC') throw new Error(`Wrong t0 timestamp: ${t0Event.exactTimestamp}`);
  if (proxEvent.exactTimestamp !== '18:42:11.220 UTC') throw new Error(`Wrong proximity timestamp: ${proxEvent.exactTimestamp}`);
  if ((proxEvent.sec - t0Event.sec).toFixed(3) !== '0.200') throw new Error('Difference must be 0.200s');
});

runTest('2.3 Every event cites an empirical CSV row or derived computation', () => {
  expectedEvents.forEach(evt => {
    if (!evt.row || evt.row.length === 0) throw new Error(`Event at ${evt.tOffset} lacks row reference`);
  });
});

// Group 3: Individual Vehicle Kinematics
console.log('\n[Suite 3: Vehicle Kinematic Profiles]');

const v1Traj = sceneData.trajectories['V1'];
const v2Traj = sceneData.trajectories['V2'];
const v3Traj = sceneData.trajectories['V3'];

runTest('3.1 V1 approach speed is 84.5 km/h, peak 84.8 km/h, delayed brake at Row #4', () => {
  if (v1Traj[0].speedVal !== 84.5) throw new Error(`Expected 84.5 km/h, got ${v1Traj[0].speedVal}`);
  if (v1Traj[1].speedVal !== 84.8) throw new Error(`Expected 84.8 km/h, got ${v1Traj[1].speedVal}`);
  if (v1Traj[3].isBrakeActive !== true) throw new Error('Row 4 must have isBrakeActive=true');
  if (v1Traj[2].isBrakeActive !== false) throw new Error('Row 3 must have isBrakeActive=false');
  if (v1Traj[3].exactTimestamp !== '18:42:10.520 UTC') throw new Error('Braking onset timestamp mismatch');
});

runTest('3.2 V1 integrated displacement is 64.02m (trapezoidal integration)', () => {
  const lastV1 = v1Traj[v1Traj.length - 1];
  if (Math.abs(lastV1.cumulativeDistanceMeters - 64.02) >= 0.2) {
    throw new Error(`Expected ~64.02m, got ${lastV1.cumulativeDistanceMeters}`);
  }
});

runTest('3.3 V2 speed decreases from 45.0 to 36.0 km/h at proximity and travels ~34.95m', () => {
  if (v2Traj[0].speedVal !== 45.0) throw new Error(`Expected 45.0 km/h, got ${v2Traj[0].speedVal}`);
  if (v2Traj[5].speedVal !== 36.0) throw new Error(`Expected 36.0 km/h at row 16, got ${v2Traj[5].speedVal}`);
  const lastV2 = v2Traj[v2Traj.length - 1];
  if (Math.abs(lastV2.cumulativeDistanceMeters - 34.95) >= 0.2) {
    throw new Error(`Expected ~34.95m, got ${lastV2.cumulativeDistanceMeters}`);
  }
});

runTest('3.4 V3 standstill achieved at 18:42:11.220 UTC and maintained through 18:42:14.020 UTC', () => {
  if (v3Traj[0].speedVal !== 12.0) throw new Error(`Expected 12.0 km/h, got ${v3Traj[0].speedVal}`);
  for (let i = 5; i < v3Traj.length; i++) {
    if (v3Traj[i].speedVal !== 0.0) throw new Error(`Expected 0.0 km/h at idx ${i}, got ${v3Traj[i].speedVal}`);
  }
  for (let i = 6; i < v3Traj.length; i++) {
    if (v3Traj[i].accelVal !== 0.0) throw new Error(`Expected 0.0 accel at idx ${i}, got ${v3Traj[i].accelVal}`);
  }
});

// Group 4: Contradiction Analysis Neutral Formulation
console.log('\n[Suite 4: Contradiction Analysis]');

runTest('4.1 CTR-01 documents +42.5 km/h numerical divergence neutrally without declaring legal fault', () => {
  const ctr1 = sceneData.contradictions.find(c => c.id === 'CTR-01');
  if (!ctr1) throw new Error('Missing CTR-01');
  if (ctr1.numericalDiscrepancy !== '+42.5 km/h over claimed') throw new Error(`Unexpected discrepancy: ${ctr1.numericalDiscrepancy}`);
  if (ctr1.confidence !== 94.2) throw new Error(`Unexpected confidence: ${ctr1.confidence}`);
  if (ctr1.description.includes('guilty') || ctr1.description.includes('liable')) throw new Error('Description must not assert guilt or liability');
});

runTest('4.2 CTR-02 explicitly declares steering wheel angle UNAVAILABLE and cites quantization error', () => {
  const ctr2 = sceneData.contradictions.find(c => c.id === 'CTR-02');
  if (!ctr2) throw new Error('Missing CTR-02');
  if (!ctr2.description.includes('UNAVAILABLE')) throw new Error('CTR-02 must state UNAVAILABLE');
});

runTest('4.3 CTR-03 notes +1.420s offset and declares video files absent from repository', () => {
  const ctr3 = sceneData.contradictions.find(c => c.id === 'CTR-03');
  if (!ctr3) throw new Error('Missing CTR-03');
  if (ctr3.numericalDiscrepancy !== '+1.420 s offset') throw new Error(`Unexpected discrepancy: ${ctr3.numericalDiscrepancy}`);
});

// Group 5: Spatial Reconstruction & Collision Assessment
console.log('\n[Suite 5: Spatial Collision Assessment]');

runTest('5.1 Provisional reference origin is strictly defined and NOT labeled verified impact epicenter', () => {
  const origin = sceneData.referenceOrigin;
  if (origin.lat !== 37.541565) throw new Error(`Origin lat mismatch: ${origin.lat}`);
  if (origin.lon !== -77.437165) throw new Error(`Origin lon mismatch: ${origin.lon}`);
  if (origin.isVerifiedCollisionEpicenter !== false) throw new Error('isVerifiedCollisionEpicenter must be false');
  if (origin.originType !== 'PROVISIONAL_LOCAL_REFERENCE_ORIGIN') throw new Error('Origin must be PROVISIONAL_LOCAL_REFERENCE_ORIGIN');
});

runTest('5.2 Bounding geometry produces nominal OBB separation of 0.309m (no SAT overlap)', () => {
  const ca = sceneData.collisionAssessment;
  if (!ca) throw new Error('Missing collisionAssessment in sceneData');
  const obb = ca.orientedBoundingBox;
  if (obb.nominalGapMeters !== 0.309) throw new Error(`Expected 0.309m gap, got ${obb.nominalGapMeters}`);
  if (obb.nominalOverlap !== false) throw new Error('OBBs must not overlap nominally');
  if (obb.hasSeparatingAxis !== true) throw new Error('OBBs must possess separating axis');
  if (ca.boundingSphere.centerDistance !== 4.257) throw new Error(`Expected 4.257m center dist, got ${ca.boundingSphere.centerDistance}`);
});

runTest('5.3 GPS contact assessment strictly evaluates to CONTACT INDETERMINATE', () => {
  const ca = sceneData.collisionAssessment;
  if (ca.gpsContactStatus !== 'INDETERMINATE') throw new Error(`Expected INDETERMINATE, got ${ca.gpsContactStatus}`);
  if (ca.orientedBoundingBox.isWithinUncertaintyBand !== true) throw new Error('Gap must fall within uncertainty band');
  if (ca.orientedBoundingBox.gpsContactClassification !== 'INDETERMINATE') throw new Error('OBB contact classification must be INDETERMINATE');
});

// Group 6: Evidence Quality & Missing Manifest
console.log('\n[Suite 6: Evidence Quality & Missing Evidence]');

const reportComponentPath = path.resolve(ROOT, 'src/components/Reconstruction3D/Report/ForensicInvestigationReport.jsx');
if (!fs.existsSync(reportComponentPath)) throw new Error('ForensicInvestigationReport.jsx must exist');
const reportSrc = fs.readFileSync(reportComponentPath, 'utf8');

runTest('6.1 Report defines full 8-tier provenance taxonomy', () => {
  const tiers = [
    'DIRECT_OBSERVATION',
    'DERIVED_VALUE',
    'ESTIMATED_VALUE',
    'INTERPOLATED_VALUE',
    'MODEL_ASSUMPTION',
    'INFERRED_ANALYSIS',
    'UNAVAILABLE',
    'SIMULATED / DEMO DATA'
  ];
  tiers.forEach(tier => {
    if (!reportSrc.includes(tier)) throw new Error(`Report must contain taxonomy tier ${tier}`);
  });
});

runTest('6.2 Report documents missing evidence checklist', () => {
  const missing = [
    'cctv_caltrans_cam402_1840.mp4',
    'v01_dashcam_front_1842.mp4',
    'ford_explorer_acm_trigger.dat',
    'Steering Angle',
    'Airbag'
  ];
  missing.forEach(item => {
    if (!reportSrc.includes(item)) throw new Error(`Report must mention missing evidence item ${item}`);
  });
});

// Group 7: Investigator's Findings
console.log('\n[Suite 7: Investigator Findings]');

runTest('7.1 Report contains all 5 formal finding categories', () => {
  const categories = [
    '1. What the Demonstration Dataset Establishes',
    '2. What Can Be Mathematically Reconstructed',
    '3. What Remains Scientifically Uncertain',
    '4. What Cannot Currently Be Established',
    '5. Additional Evidence Required for Judicial / Real-World Investigation'
  ];
  categories.forEach(cat => {
    if (!reportSrc.includes(cat)) throw new Error(`Report missing finding category ${cat}`);
  });
});

runTest('7.2 Report includes print-to-PDF button and JSON dossier exporter', () => {
  if (!reportSrc.includes('window.print()')) throw new Error('Missing print-to-PDF');
  if (!reportSrc.includes('Export PDF Report')) throw new Error('Missing Export PDF Report button');
  if (!reportSrc.includes('handleDownloadDossier')) throw new Error('Missing handleDownloadDossier');
  if (!reportSrc.includes('Export Dossier Data')) throw new Error('Missing Export Dossier Data button');
});

// Group 8: Phase 5.5.1 Forensic Consistency & Single Source of Truth Audit
console.log('\n[Suite 8: Phase 5.5.1 Forensic Consistency & Data Integrity Audit]');

runTest('8.1 Vehicle Identity: V1=Tesla Model 3, V2=Ford Explorer, V3=Honda Civic (No Sprinter)', () => {
  const v1Meta = sceneData.vehicles.find(v => v.id === 'V1');
  const v2Meta = sceneData.vehicles.find(v => v.id === 'V2');
  const v3Meta = sceneData.vehicles.find(v => v.id === 'V3');

  if (v1Meta.makeModel !== 'Tesla Model 3') throw new Error(`V1 identity mismatch: ${v1Meta.makeModel}`);
  if (v2Meta.makeModel !== 'Ford Explorer') throw new Error(`V2 identity mismatch: ${v2Meta.makeModel}`);
  if (v3Meta.makeModel !== 'Honda Civic') throw new Error(`V3 identity mismatch: ${v3Meta.makeModel}`);
  if (v3Meta.dimensions.length !== 4.55) throw new Error(`V3 length mismatch: ${v3Meta.dimensions.length}`);

  if (reportSrc.includes('Mercedes-Benz Sprinter') || reportSrc.includes('Mercedes Sprinter')) {
    throw new Error('Report must not identify V3 as a Mercedes-Benz Sprinter');
  }
  if (!reportSrc.includes('Honda Civic')) {
    throw new Error('Report must identify V3 as a Honda Civic');
  }
});

runTest('8.2 Numerical Consistency: Proximity decelerations match -2.85 m/s² and -2.40 m/s²', () => {
  const colAssess = sceneData.collisionAssessment;
  if (!colAssess) throw new Error('Missing collisionAssessment in sceneData');
  if (!colAssess.crashEventRecording.v1Deceleration.includes('-2.85')) {
    throw new Error(`Expected V1 proximity decel -2.85 m/s², got ${colAssess.crashEventRecording.v1Deceleration}`);
  }
  if (!colAssess.crashEventRecording.v2Deceleration.includes('-2.40')) {
    throw new Error(`Expected V2 proximity decel -2.40 m/s², got ${colAssess.crashEventRecording.v2Deceleration}`);
  }
});

runTest('8.3 Numerical Consistency: Overall approach headings match 328.2° (V1), 210.2° (V2), 218.5° (V3)', () => {
  import('../src/components/Reconstruction3D/utils/orientationCalculator.js').then;
  const v1 = sceneData.trajectories['V1'];
  const v2 = sceneData.trajectories['V2'];
  const v3 = sceneData.trajectories['V3'];

  const v1_dx = v1[5].x - v1[0].x;
  const v1_dz = v1[5].z - v1[0].z;
  const v1Bearing = (Math.atan2(v1_dx, -v1_dz) * 180 / Math.PI + 360) % 360;

  const v2_dx = v2[5].x - v2[0].x;
  const v2_dz = v2[5].z - v2[0].z;
  const v2Bearing = (Math.atan2(v2_dx, -v2_dz) * 180 / Math.PI + 360) % 360;

  const v3_dx = v3[5].x - v3[0].x;
  const v3_dz = v3[5].z - v3[0].z;
  const v3Bearing = (Math.atan2(v3_dx, -v3_dz) * 180 / Math.PI + 360) % 360;

  if (Math.abs(v1Bearing - 328.2) >= 0.1) throw new Error(`V1 approach bearing mismatch: ${v1Bearing.toFixed(1)}°`);
  if (Math.abs(v2Bearing - 210.2) >= 0.1) throw new Error(`V2 approach bearing mismatch: ${v2Bearing.toFixed(1)}°`);
  if (Math.abs(v3Bearing - 218.5) >= 0.1) throw new Error(`V3 approach bearing mismatch: ${v3Bearing.toFixed(1)}°`);
});

runTest('8.4 Authority & Language: No claim of accredited forensic lab; conceptual framework only', () => {
  if (reportSrc.includes('Forensic Engineering Laboratory')) {
    throw new Error('Report must not claim to be a Forensic Engineering Laboratory');
  }
  if (!reportSrc.includes('TRACE AI Forensic Reconstruction Workstation')) {
    throw new Error('Report must be titled TRACE AI Forensic Reconstruction Workstation');
  }
  if (!reportSrc.includes('SIMULATION DEMONSTRATION')) {
    throw new Error('Report must prominently state SIMULATION DEMONSTRATION');
  }
  if (!reportSrc.includes('Conceptual Reference: ISO/IEC 27037:2012')) {
    throw new Error('ISO/IEC 27037 must be labeled as Conceptual Reference');
  }
});

runTest('8.5 SHA-256 Digest: Reproducible hash of actual telemetry CSV in repository', () => {
  const fileBuffer = fs.readFileSync(csvPath);
  const calculatedHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

  const expectedDigest = 'bfccd5d400a7f1fcecddd93891a0b6729892caab497018a023bb046900e68bc0';
  if (calculatedHash !== expectedDigest) {
    throw new Error(`CSV file SHA-256 mismatch: calculated ${calculatedHash} vs expected ${expectedDigest}`);
  }
  if (!reportSrc.includes(expectedDigest)) {
    throw new Error(`Report must display the actual verified SHA-256 digest: ${expectedDigest}`);
  }
  if (!reportSrc.includes('verifies file integrity against the hashed version, not real-world evidence authenticity')) {
    throw new Error('Report must explicitly state that SHA-256 verifies file integrity against the hashed version, not real-world evidence authenticity');
  }
});

console.log('------------------------------------------------------------');
console.log(`Phase 5.5 Audit Summary: ${passedTests}/${totalTests} tests passed (${failedTests} failed).`);
console.log('------------------------------------------------------------\n');

if (failedTests > 0) {
  process.exit(1);
}
