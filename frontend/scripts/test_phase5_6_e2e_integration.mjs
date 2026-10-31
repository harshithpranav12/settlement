/**
 * TRACE AI — Phase 5.6 End-to-End Integration & Prototype Stabilization Test Suite
 * 
 * Verifies the complete 13-step forensic reconstruction workflow:
 * 1. Open TRACE AI workstation
 * 2. Select / Create incident
 * 3. Evidence upload & registry
 * 4. Supported evidence processing & schema validation
 * 5. Telemetry conversion to structured observations
 * 6. Deterministic timeline generation
 * 7. 3D spatial reconstruction
 * 8. Synchronized motion playback controller
 * 9. Vehicle & waypoint inspection
 * 10. Multi-vehicle comparison at identical timestamps
 * 11. Contradiction cross-examination engine
 * 12. Link findings to underlying evidence
 * 13. Forensic investigation report & dossier export
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import application engines
import { generateTimelineFromTelemetry, resolveColumnIndices, parseTimestampToSeconds } from '../src/utils/telemetryTimelineEngine.js';
import { detectContradictions } from '../src/utils/contradictionEngine.js';
import { buildReconstructionSceneData } from '../src/components/Reconstruction3D/services/reconstructionDataAdapter.js';
import { INCIDENTS } from '../src/data/mockData.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    failedTests++;
  }
}

console.log('========================================================================');
console.log('TRACE AI — PHASE 5.6: END-TO-END WORKFLOW & INTEGRATION TEST SUITE');
console.log('========================================================================\n');

// -------------------------------------------------------------------------
// SUITE 1: Incident Selection & Creation Data Flow
// -------------------------------------------------------------------------
console.log('[Suite 1: Incident Selection & Creation Flow]');

runTest('1.1 Workstation initializes with primary demonstration incident INC-2026-0884', () => {
  if (!Array.isArray(INCIDENTS) || INCIDENTS.length < 2) {
    throw new Error('INCIDENTS list must contain at least 2 incident records');
  }
  const primary = INCIDENTS.find(i => i.id === 'INC-2026-0884');
  if (!primary) throw new Error('Primary demonstration incident INC-2026-0884 not found');
  if (!primary.title.includes('Interstate 95')) throw new Error('Primary incident title incorrect');
  if (primary.reconstructionConfidence !== 94.2) throw new Error('Primary confidence must be 94.2');
});

runTest('1.2 New incident creation creates valid schema without crashing downstream engines', () => {
  const newInc = {
    id: 'INC-2026-0999',
    title: 'Test Incident Scenario',
    location: 'Test Location',
    timestamp: '2026-10-31 06:00:00 UTC',
    weather: 'Clear',
    leadInvestigator: 'Investigator Test',
    status: 'Active Collection',
    reconstructionConfidence: 0.0,
    forensicLock: false,
    totalVehicles: 0,
    evidenceCount: 0,
    timelineEventsCount: 0,
    contradictionsCount: 0
  };

  const emptyScene = buildReconstructionSceneData({
    evidenceSources: [],
    timelineEvents: [],
    vehicles: [],
    incident: newInc,
    contradictions: []
  });

  if (emptyScene.status !== 'EMPTY') {
    throw new Error(`Expected EMPTY status for incident without telemetry, got ${emptyScene.status}`);
  }
  if (!emptyScene.message.includes('No sensor telemetry')) {
    throw new Error('Empty scene must provide clear guidance to upload telemetry');
  }
});

// -------------------------------------------------------------------------
// SUITE 2: Telemetry Ingestion & Conversion to Structured Observations
// -------------------------------------------------------------------------
console.log('\n[Suite 2: Telemetry Ingestion & Structured Observations]');

const csvPath = path.resolve(__dirname, '../public/trace_ai_synthetic_road_accident_telemetry.csv');
const rawCSV = fs.readFileSync(csvPath, 'utf8');
const csvLines = rawCSV.split(/\r?\n/).filter(l => l.trim().length > 0);
const headers = csvLines[0].split(',').map(h => h.trim());
const dataRows = csvLines.slice(1).map(l => l.split(',').map(c => c.trim()));

runTest('2.1 CSV file physically exists and parses into exactly 30 telemetry rows across 9 channels', () => {
  if (headers.length !== 9) throw new Error(`Expected 9 columns, got ${headers.length}`);
  if (dataRows.length !== 30) throw new Error(`Expected 30 rows, got ${dataRows.length}`);
  const colIdx = resolveColumnIndices(headers);
  if (colIdx.timestamp === -1 || colIdx.speed === -1 || colIdx.latitude === -1) {
    throw new Error('CSV missing critical column indices');
  }
});

const mockEvidence = [
  {
    id: 'EVD-SNS-1162-562',
    name: 'trace_ai_synthetic_road_accident_telemetry.csv',
    fileName: 'trace_ai_synthetic_road_accident_telemetry.csv',
    type: 'telemetry_csv',
    format: 'CSV',
    origin: 'Actual Upload',
    isActualUpload: true,
    headers,
    allRows: dataRows,
    sampleRows: dataRows.slice(0, 10),
    totalRows: dataRows.length
  },
  {
    id: 'EVD-WIT-01',
    witnessName: 'Driver V1',
    title: 'Driver V1 Deposition',
    statementText: 'I was travelling northbound on Market Street around 25 mph (40 km/h).'
  },
  {
    id: 'EVD-WIT-02',
    witnessName: 'Pedestrian Bystander',
    title: 'Eyewitness Statement 02',
    statementText: 'Stated Vehicle 02 swung erratically wide outside its dedicated turn lane before being struck.'
  },
  {
    id: 'EVD-DASH-V01',
    fileName: 'v01_dashcam_front_1842.mp4',
    title: 'Dashcam Video Front',
    details: 'Uncalibrated Dashcam internal clock offset +1.420s'
  }
];

const generatedTimeline = generateTimelineFromTelemetry(mockEvidence);

runTest('2.2 Deterministic timeline engine parses 30 Direct Sensor Observations', () => {
  const dsoList = generatedTimeline.filter(e => e.classification === 'DIRECT_OBSERVATION');
  if (dsoList.length !== 30) throw new Error(`Expected 30 DSOs, got ${dsoList.length}`);
  const v1DSO = dsoList.filter(e => e.vehicleId === 'V1');
  const v2DSO = dsoList.filter(e => e.vehicleId === 'V2');
  const v3DSO = dsoList.filter(e => e.vehicleId === 'V3');
  if (v1DSO.length !== 10 || v2DSO.length !== 10 || v3DSO.length !== 10) {
    throw new Error(`Vehicle DSO partitioning mismatch: V1=${v1DSO.length}, V2=${v2DSO.length}, V3=${v3DSO.length}`);
  }
});

// -------------------------------------------------------------------------
// SUITE 3: 3D Spatial Scene & Synchronized Kinematics
// -------------------------------------------------------------------------
console.log('\n[Suite 3: 3D Spatial Scene & Kinematics]');

const sceneData = buildReconstructionSceneData({
  evidenceSources: mockEvidence,
  timelineEvents: generatedTimeline,
  vehicles: [
    { id: 'V1', makeModel: 'Tesla Model 3' },
    { id: 'V2', makeModel: 'Ford Explorer' },
    { id: 'V3', makeModel: 'Honda Civic' }
  ],
  incident: INCIDENTS[0],
  contradictions: []
});

runTest('3.1 3D scene data generated with GEODETIC_WGS84_ENU mode and 3 vehicle tracks', () => {
  if (sceneData.status !== 'READY') throw new Error(`Expected READY status, got ${sceneData.status}`);
  if (sceneData.mode !== 'GEODETIC_WGS84_ENU') throw new Error(`Expected GEODETIC_WGS84_ENU, got ${sceneData.mode}`);
  if (sceneData.vehicles.length !== 3) throw new Error(`Expected 3 vehicles, got ${sceneData.vehicles.length}`);
  if (sceneData.trajectories.V1.length !== 10) throw new Error(`Expected 10 V1 waypoints, got ${sceneData.trajectories.V1.length}`);
});

runTest('3.2 Provisional reference origin correctly established at midpoint of V1 #6 and V2 #16', () => {
  const origin = sceneData.referenceOrigin;
  if (!origin) throw new Error('Missing reference origin');
  if (Math.abs(origin.lat - 37.541565) > 1e-6) throw new Error(`Origin lat mismatch: ${origin.lat}`);
  if (Math.abs(origin.lon - (-77.437165)) > 1e-6) throw new Error(`Origin lon mismatch: ${origin.lon}`);
  if (origin.isVerifiedCollisionEpicenter !== false) throw new Error('Origin must not claim to be verified epicenter');
});

runTest('3.3 5-Channel bounding geometry confirms nominal OBB gap = 0.309m and CONTACT INDETERMINATE', () => {
  const ca = sceneData.collisionAssessment;
  if (!ca) throw new Error('Missing collision assessment');
  const obb = ca.orientedBoundingBox;
  if (!obb) throw new Error('Missing OBB in collision assessment');
  if (obb.gpsContactClassification !== 'INDETERMINATE') {
    throw new Error(`Expected INDETERMINATE, got ${obb.gpsContactClassification}`);
  }
  if (Math.abs(obb.nominalGapMeters - 0.309) > 0.005) {
    throw new Error(`Expected OBB gap ~0.309m, got ${obb.nominalGapMeters}`);
  }
});

// -------------------------------------------------------------------------
// SUITE 4: Contradiction Cross-Examination Engine
// -------------------------------------------------------------------------
console.log('\n[Suite 4: Contradiction Cross-Examination Engine]');

const detectedContradictions = detectContradictions({
  evidenceSources: mockEvidence,
  timelineEvents: generatedTimeline,
  vehicles: sceneData.vehicles,
  incident: INCIDENTS[0]
});

runTest('4.1 Contradiction engine flags discrepancies with empirical linkages', () => {
  if (!Array.isArray(detectedContradictions) || detectedContradictions.length < 3) {
    throw new Error(`Expected at least 3 contradictions, got ${detectedContradictions.length}`);
  }
  const ctr01 = detectedContradictions.find(c => c.id === 'CTR-01');
  const ctr03 = detectedContradictions.find(c => c.id === 'CTR-03');

  if (!ctr01 || ctr01.severity !== 'CRITICAL') throw new Error('CTR-01 must be CRITICAL');
  if (!ctr03 || ctr03.severity !== 'TECHNICAL') throw new Error('CTR-03 must be TECHNICAL');

  if (!ctr01.evidenceText.includes('84.5 km/h')) throw new Error('CTR-01 must reference 84.5 km/h observed speed');
});

// -------------------------------------------------------------------------
// SUITE 5: Forensic Report Data Integrity & Deliverable Hashing
// -------------------------------------------------------------------------
console.log('\n[Suite 5: Forensic Report & Deliverable Integrity]');

const fileBuffer = fs.readFileSync(csvPath);
const calculatedHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
const expectedHash = 'bfccd5d400a7f1fcecddd93891a0b6729892caab497018a023bb046900e68bc0';

runTest('5.1 Actual telemetry CSV SHA-256 matches certified hash', () => {
  if (calculatedHash !== expectedHash) {
    throw new Error(`Hash mismatch: got ${calculatedHash} vs ${expectedHash}`);
  }
});

const reportPath = path.resolve(__dirname, '../src/components/Reconstruction3D/Report/ForensicInvestigationReport.jsx');
const reportSrc = fs.readFileSync(reportPath, 'utf8');

runTest('5.2 Report explicitly qualifies SHA-256 verifies file integrity against hashed version, not real-world authenticity', () => {
  if (!reportSrc.includes('verifies file integrity against the hashed version, not real-world evidence authenticity')) {
    throw new Error('Report missing required SHA-256 qualification statement');
  }
});

runTest('5.3 Vehicle 03 identity is Honda Civic across all models and reports', () => {
  if (reportSrc.includes('Mercedes-Benz Sprinter')) {
    throw new Error('Report must not contain Mercedes-Benz Sprinter');
  }
  if (!reportSrc.includes('Honda Civic')) {
    throw new Error('Report must contain Honda Civic for Vehicle 03');
  }
});

// -------------------------------------------------------------------------
// SUITE 6: UI Component Integrity & No Dead Buttons
// -------------------------------------------------------------------------
console.log('\n[Suite 6: UI Component Integration & Navigation]');

const topBarPath = path.resolve(__dirname, '../src/components/TopBar/TopBar.jsx');
const topBarSrc = fs.readFileSync(topBarPath, 'utf8');

runTest('6.1 TopBar includes New Incident modal and wired contradiction navigation', () => {
  if (!topBarSrc.includes('onCreateIncident')) throw new Error('TopBar must accept onCreateIncident');
  if (!topBarSrc.includes('onNavigateTab')) throw new Error('TopBar must accept onNavigateTab');
  if (!topBarSrc.includes("onNavigateTab('contradictions')")) throw new Error('TopBar contradiction pill must navigate');
  if (!topBarSrc.includes('New Incident')) throw new Error('TopBar must have New Incident action');
});

const dashboardPath = path.resolve(__dirname, '../src/components/Dashboard/Dashboard.jsx');
const dashboardSrc = fs.readFileSync(dashboardPath, 'utf8');

runTest('6.2 Dashboard includes 7-stage workflow progression ribbon and uncertainty panel', () => {
  if (!dashboardSrc.includes('WORKFLOW_STEPS')) throw new Error('Dashboard must include WORKFLOW_STEPS');
  if (!dashboardSrc.includes('Forensic Reconstruction Uncertainty & Demonstration Scope')) {
    throw new Error('Dashboard must include Forensic Uncertainty panel');
  }
  if (!dashboardSrc.includes("onNavigateTab('reconstruction3d')")) {
    throw new Error('Dashboard must include direct 3D Reconstruction launch button');
  }
});

console.log('------------------------------------------------------------');
console.log(`Phase 5.6 Test Summary: ${passedTests}/${totalTests} tests passed (${failedTests} failed).`);
console.log('------------------------------------------------------------\n');

if (failedTests > 0) {
  process.exit(1);
}
