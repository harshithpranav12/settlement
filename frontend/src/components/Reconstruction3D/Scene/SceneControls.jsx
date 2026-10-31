/**
 * TRACE AI - 3D Scene Controls & Viewport Overlay HUD
 * 
 * Provides camera view presets, display layer toggles, compass rose,
 * and calibrated metric scale reference.
 */

import React from 'react';
import {
  Compass,
  Layers,
  Eye,
  Maximize2,
  RotateCcw,
  Camera,
  Grid,
  MapPin,
  Car
} from 'lucide-react';

export default function SceneControls({
  cameraMode,
  setCameraMode,
  onResetCamera,
  layers,
  setLayers,
  selectedVehicleId,
  setSelectedVehicleId,
  vehicles = [],
  coordinateQuality,
  mode
}) {
  return (
    <div className="absolute top-4 left-4 right-4 pointer-events-none flex flex-wrap items-start justify-between gap-3 z-10 text-xs font-sans">
      {/* Left Pill: Camera Presets & Layer Toggles */}
      <div className="pointer-events-auto bg-white/95 backdrop-blur-sm border border-[#D9DEE3] rounded-lg shadow-card p-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-semibold text-[#8A96A6] px-2 flex items-center gap-1">
          <Camera className="w-3.5 h-3.5 text-[#527D70]" />
          Camera:
        </span>

        {[
          { id: 'perspective', label: 'Perspective' },
          { id: 'topdown', label: 'Top-Down (Plan)' },
          { id: 'follow-v1', label: 'Follow V1' },
          { id: 'follow-v2', label: 'Follow V2' },
        ].map((btn) => (
          <button
            key={btn.id}
            onClick={() => setCameraMode(btn.id)}
            className={`px-2.5 py-1 rounded text-xs transition cursor-pointer font-medium ${
              cameraMode === btn.id
                ? 'bg-[#EBF2EE] text-[#527D70] font-semibold border border-[#D0E0D6]'
                : 'text-[#697586] hover:text-[#25364A] hover:bg-[#F5F4EF]'
            }`}
          >
            {btn.label}
          </button>
        ))}

        <div className="w-[1px] h-4 bg-[#D9DEE3] mx-1"></div>

        <button
          onClick={onResetCamera}
          title="Reset camera position and zoom"
          className="p-1 rounded text-[#697586] hover:text-[#25364A] hover:bg-[#F5F4EF] cursor-pointer flex items-center gap-1 px-2"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#7189A6]" />
          <span>Reset</span>
        </button>

        <div className="w-[1px] h-4 bg-[#D9DEE3] mx-1"></div>

        {/* Display Layer Toggles */}
        <span className="text-[11px] font-semibold text-[#8A96A6] px-1 flex items-center gap-1">
          <Layers className="w-3.5 h-3.5 text-[#7189A6]" />
        </span>

        <button
          onClick={() => setLayers((prev) => ({ ...prev, road: !prev.road }))}
          className={`px-2 py-1 rounded text-[11px] font-medium border cursor-pointer ${
            layers.road !== false
              ? 'bg-[#EBF2EE] text-[#527D70] border-[#D0E0D6]'
              : 'bg-white text-[#8A96A6] border-transparent hover:bg-[#F5F4EF]'
          }`}
        >
          Road
        </button>

        <button
          onClick={() => setLayers((prev) => ({ ...prev, vehicles: !prev.vehicles }))}
          className={`px-2 py-1 rounded text-[11px] font-medium border cursor-pointer ${
            layers.vehicles !== false
              ? 'bg-[#EFF4F9] text-[#2563EB] border-[#D6E2EC]'
              : 'bg-white text-[#8A96A6] border-transparent hover:bg-[#F5F4EF]'
          }`}
        >
          Vehicles
        </button>

        <button
          onClick={() => setLayers((prev) => ({ ...prev, grid: !prev.grid }))}
          className={`px-2 py-1 rounded text-[11px] font-medium border cursor-pointer ${
            layers.grid
              ? 'bg-[#EFF4F9] text-[#7189A6] border-[#D6E2EC]'
              : 'bg-white text-[#8A96A6] border-transparent hover:bg-[#F5F4EF]'
          }`}
        >
          Grid
        </button>

        <button
          onClick={() => setLayers((prev) => ({ ...prev, trajectories: !prev.trajectories }))}
          className={`px-2 py-1 rounded text-[11px] font-medium border cursor-pointer ${
            layers.trajectories
              ? 'bg-[#EBF2EE] text-[#527D70] border-[#D0E0D6]'
              : 'bg-white text-[#8A96A6] border-transparent hover:bg-[#F5F4EF]'
          }`}
        >
          Paths
        </button>

        <button
          onClick={() => setLayers((prev) => ({ ...prev, waypoints: !prev.waypoints }))}
          className={`px-2 py-1 rounded text-[11px] font-medium border cursor-pointer ${
            layers.waypoints
              ? 'bg-[#FAF4EB] text-[#C18A45] border-[#F0DFCA]'
              : 'bg-white text-[#8A96A6] border-transparent hover:bg-[#F5F4EF]'
          }`}
        >
          Waypoints
        </button>

        <button
          onClick={() => setLayers((prev) => ({ ...prev, collisions: !prev.collisions }))}
          className={`px-2 py-1 rounded text-[11px] font-medium border cursor-pointer ${
            layers.collisions
              ? 'bg-[#FBF2F2] text-[#B85C5C] border-[#F1D7D7]'
              : 'bg-white text-[#8A96A6] border-transparent hover:bg-[#F5F4EF]'
          }`}
        >
          Collisions
        </button>
      </div>

      {/* Right Pill: Spatial Coordinate Quality Badge & Compass */}
      <div className="pointer-events-auto flex items-center space-x-2">
        <div className="bg-white/95 backdrop-blur-sm border border-[#D9DEE3] rounded-lg shadow-card px-3 py-1.5 flex items-center space-x-2 text-xs">
          <span className="w-2 h-2 rounded-full bg-[#527D70]"></span>
          <span className="font-mono text-[11px] text-[#25364A] font-semibold">
            {mode === 'GEODETIC_WGS84_ENU' ? 'WGS84 / ENU Metric' : 'Schematic Kinematic'}
          </span>
          <span className="text-[#8A96A6] text-[10px]">•</span>
          <span className="text-[#697586] text-[11px]">1 unit = 1 meter</span>
        </div>

        {/* Compass Heading Indicator */}
        <div className="w-9 h-9 rounded-lg bg-white/95 backdrop-blur-sm border border-[#D9DEE3] shadow-card flex items-center justify-center text-[#527D70]">
          <Compass className="w-5 h-5 text-[#527D70]" />
        </div>
      </div>
    </div>
  );
}
