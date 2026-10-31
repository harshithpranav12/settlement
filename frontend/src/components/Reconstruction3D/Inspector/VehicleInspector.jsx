/**
 * TRACE AI - Vehicle & Waypoint Forensic Inspector
 * 
 * Provides rigorous, evidence-grounded inspection of:
 * 1. Vehicle Identity & OEM Specifications (MODEL_ASSUMPTION)
 * 2. Instantaneous Kinematics & Actuation Inputs (Speed, Accel, Brake, Throttle)
 * 3. Waypoint-Level Observation Evidence (Raw GPS, CAN bus measurements, Local ENU, Uncertainty)
 * 4. Stepwise Observation Navigation ([< Prev] [Next >])
 * 5. Correlated Timeline Events & Contradiction Discrepancy Cross-References (CTR-01, CTR-02, CTR-03)
 * 6. Forensic Provenance Classification Panel (DIRECT_OBSERVATION, DERIVED_VALUE, etc.)
 */

import React, { useMemo } from 'react';
import {
  Car,
  Gauge,
  Activity,
  Compass,
  MapPin,
  Clock,
  ShieldCheck,
  FileText,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Scale,
  Layers,
  Database,
  Info
} from 'lucide-react';
import { sampleVehicleStateAtTime, formatSecondsToTimestamp } from '../utils/trajectoryInterpolation.js';

export default function VehicleInspector({
  selectedVehicleId = 'V1',
  onSelectVehicle,
  sceneData,
  currentSeconds,
  selectedWaypoint = null,
  onSelectWaypoint,
  onSeek,
  onNavigateTab
}) {
  const vehicles = sceneData?.vehicles || [];
  const activeVehicle = vehicles.find((v) => v.id === selectedVehicleId) || vehicles[0];

  const waypoints = sceneData?.trajectories?.[activeVehicle?.id] || [];
  const sample = sampleVehicleStateAtTime(waypoints, currentSeconds);

  const t0 = sceneData?.timelineBounds?.t0 || 67331.02;
  const relTimeSec = (currentSeconds - t0).toFixed(2);
  const relTimeStr = relTimeSec >= 0 ? `+${relTimeSec}s` : `${relTimeSec}s`;

  // Locate the active observation row index
  // Priority: explicit selectedWaypoint matching active vehicle, or closest waypoint to currentSeconds
  const activeWaypointIndex = useMemo(() => {
    if (!waypoints || waypoints.length === 0) return -1;

    if (selectedWaypoint && selectedWaypoint.vehicleId === activeVehicle?.id) {
      const idx = waypoints.findIndex((w) => w.rowIndex === selectedWaypoint.rowIndex);
      if (idx >= 0) return idx;
    }

    // Default to closest waypoint within 0.25s of currentSeconds
    let closestIdx = 0;
    let minDiff = Infinity;
    waypoints.forEach((w, idx) => {
      const diff = Math.abs(w.seconds - currentSeconds);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });

    return closestIdx;
  }, [waypoints, selectedWaypoint, activeVehicle, currentSeconds]);

  const activeWaypoint = activeWaypointIndex >= 0 ? waypoints[activeWaypointIndex] : null;
  const prevWaypoint = activeWaypointIndex > 0 ? waypoints[activeWaypointIndex - 1] : null;
  const nextWaypoint = activeWaypointIndex >= 0 && activeWaypointIndex < waypoints.length - 1 ? waypoints[activeWaypointIndex + 1] : null;

  // Previous / Next Observation navigation handlers
  const handleNavigateWaypoint = (targetWp) => {
    if (!targetWp) return;
    if (onSelectWaypoint) {
      onSelectWaypoint({
        vehicleId: activeVehicle.id,
        rowIndex: targetWp.rowIndex,
        seconds: targetWp.seconds,
        exactTimestamp: targetWp.exactTimestamp
      });
    }
    if (onSeek) {
      onSeek(targetWp.seconds);
    }
  };

  const speedKmh = parseFloat(sample.speed_kmh) || 0;
  const speedMph = (speedKmh * 0.621371).toFixed(1);
  const accelMps2 = parseFloat(sample.acceleration_mps2) || 0;
  const accelG = (accelMps2 / 9.80665).toFixed(2);
  const isBraking = sample.brake_status === 'True' || sample.isBrakeActive;

  // Correlated contradictions for active vehicle and current waypoint
  const correlatedContradictions = useMemo(() => {
    const list = [];
    if (activeVehicle?.id === 'V1') {
      list.push({
        id: 'CTR-01',
        title: 'Approach Speed & Braking Onset Contradiction',
        severity: 'CRITICAL',
        summary: 'Driver claimed 42 km/h approach; synthetic telemetry CSV logs 84.5 km/h with 84% throttle (Row #1), panic braking delayed to 18:42:10.520 UTC (Row #4). Note: Telemetry is synthetic demonstration data; CCTV optical corroboration is unverified as video file is absent.',
        relevantRows: [1, 2, 3, 4]
      });
    } else if (activeVehicle?.id === 'V2') {
      list.push({
        id: 'CTR-02',
        title: 'V2 Lateral Lane Departure Claim Refuted',
        severity: 'MODERATE',
        summary: 'Witness claimed erratic wide turn. Note: Continuous steering wheel angle sensor is UNAVAILABLE in telemetry stream. Trajectory reconstruction from synthetic GPS waypoints (Rows #11–20) indicates turn path adherence, with lateral resolution bounded by GPS quantization (±0.71m). Sub-0.18m lane tracking is an unverified analytical estimate (CCTV video file is absent).',
        relevantRows: [11, 12, 13, 14, 15, 16]
      });
    }

    if (activeWaypoint?.rowIndex === 5 || activeWaypoint?.rowIndex === 15 || Math.abs(currentSeconds - t0) < 0.25) {
      list.push({
        id: 'CTR-03',
        title: 'Dashcam Internal Clock Temporal Skew',
        severity: 'TECHNICAL',
        summary: 'Simulated +1.420s timestamp offset between mock Dashcam metadata (18:42:12.440 UTC) and mock CCTV reference (18:42:11.020 UTC). Note: Demonstration scenario; actual video files and NTP synchronization logs are absent from repository; ±50ms represents an illustrative model assumption.',
        relevantRows: [5, 15]
      });
    }

    return list;
  }, [activeVehicle, activeWaypoint, currentSeconds, t0]);

  // Classification styling helper
  const getClassificationBadge = (cls) => {
    switch (cls) {
      case 'DIRECT_OBSERVATION':
        return { label: 'Direct Observation (Synthetic)', className: 'bg-[#EBF2EE] text-[#527D70] border-[#D0E0D6]', icon: ShieldCheck };
      case 'DERIVED_VALUE':
        return { label: 'Derived Geodetic/Kinematic', className: 'bg-[#EFF4F9] text-[#7189A6] border-[#D6E2EC]', icon: Compass };
      case 'INTERPOLATED_VALUE':
        return { label: 'Piecewise Interpolated', className: 'bg-[#FAF4EB] text-[#C18A45] border-[#F0DFCA]', icon: Activity };
      case 'ESTIMATED_VALUE':
        return { label: 'Kinematic Estimate', className: 'bg-[#EFF4F9] text-[#7189A6] border-[#D6E2EC]', icon: Compass };
      case 'MODEL_ASSUMPTION':
        return { label: 'Model Assumption', className: 'bg-[#F5F4EF] text-[#8A96A6] border-[#D9DEE3]', icon: AlertTriangle };
      case 'INFERRED_ANALYSIS':
        return { label: 'Inferred Analysis', className: 'bg-[#F0EFF8] text-[#6B52B5] border-[#D8D4EE]', icon: Compass };
      case 'SIMULATED / DEMONSTRATION DATA':
      case 'SIMULATED_DEMO_DATA':
        return { label: 'Simulated / Demo Data', className: 'bg-[#FAF4EB] text-[#C18A45] border-[#F0DFCA]', icon: AlertTriangle };
      case 'UNAVAILABLE':
      default:
        return { label: 'Unavailable / Missing', className: 'bg-[#F5F4EF] text-[#8A96A6] border-[#D9DEE3]', icon: AlertTriangle };
    }
  };

  const classBadge = getClassificationBadge(sample.classification);
  const BadgeIcon = classBadge.icon;

  return (
    <div className="bg-white border border-[#D9DEE3] rounded-lg shadow-card p-4 lg:p-5 space-y-4 text-xs font-sans">
      {/* 1. Header & Vehicle Switcher */}
      <div className="flex items-center justify-between pb-3 border-b border-[#EDF0F3]">
        <div className="flex items-center space-x-2">
          <Car className="w-4 h-4 text-[#527D70]" />
          <h3 className="font-sans font-bold uppercase tracking-wider text-[#25364A] text-xs">
            Forensic Telemetry Inspector
          </h3>
        </div>

        {/* Vehicle Selection Tabs */}
        <div className="flex items-center space-x-1">
          {vehicles.map((v) => (
            <button
              key={v.id}
              onClick={() => {
                onSelectVehicle(v.id);
                if (onSelectWaypoint) onSelectWaypoint(null);
              }}
              className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition ${
                v.id === selectedVehicleId
                  ? 'bg-[#25364A] text-white shadow-xs'
                  : 'bg-[#F5F4EF] text-[#697586] hover:text-[#25364A] border border-[#D9DEE3]'
              }`}
            >
              {v.id}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Selected Vehicle Metadata Banner (MODEL_ASSUMPTION) */}
      <div className="p-3 rounded-lg bg-[#FAFAF8] border border-[#D9DEE3] flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-[#25364A] flex items-center gap-2">
            <span>{activeVehicle?.name || 'Vehicle'}</span>
            <span className="text-[10px] font-sans px-1.5 py-0.5 rounded bg-white text-[#697586] border border-[#D9DEE3]">
              {activeVehicle?.type || 'Sedan'}
            </span>
          </div>
          <div className="text-[11px] text-[#697586] mt-0.5">
            Dimensions: {activeVehicle?.dimensions?.length}m × {activeVehicle?.dimensions?.width}m × {activeVehicle?.dimensions?.height}m
            <span className="ml-1 text-[9px] text-[#8A96A6] font-mono">(OEM Specification: MODEL_ASSUMPTION)</span>
          </div>
        </div>

        {/* Dynamic State Classification Pill */}
        <div className={`px-2 py-1 rounded border text-[10px] font-medium flex items-center gap-1.5 ${classBadge.className}`}>
          <BadgeIcon className="w-3.5 h-3.5" />
          <span>{classBadge.label}</span>
        </div>
      </div>

      {/* 3. Primary Telemetry Metrics Strip */}
      <div className="grid grid-cols-2 gap-3">
        {/* Speed Card */}
        <div className="p-3 rounded-lg bg-[#FAF4EB]/60 border border-[#F0DFCA]">
          <div className="text-[10px] uppercase font-bold text-[#8A96A6] flex items-center gap-1">
            <Gauge className="w-3.5 h-3.5 text-[#C18A45]" />
            Ground Speed
          </div>
          <div className="text-xl font-bold font-mono text-[#25364A] mt-1">
            {speedKmh.toFixed(1)} <span className="text-xs font-sans text-[#697586]">km/h</span>
          </div>
          <div className="text-[11px] font-mono text-[#8A96A6]">
            {speedMph} mph
          </div>
        </div>

        {/* Acceleration Card */}
        <div className="p-3 rounded-lg bg-[#EFF4F9]/60 border border-[#D6E2EC]">
          <div className="text-[10px] uppercase font-bold text-[#8A96A6] flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-[#7189A6]" />
            Acceleration
          </div>
          <div className="text-xl font-bold font-mono text-[#25364A] mt-1">
            {accelMps2.toFixed(2)} <span className="text-xs font-sans text-[#697586]">m/s²</span>
          </div>
          <div className="text-[11px] font-mono text-[#8A96A6]">
            {accelG >= 0 ? `+${accelG}` : accelG} g
          </div>
        </div>
      </div>

      {/* 4. Controls & Actuation Inputs */}
      <div className="grid grid-cols-2 gap-3">
        {/* Brake Status */}
        <div className="p-2.5 rounded-lg bg-white border border-[#D9DEE3] flex items-center justify-between">
          <span className="text-[11px] text-[#697586] font-medium">Brake System:</span>
          <span className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono border ${
            isBraking
              ? 'bg-[#FBF2F2] text-[#B85C5C] border-[#F1D7D7]'
              : 'bg-[#EBF2EE] text-[#527D70] border-[#D0E0D6]'
          }`}>
            {isBraking ? 'ACTIVE (Hydraulic)' : 'Released'}
          </span>
        </div>

        {/* Throttle Position */}
        <div className="p-2.5 rounded-lg bg-white border border-[#D9DEE3] flex items-center justify-between">
          <span className="text-[11px] text-[#697586] font-medium">Throttle Position:</span>
          <span className="text-[11px] font-bold font-mono text-[#25364A]">
            {sample.throttle_position || '0%'}
          </span>
        </div>
      </div>

      {/* 5. Spatial State & Heading */}
      <div className="space-y-2 pt-1 border-t border-[#EDF0F3]">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[#8A96A6] flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5 text-[#527D70]" />
          Spatial State & Heading
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded bg-[#FAFAF8] border border-[#EDF0F3]">
            <span className="text-[10px] text-[#8A96A6] block">Local 3D (X, Z)</span>
            <span className="font-mono text-[#25364A] font-semibold text-[11px]">
              X: {sample.x !== undefined ? `${sample.x.toFixed(1)}m` : '0.0m'}, Z: {sample.z !== undefined ? `${sample.z.toFixed(1)}m` : '0.0m'}
            </span>
          </div>

          <div className="p-2 rounded bg-[#FAFAF8] border border-[#EDF0F3]">
            <span className="text-[10px] text-[#8A96A6] block">Compass Bearing</span>
            <span className="font-mono text-[#527D70] font-semibold text-[11px]">
              {sample.bearing ? `${sample.bearing.toFixed(1)}° (${sample.cardinal})` : '0.0° (N)'}
            </span>
          </div>
        </div>

        <div className="p-2 rounded bg-[#FAFAF8] border border-[#EDF0F3] text-[11px] flex items-center justify-between">
          <span className="text-[#8A96A6]">WGS84 GPS:</span>
          <span className="font-mono text-[#25364A]">
            {sample.lat ? `${sample.lat.toFixed(5)}°, ${sample.lon?.toFixed(5)}°` : 'Schematic'}
          </span>
        </div>
      </div>

      {/* 6. Waypoint-Level Evidence Inspection Card & Stepwise Navigation */}
      {activeWaypoint && (
        <div className="rounded-lg bg-[#F8FAFC] border border-[#CBD5E1] p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-[#25364A] flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-[#2563EB]" />
              Empirical Waypoint Observation (Row #{activeWaypoint.rowIndex})
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white text-[#527D70] border border-[#CBD5E1] font-semibold">
              {activeWaypoint.exactTimestamp}
            </span>
          </div>

          {/* Previous / Next Observation Buttons */}
          <div className="flex items-center justify-between gap-2 pt-1 pb-1">
            <button
              onClick={() => handleNavigateWaypoint(prevWaypoint)}
              disabled={!prevWaypoint}
              className={`flex-1 px-2.5 py-1.5 rounded text-xs font-semibold flex items-center justify-center gap-1 transition ${
                prevWaypoint
                  ? 'bg-white border border-[#CBD5E1] text-[#25364A] hover:bg-[#F1F5F9] cursor-pointer shadow-xs'
                  : 'bg-[#F1F5F9] border border-[#E2E8F0] text-[#94A3B8] cursor-not-allowed opacity-60'
              }`}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev Obs {prevWaypoint ? `(Row #${prevWaypoint.rowIndex})` : ''}</span>
            </button>

            <span className="text-[10px] font-mono text-[#64748B]">
              {activeWaypointIndex + 1} of {waypoints.length}
            </span>

            <button
              onClick={() => handleNavigateWaypoint(nextWaypoint)}
              disabled={!nextWaypoint}
              className={`flex-1 px-2.5 py-1.5 rounded text-xs font-semibold flex items-center justify-center gap-1 transition ${
                nextWaypoint
                  ? 'bg-white border border-[#CBD5E1] text-[#25364A] hover:bg-[#F1F5F9] cursor-pointer shadow-xs'
                  : 'bg-[#F1F5F9] border border-[#E2E8F0] text-[#94A3B8] cursor-not-allowed opacity-60'
              }`}
            >
              <span>Next Obs {nextWaypoint ? `(Row #${nextWaypoint.rowIndex})` : ''}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Raw Sensor Readings & Uncertainty */}
          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-[#475569] bg-white p-2 rounded border border-[#E2E8F0]">
            <div>
              <span className="text-[#8A96A6] block font-sans">Raw GPS</span>
              <span>{activeWaypoint.lat ? `${activeWaypoint.lat.toFixed(6)}°, ${activeWaypoint.lon.toFixed(6)}°` : 'N/A'}</span>
            </div>
            <div>
              <span className="text-[#8A96A6] block font-sans">GPS CEP Radius</span>
              <span>±2.50m (Configured CEP95)</span>
            </div>
            <div>
              <span className="text-[#8A96A6] block font-sans">CAN Wheel Speed</span>
              <span>{activeWaypoint.speed_kmh} (±1.5%)</span>
            </div>
            <div>
              <span className="text-[#8A96A6] block font-sans">Odometry Cumulative</span>
              <span>{activeWaypoint.cumulativeDistanceMeters || 0}m integrated</span>
            </div>
          </div>
        </div>
      )}

      {/* 7. Correlated Contradiction & Timeline Discrepancies */}
      {correlatedContradictions.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-[#EDF0F3]">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#B85C5C] flex items-center gap-1">
            <Scale className="w-3.5 h-3.5 text-[#B85C5C]" />
            Correlated Contradictions ({correlatedContradictions.length})
          </div>

          <div className="space-y-1.5">
            {correlatedContradictions.map((c) => (
              <div
                key={c.id}
                onClick={() => onNavigateTab && onNavigateTab('contradictions')}
                className="p-2.5 rounded bg-[#FBF2F2]/60 border border-[#F1D7D7] hover:border-[#B85C5C] transition cursor-pointer space-y-1"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#25364A] flex items-center gap-1 font-mono">
                    <span className="text-[#B85C5C]">{c.id}:</span> {c.title}
                  </span>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-white text-[#B85C5C] border border-[#F1D7D7]">
                    {c.severity}
                  </span>
                </div>
                <p className="text-[10px] text-[#697586] leading-snug">
                  {c.summary}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 8. Forensic Provenance Panel */}
      <div className="p-3 rounded-lg bg-[#EFF4F9]/60 border border-[#D6E2EC] space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase text-[#7189A6] flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-[#7189A6]" />
            Forensic Provenance & Audit Trail
          </span>
          <span className="font-mono text-[10px] text-[#25364A] font-semibold">
            {sample.sourceId || 'EVD-SNS-1162-562'}
          </span>
        </div>

        <div className="text-[11px] text-[#697586] leading-snug">
          File: <strong className="text-[#25364A]">{sample.sourceFileName || 'trace_ai_synthetic_road_accident_telemetry.csv'}</strong> [Row: {sample.rowIndex || '1'}]
          <span className="block text-[10px] text-[#C18A45] font-medium mt-0.5">Status: SIMULATED / DEMONSTRATION DATA</span>
        </div>

        {/* Provenance Taxonomy Key */}
        <div className="grid grid-cols-2 gap-1 pt-1 text-[9px] font-mono text-[#64748B]">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#527D70]" /> DIRECT_OBSERVATION
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7189A6]" /> DERIVED_VALUE
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C18A45]" /> INTERPOLATED_VALUE
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#8A96A6]" /> MODEL_ASSUMPTION
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#6B52B5]" /> INFERRED_ANALYSIS
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#B85C5C]" /> UNAVAILABLE
          </div>
        </div>

        {/* Button to navigate to original evidence */}
        <button
          onClick={() => onNavigateTab && onNavigateTab('timeline')}
          className="w-full mt-1 px-3 py-1.5 rounded-md bg-white border border-[#D6E2EC] text-[#7189A6] hover:text-[#25364A] hover:bg-[#F5F4EF] transition text-xs font-medium cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
        >
          <span>Inspect In Telemetry Timeline</span>
          <ExternalLink className="w-3 h-3 text-[#7189A6]" />
        </button>
      </div>
    </div>
  );
}
