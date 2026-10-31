/**
 * TRACE AI - Advanced 3D Accident Reconstruction & Spatial Visualization
 * 
 * Interactive, telemetry-driven 3D forensic environment transforming physical
 * sensor observations, GPS coordinates, and synchronized timeline events
 * into a verifiable spatial reconstruction.
 */

import React from 'react';
import {
  Layers,
  Car,
  AlertTriangle,
  Compass,
  MapPin,
  Clock,
  ShieldCheck,
  RotateCcw,
  Maximize2,
  Sliders,
  ExternalLink,
  Info,
  FileText
} from 'lucide-react';

import './Reconstruction3D.css';
import AccidentScene from './Scene/AccidentScene.jsx';
import SceneControls from './Scene/SceneControls.jsx';
import ReconstructionScrubber from './Timeline/ReconstructionScrubber.jsx';
import ReconstructionControls from './Timeline/ReconstructionControls.jsx';
import TelemetryGraphs from './Graphs/TelemetryGraphs.jsx';
import VehicleInspector from './Inspector/VehicleInspector.jsx';
import MultiVehicleComparison from './Inspector/MultiVehicleComparison.jsx';
import EvidenceInspector from './Inspector/EvidenceInspector.jsx';

import { useReconstructionData } from './hooks/useReconstructionData.js';
import { usePlaybackController } from './hooks/usePlaybackController.js';

export default function Reconstruction3D({
  evidenceSources = [],
  timelineEvents = [],
  vehicles = [],
  incident = null,
  contradictions = [],
  onNavigateTab
}) {
  const {
    sceneData,
    selectedVehicleId,
    setSelectedVehicleId,
    selectedWaypoint,
    setSelectedWaypoint,
    cameraMode,
    setCameraMode,
    layers,
    setLayers,
    inspectorTab,
    setInspectorTab,
    keyEvents
  } = useReconstructionData({
    evidenceSources,
    timelineEvents,
    vehicles,
    incident,
    contradictions
  });

  const timelineBounds = sceneData?.timelineBounds || { start: 0, end: 10, t0: 5, duration: 10 };

  const handleSelectWaypoint = (wp) => {
    setSelectedWaypoint(wp);
    if (wp) {
      setInspectorTab('vehicle');
    }
  };

  const {
    currentSeconds,
    isPlaying,
    playbackSpeed,
    play,
    pause,
    reset,
    seek,
    stepForward,
    stepBackward,
    setSpeed
  } = usePlaybackController({
    startTime: timelineBounds.start,
    endTime: timelineBounds.end,
    initialSpeed: 1.0,
    autoPlay: false
  });

  // Handle empty state gracefully
  if (sceneData?.status === 'EMPTY') {
    return (
      <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto font-sans">
        <div className="pb-5 border-b border-[#D9DEE3]">
          <h1 className="text-2xl font-bold text-[#25364A]">3D Accident Reconstruction</h1>
          <p className="text-xs text-[#697586] mt-1">Spatial visualization environment.</p>
        </div>

        <div className="rounded-lg bg-white border border-[#D9DEE3] p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#FAF4EB] border border-[#F0DFCA] flex items-center justify-center text-[#C18A45] mx-auto">
            <AlertTriangle className="w-6 h-6 text-[#C18A45]" />
          </div>
          <h3 className="text-base font-bold text-[#25364A]">No Telemetry Records Available</h3>
          <p className="text-xs text-[#697586] max-w-md mx-auto leading-relaxed">
            {sceneData.message || 'Please upload vehicle sensor telemetry via the Evidence Management Center to generate the 3D accident reconstruction.'}
          </p>
          <button
            onClick={() => onNavigateTab && onNavigateTab('evidence')}
            className="px-4 py-2 rounded-md bg-[#527D70] text-white text-xs font-semibold hover:bg-[#43675C] transition cursor-pointer shadow-xs"
          >
            Go to Evidence Upload Center
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#D9DEE3]">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-xs font-sans font-medium px-2.5 py-0.5 rounded bg-[#EBF2EE] text-[#527D70] border border-[#D0E0D6]">
              Phase 05
            </span>
            <span className="font-mono text-xs font-semibold text-[#25364A] bg-[#FAFAF8] px-2 py-0.5 rounded border border-[#D9DEE3]">
              Incident: {incident?.id || 'INC-2026-0884'}
            </span>
            <span className="text-xs text-[#697586] bg-white px-2 py-0.5 rounded border border-[#D9DEE3]">
              {sceneData.totalObservations} Telemetry Observations
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#EFF4F9] text-[#7189A6] border border-[#D6E2EC]">
              {sceneData.mode === 'GEODETIC_WGS84_ENU' ? 'WGS84 / Local ENU' : 'Schematic'}
            </span>
          </div>

          <h1 className="text-2xl font-bold text-[#25364A] tracking-tight">
            Advanced 3D Accident Reconstruction & Spatial Visualization
          </h1>

          <p className="text-xs text-[#697586] leading-relaxed">
            Telemetry-driven spatial reconstruction projecting physical vehicle positions, headings, and braking dynamics across the collision horizon.
          </p>
        </div>

        {/* Status Pills */}
        <div className="flex items-center space-x-2">
          <div className="px-3 py-1.5 rounded-md bg-white border border-[#D9DEE3] text-xs text-[#697586] flex items-center gap-1.5 shadow-xs">
            <Car className="w-3.5 h-3.5 text-[#527D70]" />
            <span><strong className="text-[#25364A]">{sceneData.vehicles.length}</strong> Vehicles Tracked</span>
          </div>
          <div className="px-3 py-1.5 rounded-md bg-[#FBF2F2] border border-[#F1D7D7] text-xs text-[#B85C5C] flex items-center gap-1.5 font-medium shadow-xs">
            <AlertTriangle className="w-3.5 h-3.5 text-[#B85C5C]" />
            <span>T0: {sceneData.collisionMarkers[0]?.exactTimestamp || '18:42:11.020 UTC'}</span>
          </div>
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('reports')}
              className="px-3 py-1.5 rounded-md bg-[#527D70] hover:bg-[#43675C] text-white text-xs font-medium flex items-center gap-1.5 shadow-xs cursor-pointer transition"
              title="Open Forensic Technical Investigation Report"
            >
              <FileText className="w-3.5 h-3.5 text-white" />
              <span>Forensic Report</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Main Workspace Grid: 3D Viewport (Left 8 cols) + Inspector (Right 4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: 3D Viewport + Playback Scrubber & Controls */}
        <div className="lg:col-span-8 space-y-4">
          {/* 3D Canvas Box */}
          <div className="reconstruction-viewport-container bg-[#F5F4EF] rounded-lg border border-[#D9DEE3] shadow-card relative overflow-hidden">
            {/* Viewport Overlay Controls (Camera, Presets, Layers, Compass) */}
            <SceneControls
              cameraMode={cameraMode}
              setCameraMode={setCameraMode}
              onResetCamera={() => setCameraMode('perspective')}
              layers={layers}
              setLayers={setLayers}
              selectedVehicleId={selectedVehicleId}
              setSelectedVehicleId={setSelectedVehicleId}
              vehicles={sceneData.vehicles}
              coordinateQuality={sceneData.coordinateQuality}
              mode={sceneData.mode}
            />

            {/* Three.js Canvas */}
            <div className="reconstruction-canvas-wrapper h-[480px] lg:h-[560px]">
              <AccidentScene
                sceneData={sceneData}
                currentSeconds={currentSeconds}
                selectedVehicleId={selectedVehicleId}
                onSelectVehicle={setSelectedVehicleId}
                selectedWaypoint={selectedWaypoint}
                onSelectWaypoint={handleSelectWaypoint}
                onSeek={seek}
                cameraMode={cameraMode}
                layers={layers}
              />
            </div>
          </div>

          {/* Bottom Card: Synchronized Timeline Scrubber & Playback Controls */}
          <div className="rounded-lg bg-white border border-[#D9DEE3] p-4 lg:p-5 space-y-3 shadow-card">
            {/* Timeline Scrubber */}
            <ReconstructionScrubber
              startTime={timelineBounds.start}
              endTime={timelineBounds.end}
              currentSeconds={currentSeconds}
              t0Seconds={timelineBounds.t0}
              onSeek={seek}
              keyEvents={keyEvents}
            />

            {/* Playback Controls & Readout */}
            <ReconstructionControls
              isPlaying={isPlaying}
              onPlay={play}
              onPause={pause}
              onReset={reset}
              onStepBackward={stepBackward}
              onStepForward={stepForward}
              playbackSpeed={playbackSpeed}
              onSetSpeed={setSpeed}
              currentSeconds={currentSeconds}
              t0Seconds={timelineBounds.t0}
              keyEvents={keyEvents}
              onSeek={seek}
            />
          </div>

          {/* Synchronized Telemetry Graphs: Speed vs Time & Acceleration vs Time */}
          <TelemetryGraphs
            sceneData={sceneData}
            currentSeconds={currentSeconds}
            onSeek={seek}
            selectedVehicleId={selectedVehicleId}
            onSelectVehicle={setSelectedVehicleId}
            selectedWaypoint={selectedWaypoint}
            onSelectWaypoint={handleSelectWaypoint}
          />
        </div>

        {/* Right Column: Forensic Inspector (Vehicle Telemetry / Collision Evidence) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Inspector View Switcher Tabs */}
          <div className="flex rounded-md bg-[#FAFAF8] p-1 border border-[#D9DEE3] text-xs font-medium">
            <button
              onClick={() => setInspectorTab('vehicle')}
              className={`flex-1 py-1.5 rounded transition cursor-pointer text-center ${
                inspectorTab === 'vehicle'
                  ? 'bg-white text-[#25364A] font-bold shadow-xs border border-[#D9DEE3]'
                  : 'text-[#697586] hover:text-[#25364A]'
              }`}
            >
              Vehicle & Waypoint
            </button>
            <button
              onClick={() => setInspectorTab('comparison')}
              className={`flex-1 py-1.5 rounded transition cursor-pointer text-center ${
                inspectorTab === 'comparison'
                  ? 'bg-white text-[#25364A] font-bold shadow-xs border border-[#D9DEE3]'
                  : 'text-[#697586] hover:text-[#25364A]'
              }`}
            >
              Comparison
            </button>
            <button
              onClick={() => setInspectorTab('evidence')}
              className={`flex-1 py-1.5 rounded transition cursor-pointer text-center ${
                inspectorTab === 'evidence'
                  ? 'bg-white text-[#25364A] font-bold shadow-xs border border-[#D9DEE3]'
                  : 'text-[#697586] hover:text-[#25364A]'
              }`}
            >
              Collision & Evidence
            </button>
          </div>

          {/* Tab 1: Vehicle & Waypoint-Level Evidence Inspector */}
          {inspectorTab === 'vehicle' && (
            <VehicleInspector
              selectedVehicleId={selectedVehicleId}
              onSelectVehicle={setSelectedVehicleId}
              sceneData={sceneData}
              currentSeconds={currentSeconds}
              selectedWaypoint={selectedWaypoint}
              onSelectWaypoint={handleSelectWaypoint}
              onSeek={seek}
              onNavigateTab={onNavigateTab}
            />
          )}

          {/* Tab 2: Multi-Vehicle Forensic Comparison */}
          {inspectorTab === 'comparison' && (
            <MultiVehicleComparison
              sceneData={sceneData}
              currentSeconds={currentSeconds}
              selectedVehicleId={selectedVehicleId}
              onSelectVehicle={setSelectedVehicleId}
              onSeek={seek}
            />
          )}

          {/* Tab 3: Collision & Evidence Stream Inspector */}
          {inspectorTab === 'evidence' && (
            <EvidenceInspector
              sceneData={sceneData}
              onNavigateTab={onNavigateTab}
              onJumpToTimestamp={seek}
            />
          )}
        </div>
      </div>
    </div>
  );
}
