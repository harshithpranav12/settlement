/**
 * TRACE AI - 3D Collision Marker & Forensic Event Overlay Engine
 * 
 * Generates calibrated 3D collision proximity zones, oriented bounding box (OBB) footprints,
 * bounding sphere wireframes, illustrative uncertainty halos, and provisional reference origin.
 * 
 * FORENSIC STANDARDS:
 * - GPS-only contact assessment is classified strictly as INDETERMINATE.
 * - The origin at (0, 0, 0) is labeled PROVISIONAL LOCAL REFERENCE ORIGIN (not collision epicenter).
 * - Deceleration vectors are shown as inertial impulses, not proof of mechanical contact.
 */

import * as THREE from 'three';
import { RECONCILED_VEHICLE_DIMENSIONS } from '../utils/collisionAssessment.js';

export function createCollisionMarkers(collisionMarkers = [], { onSelectMarker } = {}) {
  const group = new THREE.Group();
  group.name = 'CollisionMarkersGroup';

  // 1. Provisional Local Reference Origin Marker at (0, 0, 0)
  const originGroup = new THREE.Group();
  originGroup.name = 'ProvisionalReferenceOriginMarker';
  originGroup.position.set(0, 0, 0);

  // Crosshair target rings on ground
  const originRingGeom = new THREE.RingGeometry(1.2, 1.6, 32);
  originRingGeom.rotateX(-Math.PI / 2);
  const originRingMat = new THREE.MeshBasicMaterial({ color: 0x527D70, side: THREE.DoubleSide });
  const originRing = new THREE.Mesh(originRingGeom, originRingMat);
  originRing.position.y = 0.03;
  originGroup.add(originRing);

  // Origin vertical crosshair axis
  const crossGeomX = new THREE.BoxGeometry(4.0, 0.02, 0.12);
  const crossGeomZ = new THREE.BoxGeometry(0.12, 0.02, 4.0);
  const crossMat = new THREE.MeshBasicMaterial({ color: 0x527D70 });
  const crossX = new THREE.Mesh(crossGeomX, crossMat);
  crossX.position.y = 0.032;
  originGroup.add(crossX);

  const crossZ = new THREE.Mesh(crossGeomZ, crossMat);
  crossZ.position.y = 0.032;
  originGroup.add(crossZ);

  // Origin Ground Surveyor Datum Plaque (replaces floating billboard to eliminate occlusion)
  const originCanvas = document.createElement('canvas');
  originCanvas.width = 440;
  originCanvas.height = 130;
  const oCtx = originCanvas.getContext('2d');

  oCtx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  oCtx.strokeStyle = '#527D70';
  oCtx.lineWidth = 4;
  oCtx.beginPath();
  oCtx.roundRect(8, 8, 424, 114, 12);
  oCtx.fill();
  oCtx.stroke();

  oCtx.fillStyle = '#527D70';
  oCtx.font = 'bold 22px sans-serif';
  oCtx.textAlign = 'center';
  oCtx.fillText('PROVISIONAL REFERENCE ORIGIN (0, 0, 0)', 220, 42);

  oCtx.fillStyle = '#25364A';
  oCtx.font = 'bold 22px monospace';
  oCtx.fillText('WGS84: 37.541565°, -77.437165°', 220, 76);

  oCtx.fillStyle = '#697586';
  oCtx.font = '16px sans-serif';
  oCtx.fillText('SCHEMATIC LOCAL DATUM (±2.5m CEP)', 220, 104);

  const oTex = new THREE.CanvasTexture(originCanvas);
  const oPlaqueGeom = new THREE.PlaneGeometry(5.4, 1.6);
  oPlaqueGeom.rotateX(-Math.PI / 2);
  const oPlaqueMat = new THREE.MeshBasicMaterial({ map: oTex, transparent: true, side: THREE.DoubleSide });
  const oPlaque = new THREE.Mesh(oPlaqueGeom, oPlaqueMat);
  oPlaque.position.set(0, 0.052, -2.8);
  originGroup.add(oPlaque);

  group.add(originGroup);

  // 2. Incident Event Markers (Collision proximity & Standstill)
  collisionMarkers.forEach((marker) => {
    const markerGroup = new THREE.Group();
    markerGroup.name = `Marker_${marker.id}`;
    markerGroup.position.set(marker.x, marker.y, marker.z);

    const isPrimary = marker.id.includes('PROVISIONAL') || marker.id.includes('PRIMARY');
    const colorHex = isPrimary ? 0xB85C5C : 0x527D70;
    const colorStr = isPrimary ? '#B85C5C' : '#527D70';

    // Ground Uncertainty Halo Disc
    const radius = marker.uncertaintyMeters || 2.5;
    const discGeom = new THREE.RingGeometry(0.1, radius, 32);
    discGeom.rotateX(-Math.PI / 2);
    const discMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide
    });
    const discMesh = new THREE.Mesh(discGeom, discMat);
    discMesh.position.y = 0.04;
    markerGroup.add(discMesh);

    // Halo Perimeter Ring
    const ringGeom = new THREE.RingGeometry(radius - 0.12, radius, 32);
    ringGeom.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide
    });
    const ringMesh = new THREE.Mesh(ringGeom, ringMat);
    ringMesh.position.y = 0.045;
    markerGroup.add(ringMesh);

    if (isPrimary) {
      // 3. Bounding Sphere Proximity Wireframes at Estimated Proximity Locations
      // V1 proximity center: (1.326, 0.1, 1.665), R1 = 2.521m
      // V2 proximity center: (-1.326, 0.1, -1.665), R2 = 2.716m
      const sphereMat1 = new THREE.MeshBasicMaterial({
        color: 0x2563EB,
        wireframe: true,
        transparent: true,
        opacity: 0.4
      });
      const sphereGeom1 = new THREE.SphereGeometry(2.521, 16, 12);
      const sphere1 = new THREE.Mesh(sphereGeom1, sphereMat1);
      sphere1.position.set(1.326 - marker.x, 0.8, 1.665 - marker.z);
      markerGroup.add(sphere1);

      const sphereMat2 = new THREE.MeshBasicMaterial({
        color: 0xD97706,
        wireframe: true,
        transparent: true,
        opacity: 0.4
      });
      const sphereGeom2 = new THREE.SphereGeometry(2.716, 16, 12);
      const sphere2 = new THREE.Mesh(sphereGeom2, sphereMat2);
      sphere2.position.set(-1.326 - marker.x, 0.9, -1.665 - marker.z);
      markerGroup.add(sphere2);

      // 4. 2D Oriented Bounding Box (OBB) Footprint Outlines on Road Surface
      const createOBBLine = (w, l, yaw, centerX, centerZ, color) => {
        const halfW = w / 2;
        const halfL = l / 2;
        const corners = [
          new THREE.Vector3(-halfW, 0.05, -halfL),
          new THREE.Vector3(halfW, 0.05, -halfL),
          new THREE.Vector3(halfW, 0.05, halfL),
          new THREE.Vector3(-halfW, 0.05, halfL),
          new THREE.Vector3(-halfW, 0.05, -halfL)
        ];
        const geom = new THREE.BufferGeometry().setFromPoints(corners);
        const mat = new THREE.LineBasicMaterial({ color, linewidth: 2 });
        const line = new THREE.Line(geom, mat);
        line.position.set(centerX - marker.x, 0, centerZ - marker.z);
        line.rotation.y = yaw;
        return line;
      };

      // V1 OBB footprint (Tesla Model 3: 4.69m x 1.85m, heading ~328°)
      markerGroup.add(createOBBLine(1.85, 4.69, 2.531, 1.326, 1.665, 0x2563EB));
      // V2 OBB footprint (Ford Explorer: 5.05m x 2.00m, heading ~210°)
      markerGroup.add(createOBBLine(2.00, 5.05, -2.678, -1.326, -1.665, 0xD97706));
    }

    // 5. Unobstructed Leader Line and Annotation Billboard
    // Provisional Proximity Reference at estimated proximity location (0, 0, 0)
    const pinH = 1.4;
    const pinGeom = new THREE.CylinderGeometry(0.04, 0.04, pinH, 12);
    const pinMat = new THREE.MeshBasicMaterial({ color: colorHex });
    const pin = new THREE.Mesh(pinGeom, pinMat);
    pin.name = 'ProvisionalProximityReference';
    pin.position.y = pinH / 2;
    markerGroup.add(pin);

    // Glowing proximity reference marker sphere
    const sphereNodeGeom = new THREE.SphereGeometry(0.24, 16, 16);
    const sphereNodeMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: 0.85
    });
    const sphereNode = new THREE.Mesh(sphereNodeGeom, sphereNodeMat);
    sphereNode.name = 'ProvisionalProximityMarkerSphere';
    sphereNode.position.y = pinH;
    markerGroup.add(sphereNode);

    // Leader Line connecting estimated proximity location to offset billboard position in unobstructed viewport space
    // Offsets: Primary collision moved to unobstructed Northwest (-24, 5.8, -8)
    // V3 standstill moved to unobstructed Northeast (+16, 4.8, -4)
    const targetOffsetX = isPrimary ? -24.0 : 16.0;
    const targetOffsetY = isPrimary ? 5.8 : 4.8;
    const targetOffsetZ = isPrimary ? -8.0 : -4.0;

    const elbowX = isPrimary ? -10.0 : 8.0;
    const elbowY = isPrimary ? 4.0 : 3.4;
    const elbowZ = isPrimary ? -4.0 : -2.0;

    const leaderPoints = [
      new THREE.Vector3(0, pinH, 0),
      new THREE.Vector3(elbowX, elbowY, elbowZ),
      new THREE.Vector3(targetOffsetX + (isPrimary ? 4.8 : -4.0), targetOffsetY, targetOffsetZ)
    ];

    const leaderGeom = new THREE.BufferGeometry().setFromPoints(leaderPoints);
    const leaderLineMat = new THREE.LineBasicMaterial({
      color: colorHex,
      linewidth: 3,
      transparent: true,
      opacity: 0.85
    });
    const leaderLine = new THREE.Line(leaderGeom, leaderLineMat);
    markerGroup.add(leaderLine);

    // Junction anchor node at leader line elbow
    const junctionGeom = new THREE.SphereGeometry(0.12, 12, 12);
    const junctionNode = new THREE.Mesh(junctionGeom, sphereNodeMat);
    junctionNode.position.set(elbowX, elbowY, elbowZ);
    markerGroup.add(junctionNode);

    // Overhead 3D Forensic Tag Billboard (Placed in unobstructed viewport space)
    const tagCanvas = document.createElement('canvas');
    tagCanvas.width = 460;
    tagCanvas.height = 145;
    const ctx = tagCanvas.getContext('2d');

    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    ctx.strokeStyle = colorStr;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(8, 8, 444, 129, 14);
    ctx.fill();
    ctx.stroke();

    // Banner Title
    ctx.fillStyle = colorStr;
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(isPrimary ? 'PROXIMITY ZONE: CONTACT INDETERMINATE' : 'EVASIVE STANDSTILL RECORD', 22, 42);

    // Timestamp - T0 Reference Epoch
    ctx.fillStyle = '#25364A';
    ctx.font = 'bold 25px monospace';
    ctx.fillText(isPrimary ? `${marker.exactTimestamp} (T0 Reference Epoch)` : marker.exactTimestamp, 22, 78);

    // Uncertainty and Finding Subtitle
    ctx.fillStyle = '#697586';
    ctx.font = '19px sans-serif';
    if (isPrimary) {
      ctx.fillText('Nominal OBB Gap: 0.31m | GPS CEP: ±2.5m', 22, 114);
    } else {
      ctx.fillText('Vehicle 03 at complete stop | Ref: Row #26', 22, 114);
    }

    const tagTexture = new THREE.CanvasTexture(tagCanvas);
    const tagSpriteMat = new THREE.SpriteMaterial({ map: tagTexture, transparent: true });
    const tagSprite = new THREE.Sprite(tagSpriteMat);
    const spriteScaleX = isPrimary ? 9.6 : 8.2;
    const spriteScaleY = isPrimary ? 3.0 : 2.6;
    tagSprite.position.set(targetOffsetX, targetOffsetY, targetOffsetZ);
    tagSprite.scale.set(spriteScaleX, spriteScaleY, 1);
    markerGroup.add(tagSprite);

    markerGroup.userData = {
      markerId: marker.id,
      markerData: marker,
      isMarker: true
    };

    group.add(markerGroup);
  });

  return group;
}
