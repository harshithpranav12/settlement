/**
 * TRACE AI - Synchronized Forensic Telemetry Graphs
 * 
 * Provides interactive, high-precision SVG time-series visualizations:
 * 1. Speed vs. Time (km/h vs. elapsed seconds / UTC)
 * 2. Acceleration vs. Time (m/s² vs. elapsed seconds / UTC)
 * 
 * FORENSIC INTEGRITY PRINCIPLES:
 * - Direct sensor observations (DSOs) are rendered as distinct empirical nodes.
 * - Interpolated segments are clearly distinguished.
 * - Missing records are preserved without continuous fabrication.
 * - Live vertical time cursor is bidirectionally synchronized with 3D playback.
 * - Clicking or dragging along the graph seeks the global reconstruction timeline.
 */

import React, { useRef, useState, useMemo, useCallback } from 'react';
import { Activity, Gauge, Navigation, Info, Clock, CheckCircle2 } from 'lucide-react';
import { sampleVehicleStateAtTime, formatSecondsToTimestamp } from '../utils/trajectoryInterpolation.js';

export default function TelemetryGraphs({
  sceneData,
  currentSeconds,
  onSeek,
  selectedVehicleId = 'V1',
  onSelectVehicle,
  selectedWaypoint = null,
  onSelectWaypoint
}) {
  const containerRef = useRef(null);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [activeVehicleFilter, setActiveVehicleFilter] = useState('ALL'); // 'ALL' | 'V1' | 'V2' | 'V3'

  const timelineBounds = sceneData?.timelineBounds || { start: 67329.02, end: 67334.02, t0: 67331.02, duration: 5.0 };
  const startTime = timelineBounds.start;
  const endTime = timelineBounds.end;
  const duration = Math.max(0.1, endTime - startTime);

  // Vehicle styling definitions
  const vehicleConfig = useMemo(() => ({
    V1: {
      id: 'V1',
      name: 'Vehicle 1 (Tesla Model 3)',
      shortName: 'V1 (Sedan)',
      color: '#2563EB',
      lightColor: '#DBEAFE',
      badgeBg: '#EFF6FF',
      badgeBorder: '#BFDBFE'
    },
    V2: {
      id: 'V2',
      name: 'Vehicle 2 (Ford Explorer)',
      shortName: 'V2 (SUV)',
      color: '#D97706',
      lightColor: '#FEF3C7',
      badgeBg: '#FFFBEB',
      badgeBorder: '#FDE68A'
    },
    V3: {
      id: 'V3',
      name: 'Vehicle 3 (Honda Civic)',
      shortName: 'V3 (Compact)',
      color: '#475569',
      lightColor: '#E2E8F0',
      badgeBg: '#F8FAFC',
      badgeBorder: '#CBD5E1'
    }
  }), []);

  // Extract raw observation points from scene trajectories
  const trajectorySeries = useMemo(() => {
    if (!sceneData || !sceneData.trajectories) return { V1: [], V2: [], V3: [] };

    const series = {};
    ['V1', 'V2', 'V3'].forEach((vId) => {
      const records = sceneData.trajectories[vId] || [];
      series[vId] = records.map((r) => ({
        seconds: r.seconds,
        relSeconds: r.seconds - startTime,
        speedVal: typeof r.speedVal === 'number' && !isNaN(r.speedVal) ? r.speedVal : null,
        accelVal: typeof r.accelVal === 'number' && !isNaN(r.accelVal) ? r.accelVal : null,
        exactTimestamp: r.exactTimestamp,
        rowIndex: r.rowIndex,
        sourceId: r.sourceId,
        sourceFileName: r.sourceFileName,
        brake_status: r.brake_status,
        classification: r.observationClassification || 'DIRECT_OBSERVATION'
      }));
    });
    return series;
  }, [sceneData, startTime]);

  // Current sampled instantaneous values across all 3 vehicles at currentSeconds
  const currentReadouts = useMemo(() => {
    if (!sceneData || !sceneData.trajectories) return {};
    const readouts = {};
    ['V1', 'V2', 'V3'].forEach((vId) => {
      const waypoints = sceneData.trajectories[vId] || [];
      readouts[vId] = sampleVehicleStateAtTime(waypoints, currentSeconds);
    });
    return readouts;
  }, [sceneData, currentSeconds]);

  // SVG Dimension Constants
  const svgWidth = 840;
  const graphHeight = 135;
  const padding = { top: 20, right: 30, bottom: 25, left: 55 };
  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = graphHeight - padding.top - padding.bottom;

  // Scale Functions
  const scaleX = useCallback((sec) => {
    const clamped = Math.max(startTime, Math.min(endTime, sec));
    return padding.left + ((clamped - startTime) / duration) * plotWidth;
  }, [startTime, endTime, duration, plotWidth, padding.left]);

  const invertX = useCallback((pixelX) => {
    const boundedPx = Math.max(padding.left, Math.min(padding.left + plotWidth, pixelX));
    const ratio = (boundedPx - padding.left) / plotWidth;
    return startTime + ratio * duration;
  }, [startTime, duration, plotWidth, padding.left]);

  // Speed Scale (0 to 90 km/h)
  const speedMax = 90;
  const speedMin = 0;
  const scaleSpeedY = useCallback((speed) => {
    const clamped = Math.max(speedMin, Math.min(speedMax, speed));
    return padding.top + plotHeight - ((clamped - speedMin) / (speedMax - speedMin)) * plotHeight;
  }, [plotHeight, padding.top]);

  // Acceleration Scale (-4.0 to +1.0 m/s²)
  const accelMin = -4.0;
  const accelMax = 1.0;
  const scaleAccelY = useCallback((accel) => {
    const clamped = Math.max(accelMin, Math.min(accelMax, accel));
    return padding.top + plotHeight - ((clamped - accelMin) / (accelMax - accelMin)) * plotHeight;
  }, [plotHeight, padding.top]);

  // Zero-acceleration Y coordinate
  const zeroAccelY = scaleAccelY(0);

  // Cursor X position
  const cursorX = scaleX(currentSeconds);

  // Key Event Milestones for guide lines
  const keyMilestones = useMemo(() => {
    return [
      { id: 'appr', relSec: 0.0, sec: startTime, label: 'Approach', color: '#94A3B8' },
      { id: 'brk', relSec: 1.5, sec: startTime + 1.5, label: 'Braking Onset', color: '#D97706' },
      { id: 't0', relSec: 2.0, sec: startTime + 2.0, label: 'T0 Ref Epoch', color: '#DC2626' },
      { id: 'pk', relSec: 2.2, sec: startTime + 2.2, label: 'Peak Decel', color: '#B91C1C' },
      { id: 'rst', relSec: 5.0, sec: startTime + 5.0, label: 'Final Rest', color: '#64748B' }
    ];
  }, [startTime]);

  // Interactive Click / Drag Handler to Seek
  const handleGraphPointerDown = (e) => {
    const svgEl = containerRef.current?.querySelector('svg');
    if (!svgEl) return;

    const updateSeekFromEvent = (clientX) => {
      const rect = svgEl.getBoundingClientRect();
      const pixelX = ((clientX - rect.left) / rect.width) * svgWidth;
      const targetSec = invertX(pixelX);
      onSeek(targetSec);
    };

    updateSeekFromEvent(e.clientX);

    const handlePointerMove = (moveEvt) => {
      updateSeekFromEvent(moveEvt.clientX);
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  // Helper to construct SVG line path for speed or acceleration
  const buildSvgPath = (points, valueKey, scaleYFunc) => {
    let path = '';
    let currentSegment = [];

    points.forEach((pt) => {
      const val = pt[valueKey];
      if (val !== null && typeof val === 'number' && !isNaN(val)) {
        currentSegment.push({ x: scaleX(pt.seconds), y: scaleYFunc(val) });
      } else {
        if (currentSegment.length > 0) {
          path += currentSegment.reduce((acc, p, idx) => (idx === 0 ? `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}` : `${acc} L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`), '');
          currentSegment = [];
        }
      }
    });

    if (currentSegment.length > 0) {
      path += currentSegment.reduce((acc, p, idx) => (idx === 0 ? `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}` : `${acc} L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`), '');
    }

    return path;
  };

  const isVehicleVisible = (vId) => activeVehicleFilter === 'ALL' || activeVehicleFilter === vId;

  return (
    <div className="rounded-lg bg-white border border-[#D9DEE3] p-4 lg:p-5 space-y-4 shadow-card font-sans">
      {/* 1. Header with Controls & Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#EDF0F3]">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-[#527D70]" />
          <h3 className="text-sm font-bold text-[#25364A] tracking-tight">
            Synchronized Kinematic Telemetry Graphs
          </h3>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FAF4EB] text-[#C18A45] border border-[#F0DFCA]">
            Synthetic CSV Telemetry (30 Obs)
          </span>
        </div>

        {/* Vehicle Filter Buttons */}
        <div className="flex items-center space-x-1.5 text-xs">
          <span className="text-[11px] text-[#8A96A6] mr-1 hidden sm:inline">Focus:</span>
          {['ALL', 'V1', 'V2', 'V3'].map((vId) => (
            <button
              key={vId}
              onClick={() => {
                setActiveVehicleFilter(vId);
                if (vId !== 'ALL' && onSelectVehicle) {
                  onSelectVehicle(vId);
                }
              }}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeVehicleFilter === vId
                  ? 'bg-[#25364A] text-white shadow-xs'
                  : 'bg-[#FAFAF8] text-[#697586] hover:bg-[#F5F4EF] border border-[#D9DEE3]'
              }`}
            >
              {vId !== 'ALL' && (
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ backgroundColor: vehicleConfig[vId]?.color }}
                />
              )}
              <span>{vId === 'ALL' ? 'All Vehicles' : vId}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Live Telemetry Readout Cards at Current Time */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {['V1', 'V2', 'V3'].map((vId) => {
          const cfg = vehicleConfig[vId];
          const sample = currentReadouts[vId] || {};
          const isSelected = selectedVehicleId === vId;
          const isFilteredOut = activeVehicleFilter !== 'ALL' && activeVehicleFilter !== vId;

          return (
            <div
              key={vId}
              onClick={() => onSelectVehicle && onSelectVehicle(vId)}
              className={`p-2.5 rounded-md border transition cursor-pointer ${
                isSelected
                  ? 'bg-[#F9FBFA] border-[#527D70] shadow-xs ring-1 ring-[#527D70]'
                  : isFilteredOut
                  ? 'opacity-40 bg-white border-[#EDF0F3]'
                  : 'bg-[#FAFAF8] border-[#D9DEE3] hover:bg-white hover:border-[#CBD5E1]'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center space-x-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: cfg.color }}
                  />
                  <span className="text-xs font-bold text-[#25364A]">{cfg.shortName}</span>
                </div>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                  sample.classification === 'DIRECT_OBSERVATION'
                    ? 'bg-[#EBF2EE] text-[#527D70] border-[#D0E0D6]'
                    : 'bg-[#EFF4F9] text-[#7189A6] border-[#D6E2EC]'
                }`}>
                  {sample.classification === 'DIRECT_OBSERVATION' ? 'Direct Obs (Synthetic)' : 'Interpolated'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-[#8A96A6] block font-sans">Speed</span>
                  <span className="font-bold text-[#25364A]">
                    {sample.speed_kmh || '0.0 km/h'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#8A96A6] block font-sans">Acceleration</span>
                  <span className={`font-bold ${
                    sample.accelVal < -1.5 ? 'text-[#B85C5C]' : sample.accelVal < 0 ? 'text-[#C18A45]' : 'text-[#25364A]'
                  }`}>
                    {sample.acceleration_mps2 || '0.00 m/s²'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Interactive SVG Dual Charts Container */}
      <div
        ref={containerRef}
        onPointerDown={handleGraphPointerDown}
        className="relative select-none cursor-crosshair bg-[#FAFAF8] rounded-md border border-[#D9DEE3] p-2 overflow-x-auto"
      >
        <svg
          viewBox={`0 0 ${svgWidth} ${graphHeight * 2 + 10}`}
          className="w-full h-auto block"
          style={{ minWidth: '600px' }}
        >
          {/* Defs for gradients/markers */}
          <defs>
            <linearGradient id="cursorGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#527D70" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#527D70" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          {/* ========================================================= */}
          {/* SUBPLOT 1: SPEED VERSUS TIME (km/h)                       */}
          {/* ========================================================= */}
          <g transform="translate(0, 0)">
            {/* Background Plot Area */}
            <rect
              x={padding.left}
              y={padding.top}
              width={plotWidth}
              height={plotHeight}
              fill="#FFFFFF"
              stroke="#E2E8F0"
              strokeWidth="1"
            />

            {/* Horizontal Grid Lines & Y-Axis Labels */}
            {[0, 20, 40, 60, 80].map((spd) => {
              const y = scaleSpeedY(spd);
              return (
                <g key={spd}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={padding.left + plotWidth}
                    y2={y}
                    stroke={spd === 0 ? '#CBD5E1' : '#F1F5F9'}
                    strokeWidth={spd === 0 ? '1.5' : '1'}
                    strokeDasharray={spd === 0 ? 'none' : '3 3'}
                  />
                  <text
                    x={padding.left - 8}
                    y={y + 3.5}
                    textAnchor="end"
                    fill="#64748B"
                    fontSize="9.5"
                    fontFamily="monospace"
                  >
                    {spd}
                  </text>
                </g>
              );
            })}

            {/* Y-Axis Title */}
            <text
              x={14}
              y={padding.top + plotHeight / 2}
              textAnchor="middle"
              transform={`rotate(-90 14 ${padding.top + plotHeight / 2})`}
              fill="#475569"
              fontSize="10"
              fontWeight="600"
              fontFamily="sans-serif"
            >
              Speed (km/h)
            </text>

            {/* Vertical Milestone Guides */}
            {keyMilestones.map((m) => {
              const mx = scaleX(m.sec);
              return (
                <line
                  key={m.id}
                  x1={mx}
                  y1={padding.top}
                  x2={mx}
                  y2={padding.top + plotHeight}
                  stroke={m.color}
                  strokeWidth="1"
                  strokeDasharray="2 2"
                  opacity="0.6"
                />
              );
            })}

            {/* Vehicle Trajectory Lines */}
            {['V3', 'V2', 'V1'].map((vId) => {
              if (!isVehicleVisible(vId)) return null;
              const points = trajectorySeries[vId] || [];
              const pathStr = buildSvgPath(points, 'speedVal', scaleSpeedY);
              const cfg = vehicleConfig[vId];
              const isSelected = selectedVehicleId === vId;

              return (
                <g key={vId}>
                  <path
                    d={pathStr}
                    fill="none"
                    stroke={cfg.color}
                    strokeWidth={isSelected ? '2.8' : '2.0'}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={isSelected || activeVehicleFilter !== 'ALL' ? 1.0 : 0.85}
                  />

                  {/* Empirical Direct Observation Nodes */}
                  {points.map((pt, idx) => {
                    if (pt.speedVal === null) return null;
                    const cx = scaleX(pt.seconds);
                    const cy = scaleSpeedY(pt.speedVal);
                    const isSelectedWp = selectedWaypoint &&
                      selectedWaypoint.vehicleId === vId &&
                      selectedWaypoint.rowIndex === pt.rowIndex;

                    return (
                      <circle
                        key={idx}
                        cx={cx}
                        cy={cy}
                        r={isSelectedWp ? 5.5 : isSelected ? 3.5 : 3.0}
                        fill={isSelectedWp ? '#FEF3C7' : '#FFFFFF'}
                        stroke={isSelectedWp ? '#D97706' : cfg.color}
                        strokeWidth={isSelectedWp ? '3.0' : isSelected ? '2.2' : '1.8'}
                        className="transition-transform hover:scale-150 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSelectWaypoint) {
                            onSelectWaypoint({
                              vehicleId: vId,
                              rowIndex: pt.rowIndex,
                              seconds: pt.seconds,
                              exactTimestamp: pt.exactTimestamp
                            });
                          }
                          if (onSelectVehicle) {
                            onSelectVehicle(vId);
                          }
                          onSeek(pt.seconds);
                        }}
                        onMouseEnter={() => setHoveredPoint({ ...pt, vehicleId: vId, type: 'Speed', unit: 'km/h', value: pt.speedVal })}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    );
                  })}
                </g>
              );
            })}

            {/* Live Playhead Synchronized Cursor */}
            <line
              x1={cursorX}
              y1={padding.top}
              x2={cursorX}
              y2={padding.top + plotHeight}
              stroke="#527D70"
              strokeWidth="1.8"
            />
          </g>

          {/* ========================================================= */}
          {/* SUBPLOT 2: ACCELERATION VERSUS TIME (m/s²)                */}
          {/* ========================================================= */}
          <g transform={`translate(0, ${graphHeight + 10})`}>
            {/* Background Plot Area */}
            <rect
              x={padding.left}
              y={padding.top}
              width={plotWidth}
              height={plotHeight}
              fill="#FFFFFF"
              stroke="#E2E8F0"
              strokeWidth="1"
            />

            {/* Zero Acceleration Reference Line */}
            <line
              x1={padding.left}
              y1={zeroAccelY}
              x2={padding.left + plotWidth}
              y2={zeroAccelY}
              stroke="#94A3B8"
              strokeWidth="1.5"
            />

            {/* Horizontal Grid Lines & Y-Axis Labels */}
            {[-4.0, -3.0, -2.0, -1.0, 0.0, 1.0].map((acc) => {
              const y = scaleAccelY(acc);
              return (
                <g key={acc}>
                  {acc !== 0 && (
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={padding.left + plotWidth}
                      y2={y}
                      stroke="#F1F5F9"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
                  )}
                  <text
                    x={padding.left - 8}
                    y={y + 3.5}
                    textAnchor="end"
                    fill="#64748B"
                    fontSize="9.5"
                    fontFamily="monospace"
                  >
                    {acc > 0 ? `+${acc.toFixed(1)}` : acc.toFixed(1)}
                  </text>
                </g>
              );
            })}

            {/* Y-Axis Title */}
            <text
              x={14}
              y={padding.top + plotHeight / 2}
              textAnchor="middle"
              transform={`rotate(-90 14 ${padding.top + plotHeight / 2})`}
              fill="#475569"
              fontSize="10"
              fontWeight="600"
              fontFamily="sans-serif"
            >
              Accel (m/s²)
            </text>

            {/* Vertical Milestone Guides */}
            {keyMilestones.map((m) => {
              const mx = scaleX(m.sec);
              return (
                <line
                  key={m.id}
                  x1={mx}
                  y1={padding.top}
                  x2={mx}
                  y2={padding.top + plotHeight}
                  stroke={m.color}
                  strokeWidth="1"
                  strokeDasharray="2 2"
                  opacity="0.6"
                />
              );
            })}

            {/* Vehicle Trajectory Lines */}
            {['V3', 'V2', 'V1'].map((vId) => {
              if (!isVehicleVisible(vId)) return null;
              const points = trajectorySeries[vId] || [];
              const pathStr = buildSvgPath(points, 'accelVal', scaleAccelY);
              const cfg = vehicleConfig[vId];
              const isSelected = selectedVehicleId === vId;

              return (
                <g key={vId}>
                  <path
                    d={pathStr}
                    fill="none"
                    stroke={cfg.color}
                    strokeWidth={isSelected ? '2.8' : '2.0'}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={isSelected || activeVehicleFilter !== 'ALL' ? 1.0 : 0.85}
                  />

                  {/* Empirical Direct Observation Nodes */}
                  {points.map((pt, idx) => {
                    if (pt.accelVal === null) return null;
                    const cx = scaleX(pt.seconds);
                    const cy = scaleAccelY(pt.accelVal);
                    const isSelectedWp = selectedWaypoint &&
                      selectedWaypoint.vehicleId === vId &&
                      selectedWaypoint.rowIndex === pt.rowIndex;

                    return (
                      <circle
                        key={idx}
                        cx={cx}
                        cy={cy}
                        r={isSelectedWp ? 5.5 : isSelected ? 3.5 : 3.0}
                        fill={isSelectedWp ? '#FEF3C7' : '#FFFFFF'}
                        stroke={isSelectedWp ? '#D97706' : cfg.color}
                        strokeWidth={isSelectedWp ? '3.0' : isSelected ? '2.2' : '1.8'}
                        className="transition-transform hover:scale-150 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSelectWaypoint) {
                            onSelectWaypoint({
                              vehicleId: vId,
                              rowIndex: pt.rowIndex,
                              seconds: pt.seconds,
                              exactTimestamp: pt.exactTimestamp
                            });
                          }
                          if (onSelectVehicle) {
                            onSelectVehicle(vId);
                          }
                          onSeek(pt.seconds);
                        }}
                        onMouseEnter={() => setHoveredPoint({ ...pt, vehicleId: vId, type: 'Acceleration', unit: 'm/s²', value: pt.accelVal })}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    );
                  })}
                </g>
              );
            })}

            {/* X-Axis Horizontal Baseline */}
            <line
              x1={padding.left}
              y1={padding.top + plotHeight}
              x2={padding.left + plotWidth}
              y2={padding.top + plotHeight}
              stroke="#CBD5E1"
              strokeWidth="1"
            />

            {/* X-Axis Time Ticks (every 0.5s) */}
            {[0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0].map((t) => {
              const sec = startTime + t;
              if (sec > endTime + 0.01) return null;
              const tx = scaleX(sec);
              const isMajor = t % 1.0 === 0;

              return (
                <g key={t}>
                  <line
                    x1={tx}
                    y1={padding.top + plotHeight}
                    x2={tx}
                    y2={padding.top + plotHeight + (isMajor ? 5 : 3)}
                    stroke="#94A3B8"
                    strokeWidth={isMajor ? '1.5' : '1'}
                  />
                  {isMajor && (
                    <text
                      x={tx}
                      y={padding.top + plotHeight + 16}
                      textAnchor="middle"
                      fill="#64748B"
                      fontSize="9.5"
                      fontFamily="monospace"
                    >
                      {t === 0 ? '0.0s' : `+${t.toFixed(1)}s`}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Live Playhead Synchronized Cursor */}
            <line
              x1={cursorX}
              y1={padding.top}
              x2={cursorX}
              y2={padding.top + plotHeight}
              stroke="#527D70"
              strokeWidth="1.8"
            />

            {/* Cursor Flag Marker at Bottom */}
            <polygon
              points={`${cursorX - 4},${padding.top + plotHeight + 2} ${cursorX + 4},${padding.top + plotHeight + 2} ${cursorX},${padding.top + plotHeight - 3}`}
              fill="#527D70"
            />
          </g>

          {/* Cursor Badge at Top Subplot */}
          <g transform={`translate(${cursorX}, 14)`}>
            <rect
              x="-24"
              y="-12"
              width="48"
              height="15"
              rx="3"
              fill="#527D70"
            />
            <text
              x="0"
              y="-2"
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="9"
              fontWeight="bold"
              fontFamily="monospace"
            >
              {`+${(currentSeconds - startTime).toFixed(2)}s`}
            </text>
          </g>
        </svg>

        {/* Hover Tooltip Box */}
        {hoveredPoint && (
          <div
            className="absolute z-30 bg-[#25364A] text-white p-2.5 rounded shadow-xl text-xs space-y-1 pointer-events-none font-sans"
            style={{
              left: `${Math.min(window.innerWidth - 220, Math.max(10, scaleX(hoveredPoint.seconds) * 0.95))}px`,
              top: '12px'
            }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-[#3D526B] pb-1">
              <span className="font-bold text-white flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: vehicleConfig[hoveredPoint.vehicleId]?.color }}
                />
                {hoveredPoint.vehicleId}
              </span>
              <span className="font-mono text-[10px] text-[#A5B4FC]">{hoveredPoint.exactTimestamp}</span>
            </div>
            <div className="font-mono text-[11px] text-[#E2E8F0]">
              <span>{hoveredPoint.type}: </span>
              <strong className="text-white">{hoveredPoint.value} {hoveredPoint.unit}</strong>
            </div>
            <div className="text-[10px] text-[#94A3B8] flex items-center justify-between gap-3 pt-0.5">
              <span>CSV Row #{hoveredPoint.rowIndex}</span>
              <span className="text-[#34D399] font-medium">{hoveredPoint.classification} (Synthetic CSV)</span>
            </div>
          </div>
        )}
      </div>

      {/* 4. Graph Footnote & Forensic Citations */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-[#697586] pt-1 border-t border-[#EDF0F3]">
        <div className="flex items-center space-x-2">
          <Info className="w-3.5 h-3.5 text-[#527D70] shrink-0" />
          <span>
            Click or drag across the graph to seek the reconstruction timeline. Solid lines show interpolation; hollow circular nodes represent direct CSV observations (Simulated/Demo Dataset).
          </span>
        </div>
        <div className="flex items-center space-x-3 shrink-0 font-mono text-[10px]">
          <span className="flex items-center gap-1 text-[#2563EB]">
            <span className="w-2 h-2 rounded-full bg-[#2563EB]" /> V1 (Tesla)
          </span>
          <span className="flex items-center gap-1 text-[#D97706]">
            <span className="w-2 h-2 rounded-full bg-[#D97706]" /> V2 (Ford)
          </span>
          <span className="flex items-center gap-1 text-[#475569]">
            <span className="w-2 h-2 rounded-full bg-[#475569]" /> V3 (Honda)
          </span>
        </div>
      </div>
    </div>
  );
}