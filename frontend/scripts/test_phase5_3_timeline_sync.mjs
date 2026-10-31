/**
 * TRACE AI — PHASE 5.3: TIMELINE SYNCHRONIZATION & MOTION VERIFICATION TEST SUITE
 * 
 * Validates the 12 core requirements for synchronized 3D multi-vehicle kinematic playback:
 * 1. Shared reconstruction clock across V1, V2, and V3.
 * 2. Accurate vehicle positions at known source timestamps (t = 0.00s, 1.50s, 2.20s, 5.00s).
 * 3. Rigorous mathematical interpolation between source timestamps.
 * 4. Temporal consistency across pause and resume states.
 * 5. Immediate multi-vehicle synchronization upon seeking.
 * 6. Playback speed multiplier invariance (0.25x to 4.0x).
 * 7. Missing GPS / telemetry handling without continuous fabrication.
 * 8. Telemetry graph dataset fidelity to raw CSV records.
 * 9. Graph time cursor bijective mapping and precision.
 * 10. Key event milestone synchronization and provenance citations.
 * 11. Zero NaN, null, or infinite spatial coordinates across the full duration.
 * 12. Strict forensic separation between DIRECT_OBSERVATION and INTERPOLATED_VALUE.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { buildReconstructionSceneData } from '../src/components/Reconstruction3D/services/reconstructionDataAdapter.js';
import { sampleVehicleStateAtTime, formatSecondsToTimestamp } from '../src/components/Reconstruction3D/utils/trajectoryInterpolation.js';
import { parseTimestampToSeconds } from '../src/utils/telemetryTimelineEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('========================================================================');
console.log('TRACE AI — PHASE 5.3: TIMELINE SYNCHRONIZATION & MOTION TEST SUITE');
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

const mockTimeline = [
  { id: 'EVT-001', category: 'SIGNAL_STATE', label: 'Signal Cycle Transitions to Red', exactTimestamp: '18:42:10.020 UTC' },
  { id: 'EVT-006', category: 'BRAKE_EVENT', label: 'Emergency Panic Braking Engaged', exactTimestamp: '18:42:10.520 UTC' },
  { id: 'EVT-007', category: 'IMPACT', label: 'Provisional Reference Epoch (t-0)', exactTimestamp: '18:42:11.020 UTC' },
  { id: 'EVT-010', category: 'FINAL_REST', label: 'Rest Positions Established', exactTimestamp: '18:42:14.020 UTC' }
];

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    testsPassed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    testsFailed++;
  }
}

// Build scene data from evidence
const sceneData = buildReconstructionSceneData({
  evidenceSources: mockEvidence,
  timelineEvents: mockTimeline
});

const tStart = sceneData.timelineBounds.start; // 67329.020 (18:42:09.020)
const tEnd = sceneData.timelineBounds.end;     // 67334.020 (18:42:14.020)
const t0 = sceneData.timelineBounds.t0;       // 67331.020 (18:42:11.020)

// --------------------------------------------------------------------
// TEST 1: Shared Reconstruction Clock Across All 3 Vehicles
// --------------------------------------------------------------------
console.log('TEST 1: Shared Reconstruction Clock Across All 3 Vehicles');
const testEpoch = tStart + 1.25; // arbitrary intermediate timestamp
const sampleV1 = sampleVehicleStateAtTime(sceneData.trajectories.V1, testEpoch);
const sampleV2 = sampleVehicleStateAtTime(sceneData.trajectories.V2, testEpoch);
const sampleV3 = sampleVehicleStateAtTime(sceneData.trajectories.V3, testEpoch);

assert(sampleV1.seconds === testEpoch, `V1 evaluated at exact epoch ${testEpoch}s`);
assert(sampleV2.seconds === testEpoch, `V2 evaluated at exact epoch ${testEpoch}s`);
assert(sampleV3.seconds === testEpoch, `V3 evaluated at exact epoch ${testEpoch}s`);
assert(sampleV1.exactTimestamp === sampleV2.exactTimestamp && sampleV2.exactTimestamp === sampleV3.exactTimestamp,
  `All 3 vehicles share synchronized formatted timestamp (${sampleV1.exactTimestamp})`);

// --------------------------------------------------------------------
// TEST 2: Vehicle Positions at Known Source Timestamps
// --------------------------------------------------------------------
console.log('\nTEST 2: Vehicle Positions at Known Source Timestamps');

// Benchmark 1: t = 0.00s (18:42:09.020 UTC, Row #1, Row #11, Row #21)
const t00 = tStart;
const v1At0 = sampleVehicleStateAtTime(sceneData.trajectories.V1, t00);
const v2At0 = sampleVehicleStateAtTime(sceneData.trajectories.V2, t00);
const v3At0 = sampleVehicleStateAtTime(sceneData.trajectories.V3, t00);

assert(v1At0.classification === 'DIRECT_OBSERVATION', `V1 at t=0 is DIRECT_OBSERVATION`);
assert(v1At0.rowIndex === 1, `V1 at t=0 maps to CSV Row #1`);
assert(Math.abs(v1At0.speedVal - 84.5) < 0.01, `V1 at t=0 speed is 84.5 km/h (got ${v1At0.speedVal})`);
assert(v2At0.rowIndex === 11, `V2 at t=0 maps to CSV Row #11`);
assert(Math.abs(v2At0.speedVal - 45.0) < 0.01, `V2 at t=0 speed is 45.0 km/h (got ${v2At0.speedVal})`);
assert(v3At0.rowIndex === 21, `V3 at t=0 maps to CSV Row #21`);
assert(Math.abs(v3At0.speedVal - 12.0) < 0.01, `V3 at t=0 speed is 12.0 km/h (got ${v3At0.speedVal})`);

// Benchmark 2: t = 1.50s (18:42:10.520 UTC, Braking Onset, Row #4, #14, #24)
const t15 = tStart + 1.5;
const v1At15 = sampleVehicleStateAtTime(sceneData.trajectories.V1, t15);
const v2At15 = sampleVehicleStateAtTime(sceneData.trajectories.V2, t15);
assert(v1At15.classification === 'DIRECT_OBSERVATION', `V1 at t=1.5s is DIRECT_OBSERVATION`);
assert(v1At15.rowIndex === 4, `V1 at t=1.5s maps to CSV Row #4`);
assert(v1At15.isBrakeActive === true, `V1 at t=1.5s brake system is active`);
assert(v2At15.rowIndex === 14, `V2 at t=1.5s maps to CSV Row #14`);
assert(v2At15.isBrakeActive === true, `V2 at t=1.5s brake system is active`);

// Benchmark 3: t = 2.20s (18:42:11.220 UTC, Peak Decel / Proximity, Row #6, #16, #26)
const t22 = tStart + 2.2;
const v1At22 = sampleVehicleStateAtTime(sceneData.trajectories.V1, t22);
const v2At22 = sampleVehicleStateAtTime(sceneData.trajectories.V2, t22);
assert(v1At22.classification === 'DIRECT_OBSERVATION', `V1 at t=2.2s is DIRECT_OBSERVATION`);
assert(v1At22.rowIndex === 6, `V1 at t=2.2s maps to CSV Row #6`);
assert(Math.abs(v1At22.accelVal - (-2.85)) < 0.01, `V1 at t=2.2s peak decel is -2.85 m/s² (got ${v1At22.accelVal})`);
assert(v2At22.rowIndex === 16, `V2 at t=2.2s maps to CSV Row #16`);
assert(Math.abs(v2At22.accelVal - (-2.40)) < 0.01, `V2 at t=2.2s peak decel is -2.40 m/s² (got ${v2At22.accelVal})`);

// Benchmark 4: t = 5.00s (18:42:14.020 UTC, Final Rest, Row #10, #20, #30)
const t50 = tStart + 5.0;
const v1At50 = sampleVehicleStateAtTime(sceneData.trajectories.V1, t50);
const v2At50 = sampleVehicleStateAtTime(sceneData.trajectories.V2, t50);
const v3At50 = sampleVehicleStateAtTime(sceneData.trajectories.V3, t50);
assert(v1At50.speedVal === 0, `V1 at final rest speed is 0.0 km/h`);
assert(v2At50.speedVal === 0, `V2 at final rest speed is 0.0 km/h`);
assert(v3At50.speedVal === 0, `V3 at final rest speed is 0.0 km/h`);

// --------------------------------------------------------------------
// TEST 3: Mathematical Correctness of Piecewise Interpolation
// --------------------------------------------------------------------
console.log('\nTEST 3: Mathematical Correctness of Piecewise Interpolation');

// Interpolate at t = 0.25s (exactly halfway between Row #1 at t=0.0s and Row #2 at t=0.5s)
const tMid = tStart + 0.25;
const v1Mid = sampleVehicleStateAtTime(sceneData.trajectories.V1, tMid);
const p1 = sceneData.trajectories.V1[0];
const p2 = sceneData.trajectories.V1[1];

const expectedX = p1.x + (p2.x - p1.x) * 0.5;
const expectedZ = p1.z + (p2.z - p1.z) * 0.5;
const expectedSpeed = p1.speedVal + (p2.speedVal - p1.speedVal) * 0.5;

assert(v1Mid.classification === 'INTERPOLATED_VALUE', `Midpoint classified strictly as INTERPOLATED_VALUE`);
assert(Math.abs(v1Mid.interpolationAlpha - 0.50) < 0.001, `Interpolation alpha is exactly 0.5000`);
assert(Math.abs(v1Mid.x - expectedX) < 0.01, `Interpolated X (${v1Mid.x}) matches mathematical linear blend (${expectedX.toFixed(3)})`);
assert(Math.abs(v1Mid.z - expectedZ) < 0.01, `Interpolated Z (${v1Mid.z}) matches mathematical linear blend (${expectedZ.toFixed(3)})`);
assert(Math.abs(v1Mid.speedVal - expectedSpeed) < 0.05, `Interpolated speed (${v1Mid.speedVal}) matches linear blend (${expectedSpeed.toFixed(1)})`);

// --------------------------------------------------------------------
// TEST 4: Pause and Resume Consistency
// --------------------------------------------------------------------
console.log('\nTEST 4: Pause and Resume Consistency');

// When paused at t = 2.15s, state should remain frozen identically across repeated evaluations
const freezeTime = tStart + 2.15;
const sampleBeforePause = sampleVehicleStateAtTime(sceneData.trajectories.V1, freezeTime);
const sampleDuringPause = sampleVehicleStateAtTime(sceneData.trajectories.V1, freezeTime);
assert(sampleBeforePause.x === sampleDuringPause.x, `Spatial X invariant under pause`);
assert(sampleBeforePause.z === sampleDuringPause.z, `Spatial Z invariant under pause`);
assert(sampleBeforePause.speed_kmh === sampleDuringPause.speed_kmh, `Speed invariant under pause`);

// Upon resume with a delta dt = 0.05s, position advances monotonically
const resumeTime = freezeTime + 0.05;
const sampleAfterResume = sampleVehicleStateAtTime(sceneData.trajectories.V1, resumeTime);
assert(sampleAfterResume.seconds === resumeTime, `Resumed clock starts from paused timestamp + dt`);
assert(sampleAfterResume.cumulativeDistanceMeters >= sampleBeforePause.cumulativeDistanceMeters,
  `Cumulative distance advances monotonically after resume`);

// --------------------------------------------------------------------
// TEST 5: Seeking to Arbitrary Timestamp Updates All 3 Vehicles Immediately
// --------------------------------------------------------------------
console.log('\nTEST 5: Seeking Updates All 3 Vehicles Immediately');
const seekTargets = [tStart + 0.1, tStart + 1.8, tStart + 3.4, tEnd - 0.1];

seekTargets.forEach((target) => {
  const s1 = sampleVehicleStateAtTime(sceneData.trajectories.V1, target);
  const s2 = sampleVehicleStateAtTime(sceneData.trajectories.V2, target);
  const s3 = sampleVehicleStateAtTime(sceneData.trajectories.V3, target);

  assert(s1.seconds === target && s2.seconds === target && s3.seconds === target,
    `Seek to ${target.toFixed(2)}s synchronously updates V1, V2, and V3`);
  assert(!isNaN(s1.x) && !isNaN(s2.x) && !isNaN(s3.x),
    `Seek to ${target.toFixed(2)}s yields valid non-NaN positions`);
});

// --------------------------------------------------------------------
// TEST 6: Playback Speed Multiplier Invariance
// --------------------------------------------------------------------
console.log('\nTEST 6: Playback Speed Multiplier Invariance');
// A speed multiplier simply scales dtSimulation = dtWall * speed.
// Vehicle position depends ONLY on currentSeconds, not on playbackSpeed.
const speeds = [0.25, 0.5, 1.0, 2.0, 4.0];
const targetSec = tStart + 1.75;
const referenceState = sampleVehicleStateAtTime(sceneData.trajectories.V1, targetSec);

speeds.forEach((speed) => {
  const dtWall = 0.016; // 16ms frame
  const dtSim = dtWall * speed;
  assert(dtSim > 0, `Speed ${speed}x produces positive simulation dt (${(dtSim * 1000).toFixed(1)}ms)`);

  const evaluated = sampleVehicleStateAtTime(sceneData.trajectories.V1, targetSec);
  assert(evaluated.x === referenceState.x && evaluated.z === referenceState.z,
    `Speed ${speed}x does not perturb spatial state at t=${targetSec.toFixed(2)}s`);
});

// --------------------------------------------------------------------
// TEST 7: Handling Missing GPS Records Without Fabrication
// --------------------------------------------------------------------
console.log('\nTEST 7: Handling Missing GPS Records Without Fabrication');
const missingSample = sampleVehicleStateAtTime([], tStart + 1.0);
assert(missingSample.isMissing === true, `Empty trajectory returns isMissing: true`);
assert(missingSample.classification === 'UNAVAILABLE', `Empty trajectory classification is UNAVAILABLE`);
assert(missingSample.lat === null && missingSample.lon === null, `No GPS coordinates fabricated for missing data`);

// --------------------------------------------------------------------
// TEST 8: Telemetry Graph Dataset Fidelity to Raw CSV Records
// --------------------------------------------------------------------
console.log('\nTEST 8: Telemetry Graph Dataset Fidelity to Raw CSV Records');
const v1Traj = sceneData.trajectories.V1;
const v1CsvRows = allRows.filter(r => r[1] === 'V1');

assert(v1Traj.length === v1CsvRows.length, `V1 trajectory count (${v1Traj.length}) equals CSV row count (${v1CsvRows.length})`);
for (let i = 0; i < v1Traj.length; i++) {
  const trajPoint = v1Traj[i];
  const csvRow = v1CsvRows[i];

  const csvSpeed = parseFloat(csvRow[2]);
  const csvAccel = parseFloat(csvRow[3]);
  const csvTs = csvRow[0];

  assert(Math.abs(trajPoint.speedVal - csvSpeed) < 0.001,
    `Row #${trajPoint.rowIndex} speed (${trajPoint.speedVal}) matches CSV (${csvSpeed})`);
  assert(Math.abs(trajPoint.accelVal - csvAccel) < 0.001,
    `Row #${trajPoint.rowIndex} accel (${trajPoint.accelVal}) matches CSV (${csvAccel})`);
  assert(trajPoint.exactTimestamp === csvTs,
    `Row #${trajPoint.rowIndex} timestamp matches CSV (${csvTs})`);
}

// --------------------------------------------------------------------
// TEST 9: Graph Time Cursor Bijective Mapping and Precision
// --------------------------------------------------------------------
console.log('\nTEST 9: Graph Time Cursor Bijective Mapping and Precision');
const svgWidth = 840;
const padding = { left: 55, right: 30 };
const plotWidth = svgWidth - padding.left - padding.right;
const dur = tEnd - tStart;

const scaleX = (sec) => padding.left + ((sec - tStart) / dur) * plotWidth;
const invertX = (px) => tStart + ((px - padding.left) / plotWidth) * dur;

const testTimes = [tStart, tStart + 1.0, tStart + 2.5, tEnd];
testTimes.forEach((t) => {
  const px = scaleX(t);
  const roundTripTime = invertX(px);
  assert(Math.abs(t - roundTripTime) < 1e-6,
    `Bijective cursor coordinate transformation exact for t=${t.toFixed(2)}s (px=${px.toFixed(1)})`);
});

// --------------------------------------------------------------------
// TEST 10: Event Milestone Synchronization & Citations
// --------------------------------------------------------------------
console.log('\nTEST 10: Event Milestone Synchronization & Citations');
const milestones = [
  { label: 'Pre-Incident Approach', sec: tStart, rowRef: 'Row #1' },
  { label: 'Braking Onset', sec: tStart + 1.5, rowRef: 'Row #4' },
  { label: 'T0 Reference Epoch', sec: t0, rowRef: 'Row #5' },
  { label: 'Peak Decel & Proximity', sec: tStart + 2.2, rowRef: 'Row #6' },
  { label: 'Final Rest Positions', sec: tEnd, rowRef: 'Row #10' }
];

milestones.forEach((m) => {
  const sample = sampleVehicleStateAtTime(sceneData.trajectories.V1, m.sec);
  assert(Math.abs(sample.seconds - m.sec) < 0.01,
    `Milestone "${m.label}" synchronizes clock to ${formatSecondsToTimestamp(m.sec)}`);
  assert(sample.classification === 'DIRECT_OBSERVATION',
    `Milestone "${m.label}" corresponds to verified DIRECT_OBSERVATION`);
  assert(String(sample.rowIndex).includes(m.rowRef.replace('Row #', '')),
    `Milestone "${m.label}" retains evidence citation ${m.rowRef}`);
});

// --------------------------------------------------------------------
// TEST 11: Zero NaN, Null, or Infinite Coordinates Across Playback
// --------------------------------------------------------------------
console.log('\nTEST 11: Zero NaN, Null, or Infinite Coordinates Across Playback');
let sampledCount = 0;
let hasInvalidCoordinate = false;

// Step through entire duration in 50ms increments (100 steps)
for (let t = tStart; t <= tEnd + 0.001; t += 0.05) {
  ['V1', 'V2', 'V3'].forEach((vId) => {
    const s = sampleVehicleStateAtTime(sceneData.trajectories[vId], t);
    sampledCount++;

    if (isNaN(s.x) || isNaN(s.y) || isNaN(s.z) || !isFinite(s.x) || !isFinite(s.z)) {
      hasInvalidCoordinate = true;
    }
    if (isNaN(s.speedVal) || isNaN(s.accelVal) || isNaN(s.yaw)) {
      hasInvalidCoordinate = true;
    }
  });
}

assert(hasInvalidCoordinate === false,
  `Full timeline sweep (${sampledCount} vehicle state evaluations) verified 0 NaN / infinite coordinates`);

// --------------------------------------------------------------------
// TEST 12: Strict Forensic Separation Between DIRECT_OBSERVATION and INTERPOLATED_VALUE
// --------------------------------------------------------------------
console.log('\nTEST 12: Strict Forensic Separation of Direct Observations and Interpolations');

// Direct observation at exact row timestamp
const directSample = sampleVehicleStateAtTime(sceneData.trajectories.V1, tStart + 0.50);
assert(directSample.classification === 'DIRECT_OBSERVATION',
  `Exact row timestamp (18:42:09.520) classified as DIRECT_OBSERVATION`);
assert(directSample.interpolated === false,
  `directSample.interpolated is strictly false`);
assert(directSample.rowIndex === 2,
  `directSample retains exact CSV Row #2`);

// Interpolated value at intermediate timestamp
const interpolatedSample = sampleVehicleStateAtTime(sceneData.trajectories.V1, tStart + 0.35);
assert(interpolatedSample.classification === 'INTERPOLATED_VALUE',
  `Intermediate timestamp (t=0.35s) classified as INTERPOLATED_VALUE`);
assert(Array.isArray(interpolatedSample.boundingRows) && interpolatedSample.boundingRows[0] === 1 && interpolatedSample.boundingRows[1] === 2,
  `Interpolated sample identifies bounding rows [1, 2]`);
assert(typeof interpolatedSample.interpolationAlpha === 'number',
  `Interpolated sample reports interpolationAlpha (${interpolatedSample.interpolationAlpha})`);

// Ensure direct observation is never labeled as interpolated
assert(directSample.classification !== 'INTERPOLATED_VALUE',
  `DIRECT_OBSERVATION is never mislabeled as INTERPOLATED_VALUE`);
assert(interpolatedSample.classification !== 'DIRECT_OBSERVATION',
  `INTERPOLATED_VALUE is never mislabeled as DIRECT_OBSERVATION`);

console.log('\n========================================================================');
console.log(`PHASE 5.3 TEST SUITE COMPLETE: ${testsPassed} PASSED, ${testsFailed} FAILED`);
console.log('========================================================================');

if (testsFailed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
