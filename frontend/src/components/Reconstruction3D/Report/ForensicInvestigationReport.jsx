/**
 * TRACE AI - Forensic Investigation Report & Findings
 * Phase 5.5: Professional, Investigator-Friendly Forensic Report Interface
 * 
 * Complies with strict evidentiary standards:
 * - Dataset authenticity explicitly classified as SIMULATED / DEMONSTRATION DATA.
 * - Decouples direct CSV observation from physical hardware authentication.
 * - Formulates contradictions neutrally without asserting legal fault or liability.
 * - Spatial contact status strictly declared as CONTACT INDETERMINATE.
 * - Formats high-fidelity print styles for professional PDF generation.
 */

import React, { useState, useMemo } from 'react';
import {
  Printer,
  Download,
  FileText,
  ShieldCheck,
  AlertTriangle,
  Scale,
  Lock,
  Car,
  MapPin,
  Activity,
  Gauge,
  Compass,
  CheckCircle2,
  XCircle,
  Info,
  ExternalLink,
  Calendar,
  User,
  Clock,
  Layers,
  FileCode,
  Eye
} from 'lucide-react';

import { buildReconstructionSceneData } from '../services/reconstructionDataAdapter.js';
import { formatSecondsToTimestamp } from '../utils/trajectoryInterpolation.js';
import InvestigationSummarySection from '../../AI/InvestigationSummarySection.jsx';
import { calculateCompassBearing, getCardinalDirection } from '../utils/orientationCalculator.js';

export default function ForensicInvestigationReport({
  incident = null,
  evidenceSources = [],
  timelineEvents = [],
  vehicles = [],
  contradictions = [],
  onNavigateTab
}) {
  const [activeReportSection, setActiveReportSection] = useState('ALL');
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Build full scene data deterministically from actual application records
  const sceneData = useMemo(() => {
    return buildReconstructionSceneData({
      evidenceSources,
      timelineEvents,
      vehicles,
      incident,
      contradictions,
      uncertaintyConfig: {
        gpsCepMeters: 2.5,
        wheelSpeedErrorPct: 1.5,
        vehicleDimensionToleranceMeters: 0.05
      }
    });
  }, [evidenceSources, timelineEvents, vehicles, incident, contradictions]);

  const safeIncident = incident || {
    id: 'INC-2026-0884',
    title: 'Interstate 95 Mile Marker 142.6 Multi-Vehicle Collision',
    location: 'I-95 Northbound, Exit 42 interchange, Richmond Sector',
    timestamp: '2026-10-24 18:42:11.020 UTC',
    weather: 'Overcast / Wet Pavement / Ambient Temp 11°C',
    leadInvestigator: 'Agent Marcus Vance (Accident Recon Unit #7)',
    reconstructionConfidence: 94.2
  };

  // Reproducible SHA-256 digest of the actual source demonstration dataset
  // File: trace_ai_synthetic_road_accident_telemetry.csv
  const certifiedReportHash = 'bfccd5d400a7f1fcecddd93891a0b6729892caab497018a023bb046900e68bc0';
  const reportGenerationDate = new Date().toISOString().split('T')[0];

  // Dynamic vehicle profiles derived directly from authoritative sceneData (Single Source of Truth)
  const vehicleProfiles = useMemo(() => {
    const profiles = {};
    ['V1', 'V2', 'V3'].forEach((vId) => {
      const vMeta = sceneData.vehicles?.find((v) => v.id === vId) || {};
      const waypoints = sceneData.trajectories?.[vId] || [];
      const entryWp = waypoints[0] || {};
      const finalWp = waypoints[waypoints.length - 1] || {};
      
      // Proximity waypoint (at 18:42:11.220 UTC, 67331.220s)
      const proxWp = waypoints.find((w) => Math.abs(w.seconds - 67331.22) < 0.15) || waypoints[5] || {};

      // Overall trajectory vector bearing from entry to proximity
      let approachBearing = null;
      let cardinal = 'N';
      if (entryWp && proxWp && typeof entryWp.x === 'number' && typeof proxWp.x === 'number') {
        const dx = proxWp.x - entryWp.x;
        const dz = proxWp.z - entryWp.z;
        approachBearing = calculateCompassBearing(dx, dz);
        cardinal = getCardinalDirection(approachBearing);
      }

      // Peak overall deceleration (lowest algebraic value) across the whole stream
      let minAccelVal = 0;
      let minAccelWp = null;
      waypoints.forEach((w) => {
        const a = typeof w.accelVal === 'number' ? w.accelVal : parseFloat(w.acceleration_mps2 || 0);
        if (a < minAccelVal) {
          minAccelVal = a;
          minAccelWp = w;
        }
      });

      // Braking onset waypoint (first point where brake active)
      const brakeOnsetWp = waypoints.find((w) => w.isBrakeActive || w.brake_status === 'True');

      profiles[vId] = {
        meta: vMeta,
        entryWp,
        finalWp,
        proxWp,
        approachBearingDeg: approachBearing !== null ? parseFloat(approachBearing.toFixed(1)) : 0,
        approachCardinal: cardinal,
        proximityDecel: typeof proxWp.accelVal === 'number' ? proxWp.accelVal : 0,
        peakOverallDecel: minAccelVal,
        peakOverallWp: minAccelWp,
        brakeOnsetWp,
        integratedDisplacement: finalWp.cumulativeDistanceMeters || vMeta.totalDisplacementMeters || 0
      };
    });
    return profiles;
  }, [sceneData]);

  // Timing bounds and reference epochs
  const t0 = sceneData.timelineBounds?.t0 || 67331.02;
  const startTime = sceneData.timelineBounds?.start || 67329.02;
  const endTime = sceneData.timelineBounds?.end || 67334.02;
  const totalDuration = (endTime - startTime).toFixed(3);

  // Chronological reconstructed events
  const reconstructedEventSequence = useMemo(() => {
    return [
      {
        tOffset: '-02.000s',
        sec: 67329.02,
        exactTimestamp: '18:42:09.020 UTC',
        vehicleId: 'V1',
        label: 'Approach Entry Velocity Logged',
        description: 'V1 enters northern approach at 84.5 km/h with 84% throttle applied and hydraulic brakes released.',
        sourceRecord: 'CSV Row #1 (EVD-SNS-1162-562)',
        classification: 'DIRECT_OBSERVATION',
        badgeColor: 'bg-[#EBF2EE] text-[#527D70] border-[#D0E0D6]'
      },
      {
        tOffset: '-02.000s',
        sec: 67329.02,
        exactTimestamp: '18:42:09.020 UTC',
        vehicleId: 'V2',
        label: 'Turn Pocket Entry',
        description: 'V2 initiates left turn arc at 45.0 km/h with 30% throttle input.',
        sourceRecord: 'CSV Row #11 (EVD-SNS-1162-562)',
        classification: 'DIRECT_OBSERVATION',
        badgeColor: 'bg-[#EBF2EE] text-[#527D70] border-[#D0E0D6]'
      },
      {
        tOffset: '-02.000s',
        sec: 67329.02,
        exactTimestamp: '18:42:09.020 UTC',
        vehicleId: 'V3',
        label: 'Queue Approach Roll',
        description: 'V3 rolls toward stationary queue line at 12.0 km/h.',
        sourceRecord: 'CSV Row #21 (EVD-SNS-1162-562)',
        classification: 'DIRECT_OBSERVATION',
        badgeColor: 'bg-[#EBF2EE] text-[#527D70] border-[#D0E0D6]'
      },
      {
        tOffset: '-01.500s',
        sec: 67329.52,
        exactTimestamp: '18:42:09.520 UTC',
        vehicleId: 'V1',
        label: 'Peak Approach Speed Sustained',
        description: 'V1 sustains maximum approach speed of 84.8 km/h (+0.15 m/s² accel, 84% throttle).',
        sourceRecord: 'CSV Row #2 (EVD-SNS-1162-562)',
        classification: 'DIRECT_OBSERVATION',
        badgeColor: 'bg-[#EBF2EE] text-[#527D70] border-[#D0E0D6]'
      },
      {
        tOffset: '-01.000s',
        sec: 67330.02,
        exactTimestamp: '18:42:10.020 UTC',
        vehicleId: 'V1',
        label: 'Partial Throttle Release',
        description: 'V1 throttle reduced from 84% to 76%; speed drops slightly to 83.0 km/h.',
        sourceRecord: 'CSV Row #3 (EVD-SNS-1162-562)',
        classification: 'DIRECT_OBSERVATION',
        badgeColor: 'bg-[#EBF2EE] text-[#527D70] border-[#D0E0D6]'
      },
      {
        tOffset: '-00.500s',
        sec: 67330.52,
        exactTimestamp: '18:42:10.520 UTC',
        vehicleId: 'V1',
        label: 'Panic Braking Onset (Hydraulic Active)',
        description: 'V1 hydraulic brakes engage (True); throttle drops to 0%; deceleration begins at -0.75 m/s² (speed: 80.2 km/h).',
        sourceRecord: 'CSV Row #4 (EVD-SNS-1162-562)',
        classification: 'DIRECT_OBSERVATION',
        badgeColor: 'bg-[#FAF4EB] text-[#C18A45] border-[#F0DFCA]'
      },
      {
        tOffset: '+00.000s',
        sec: 67331.02,
        exactTimestamp: '18:42:11.020 UTC',
        vehicleId: 'V1/V2',
        label: 'T0 Reference Epoch',
        description: 'Master temporal alignment reference epoch. V1 speed at 72.4 km/h (-1.20 m/s²); V2 speed at 42.5 km/h (-0.60 m/s²).',
        sourceRecord: 'CSV Rows #5 & #15 (EVD-SNS-1162-562)',
        classification: 'DIRECT_OBSERVATION',
        badgeColor: 'bg-[#FBF2F2] text-[#B85C5C] border-[#F1D7D7]'
      },
      {
        tOffset: '+00.200s',
        sec: 67331.22,
        exactTimestamp: '18:42:11.220 UTC',
        vehicleId: 'V1/V2/V3',
        label: 'Peak Proximity Epoch (Inter-Vehicle 4.26m)',
        description: 'Closest geometric approach. V1 at 58.0 km/h (peak decel -2.85 m/s²); V2 at 36.0 km/h (peak decel -2.40 m/s²); V3 full stop (0.0 km/h). OBB nominal gap is 0.309m.',
        sourceRecord: 'CSV Rows #6, #16, #26 (EVD-SNS-1162-562)',
        classification: 'DERIVED_VALUE',
        badgeColor: 'bg-[#EFF4F9] text-[#7189A6] border-[#D6E2EC]'
      },
      {
        tOffset: '+01.000s',
        sec: 67332.02,
        exactTimestamp: '18:42:12.020 UTC',
        vehicleId: 'V1/V2',
        label: 'Post-Proximity Deceleration Roll',
        description: 'V1 rapid speed decline to 31.5 km/h (-3.20 m/s²); V2 decelerates to 16.2 km/h (-2.60 m/s²).',
        sourceRecord: 'CSV Rows #7 & #17 (EVD-SNS-1162-562)',
        classification: 'DIRECT_OBSERVATION',
        badgeColor: 'bg-[#EBF2EE] text-[#527D70] border-[#D0E0D6]'
      },
      {
        tOffset: '+01.480s',
        sec: 67332.52,
        exactTimestamp: '18:42:12.520 UTC',
        vehicleId: 'V1/V2',
        label: 'Secondary Rollout Horizon',
        description: 'V1 speed drops to 14.8 km/h; V2 speed drops to 6.5 km/h.',
        sourceRecord: 'CSV Rows #8 & #18 (EVD-SNS-1162-562)',
        classification: 'DIRECT_OBSERVATION',
        badgeColor: 'bg-[#EBF2EE] text-[#527D70] border-[#D0E0D6]'
      },
      {
        tOffset: '+02.000s',
        sec: 67333.02,
        exactTimestamp: '18:42:13.020 UTC',
        vehicleId: 'V1/V2',
        label: 'Low-Velocity Rollout (< 5 km/h)',
        description: 'V1 at 4.2 km/h; V2 at 1.2 km/h. Heading stabilized along runout vectors.',
        sourceRecord: 'CSV Rows #9 & #19 (EVD-SNS-1162-562)',
        classification: 'DIRECT_OBSERVATION',
        badgeColor: 'bg-[#EBF2EE] text-[#527D70] border-[#D0E0D6]'
      },
      {
        tOffset: '+03.000s',
        sec: 67334.02,
        exactTimestamp: '18:42:14.020 UTC',
        vehicleId: 'ALL',
        label: 'Final Rest State (Zero Ground Velocity)',
        description: 'All 3 vehicles achieve 0.0 km/h ground velocity. Telemetry baseline confirmed.',
        sourceRecord: 'CSV Rows #10, #20, #30 (EVD-SNS-1162-562)',
        classification: 'DIRECT_OBSERVATION',
        badgeColor: 'bg-[#EBF2EE] text-[#527D70] border-[#D0E0D6]'
      }
    ];
  }, []);

  // Print handler leveraging browser native print-to-PDF engine
  const handlePrint = () => {
    window.print();
  };

  // Download complete dossier JSON artifact
  const handleDownloadDossier = () => {
    const reportData = {
      reportRef: 'REP-2026-0884-FR1',
      reportType: 'SYNTHETIC_DEMONSTRATION_REPORT',
      incident: safeIncident,
      authenticityTier: 'SIMULATED / DEMONSTRATION DATA',
      sourceDatasetDigest: certifiedReportHash,
      digestVerificationScope: 'Verifies file integrity against the hashed version, not real-world evidence authenticity',
      sourceFileName: sceneData.sourceFileName || 'trace_ai_synthetic_road_accident_telemetry.csv',
      generationDate: reportGenerationDate,
      timeHorizon: {
        startTime: '18:42:09.020 UTC',
        endTime: '18:42:14.020 UTC',
        durationSec: totalDuration,
        t0Epoch: '18:42:11.020 UTC',
        peakProximityEpoch: '18:42:11.220 UTC'
      },
      spatialReconstruction: {
        mode: sceneData.mode,
        referenceOrigin: sceneData.referenceOrigin,
        collisionAssessment: sceneData.collisionAssessment
      },
      vehicles: sceneData.vehicles,
      vehicleKinematicsProfiles: vehicleProfiles,
      contradictions: sceneData.contradictions,
      eventSequence: reconstructedEventSequence
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Forensic_Investigation_Report_${safeIncident.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-6xl mx-auto font-sans print:p-0 print:m-0 print:max-w-none">
      {/* 1. Interactive Header & Export Controls (Hidden in Print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#D9DEE3] print:hidden">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-xs font-sans font-semibold px-2.5 py-0.5 rounded bg-[#EBF2EE] text-[#527D70] border border-[#D0E0D6]">
              Phase 5.5
            </span>
            <span className="text-xs text-[#697586] font-medium">Forensic Investigation Report & Findings</span>
            <span className="text-xs px-2 py-0.5 rounded bg-[#FAF4EB] text-[#C18A45] border border-[#F0DFCA] font-semibold">
              SIMULATED DATA
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#25364A] tracking-tight">
            Forensic Technical Investigation Report
          </h1>
          <p className="text-xs text-[#697586] leading-relaxed">
            Multi-vehicle kinematic reconstruction, empirical telemetry verification, contradiction analysis, and spatial geometry findings.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2.5 text-xs font-sans">
          <button
            onClick={handleDownloadDossier}
            className="px-3.5 py-2 rounded-md bg-white hover:bg-[#FAFAF8] border border-[#D9DEE3] text-[#25364A] flex items-center gap-2 transition shadow-xs cursor-pointer font-medium"
            title="Download complete structured report data (JSON dossier)"
          >
            <Download className="w-3.5 h-3.5 text-[#697586]" />
            <span>{downloadSuccess ? 'Dossier Downloaded!' : 'Export Dossier Data'}</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-md bg-[#527D70] hover:bg-[#43675C] text-white font-medium flex items-center gap-2 transition shadow-sm cursor-pointer"
            title="Export high-fidelity multi-page PDF via browser print engine"
          >
            <Printer className="w-4 h-4 text-white" />
            <span>Export PDF Report</span>
          </button>
        </div>
      </div>

      {/* 2. Formal Paper Dossier Sheet (Prints as formal document) */}
      <div className="rounded-lg bg-white border border-[#D9DEE3] p-8 lg:p-12 space-y-10 text-[#25364A] shadow-md print:shadow-none print:border-none print:p-0">
        
        {/* ==================================================================== */}
        {/* DOCUMENT HEADER / COVER BANNER                                      */}
        {/* ==================================================================== */}
        <div className="border-b-2 border-[#25364A] pb-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center space-x-2.5">
                <span className="text-xl font-black text-[#25364A] tracking-tight uppercase">
                  TRACE AI Forensic Reconstruction Workstation
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#FAF4EB] text-[#C18A45] border border-[#F0DFCA] font-bold">
                  SIMULATION DEMONSTRATION
                </span>
              </div>
              <div className="text-xs text-[#697586] font-medium">
                Automated Spatial Reconstruction & Telemetry Analysis Engine • Simulated Demonstration Output
              </div>
              <div className="text-xs text-[#475569] font-mono pt-1">
                Report Ref: <strong className="text-[#25364A] font-bold">REP-2026-0884-FR1</strong> • Conceptual Reference: ISO/IEC 27037:2012 Guidelines (Demonstration Mode)
              </div>
            </div>

            <div className="text-left sm:text-right text-xs space-y-1 shrink-0">
              <div className="text-[#697586]">Report Date: <strong className="text-[#25364A] font-mono">{reportGenerationDate}</strong></div>
              <div className="text-[#697586]">Source CSV Digest: <span className="font-mono text-[10px] text-[#527D70]" title="Verifies file integrity against the hashed version, not real-world evidence authenticity">{certifiedReportHash.slice(0, 16)}...</span></div>
              <div className="text-[11px] font-bold text-[#B85C5C] bg-[#FBF2F2] px-2 py-0.5 rounded border border-[#F1D7D7] inline-block">
                GPS Contact: INDETERMINATE
              </div>
            </div>
          </div>

          {/* Mandatory Dataset Authenticity Disclosure Banner */}
          <div className="p-3.5 rounded-lg bg-[#FAF4EB] border border-[#F0DFCA] text-xs space-y-1">
            <div className="flex items-center gap-2 font-bold text-[#C18A45] uppercase tracking-wide text-[11px]">
              <AlertTriangle className="w-4 h-4 shrink-0 text-[#C18A45]" />
              Dataset Authenticity Disclosure: SIMULATED / DEMONSTRATION DATA
            </div>
            <p className="text-[#697586] text-[11px] leading-relaxed">
              This report was generated using a simulated demonstration dataset (<strong className="text-[#25364A]">trace_ai_synthetic_road_accident_telemetry.csv</strong>, SHA-256: <code className="text-[#25364A] font-mono font-bold">{certifiedReportHash}</code>). The SHA-256 cryptographic digest verifies file integrity against the hashed version, not real-world evidence authenticity. Direct observations from this file represent numerical inputs within an illustrative scenario and are <strong>not authenticated real-world crash data retrieval (CDR) hardware pulls</strong> from physical vehicles. TRACE AI is an automated software analysis tool and does not claim accredited forensic laboratory status. Unverified video containers and steering sensor streams are explicitly declared as unavailable.
            </p>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* A. INCIDENT OVERVIEW MATRIX                                         */}
        {/* ==================================================================== */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#25364A] flex items-center gap-2 pb-1 border-b border-[#EDF0F3]">
            <MapPin className="w-4 h-4 text-[#527D70]" />
            A. Incident Overview & Reconstruction Scope
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-lg bg-[#FAFAF8] border border-[#D9DEE3] text-xs">
            <div>
              <div className="text-[10px] text-[#8A96A6] uppercase tracking-wider font-semibold">Incident Identifier</div>
              <div className="text-sm font-bold font-mono text-[#25364A] mt-1">{safeIncident.id}</div>
              <div className="text-[11px] text-[#697586] mt-0.5">{safeIncident.title}</div>
            </div>
            <div>
              <div className="text-[10px] text-[#8A96A6] uppercase tracking-wider font-semibold">Incident Location</div>
              <div className="text-xs font-semibold text-[#25364A] mt-1">{safeIncident.location}</div>
              <div className="text-[10px] text-[#697586] mt-0.5">Weather: {safeIncident.weather}</div>
            </div>
            <div>
              <div className="text-[10px] text-[#8A96A6] uppercase tracking-wider font-semibold">Time Horizon</div>
              <div className="font-mono text-xs font-bold text-[#527D70] mt-1">18:42:09.020 – 18:42:14.020 UTC</div>
              <div className="text-[10px] text-[#697586] mt-0.5">Duration: {totalDuration}s (30 Telemetry Rows)</div>
            </div>
            <div>
              <div className="text-[10px] text-[#8A96A6] uppercase tracking-wider font-semibold">Investigator Persona & Status</div>
              <div className="text-xs font-semibold text-[#25364A] mt-1">{safeIncident.leadInvestigator}</div>
              <div className="text-[10px] text-[#527D70] font-semibold mt-0.5">Status: Automated Synthetic Reconstruction</div>
            </div>
          </div>

          {/* Involved Vehicles Summary Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-1">
            <div className="p-3 rounded bg-white border border-[#D9DEE3] space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#25364A] flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" /> Vehicle 01 (V1)
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#EFF4F9] text-[#7189A6]">Target</span>
              </div>
              <div className="text-[11px] text-[#697586]">{vehicleProfiles.V1?.meta.makeModel || 'Tesla Model 3'} ({vehicleProfiles.V1?.meta.type || 'Electric Sedan'}) • Blue</div>
              <div className="text-[10px] text-[#8A96A6] font-mono">Approach: {vehicleProfiles.V1?.entryWp.speedVal || 84.5} km/h • Panic Brake: 18:42:10.520 UTC</div>
            </div>

            <div className="p-3 rounded bg-white border border-[#D9DEE3] space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#25364A] flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#D97706]" /> Vehicle 02 (V2)
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#FAF4EB] text-[#C18A45]">Target</span>
              </div>
              <div className="text-[11px] text-[#697586]">{vehicleProfiles.V2?.meta.makeModel || 'Ford Explorer'} ({vehicleProfiles.V2?.meta.type || 'Full-Size SUV'}) • Amber</div>
              <div className="text-[10px] text-[#8A96A6] font-mono">Turn Arc: {vehicleProfiles.V2?.entryWp.speedVal || 45.0} km/h • Proximity Decel: {vehicleProfiles.V2?.proximityDecel?.toFixed(2) || '-2.40'} m/s²</div>
            </div>

            <div className="p-3 rounded bg-white border border-[#D9DEE3] space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#25364A] flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#475569]" /> Vehicle 03 (V3)
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#F1F5F9] text-[#64748B]">Non-Involved</span>
              </div>
              <div className="text-[11px] text-[#697586]">{vehicleProfiles.V3?.meta.makeModel || 'Honda Civic'} ({vehicleProfiles.V3?.meta.type || 'Compact Sedan'}) • Slate</div>
              <div className="text-[10px] text-[#8A96A6] font-mono">Queue Approach: {vehicleProfiles.V3?.entryWp.speedVal || 12.0} km/h • Standstill: 18:42:11.220 UTC</div>
            </div>
          </div>
        </section>

        {/* ==================================================================== */}
        {/* B. RECONSTRUCTED EVENT SEQUENCE (CHRONOLOGICAL TIMELINE)            */}
        {/* ==================================================================== */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#25364A] flex items-center gap-2 pb-1 border-b border-[#EDF0F3]">
            <Clock className="w-4 h-4 text-[#527D70]" />
            B. Reconstructed Event Sequence (Chronological Event Timeline)
          </h2>

          <div className="overflow-x-auto rounded-lg border border-[#D9DEE3]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#FAFAF8] border-b border-[#D9DEE3] text-[10px] uppercase font-bold text-[#697586]">
                  <th className="p-2.5 w-16">Offset</th>
                  <th className="p-2.5 w-28">Exact UTC Time</th>
                  <th className="p-2.5 w-16">Veh</th>
                  <th className="p-2.5">Kinematic Event Description</th>
                  <th className="p-2.5 w-40">Source Reference</th>
                  <th className="p-2.5 w-36">Classification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDF0F3] font-sans">
                {reconstructedEventSequence.map((evt, idx) => (
                  <tr key={idx} className="hover:bg-[#F8FAFC] transition">
                    <td className="p-2.5 font-mono text-[11px] font-bold text-[#25364A]">{evt.tOffset}</td>
                    <td className="p-2.5 font-mono text-[11px] text-[#527D70] font-semibold">{evt.exactTimestamp}</td>
                    <td className="p-2.5 font-bold text-[#25364A]">{evt.vehicleId}</td>
                    <td className="p-2.5 leading-snug">
                      <strong className="text-[#25364A] block">{evt.label}</strong>
                      <span className="text-[#697586] text-[11px]">{evt.description}</span>
                    </td>
                    <td className="p-2.5 font-mono text-[10px] text-[#64748B]">{evt.sourceRecord}</td>
                    <td className="p-2.5">
                      <span className={`text-[9px] font-mono px-2 py-0.5 rounded border font-semibold inline-block ${evt.badgeColor}`}>
                        {evt.classification}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ==================================================================== */}
        {/* C. INDIVIDUAL VEHICLE KINEMATIC ANALYSIS                             */}
        {/* ==================================================================== */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#25364A] flex items-center gap-2 pb-1 border-b border-[#EDF0F3]">
            <Gauge className="w-4 h-4 text-[#527D70]" />
            C. Vehicle Kinematic Analysis & Trajectory Dynamics
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Vehicle 1 Profile */}
            <div className="p-4 rounded-lg bg-[#FAFAF8] border border-[#D9DEE3] space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-[#EDF0F3]">
                <span className="font-bold text-[#25364A] text-sm flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#2563EB]" /> Vehicle 01
                </span>
                <span className="text-[10px] font-mono text-[#697586]">{vehicleProfiles.V1?.meta.makeModel || 'Tesla Model 3'}</span>
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[#8A96A6]">OEM Dimensions:</span>
                  <span className="font-mono text-[#25364A] font-medium">
                    {vehicleProfiles.V1?.meta.dimensions?.length || 4.69}m × {vehicleProfiles.V1?.meta.dimensions?.width || 1.85}m × {vehicleProfiles.V1?.meta.dimensions?.height || 1.44}m
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A96A6]">Approach Velocity:</span>
                  <span className="font-mono text-[#25364A] font-bold">
                    {vehicleProfiles.V1?.entryWp.speedVal || 84.5} km/h (Row #{vehicleProfiles.V1?.entryWp.rowIndex || 1})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A96A6]">Peak Velocity:</span>
                  <span className="font-mono text-[#25364A]">84.8 km/h (Row #2)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A96A6]">Braking Onset:</span>
                  <span className="font-mono text-[#B85C5C] font-bold">
                    {vehicleProfiles.V1?.brakeOnsetWp?.exactTimestamp || '18:42:10.520 UTC'} (Row #{vehicleProfiles.V1?.brakeOnsetWp?.rowIndex || 4})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A96A6]">Proximity Deceleration:</span>
                  <span className="font-mono text-[#B85C5C] font-bold">
                    {vehicleProfiles.V1?.proximityDecel?.toFixed(2)} m/s² (-0.29g)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A96A6]">Peak Decel (Overall):</span>
                  <span className="font-mono text-[#B85C5C]">
                    {vehicleProfiles.V1?.peakOverallDecel?.toFixed(2)} m/s² (-0.33g)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A96A6]">Integrated Distance:</span>
                  <span className="font-mono text-[#527D70] font-bold">
                    {vehicleProfiles.V1?.integratedDisplacement?.toFixed(2)}m (DERIVED)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A96A6]">Approach Vector Heading:</span>
                  <span className="font-mono text-[#25364A] font-bold">
                    {vehicleProfiles.V1?.approachBearingDeg}° {vehicleProfiles.V1?.approachCardinal} (ESTIMATED)
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-[#EDF0F3] text-[10px] text-[#697586] leading-snug">
                <strong className="text-[#25364A] block">Observations & Caveats:</strong>
                Approach bearing of 328.2° (NNW) maintained from northern entry. Throttle sustained at 84% until t-1.0s. Emergency braking onset delayed to t-0.5s prior to T0. Deceleration measured -2.85 m/s² at closest proximity (Row #6, 18:42:11.220 UTC), peaking at -3.20 m/s² during secondary rollout (Row #7). Optical flow speed corroboration is unverified because CCTV video is absent.
              </div>
            </div>

            {/* Vehicle 2 Profile */}
            <div className="p-4 rounded-lg bg-[#FAFAF8] border border-[#D9DEE3] space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-[#EDF0F3]">
                <span className="font-bold text-[#25364A] text-sm flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#D97706]" /> Vehicle 02
                </span>
                <span className="text-[10px] font-mono text-[#697586]">{vehicleProfiles.V2?.meta.makeModel || 'Ford Explorer'}</span>
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[#8A96A6]">OEM Dimensions:</span>
                  <span className="font-mono text-[#25364A] font-medium">
                    {vehicleProfiles.V2?.meta.dimensions?.length || 5.05}m × {vehicleProfiles.V2?.meta.dimensions?.width || 2.00}m × {vehicleProfiles.V2?.meta.dimensions?.height || 1.78}m
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A96A6]">Approach Velocity:</span>
                  <span className="font-mono text-[#25364A] font-bold">
                    {vehicleProfiles.V2?.entryWp.speedVal || 45.0} km/h (Row #{vehicleProfiles.V2?.entryWp.rowIndex || 11})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A96A6]">Speed at Proximity:</span>
                  <span className="font-mono text-[#25364A]">
                    {vehicleProfiles.V2?.proxWp.speedVal || 36.0} km/h (Row #{vehicleProfiles.V2?.proxWp.rowIndex || 16})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A96A6]">Braking Onset:</span>
                  <span className="font-mono text-[#B85C5C] font-bold">
                    {vehicleProfiles.V2?.brakeOnsetWp?.exactTimestamp || '18:42:10.520 UTC'} (Row #{vehicleProfiles.V2?.brakeOnsetWp?.rowIndex || 14})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A96A6]">Proximity Deceleration:</span>
                  <span className="font-mono text-[#B85C5C] font-bold">
                    {vehicleProfiles.V2?.proximityDecel?.toFixed(2)} m/s² (-0.24g)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A96A6]">Peak Decel (Overall):</span>
                  <span className="font-mono text-[#B85C5C]">
                    {vehicleProfiles.V2?.peakOverallDecel?.toFixed(2)} m/s² (-0.27g)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A96A6]">Integrated Distance:</span>
                  <span className="font-mono text-[#527D70] font-bold">
                    {vehicleProfiles.V2?.integratedDisplacement?.toFixed(2)}m (DERIVED)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A96A6]">Approach Vector Heading:</span>
                  <span className="font-mono text-[#25364A] font-bold">
                    {vehicleProfiles.V2?.approachBearingDeg}° {vehicleProfiles.V2?.approachCardinal} (ESTIMATED)
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-[#EDF0F3] text-[10px] text-[#697586] leading-snug">
                <strong className="text-[#25364A] block">Observations & Caveats:</strong>
                Approach vector bearing of 210.2° (SSW) transitioning through turn arc. Deceleration reached -2.40 m/s² at closest proximity (Row #16, 18:42:11.220 UTC), peaking at -2.60 m/s² post-proximity (Row #17). Continuous steering wheel angle sensor is UNAVAILABLE in CSV. Lateral lane keeping within 0.18m is an unverified analytical estimate.
              </div>
            </div>

            {/* Vehicle 3 Profile */}
            <div className="p-4 rounded-lg bg-[#FAFAF8] border border-[#D9DEE3] space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-[#EDF0F3]">
                <span className="font-bold text-[#25364A] text-sm flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#475569]" /> Vehicle 03
                </span>
                <span className="text-[10px] font-mono text-[#697586]">{vehicleProfiles.V3?.meta.makeModel || 'Honda Civic'}</span>
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[#8A96A6]">OEM Dimensions:</span>
                  <span className="font-mono text-[#25364A] font-medium">
                    {vehicleProfiles.V3?.meta.dimensions?.length || 4.55}m × {vehicleProfiles.V3?.meta.dimensions?.width || 1.80}m × {vehicleProfiles.V3?.meta.dimensions?.height || 1.41}m
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A96A6]">Approach Velocity:</span>
                  <span className="font-mono text-[#25364A] font-bold">
                    {vehicleProfiles.V3?.entryWp.speedVal || 12.0} km/h (Row #{vehicleProfiles.V3?.entryWp.rowIndex || 21})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A96A6]">Speed at Proximity:</span>
                  <span className="font-mono text-[#527D70] font-bold">
                    {vehicleProfiles.V3?.proxWp.speedVal || 0.0} km/h (Row #{vehicleProfiles.V3?.proxWp.rowIndex || 26})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A96A6]">Braking Onset:</span>
                  <span className="font-mono text-[#B85C5C] font-bold">
                    {vehicleProfiles.V3?.brakeOnsetWp?.exactTimestamp || '18:42:10.520 UTC'} (Row #{vehicleProfiles.V3?.brakeOnsetWp?.rowIndex || 24})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A96A6]">Proximity Decel:</span>
                  <span className="font-mono text-[#25364A]">
                    {vehicleProfiles.V3?.proximityDecel?.toFixed(2)} m/s² (-0.12g)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A96A6]">Peak Decel (Overall):</span>
                  <span className="font-mono text-[#25364A]">
                    {vehicleProfiles.V3?.peakOverallDecel?.toFixed(2)} m/s² (-0.14g)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A96A6]">Integrated Distance:</span>
                  <span className="font-mono text-[#527D70] font-bold">
                    {vehicleProfiles.V3?.integratedDisplacement?.toFixed(2)}m (DERIVED)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A96A6]">Approach Vector Heading:</span>
                  <span className="font-mono text-[#25364A] font-bold">
                    {vehicleProfiles.V3?.approachBearingDeg}° {vehicleProfiles.V3?.approachCardinal} (ESTIMATED)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A96A6]">Standstill Distance:</span>
                  <span className="font-mono text-[#25364A]">61.5m North of Origin</span>
                </div>
              </div>

              <div className="pt-2 border-t border-[#EDF0F3] text-[10px] text-[#697586] leading-snug">
                <strong className="text-[#25364A] block">Observations & Caveats:</strong>
                Complete evasive standstill achieved at 18:42:11.220 UTC prior to any vehicle interaction. Maintained stationary roll buffer through final rest.
              </div>
            </div>
          </div>
        </section>

        {/* ==================================================================== */}
        {/* D. CONTRADICTION ANALYSIS (CTR-01, CTR-02, CTR-03)                   */}
        {/* ==================================================================== */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#25364A] flex items-center gap-2 pb-1 border-b border-[#EDF0F3]">
            <Scale className="w-4 h-4 text-[#B85C5C]" />
            D. Evidentiary Contradiction & Cross-Examination Analysis
          </h2>

          <div className="space-y-3.5">
            {/* CTR-01 */}
            <div className="p-4 rounded-lg border border-[#D9DEE3] bg-[#FAFAF8] space-y-2 text-xs">
              <div className="flex items-center justify-between pb-1 border-b border-[#EDF0F3]">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-[#B85C5C]">CTR-01:</span>
                  <span className="font-bold text-[#25364A]">Approach Velocity & Throttle Input Discrepancy</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#FBF2F2] text-[#B85C5C] border border-[#F1D7D7]">
                  CRITICAL SEVERITY
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="p-2.5 rounded bg-white border border-[#EDF0F3]">
                  <span className="text-[10px] font-bold text-[#C18A45] uppercase tracking-wide block">Testimonial Claim (Driver V1)</span>
                  <p className="text-[#25364A] italic text-[11px] mt-1">
                    "I was travelling northbound on Market Street. The signal was yellow as I entered the crosswalk. I was driving under the 45 mph speed limit, around 25 mph (40 km/h)."
                  </p>
                  <span className="text-[10px] text-[#8A96A6] block mt-1">Source: Deposition Transcript #EVD-WIT-01 [Mock Statement]</span>
                </div>
                <div className="p-2.5 rounded bg-white border border-[#EDF0F3]">
                  <span className="text-[10px] font-bold text-[#527D70] uppercase tracking-wide block">Physical Record (Synthetic CSV)</span>
                  <p className="text-[#25364A] text-[11px] mt-1">
                    Synthetic CSV Row #1 records V1 at <strong>84.5 km/h (52.5 mph)</strong> with <strong>84% throttle applied</strong>. Panic braking was delayed until Row #4 at 18:42:10.520 UTC (80.2 km/h).
                  </p>
                  <span className="text-[10px] text-[#8A96A6] block mt-1">Source: CSV Rows #1–4 (EVD-SNS-1162-562) [DIRECT_OBSERVATION]</span>
                </div>
              </div>
              <div className="text-[10px] text-[#697586] pt-1 leading-snug">
                <strong>Forensic & Legal Caveat:</strong> This contradiction establishes an empirical divergence of +42.5 km/h between statement and data. Optical flow corroboration from CCTV #402 is unverified because the video file is absent. This finding documents numerical inconsistency and does not constitute a judicial ruling on legal liability.
              </div>
            </div>

            {/* CTR-02 */}
            <div className="p-4 rounded-lg border border-[#D9DEE3] bg-[#FAFAF8] space-y-2 text-xs">
              <div className="flex items-center justify-between pb-1 border-b border-[#EDF0F3]">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-[#B85C5C]">CTR-02:</span>
                  <span className="font-bold text-[#25364A]">V2 Lateral Lane Departure Claim Qualified</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#FAF4EB] text-[#C18A45] border border-[#F0DFCA]">
                  MODERATE SEVERITY
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="p-2.5 rounded bg-white border border-[#EDF0F3]">
                  <span className="text-[10px] font-bold text-[#C18A45] uppercase tracking-wide block">Testimonial Claim (Witness 02)</span>
                  <p className="text-[#25364A] italic text-[11px] mt-1">
                    "Stated Vehicle 02 swung erratically wide outside its dedicated turn lane before being struck."
                  </p>
                  <span className="text-[10px] text-[#8A96A6] block mt-1">Source: Eyewitness Field Form #EVD-WIT-02 [Mock Statement]</span>
                </div>
                <div className="p-2.5 rounded bg-white border border-[#EDF0F3]">
                  <span className="text-[10px] font-bold text-[#527D70] uppercase tracking-wide block">Physical Record & Spatial Status</span>
                  <p className="text-[#25364A] text-[11px] mt-1">
                    Continuous steering wheel angle sensor is <strong>UNAVAILABLE</strong> in CSV headers. GPS geodetic coordinates (Rows #11–20) reflect standard left-turn curvature. Sub-0.18m lane tracking is an unverified analytical estimate.
                  </p>
                  <span className="text-[10px] text-[#8A96A6] block mt-1">Source: GPS Waypoints (EVD-SNS-1162-562) [DERIVED_VALUE]</span>
                </div>
              </div>
              <div className="text-[10px] text-[#697586] pt-1 leading-snug">
                <strong>Forensic & Legal Caveat:</strong> Geodetic 5-decimal quantization error at this latitude is ±0.709m. Sub-0.18m lane variance cannot be mathematically asserted without RTK-GPS or LIDAR. This finding notes trajectory adherence to typical turn radii but does not definitively prove exact lane line clearance.
              </div>
            </div>

            {/* CTR-03 */}
            <div className="p-4 rounded-lg border border-[#D9DEE3] bg-[#FAFAF8] space-y-2 text-xs">
              <div className="flex items-center justify-between pb-1 border-b border-[#EDF0F3]">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-[#B85C5C]">CTR-03:</span>
                  <span className="font-bold text-[#25364A]">Dashcam Internal Clock Temporal Skew</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#EFF4F9] text-[#7189A6] border border-[#D6E2EC]">
                  TECHNICAL SEVERITY
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="p-2.5 rounded bg-white border border-[#EDF0F3]">
                  <span className="text-[10px] font-bold text-[#C18A45] uppercase tracking-wide block">Uncalibrated Source (Dashcam OSD)</span>
                  <p className="text-[#25364A] text-[11px] mt-1">
                    Dashcam embedded OSD timestamp logged primary impact at <strong>18:42:12.440 UTC</strong> (+1.420s offset).
                  </p>
                  <span className="text-[10px] text-[#8A96A6] block mt-1">Source: Raw Dashcam File Header #EVD-DASH-V01 [Mock Metadata]</span>
                </div>
                <div className="p-2.5 rounded bg-white border border-[#EDF0F3]">
                  <span className="text-[10px] font-bold text-[#527D70] uppercase tracking-wide block">Reconciliation Reference (CCTV / NTP)</span>
                  <p className="text-[#25364A] text-[11px] mt-1">
                    Simulated impact flash registered at <strong>18:42:11.020 UTC</strong>. A forward offset of +1,420ms was reconciled via inferred calibration.
                  </p>
                  <span className="text-[10px] text-[#8A96A6] block mt-1">Source: Inferred Optical Correlation [INFERRED_ANALYSIS]</span>
                </div>
              </div>
              <div className="text-[10px] text-[#697586] pt-1 leading-snug">
                <strong>Forensic & Legal Caveat:</strong> Both video files are absent from repository; ±50ms represents an illustrative model assumption based on 30/60 fps frame intervals and nominal network jitter. Authenticated UTC synchronization cannot be certified without empirical NTP packet logs.
              </div>
            </div>
          </div>
        </section>

        {/* ==================================================================== */}
        {/* E. SPATIAL RECONSTRUCTION & COLLISION ASSESSMENT                     */}
        {/* ==================================================================== */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#25364A] flex items-center gap-2 pb-1 border-b border-[#EDF0F3]">
            <Compass className="w-4 h-4 text-[#527D70]" />
            E. Spatial Reconstruction & Bounding Geometry Assessment
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            {/* Reference Origin Card */}
            <div className="p-4 rounded-lg bg-[#FAFAF8] border border-[#D9DEE3] space-y-2">
              <div className="font-bold text-[#25364A] flex items-center justify-between">
                <span>Provisional Local Reference Origin</span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white border border-[#D9DEE3]">WGS84 Datum</span>
              </div>
              <div className="font-mono text-xs text-[#527D70] font-bold">
                Origin Latitude: 37.541565° N | Origin Longitude: -77.437165° W
              </div>
              <p className="text-[11px] text-[#697586] leading-snug">
                The reference origin was established as the metric midpoint of V1 Row #6 (37.54155°, -77.43715°) and V2 Row #16 (37.54158°, -77.43718°) at 18:42:11.220 UTC. <strong>It is classified strictly as a provisional spatial coordinate frame origin, not as a verified physical collision contact point.</strong>
              </p>
              <div className="text-[10px] text-[#8A96A6] font-mono pt-1">
                Altitude: 0.0m (Planar Model Assumption) • isVerifiedCollisionEpicenter: FALSE
              </div>
            </div>

            {/* Bounding Geometry & Contact Status Card */}
            <div className="p-4 rounded-lg bg-[#FBF2F2]/60 border border-[#F1D7D7] space-y-2">
              <div className="font-bold text-[#B85C5C] flex items-center justify-between">
                <span>5-Channel Bounding Geometry Status</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white text-[#B85C5C] border border-[#F1D7D7]">
                  CONTACT INDETERMINATE
                </span>
              </div>
              <div className="space-y-1 text-[11px] text-[#25364A]">
                <div>• Bounding Spheres: <strong className="text-[#527D70]">Intersect Nominally</strong> (Center distance 4.257m ≤ Sum of Radii 5.237m)</div>
                <div>• Oriented Bounding Boxes (OBB SAT): <strong className="text-[#B85C5C]">Nominal Gap = 0.309m</strong> (Zero polygon overlap)</div>
                <div>• Geodetic Quantization Error: <strong className="text-[#C18A45]">±0.709m max radial</strong> (5-decimal grid cell)</div>
                <div>• Illustrative Receiver Accuracy: <strong className="text-[#64748B]">±2.50m (Configured CEP95)</strong></div>
              </div>
              <p className="text-[10px] text-[#697586] leading-tight pt-1">
                Because the nominal OBB gap of 0.309m falls well within the ±2.5m GPS uncertainty envelope and ±0.71m quantization limit, <strong>physical vehicular contact cannot be scientifically proven or disproven from GPS and CAN telemetry alone.</strong>
              </p>
            </div>
          </div>
        </section>

        {/* ==================================================================== */}
        {/* F. EVIDENCE QUALITY, TAXONOMY & DEFICIENCY MANIFEST                 */}
        {/* ==================================================================== */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#25364A] flex items-center gap-2 pb-1 border-b border-[#EDF0F3]">
            <ShieldCheck className="w-4 h-4 text-[#527D70]" />
            F. Evidence Quality, Provenance Taxonomy & Deficiency Manifest
          </h2>

          {/* 8-Tier Provenance Taxonomy Table */}
          <div className="overflow-x-auto rounded-lg border border-[#D9DEE3]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#FAFAF8] border-b border-[#D9DEE3] text-[10px] uppercase font-bold text-[#697586]">
                  <th className="p-2.5 w-44">Taxonomy Classification</th>
                  <th className="p-2.5 w-60">Applied Channel / Variable</th>
                  <th className="p-2.5">Scientific Definition & Evidentiary Standard</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDF0F3] text-[11px]">
                <tr>
                  <td className="p-2.5 font-bold font-mono text-[#527D70]">DIRECT_OBSERVATION</td>
                  <td className="p-2.5 font-mono text-[#25364A]">Speed, Accel, Throttle, Brake</td>
                  <td className="p-2.5 text-[#697586]">Uninterpolated numerical value parsed directly from CSV row (Note: In this case, originating from a synthetic test stream).</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold font-mono text-[#7189A6]">DERIVED_VALUE</td>
                  <td className="p-2.5 font-mono text-[#25364A]">Local ENU (X, Z), Displacement</td>
                  <td className="p-2.5 text-[#697586]">Calculated directly from observations via WGS84 projection or trapezoidal numerical integration.</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold font-mono text-[#7189A6]">ESTIMATED_VALUE</td>
                  <td className="p-2.5 font-mono text-[#25364A]">Compass Bearing, Three.js Yaw</td>
                  <td className="p-2.5 text-[#697586]">Secant forward/backward difference angle along trajectory path subject to angular uncertainty band.</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold font-mono text-[#C18A45]">INTERPOLATED_VALUE</td>
                  <td className="p-2.5 font-mono text-[#25364A]">Intermediate Timeline States</td>
                  <td className="p-2.5 text-[#697586]">Piecewise linear kinematic state evaluated between two consecutive empirical bounding observations.</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold font-mono text-[#8A96A6]">MODEL_ASSUMPTION</td>
                  <td className="p-2.5 font-mono text-[#25364A]">Vehicle Dimensions, GPS CEP95</td>
                  <td className="p-2.5 text-[#697586]">OEM baseline specifications and illustrative receiver error bounds not measured directly on scene.</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold font-mono text-[#6B52B5]">INFERRED_ANALYSIS</td>
                  <td className="p-2.5 font-mono text-[#25364A]">Clock Reconciliation, Lane Arc</td>
                  <td className="p-2.5 text-[#697586]">Analytical cross-modal correlation conditional on operational assumptions (e.g. CCTV NTP synchronization).</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold font-mono text-[#B85C5C]">UNAVAILABLE</td>
                  <td className="p-2.5 font-mono text-[#25364A]">Steering Angle, Airbags, Video</td>
                  <td className="p-2.5 text-[#697586]">Data stream or physical container absent from the evidence repository; no value is fabricated.</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold font-mono text-[#C18A45]">SIMULATED / DEMO DATA</td>
                  <td className="p-2.5 font-mono text-[#25364A]">Full Telemetry Dataset</td>
                  <td className="p-2.5 text-[#697586]">Global dataset authenticity tier: synthetic test stream modelled for software demonstration. SHA-256 verifies file integrity against the hashed version, not real-world evidence authenticity.</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Missing Evidence Deficiency Checklist */}
          <div className="p-4 rounded-lg bg-[#FAFAF8] border border-[#D9DEE3] space-y-2 text-xs">
            <div className="font-bold text-[#25364A] uppercase tracking-wide text-[11px] flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5 text-[#B85C5C]" />
              Evidentiary Deficiency & Physical File Absence Manifest
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
              <div className="flex items-center gap-2 text-[#B85C5C]">
                <XCircle className="w-4 h-4 shrink-0 text-[#B85C5C]" />
                <span>CCTV Video File (<code>cctv_caltrans_cam402_1840.mp4</code>): <strong>ABSENT FROM REPO</strong></span>
              </div>
              <div className="flex items-center gap-2 text-[#B85C5C]">
                <XCircle className="w-4 h-4 shrink-0 text-[#B85C5C]" />
                <span>Dashcam Video File (<code>v01_dashcam_front_1842.mp4</code>): <strong>ABSENT FROM REPO</strong></span>
              </div>
              <div className="flex items-center gap-2 text-[#B85C5C]">
                <XCircle className="w-4 h-4 shrink-0 text-[#B85C5C]" />
                <span>EDR ACM Trigger File (<code>ford_explorer_acm_trigger.dat</code>): <strong>ABSENT (0 BYTES)</strong></span>
              </div>
              <div className="flex items-center gap-2 text-[#B85C5C]">
                <XCircle className="w-4 h-4 shrink-0 text-[#B85C5C]" />
                <span>Continuous Steering Angle Sensor Data: <strong>UNAVAILABLE IN CSV</strong></span>
              </div>
              <div className="flex items-center gap-2 text-[#B85C5C]">
                <XCircle className="w-4 h-4 shrink-0 text-[#B85C5C]" />
                <span>Pyrotechnic Airbag Deployment Logs: <strong>UNAVAILABLE IN CSV</strong></span>
              </div>
              <div className="flex items-center gap-2 text-[#B85C5C]">
                <XCircle className="w-4 h-4 shrink-0 text-[#B85C5C]" />
                <span>Physical Vehicle Crush Profiles: <strong>UNAVAILABLE ON SCENE</strong></span>
              </div>
            </div>
          </div>
        </section>

        {/* ==================================================================== */}
        {/* G. INVESTIGATOR'S FINDINGS & PROFESSIONAL RECOMMENDATIONS            */}
        {/* ==================================================================== */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#25364A] flex items-center gap-2 pb-1 border-b border-[#EDF0F3]">
            <CheckCircle2 className="w-4 h-4 text-[#527D70]" />
            G. Investigator's Neutral Synthesis & Recommendations
          </h2>

          <div className="p-5 rounded-lg bg-[#FAFAF8] border border-[#D9DEE3] space-y-3 text-xs leading-relaxed text-[#25364A]">
            <div>
              <strong className="text-[#527D70] font-bold block uppercase tracking-wide text-[11px]">
                1. What the Demonstration Dataset Establishes:
              </strong>
              <p className="mt-0.5 text-[#475569]">
                The ingested demonstration telemetry establishes that Vehicle 01 entered the northern intersection approach at a recorded speed of 84.5 km/h with 84% throttle applied, and delayed brake actuation until 18:42:10.520 UTC (0.500s prior to reference epoch T0). Vehicle 02 traversed a continuous curved left-turn path at speeds dropping from 45.0 km/h to 36.0 km/h. Vehicle 03 brought itself to a complete standstill at 18:42:11.220 UTC, 61.5m north of the intersection.
              </p>
            </div>

            <div>
              <strong className="text-[#527D70] font-bold block uppercase tracking-wide text-[11px]">
                2. What Can Be Mathematically Reconstructed:
              </strong>
              <p className="mt-0.5 text-[#475569]">
                Local tangent plane ENU Cartesian projections establish vehicle displacements of 64.02m (V1), 34.95m (V2), and 5.87m (V3). At the peak proximity epoch (18:42:11.220 UTC), the minimum nominal center-to-center distance between V1 and V2 was 4.257m, producing a nominal oriented bounding box (OBB) gap of 0.309m without polygon intersection.
              </p>
            </div>

            <div>
              <strong className="text-[#C18A45] font-bold block uppercase tracking-wide text-[11px]">
                3. What Remains Scientifically Uncertain:
              </strong>
              <p className="mt-0.5 text-[#475569]">
                Because 5-decimal GPS geodetic cell resolution introduces a maximum radial quantization error of ±0.709m and illustrative receiver accuracy is assumed at ±2.5m CEP95, the 0.309m nominal separation falls inside the uncertainty threshold. Therefore, physical vehicular contact cannot be confirmed or disproven from numerical telemetry alone.
              </p>
            </div>

            <div>
              <strong className="text-[#B85C5C] font-bold block uppercase tracking-wide text-[11px]">
                4. What Cannot Currently Be Established:
              </strong>
              <p className="mt-0.5 text-[#475569]">
                Structural crush deformation depth, collision impulse delta-V, pyrotechnic airbag deployment trigger timestamps, and sub-0.18m lateral lane clearance cannot be established due to the total absence of on-scene physical inspections, steering angle sensor streams, and video container files.
              </p>
            </div>

            <div className="pt-2 border-t border-[#EDF0F3]">
              <strong className="text-[#25364A] font-bold block uppercase tracking-wide text-[11px]">
                5. Additional Evidence Required for Judicial / Real-World Investigation:
              </strong>
              <ul className="list-disc list-inside mt-1 space-y-0.5 text-[#64748B] text-[11px]">
                <li>Direct binary Bosch CDR hardware download from both V1 and V2 Airbag Control Modules (ACM).</li>
                <li>On-scene total station electronic distance meter (EDM) or terrestrial laser scan of roadway geometry.</li>
                <li>High-definition 3D LIDAR point cloud documentation of vehicle residual structural crush profiles.</li>
                <li>Certified original MP4 video surveillance files with SHA-256 chain-of-custody hashes and verified frame rates.</li>
                <li>Municipal traffic signal master controller NTCIP event history logs with authenticated NTP timecodes.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ==================================================================== */}
        {/* H. FEATHERLESS AI NARRATIVE SYNTHESIS & INVESTIGATOR ACCEPTANCE       */}
        {/* ==================================================================== */}
        <section className="space-y-4">
          <InvestigationSummarySection
            incident={safeIncident}
            timelineEvents={timelineEvents}
            contradictions={contradictions}
            telemetrySummary={{
              V1_peak_speed: '84.5 km/h',
              V1_peak_decel: '-2.85 m/s²',
              V2_peak_speed: '35.0 km/h',
              V2_peak_decel: '-2.40 m/s²',
              V3_status: 'Stationary (0.0 km/h)'
            }}
            onNavigateTab={onNavigateTab}
          />
        </section>

        {/* ==================================================================== */}
        {/* REPORT SIGNATURE & CERTIFICATION FOOTER                              */}
        {/* ==================================================================== */}
        <div className="pt-6 border-t-2 border-[#D9DEE3] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-[#697586]">
          <div className="space-y-1">
            <div className="text-[10px] uppercase font-bold text-[#8A96A6]">Analytical Scenario Persona</div>
            <div className="text-[#25364A] font-bold font-mono text-sm">{safeIncident.leadInvestigator}</div>
            <div className="text-[10px]">Accident Recon Unit #7 (Simulated Investigator Persona) • Automated Generation</div>
          </div>

          <div className="space-y-1 sm:text-right">
            <div className="flex items-center sm:justify-end gap-1.5 text-[#527D70] font-bold">
              <ShieldCheck className="w-4 h-4 text-[#527D70]" />
              <span>Automated Synthetic Data Synthesis</span>
            </div>
            <div className="font-mono text-[10px] text-[#8A96A6]" title="Verifies file integrity against the hashed version, not real-world evidence authenticity">
              Source Dataset SHA-256 (File Integrity Verification): {certifiedReportHash.slice(0, 32)}...
            </div>
            <div className="text-[9px] text-[#A0AEC0]">
              Page 1 of 1 • Synthetic Demonstration Output • TRACE AI Reconstruction System
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
