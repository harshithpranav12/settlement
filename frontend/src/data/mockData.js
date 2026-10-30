/**
 * TRACE AI - Forensic Mock Dataset
 * Realistically modelled fictional accident forensic dataset
 * Complies with strict evidentiary chain-of-custody and multi-modal telemetry standards.
 */

export const INCIDENTS = [
  {
    id: "INC-2026-0884",
    title: "Interstate 95 Mile Marker 142.6 Multi-Vehicle Collision",
    location: "I-95 Northbound, Exit 42 interchange, Richmond Sector",
    timestamp: "2026-10-24 18:42:11.020 UTC",
    weather: "Overcast / Wet Pavement / Ambient Temp 11°C",
    leadInvestigator: "Agent Marcus Vance (Accident Recon Unit #7)",
    status: "Active Reconstruction",
    reconstructionConfidence: 94.2,
    forensicLock: true,
    totalVehicles: 3,
    evidenceCount: 6,
    timelineEventsCount: 16,
    contradictionsCount: 3,
    criticalFinding: "Pre-impact telemetry directly refutes V1 driver assertion regarding signal compliance and approach speed."
  },
  {
    id: "INC-2026-0792",
    title: "Route 4 Westbound Intersection T-Bone Collision",
    location: "State Route 4 & Lexington Ave Junction",
    timestamp: "2026-10-18 22:15:44.800 UTC",
    weather: "Night / Dry Surface / Clear",
    leadInvestigator: "Capt. Eleanor Hayes",
    status: "Contradiction Review",
    reconstructionConfidence: 89.6,
    forensicLock: true,
    totalVehicles: 2,
    evidenceCount: 5,
    timelineEventsCount: 11,
    contradictionsCount: 2,
    criticalFinding: "Dashcam optical flow reveals pedestrian crossing warning was suppressed."
  },
  {
    id: "INC-2026-0615",
    title: "Highway 101 Heavy Freight Rollover & Jackknife",
    location: "US-101 Southbound Grade 6% Descent",
    timestamp: "2026-09-30 06:18:03.150 UTC",
    weather: "Heavy Rain / Standing Water / Low Visibility",
    leadInvestigator: "Senior Insp. Daniel Richter",
    status: "Case Closed / Certified",
    reconstructionConfidence: 98.4,
    forensicLock: true,
    totalVehicles: 4,
    evidenceCount: 12,
    timelineEventsCount: 24,
    contradictionsCount: 4,
    criticalFinding: "Brake line pressure loss verified on trailer axle 2 prior to steering instability."
  }
];

// Realistic accident telemetry headers and multi-vehicle dataset covering V1, V2, and V3
export const SAMPLE_TELEMETRY_HEADERS = [
  'timestamp',
  'vehicle_id',
  'speed_kmh',
  'acceleration_mps2',
  'latitude',
  'longitude',
  'brake_status',
  'throttle_position_pct',
  'data_source'
];

export const SAMPLE_TELEMETRY_ROWS = [
  ['18:42:09.020 UTC', 'V1', '84.5', '0.1', '37.5402', '-77.4361', 'False', '84', 'CAN_BUS_LOGGER'],
  ['18:42:09.520 UTC', 'V1', '84.8', '0.15', '37.5405', '-77.4363', 'False', '84', 'CAN_BUS_LOGGER'],
  ['18:42:10.020 UTC', 'V1', '83.0', '-0.2', '37.5409', '-77.4366', 'False', '76', 'CAN_BUS_LOGGER'],
  ['18:42:10.520 UTC', 'V1', '80.2', '-0.75', '37.5412', '-77.4368', 'True', '0', 'CAN_BUS_LOGGER'],
  ['18:42:11.020 UTC', 'V1', '72.4', '-1.2', '37.5414', '-77.4370', 'True', '0', 'CAN_BUS_LOGGER'],
  ['18:42:11.220 UTC', 'V1', '58.0', '-2.85', '37.54155', '-77.43715', 'True', '0', 'CAN_BUS_LOGGER'],
  ['18:42:12.020 UTC', 'V1', '31.5', '-3.2', '37.5417', '-77.43728', 'True', '0', 'CAN_BUS_LOGGER'],
  ['18:42:12.520 UTC', 'V1', '14.8', '-1.9', '37.5418', '-77.43735', 'True', '0', 'CAN_BUS_LOGGER'],
  ['18:42:13.020 UTC', 'V1', '4.2', '-0.8', '37.54185', '-77.4374', 'True', '0', 'CAN_BUS_LOGGER'],
  ['18:42:14.020 UTC', 'V1', '0.0', '0.0', '37.54188', '-77.43744', 'True', '0', 'CAN_BUS_LOGGER'],
  ['18:42:09.020 UTC', 'V2', '45.0', '0.05', '37.5421', '-77.4368', 'False', '30', 'EDR_INTERNAL'],
  ['18:42:09.520 UTC', 'V2', '45.2', '0.02', '37.54195', '-77.4369', 'False', '30', 'EDR_INTERNAL'],
  ['18:42:10.020 UTC', 'V2', '44.8', '-0.1', '37.5418', '-77.4370', 'False', '28', 'EDR_INTERNAL'],
  ['18:42:10.520 UTC', 'V2', '44.0', '-0.3', '37.5417', '-77.4371', 'True', '0', 'EDR_INTERNAL'],
  ['18:42:11.020 UTC', 'V2', '42.5', '-0.6', '37.54162', '-77.43715', 'True', '0', 'EDR_INTERNAL'],
  ['18:42:11.220 UTC', 'V2', '36.0', '-2.4', '37.54158', '-77.43718', 'True', '0', 'EDR_INTERNAL'],
  ['18:42:12.020 UTC', 'V2', '16.2', '-2.6', '37.54152', '-77.43725', 'True', '0', 'EDR_INTERNAL'],
  ['18:42:12.520 UTC', 'V2', '6.5', '-1.4', '37.54148', '-77.4373', 'True', '0', 'EDR_INTERNAL'],
  ['18:42:13.020 UTC', 'V2', '1.2', '-0.5', '37.54146', '-77.43734', 'True', '0', 'EDR_INTERNAL'],
  ['18:42:14.020 UTC', 'V2', '0.0', '0.0', '37.54145', '-77.43736', 'True', '0', 'EDR_INTERNAL'],
  ['18:42:09.020 UTC', 'V3', '12.0', '0.02', '37.5425', '-77.4365', 'False', '8', 'CAN_BUS_LOGGER'],
  ['18:42:09.520 UTC', 'V3', '12.2', '0.01', '37.5424', '-77.4366', 'False', '8', 'CAN_BUS_LOGGER'],
  ['18:42:10.020 UTC', 'V3', '11.8', '-0.1', '37.5423', '-77.4367', 'False', '6', 'CAN_BUS_LOGGER'],
  ['18:42:10.520 UTC', 'V3', '9.5', '-0.85', '37.5422', '-77.4368', 'True', '0', 'CAN_BUS_LOGGER'],
  ['18:42:11.020 UTC', 'V3', '4.0', '-1.4', '37.54212', '-77.43688', 'True', '0', 'CAN_BUS_LOGGER'],
  ['18:42:11.220 UTC', 'V3', '0.0', '-1.2', '37.54208', '-77.43692', 'True', '0', 'CAN_BUS_LOGGER'],
  ['18:42:12.020 UTC', 'V3', '0.0', '0.0', '37.54208', '-77.43692', 'True', '0', 'CAN_BUS_LOGGER'],
  ['18:42:12.520 UTC', 'V3', '0.0', '0.0', '37.54208', '-77.43692', 'True', '0', 'CAN_BUS_LOGGER'],
  ['18:42:13.020 UTC', 'V3', '0.0', '0.0', '37.54208', '-77.43692', 'True', '0', 'CAN_BUS_LOGGER'],
  ['18:42:14.020 UTC', 'V3', '0.0', '0.0', '37.54208', '-77.43692', 'True', '0', 'CAN_BUS_LOGGER']
];

export const SAMPLE_ACCIDENT_TELEMETRY_CSV = [
  SAMPLE_TELEMETRY_HEADERS.join(','),
  ...SAMPLE_TELEMETRY_ROWS.map((r) => r.join(','))
].join('\n');

export const EVIDENCE_SOURCES = [
  {
    id: "EVD-CCTV-402",
    name: "Caltrans Municipal CCTV #402 (Overhead Mast Camera)",
    title: "Caltrans Municipal CCTV #402 (Overhead Mast Camera)",
    fileName: "cctv_caltrans_cam402_1840.mp4",
    type: "Fixed Optical Surveillance",
    format: "1080p H.264 @ 30.00 fps",
    duration: "00:08:45",
    size: "148.2 MB",
    hashSHA256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    ingestTime: "2026-10-24 19:10:00 UTC",
    dateAdded: "2026-10-24 19:10:00 UTC",
    status: "Awaiting Analysis",
    origin: "Preloaded Demo Evidence",
    syncDriftMs: 0,
    calibrated: true,
    detections: 48,
    details: "Overhead mast mount, 14m elevation. Calibrated focal length 16mm. Unobstructed view of northbound approach lanes 1-3."
  },
  {
    id: "EVD-DASH-V01",
    name: "Vehicle 01 Front Dashcam (In-Cabin Optical Camera)",
    title: "Vehicle 01 Front Dashcam (In-Cabin Optical Camera)",
    fileName: "v01_dashcam_front_1842.mp4",
    type: "In-Cabin Onboard Camera",
    format: "720p MP4 @ 60.00 fps",
    duration: "00:03:12",
    size: "62.4 MB",
    hashSHA256: "8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4",
    ingestTime: "2026-10-24 20:30:15 UTC",
    dateAdded: "2026-10-24 20:30:15 UTC",
    status: "Awaiting Analysis",
    origin: "Preloaded Demo Evidence",
    syncDriftMs: +1420,
    calibrated: true,
    detections: 31,
    details: "Internal windshield camera on Tesla Model 3. Clock drift offset measured at +1.42s against NTP master reference."
  },
  {
    id: "EVD-SNS-1162-562",
    name: "trace_ai_synthetic_road_accident_telemetry.csv",
    title: "trace_ai_synthetic_road_accident_telemetry.csv",
    fileName: "trace_ai_synthetic_road_accident_telemetry.csv",
    type: "Sensor Telemetry",
    format: "CSV Telemetry Log",
    size: "3.2 KB",
    rawSizeBytes: 3240,
    ingestTime: "2026-10-24 20:45:00 UTC",
    dateAdded: "2026-10-24 20:45:00 UTC",
    status: "Awaiting Analysis",
    origin: "Actual Upload",
    source: "Vehicle CAN Bus / EDR Synchronized Stream",
    details: "Synchronized telemetry log containing 30 records across 3 involved vehicles (V1, V2, V3) covering pre-impact approach to final rest.",
    headers: SAMPLE_TELEMETRY_HEADERS,
    totalRows: SAMPLE_TELEMETRY_ROWS.length,
    sampleRows: SAMPLE_TELEMETRY_ROWS.slice(0, 10),
    allRows: SAMPLE_TELEMETRY_ROWS
  },
  {
    id: "EVD-SNS-002",
    name: "ford_explorer_acm_trigger.dat",
    title: "Vehicle 02 Airbag Control Module (EDR Trigger Record)",
    fileName: "ford_explorer_acm_trigger.dat",
    type: "Sensor Telemetry",
    format: "Bosch CDR Hex & CAN Log",
    size: "840 KB",
    rawSizeBytes: 860160,
    ingestTime: "2026-10-25 08:14:22 UTC",
    dateAdded: "2026-10-25 08:14:22 UTC",
    status: "Awaiting Analysis",
    origin: "Simulated Evidence",
    source: "Airbag Control Module Diagnostic Port",
    details: "Crash Data Retrieval capture from 2021 Ford Explorer ACM. Deployment trigger logged at t+0.038s post initial rear-quarter contact.",
    headers: [],
    totalRows: 0,
    sampleRows: [],
    allRows: []
  },
  {
    id: "EVD-WIT-01",
    name: "Driver Statement — Vehicle 01",
    title: "Driver Statement — Vehicle 01",
    witnessName: "Driver — Vehicle 01",
    witnessId: "WIT-001",
    type: "Witness Statement",
    format: "Audio Transcript & Signed Affidavit",
    size: "184 chars",
    ingestTime: "2026-10-24 22:40:00 UTC",
    dateAdded: "2026-10-24 22:40:00 UTC",
    status: "Awaiting Analysis",
    origin: "Preloaded Demo Evidence",
    source: "Field Deposition Form",
    statementText: "I was travelling northbound on Market Street. The signal was yellow as I entered the crosswalk. I was driving under the 45 mph speed limit, around 25 mph (40 km/h). The SUV pulled out right in front of me.",
    locationDetails: "Market & 4th Street Intersection",
    details: "I was travelling northbound on Market Street. The signal was yellow as I entered the crosswalk. I was driving under the 45 mph speed limit, around 25 mph (40 km/h). The SUV pulled out right in front of me."
  },
  {
    id: "EVD-WIT-02",
    name: "Eyewitness Statement — Sidewalk Pedestrian",
    title: "Eyewitness Statement — Sidewalk Pedestrian",
    witnessName: "Marcus Vance (Pedestrian)",
    witnessId: "WIT-002",
    type: "Witness Statement",
    format: "On-Scene Interview Form #104",
    size: "216 chars",
    ingestTime: "2026-10-25 10:15:30 UTC",
    dateAdded: "2026-10-25 10:15:30 UTC",
    status: "Awaiting Analysis",
    origin: "Preloaded Demo Evidence",
    source: "On-Scene Field Interview",
    statementText: "I was standing on the northeast corner waiting to cross. The silver sedan came down the street fast—engine humming loudly. The signal turned red before he reached the limit line, and he slammed on the brakes right before T-boning the blue SUV.",
    locationDetails: "Northeast Pedestrian Corner",
    details: "I was standing on the northeast corner waiting to cross. The silver sedan came down the street fast—engine humming loudly. The signal turned red before he reached the limit line, and he slammed on the brakes right before T-boning the blue SUV."
  }
];

export const DETECTED_VEHICLES = [
  {
    id: "V1",
    tag: "Target Vehicle 1 (V1)",
    makeModel: "2023 Tesla Model 3 (Sedan)",
    color: "Midnight Silver",
    licensePlate: "VA 7XYZ-912",
    classification: "Passenger EV",
    speedAtImpact: "58.0 km/h",
    initialApproachSpeed: "84.5 km/h",
    impactDeltaV: "-38.4 km/h",
    peakDeceleration: "-2.85 g",
    driverClaimSpeed: "40.0 km/h",
    primaryRole: "Struck vehicle in rear-quarter / right front impact",
    status: "CONTRADICTED_PROFILE",
    confidence: 97.8
  },
  {
    id: "V2",
    tag: "Target Vehicle 2 (V2)",
    makeModel: "2021 Ford Explorer (SUV)",
    color: "Deep Navy Blue",
    licensePlate: "MD 4ABC-881",
    classification: "Midsize SUV",
    speedAtImpact: "36.0 km/h",
    initialApproachSpeed: "45.0 km/h",
    impactDeltaV: "-46.1 km/h",
    peakDeceleration: "-2.40 g",
    driverClaimSpeed: "45.0 km/h",
    primaryRole: "Initiated left turn with green arrow indicator",
    status: "TELEMETRY_CONFIRMED",
    confidence: 99.1
  },
  {
    id: "V3",
    tag: "Collateral Vehicle 3 (V3)",
    makeModel: "2020 Mercedes-Benz Sprinter",
    color: "Commercial White",
    licensePlate: "PA 9LMN-304",
    classification: "Cargo Van",
    speedAtImpact: "0.0 km/h (Stationary roll)",
    initialApproachSpeed: "12.0 km/h",
    impactDeltaV: "-12.0 km/h",
    peakDeceleration: "-1.40 g",
    driverClaimSpeed: "0.0 km/h",
    primaryRole: "Secondary deflection impact while awaiting signal",
    status: "VERIFIED_NEUTRAL",
    confidence: 96.5
  }
];

export const TIMELINE_EVENTS = [
  {
    id: "EVT-001",
    timeOffset: "t - 05.000s",
    exactTimestamp: "18:42:06.020",
    label: "Normal Flow & Signal Transition",
    category: "SIGNAL_STATE",
    sourceId: "EVD-CCTV-402",
    sourceName: "CCTV #402",
    verifiedState: "VERIFIED",
    description: "Northbound signal transitions from solid Green to Yellow (4.0s duration). V1 is 114 meters south of stop line traveling at 84.5 km/h.",
    confidence: 98.6,
    tags: ["Signal Phase", "Optical Tracking"]
  },
  {
    id: "EVT-002",
    timeOffset: "t - 03.200s",
    exactTimestamp: "18:42:07.820",
    label: "V2 Protected Left Turn Initiated",
    category: "TRAJECTORY",
    sourceId: "EVD-EDR-V02",
    sourceName: "EDR-V02 + CCTV",
    verifiedState: "VERIFIED",
    description: "Vehicle 02 enters intersection turn pocket at 22 km/h under active green turn arrow. Steering angle set to +18.4 degrees.",
    confidence: 99.0,
    tags: ["Turn Execution", "CAN Bus"]
  },
  {
    id: "EVT-003",
    timeOffset: "t - 01.850s",
    exactTimestamp: "18:42:09.170",
    label: "Driver Claim: 'Began Deceleration'",
    category: "WITNESS_CLAIM",
    sourceId: "EVD-WIT-01",
    sourceName: "Witness Driver V1",
    verifiedState: "CONTRADICTED",
    description: "Driver V1 stated in deposition: 'I saw the amber light and stepped moderately on the brake pedal 50 yards back.'",
    confidence: 22.0,
    tags: ["Subjective Claim", "Deposition"]
  },
  {
    id: "EVT-004",
    timeOffset: "t - 01.500s",
    exactTimestamp: "18:42:09.520",
    label: "Telemetry: 84% Throttle Applied",
    category: "TELEMETRY",
    sourceId: "EVD-EDR-V01",
    sourceName: "V1 OEM Telematics",
    verifiedState: "VERIFIED",
    description: "V1 accelerator pedal position recorded at 84.1%. Engine speed accelerates from 80 km/h to 84.5 km/h attempting to beat signal amber cycle.",
    confidence: 99.4,
    tags: ["Throttle Position", "Sensor Telemetry"]
  },
  {
    id: "EVT-005",
    timeOffset: "t - 01.000s",
    exactTimestamp: "18:42:10.020",
    label: "Signal Cycle Transitions to Red",
    category: "SIGNAL_STATE",
    sourceId: "EVD-CCTV-402",
    sourceName: "CCTV #402 & City Traffic Log",
    verifiedState: "VERIFIED",
    description: "Northbound traffic signal turns solid Red. V1 crosses the pedestrian stop line at 81.2 km/h during Red cycle.",
    confidence: 99.9,
    tags: ["Red Light Violation", "Certified Timer"]
  },
  {
    id: "EVT-006",
    timeOffset: "t - 00.380s",
    exactTimestamp: "18:42:10.640",
    label: "Emergency Panic Braking Engaged",
    category: "BRAKE_EVENT",
    sourceId: "EVD-EDR-V01",
    sourceName: "EDR V01",
    verifiedState: "VERIFIED",
    description: "Brake line hydraulic pressure surges to 128 bar. ABS pulse frequency 28Hz. Deceleration reaches -1.28g. Velocity drops to 71.2 km/h.",
    confidence: 98.7,
    tags: ["ABS Engaged", "Panic Stop"]
  },
  {
    id: "EVT-007",
    timeOffset: "t + 00.000s",
    exactTimestamp: "18:42:11.020",
    label: "PRIMARY IMPACT (t-0)",
    category: "IMPACT",
    sourceId: "EVD-CCTV-402",
    sourceName: "Multi-Sensor Fusion (CCTV + EDR)",
    verifiedState: "CRITICAL_EVENT",
    description: "V1 front-right quarter impacts V2 front-left quarter at 52-degree collision angle. Peak impulse Delta-V = -38.4 km/h (V1) and -46.1 km/h (V2).",
    confidence: 99.8,
    tags: ["Primary Impact", "Structural Deformation"]
  },
  {
    id: "EVT-008",
    timeOffset: "t + 00.038s",
    exactTimestamp: "18:42:11.058",
    label: "Pyrotechnic Airbag Deployment",
    category: "SAFETY_SYSTEMS",
    sourceId: "EVD-EDR-V02",
    sourceName: "Bosch EDR Log V02",
    verifiedState: "VERIFIED",
    description: "Dual-stage steering and curtain airbags deploy on V2. Seatbelt pre-tensioners fire simultaneously.",
    confidence: 100.0,
    tags: ["Airbag Deployment", "Pre-Tensioner"]
  },
  {
    id: "EVT-009",
    timeOffset: "t + 01.120s",
    exactTimestamp: "18:42:12.140",
    label: "Secondary Deflection into V3",
    category: "IMPACT",
    sourceId: "EVD-CCTV-402",
    sourceName: "CCTV #402 & Drone Survey",
    verifiedState: "VERIFIED",
    description: "V2 spins 118 degrees clockwise across lane 3, colliding with stationary Sprinter Van V3 bumper at residual speed 14 km/h.",
    confidence: 97.4,
    tags: ["Secondary Impact", "Vehicle Ricochet"]
  },
  {
    id: "EVT-010",
    timeOffset: "t + 03.450s",
    exactTimestamp: "18:42:14.470",
    label: "Rest Positions Established",
    category: "FINAL_REST",
    sourceId: "EVD-DRONE-99",
    sourceName: "DOT Drone Point Cloud",
    verifiedState: "VERIFIED",
    description: "All vehicles achieve zero velocity. Emergency hazard signals triggered automatically on V1 and V2 via CAN bus crash protocol.",
    confidence: 99.5,
    tags: ["Rest Coordinates", "Crash Scene"]
  }
];

export const CONTRADICTIONS = [
  {
    id: "CTR-01",
    title: "Approach Speed & Braking Onset Contradiction",
    severity: "CRITICAL",
    category: "Telemetry vs Statement",
    confidenceDelta: "98.8% Discrepancy",
    claimParty: "Driver Vehicle 01 (V1)",
    claimText: "Witness stated approaching the intersection at approximately 42 km/h and decelerated smoothly upon seeing yellow signal phase.",
    claimSource: "Deposition Transcript #EVD-WIT-01 (t-01.850s)",
    evidenceText: "Direct CAN bus telemetry and CCTV frame optical flow confirm V1 was traveling at 84.5 km/h with 84% throttle applied. Panic braking was only initiated 0.38 seconds prior to impact at 71.2 km/h.",
    evidenceSource: "V1 OEM Telemetry EDR #EVD-EDR-V01 & CCTV #EVD-CCTV-402",
    impactOnCausation: "Direct Causation: Excessive approach speed and red light violation directly precipitated the intersection collision.",
    status: "CONFIRMED_CONTRADICTION",
    legalAdmissibilityScore: 99.4
  },
  {
    id: "CTR-02",
    title: "V2 Lateral Lane Departure Claim Refuted",
    severity: "MODERATE",
    category: "Trajectory Analysis",
    confidenceDelta: "94.1% Discrepancy",
    claimParty: "Witness Bystander #02",
    claimText: "Stated Vehicle 02 swung erratically wide outside its dedicated turn lane before being struck.",
    claimSource: "Eyewitness Field Form #EVD-WIT-02",
    evidenceText: "Continuous optical tracking across 180 video frames and steering wheel angle sensor from V2 EDR confirms maximum lateral lane variance was under 0.18 meters (well within marked geometry).",
    evidenceSource: "Caltrans CCTV-402 Optical Trajectory & V2 EDR Steering Log",
    impactOnCausation: "Exonerates V2 from contributory negligence regarding turn path execution.",
    status: "DISPROVEN_WITNESS",
    legalAdmissibilityScore: 96.8
  },
  {
    id: "CTR-03",
    title: "Dashcam Internal Clock Temporal Skew",
    severity: "TECHNICAL",
    category: "Timestamp Synchronization",
    confidenceDelta: "+1.420s Clock Drift",
    claimParty: "Dashcam Raw EXIF Metadata",
    claimText: "Dashcam embedded OSD timestamp logged primary impact at 18:42:12.440 UTC.",
    claimSource: "Raw Dashcam File Header #EVD-DASH-V01",
    evidenceText: "NTP-synchronized Caltrans CCTV network and GPS timecode broadcast registers true impact flash at exactly 18:42:11.020 UTC. A consistent 1,420ms forward offset was confirmed and mathematically reconciled.",
    evidenceSource: "NTP Server Synchronization Matrix / Caltrans Frame Counter",
    impactOnCausation: "Reconciles chronological event order across all camera feeds to sub-millisecond precision.",
    status: "RECONCILED",
    legalAdmissibilityScore: 99.9
  }
];

export const TRAJECTORY_DATA = [
  { time: "-5.0s", v1_speed: 84.5, v2_speed: 22.0, v1_accel: 0.1, v2_accel: -0.2, distance_between: 114.2 },
  { time: "-4.0s", v1_speed: 84.2, v2_speed: 24.1, v1_accel: 0.0, v2_accel: 0.1, distance_between: 91.0 },
  { time: "-3.0s", v1_speed: 84.0, v2_speed: 28.5, v1_accel: 0.2, v2_accel: 0.3, distance_between: 68.4 },
  { time: "-2.0s", v1_speed: 84.8, v2_speed: 34.0, v1_accel: 0.3, v2_accel: 0.4, distance_between: 44.8 },
  { time: "-1.5s", v1_speed: 85.1, v2_speed: 38.2, v1_accel: 0.1, v2_accel: 0.2, distance_between: 32.1 },
  { time: "-1.0s", v1_speed: 83.0, v2_speed: 41.5, v1_accel: -0.2, v2_accel: 0.1, distance_between: 20.4 },
  { time: "-0.5s", v1_speed: 78.4, v2_speed: 44.0, v1_accel: -0.8, v2_accel: -0.1, distance_between: 9.6 },
  { time: "-0.2s", v1_speed: 73.1, v2_speed: 44.4, v1_accel: -1.2, v2_accel: -0.3, distance_between: 3.2 },
  { time: "0.0s (Impact)", v1_speed: 71.2, v2_speed: 44.6, v1_accel: -1.28, v2_accel: -1.64, distance_between: 0.0 },
  { time: "+0.5s", v1_speed: 32.8, v2_speed: 18.2, v1_accel: -3.8, v2_accel: -4.2, distance_between: 4.1 },
  { time: "+1.0s", v1_speed: 19.5, v2_speed: 12.0, v1_accel: -2.1, v2_accel: -1.5, distance_between: 8.7 },
  { time: "+2.0s", v1_speed: 6.2, v2_speed: 4.1, v1_accel: -1.0, v2_accel: -0.8, distance_between: 14.2 },
  { time: "+3.5s (Rest)", v1_speed: 0.0, v2_speed: 0.0, v1_accel: 0.0, v2_accel: 0.0, distance_between: 18.5 }
];

export const PROCESSING_PIPELINE = [
  {
    step: 1,
    name: "Multi-Source Hash & Ingestion",
    description: "SHA-256 cryptographic immutability hashing and metadata extraction",
    progress: 100,
    status: "COMPLETE",
    latency: "1.2s",
    itemCount: "7 Sources"
  },
  {
    step: 2,
    name: "Optical Vehicle Tracking (YOLOv11)",
    description: "DeepSORT object bounding boxes, velocity estimation, & pose re-ID",
    progress: 100,
    status: "COMPLETE",
    latency: "14.8s",
    itemCount: "3 Vehicles Identified"
  },
  {
    step: 3,
    name: "Temporal NTP & Drift Alignment",
    description: "Cross-camera acoustic and optical sync matrix adjustment",
    progress: 100,
    status: "COMPLETE",
    latency: "3.4s",
    itemCount: "1.42s Drift Corrected"
  },
  {
    step: 4,
    name: "Contradiction Engine & Physics Validation",
    description: "CAN bus telemetry comparison against eyewitness testimony models",
    progress: 94,
    status: "IN_PROGRESS",
    latency: "Running...",
    itemCount: "3 Contradictions Flagged"
  }
];

export const RECENT_ACTIVITY_LOG = [
  {
    id: "LOG-904",
    timestamp: "18:54:12 UTC",
    user: "System (Reconstruction Engine)",
    action: "Temporal Alignment Calibrated",
    details: "Reconciled EVD-DASH-V01 drift (+1420ms) against Caltrans Master Clock.",
    type: "SYSTEM_SYNC"
  },
  {
    id: "LOG-903",
    timestamp: "18:51:30 UTC",
    user: "Agent M. Vance",
    action: "Evidence Flagged as Contradicted",
    details: "Flagged EVD-WIT-01 statement: 'Braking at 42 km/h' refuted by EDR telematics.",
    type: "USER_FLAG"
  },
  {
    id: "LOG-902",
    timestamp: "18:48:05 UTC",
    user: "System (AI Telemetry Ingest)",
    action: "EDR Airbag Telemetry Extracted",
    details: "Extracted 500Hz CAN bus crash recorder: Peak Decel -1.64g on VEH-02.",
    type: "DATA_INGEST"
  },
  {
    id: "LOG-901",
    timestamp: "18:45:00 UTC",
    user: "Dispatcher K. Gomez",
    action: "Incident Dossier Created",
    details: "Initialized incident file INC-2026-0884 with 7 multi-modal digital evidence units.",
    type: "CASE_INIT"
  }
];
