/**
 * TRACE AI - Vehicle Trajectories & Spatial Waypoint Renderer
 * 
 * Generates continuous 3D spatial trajectory lines and verified empirical waypoint markers
 * for each vehicle in the accident reconstruction scene.
 * 
 * FORENSIC PRINCIPLES:
 * - Trajectory lines represent DERIVED_VALUE metric paths connecting empirical observations.
 * - Distinct spherical markers represent DIRECT_OBSERVATION empirical CSV rows.
 * - Waypoint markers retain full evidence provenance (Row #, exact timestamp, source ID, CAN speed).
 * - Clicking a waypoint dispatches selection event to the Inspector.
 */

import * as THREE from 'three';
import { VEHICLE_COLORS } from '../services/reconstructionDataAdapter.js';

export function createVehicleTrajectories(
  trajectoriesByVehicle = {},
  {
    showWaypoints = true,
    showVectors = false,
    selectedVehicleId = 'V1',
    selectedWaypoint = null
  } = {}
) {
  const group = new THREE.Group();
  group.name = 'VehicleTrajectoriesGroup';

  Object.entries(trajectoriesByVehicle).forEach(([vehId, waypoints]) => {
    if (!Array.isArray(waypoints) || waypoints.length === 0) return;

    const colors = VEHICLE_COLORS[vehId] || VEHICLE_COLORS.DEFAULT;
    const colorHex = new THREE.Color(colors.primary);
    const isVehicleSelected = !selectedVehicleId || selectedVehicleId === vehId;

    // 1. Continuous Trajectory Polyline (DERIVED_VALUE)
    const points = waypoints
      .filter((p) => !p.isGpsMissing)
      .map((p) => new THREE.Vector3(p.x, p.y + 0.08, p.z));

    if (points.length >= 2) {
      const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
      
      // Underlay dark contrast line
      const shadowMat = new THREE.LineBasicMaterial({
        color: 0x0F172A,
        linewidth: isVehicleSelected ? 4 : 2,
        transparent: true,
        opacity: isVehicleSelected ? 0.6 : 0.25
      });
      const shadowLine = new THREE.Line(lineGeom, shadowMat);
      shadowLine.position.y = -0.01;
      group.add(shadowLine);

      // Vibrant vehicle color trajectory line
      const lineMat = new THREE.LineBasicMaterial({
        color: colorHex,
        linewidth: isVehicleSelected ? 3.5 : 1.8,
        transparent: true,
        opacity: isVehicleSelected ? 0.98 : 0.45
      });
      const trajectoryLine = new THREE.Line(lineGeom, lineMat);
      trajectoryLine.name = `TrajectoryLine_${vehId}`;
      trajectoryLine.userData = {
        vehicleId: vehId,
        classification: 'DERIVED_VALUE',
        description: `Piecewise local Cartesian path derived from WGS-84 to ENU projection`
      };
      group.add(trajectoryLine);
    }

    // 2. Verified Observation Waypoint Markers (DIRECT_OBSERVATION)
    if (showWaypoints) {
      const waypointGeom = new THREE.SphereGeometry(0.38, 16, 16);
      const waypointMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.25,
        metalness: 0.5,
        emissive: colorHex,
        emissiveIntensity: 0.35
      });

      // Ground anchor ring geometry
      const groundRingGeom = new THREE.RingGeometry(0.32, 0.46, 16);
      groundRingGeom.rotateX(-Math.PI / 2);
      const groundRingMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide
      });

      // Special highlight for impact row (Row 6 for V1, Row 16 for V2, Row 26 for V3)
      const impactMat = new THREE.MeshStandardMaterial({
        color: 0xEF4444,
        roughness: 0.2,
        metalness: 0.8,
        emissive: 0xDC2626,
        emissiveIntensity: 0.7
      });

      waypoints.forEach((p) => {
        if (p.isGpsMissing) return;

        const isImpactRow = (vehId === 'V1' && p.rowIndex === 6) ||
                            (vehId === 'V2' && p.rowIndex === 16) ||
                            (vehId === 'V3' && p.rowIndex === 26);

        const isSelectedWaypoint = selectedWaypoint &&
          selectedWaypoint.vehicleId === vehId &&
          selectedWaypoint.rowIndex === p.rowIndex;

        // Ground anchor ring
        const gRing = new THREE.Mesh(groundRingGeom, groundRingMat);
        gRing.position.set(p.x, 0.04, p.z);
        group.add(gRing);

        // Prominent target ring for explicitly selected waypoint
        if (isSelectedWaypoint) {
          const targetRingGeom = new THREE.RingGeometry(0.55, 0.75, 24);
          targetRingGeom.rotateX(-Math.PI / 2);
          const targetRingMat = new THREE.MeshBasicMaterial({
            color: 0xF59E0B, // Amber gold
            side: THREE.DoubleSide
          });
          const targetRing = new THREE.Mesh(targetRingGeom, targetRingMat);
          targetRing.position.set(p.x, 0.06, p.z);
          group.add(targetRing);
        }

        const sphere = new THREE.Mesh(waypointGeom, isImpactRow ? impactMat : waypointMat);
        sphere.position.set(p.x, p.y + 0.08, p.z);
        if (isSelectedWaypoint) {
          sphere.scale.set(1.4, 1.4, 1.4);
        }
        sphere.castShadow = true;

        sphere.userData = {
          vehicleId: vehId,
          rowIndex: p.rowIndex,
          exactTimestamp: p.exactTimestamp,
          seconds: p.seconds,
          lat: p.lat,
          lon: p.lon,
          speed: p.speed_kmh,
          speedVal: p.speedVal,
          accel: p.acceleration_mps2,
          brake: p.brake_status,
          isObservation: true,
          classification: 'DIRECT_OBSERVATION',
          sourceId: p.sourceId,
          sourceFileName: p.sourceFileName
        };
        group.add(sphere);

        // Optional Velocity Vector Arrow
        if (showVectors && p.speedVal > 2.0) {
          const dir = new THREE.Vector3(
            Math.sin(p.yaw || 0),
            0,
            -Math.cos(p.yaw || 0)
          ).normalize();
          const length = Math.min(p.speedVal * 0.15, 8.0);
          const arrow = new THREE.ArrowHelper(dir, sphere.position, length, colors.primary, 0.8, 0.4);
          group.add(arrow);
        }
      });
    }
  });

  return group;
}
