/**
 * TRACE AI - 3D Reconstruction Data Hook
 * 
 * Aggregates evidence, coordinates, and event markers into structured scene state.
 */

import { useState, useMemo } from 'react';
import { buildReconstructionSceneData } from '../services/reconstructionDataAdapter.js';

export function useReconstructionData({
  evidenceSources = [],
  timelineEvents = [],
  vehicles = [],
  incident = null,
  contradictions = []
} = {}) {
  const [selectedVehicleId, setSelectedVehicleId] = useState('V1');
  const [selectedWaypoint, setSelectedWaypoint] = useState(null);
  const [cameraMode, setCameraMode] = useState('perspective');
  const [inspectorTab, setInspectorTab] = useState('vehicle'); // 'vehicle' | 'comparison' | 'evidence'

  const [layers, setLayers] = useState({
    grid: true,
    road: true,
    vehicles: true,
    trajectories: true,
    waypoints: true,
    collisions: true
  });

  // Build 3D scene data deterministically from evidence inputs
  const sceneData = useMemo(() => {
    return buildReconstructionSceneData({
      evidenceSources,
      timelineEvents,
      vehicles,
      incident,
      contradictions
    });
  }, [evidenceSources, timelineEvents, vehicles, incident, contradictions]);

  // Key event markers for timeline scrubber and jump buttons
  const keyEvents = useMemo(() => {
    if (!sceneData || sceneData.status !== 'READY') return [];

    const events = [];
    const tBounds = sceneData.timelineBounds;

    // Approach
    events.push({
      id: 'EVT-KEY-APPROACH',
      shortLabel: 'Approach',
      label: 'Pre-Incident Approach',
      seconds: tBounds.start,
      exactTimestamp: '18:42:09.020 UTC',
      sourceCitation: 'V1 Row #1, V2 Row #11, V3 Row #21'
    });

    // Braking
    events.push({
      id: 'EVT-KEY-BRAKE',
      shortLabel: 'Braking',
      label: 'Braking Onset',
      seconds: tBounds.start + 1.5,
      exactTimestamp: '18:42:10.520 UTC',
      sourceCitation: 'V1 Row #4, V2 Row #14'
    });

    // T0 Reference Epoch
    events.push({
      id: 'EVT-KEY-IMPACT',
      shortLabel: 'T0 Ref',
      label: 'T0 Reference Epoch',
      seconds: tBounds.t0,
      exactTimestamp: '18:42:11.020 UTC',
      sourceCitation: 'V1 Row #5, V2 Row #15'
    });

    // Peak Decel
    events.push({
      id: 'EVT-KEY-PEAK',
      shortLabel: 'Peak Decel',
      label: 'Peak Deceleration (Closest Proximity)',
      seconds: tBounds.t0 + 0.2,
      exactTimestamp: '18:42:11.220 UTC',
      sourceCitation: 'V1 Row #6, V2 Row #16'
    });

    // Final Rest
    events.push({
      id: 'EVT-KEY-REST',
      shortLabel: 'Final Rest',
      label: 'Final Rest Positions',
      seconds: tBounds.end,
      exactTimestamp: '18:42:14.020 UTC',
      sourceCitation: 'V1 Row #10, V2 Row #20, V3 Row #30'
    });

    return events;
  }, [sceneData]);

  return {
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
  };
}
