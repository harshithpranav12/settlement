/**
 * TRACE AI - Main 3D Accident Scene Viewport
 * 
 * Manages Three.js WebGL canvas lifecycle, lighting, camera perspectives, OrbitControls,
 * real-time telemetry animation loop, and interactive vehicle selection.
 */

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { createCoordinateGrid } from './CoordinateGrid.js';
import { createRoadGeometry } from './RoadGeometry.js';
import { createVehicle3DModel } from './VehicleModel.js';
import { createVehicleTrajectories } from './VehicleTrajectories.js';
import { createCollisionMarkers } from './CollisionMarkers.js';
import { sampleVehicleStateAtTime } from '../utils/trajectoryInterpolation.js';

export default function AccidentScene({
  sceneData,
  currentSeconds,
  selectedVehicleId,
  onSelectVehicle,
  selectedWaypoint = null,
  onSelectWaypoint,
  onSeek,
  cameraMode = 'perspective',
  layers = { grid: true, road: true, trajectories: true, waypoints: true, collisions: true }
}) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const animFrameIdRef = useRef(null);

  // Dynamic references to vehicle meshes and marker groups
  const vehicleMeshesRef = useRef({});
  const trajectoriesGroupRef = useRef(null);
  const gridGroupRef = useRef(null);
  const roadGroupRef = useRef(null);
  const collisionGroupRef = useRef(null);

  // Raycasting for interactive clicks
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());

  // Initialize Three.js Scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 550;

    // 1. Scene & Background
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xF5F4EF); // Match TRACE AI light theme
    scene.fog = new THREE.FogExp2(0xF5F4EF, 0.0035);
    sceneRef.current = scene;

    // 2. Camera - Forensic Framing: encompasses V1, V2, V3 upstream approach, intersection & scale bar
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.5, 1000);
    camera.position.set(48, 34, 42);
    cameraRef.current = camera;

    // 3. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    rendererRef.current = renderer;

    container.replaceChildren(renderer.domElement);

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.04; // Don't go under ground
    controls.minDistance = 6;
    controls.maxDistance = 350;
    controls.target.set(6, 1.0, -18);
    controlsRef.current = controls;

    // 5. High-Fidelity Forensic Three-Point Lighting Setup
    // Base ambient illumination
    const ambientLight = new THREE.HemisphereLight(0xFFFFFF, 0x94A3B8, 0.65);
    scene.add(ambientLight);

    // Key Sun Light: casts crisp, soft geometric vehicle shadows across the pavement
    const keySunLight = new THREE.DirectionalLight(0xFFFFFF, 1.30);
    keySunLight.position.set(50, 85, 45);
    keySunLight.castShadow = true;
    keySunLight.shadow.mapSize.width = 2048;
    keySunLight.shadow.mapSize.height = 2048;
    keySunLight.shadow.camera.near = 10;
    keySunLight.shadow.camera.far = 280;
    const shadowD = 110;
    keySunLight.shadow.camera.left = -shadowD;
    keySunLight.shadow.camera.right = shadowD;
    keySunLight.shadow.camera.top = shadowD;
    keySunLight.shadow.camera.bottom = -shadowD;
    keySunLight.shadow.bias = -0.0005;
    scene.add(keySunLight);

    // Fill Light: illuminates vehicle flanks facing away from the sun so details are not lost in shadow
    const fillLight = new THREE.DirectionalLight(0xD6E2EC, 0.55);
    fillLight.position.set(-45, 55, -40);
    scene.add(fillLight);

    // Rim / Contour Accent Light: gives vehicle rooflines and silhouettes distinct edge separation
    const rimLight = new THREE.DirectionalLight(0xF8FAFC, 0.38);
    rimLight.position.set(-25, 35, 55);
    scene.add(rimLight);

    // 6. Build Environment Geometries
    const roadGroup = createRoadGeometry();
    roadGroupRef.current = roadGroup;
    scene.add(roadGroup);

    const gridGroup = createCoordinateGrid({ size: 320, divisions: 32 });
    gridGroupRef.current = gridGroup;
    scene.add(gridGroup);

    // 7. Click Detection Listener
    const handleClick = (event) => {
      if (!container || !camera || !renderer) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const intersects = raycasterRef.current.intersectObjects(scene.children, true);

      for (const hit of intersects) {
        // Find ancestor with vehicleId or markerId
        let cur = hit.object;
        while (cur && cur !== scene) {
          if (cur.userData && cur.userData.isObservation) {
            if (typeof onSelectWaypoint === 'function') {
              onSelectWaypoint({
                vehicleId: cur.userData.vehicleId,
                rowIndex: cur.userData.rowIndex,
                seconds: cur.userData.seconds,
                exactTimestamp: cur.userData.exactTimestamp
              });
            }
            if (typeof onSelectVehicle === 'function') {
              onSelectVehicle(cur.userData.vehicleId);
            }
            if (typeof onSeek === 'function' && typeof cur.userData.seconds === 'number') {
              onSeek(cur.userData.seconds);
            }
            return;
          }
          if (cur.userData && cur.userData.vehicleId) {
            onSelectVehicle(cur.userData.vehicleId);
            return;
          }
          cur = cur.parent;
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', handleClick);

    // 8. Resize Observer
    const resizeObserver = new ResizeObserver(() => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 550;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    // 9. Render Loop
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handleClick);
      controls.dispose();
      renderer.dispose();
      container.replaceChildren();
    };
  }, []);

  // Update Trajectories, Waypoints, Collisions when sceneData or layers change
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !sceneData || sceneData.status !== 'READY') return;

    // Trajectories & Waypoints
    if (trajectoriesGroupRef.current) {
      scene.remove(trajectoriesGroupRef.current);
    }
    if (layers.trajectories || layers.waypoints) {
      const trajGroup = createVehicleTrajectories(sceneData.trajectories, {
        showWaypoints: layers.waypoints,
        showVectors: false,
        selectedVehicleId,
        selectedWaypoint
      });
      trajectoriesGroupRef.current = trajGroup;
      scene.add(trajGroup);
    }

    // Collision Markers
    if (collisionGroupRef.current) {
      scene.remove(collisionGroupRef.current);
    }
    if (layers.collisions && Array.isArray(sceneData.collisionMarkers)) {
      const colGroup = createCollisionMarkers(sceneData.collisionMarkers);
      collisionGroupRef.current = colGroup;
      scene.add(colGroup);
    }

    // Vehicle Meshes
    // Remove existing vehicle meshes
    Object.values(vehicleMeshesRef.current).forEach((mesh) => scene.remove(mesh));
    vehicleMeshesRef.current = {};

    // Create fresh vehicle meshes for each identified vehicle
    if (Array.isArray(sceneData.vehicles)) {
      sceneData.vehicles.forEach((veh) => {
        const model = createVehicle3DModel({
          vehicleId: veh.id,
          makeModel: veh.makeModel,
          type: veh.type,
          primaryColor: veh.colors.primary,
          dimensions: veh.dimensions
        });
        vehicleMeshesRef.current[veh.id] = model;
        scene.add(model);
      });
    }
  }, [sceneData, layers.trajectories, layers.waypoints, layers.collisions, selectedVehicleId, selectedWaypoint]);

  // Layer Toggles (Grid, Road, Vehicles)
  useEffect(() => {
    if (gridGroupRef.current) gridGroupRef.current.visible = Boolean(layers.grid !== false);
    if (roadGroupRef.current) roadGroupRef.current.visible = Boolean(layers.road !== false);
    Object.values(vehicleMeshesRef.current).forEach((m) => {
      m.visible = Boolean(layers.vehicles !== false);
    });
  }, [layers.grid, layers.road, layers.vehicles]);

  // Vehicle Selection Highlight
  useEffect(() => {
    Object.entries(vehicleMeshesRef.current).forEach(([vId, mesh]) => {
      if (mesh.userData && typeof mesh.userData.setSelected === 'function') {
        mesh.userData.setSelected(vId === selectedVehicleId);
      }
    });
  }, [selectedVehicleId]);

  // Synchronized Vehicle Positioning and HUD Updates at currentSeconds
  useEffect(() => {
    if (!sceneData || sceneData.status !== 'READY' || typeof currentSeconds !== 'number') return;

    Object.entries(vehicleMeshesRef.current).forEach(([vehId, mesh]) => {
      const waypoints = sceneData.trajectories[vehId] || [];
      const sample = sampleVehicleStateAtTime(waypoints, currentSeconds);

      // Update 3D position
      mesh.position.set(sample.x, sample.y, sample.z);

      // Update 3D orientation (yaw)
      if (typeof sample.yaw === 'number') {
        mesh.rotation.y = sample.yaw;
      }

      // Update dynamic brake light state
      if (mesh.userData && typeof mesh.userData.setBraking === 'function') {
        const isBraking = sample.brake_status === 'True' || sample.isBrakeActive;
        mesh.userData.setBraking(isBraking);
      }

      // Update overhead HUD badge
      if (mesh.userData && typeof mesh.userData.updateHud === 'function') {
        const isBraking = sample.brake_status === 'True' || sample.isBrakeActive;
        mesh.userData.updateHud(sample.speed_kmh ? `${sample.speed_kmh} km/h` : '0.0 km/h', isBraking);
      }
    });

    // Camera follow modes
    if (cameraMode === 'follow-v1' && vehicleMeshesRef.current['V1'] && controlsRef.current && cameraRef.current) {
      const v1Mesh = vehicleMeshesRef.current['V1'];
      controlsRef.current.target.lerp(new THREE.Vector3(v1Mesh.position.x, 1, v1Mesh.position.z), 0.1);
    } else if (cameraMode === 'follow-v2' && vehicleMeshesRef.current['V2'] && controlsRef.current && cameraRef.current) {
      const v2Mesh = vehicleMeshesRef.current['V2'];
      controlsRef.current.target.lerp(new THREE.Vector3(v2Mesh.position.x, 1, v2Mesh.position.z), 0.1);
    }
  }, [currentSeconds, sceneData, cameraMode]);

  // Camera Presets
  useEffect(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    if (cameraMode === 'perspective') {
      camera.position.set(48, 34, 42);
      controls.target.set(6, 1.0, -18);
    } else if (cameraMode === 'topdown') {
      camera.position.set(6, 115, -17.99);
      controls.target.set(6, 1.0, -18);
    }
  }, [cameraMode]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[480px] lg:min-h-[580px] relative select-none cursor-grab active:cursor-grabbing outline-none"
    />
  );
}
