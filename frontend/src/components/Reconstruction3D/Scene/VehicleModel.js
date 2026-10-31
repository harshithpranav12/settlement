/**
 * TRACE AI - Forensic 3D Vehicle Model Generator
 * 
 * Generates proportioned, visually distinct 3D vehicle assets for:
 * - V1: Tesla Model 3 baseline (Electric Sedan: 4.69m x 1.85m x 1.44m, Blue)
 * - V2: Ford Explorer baseline (Full-size SUV: 5.05m x 2.00m x 1.78m, Amber)
 * - V3: Honda Civic baseline (Compact Sedan: 4.55m x 1.80m x 1.41m, Slate)
 * 
 * FORENSIC PRINCIPLE:
 * Dimensions are classified strictly as MODEL_ASSUMPTION (OEM factory catalog specifications).
 * Models avoid external binary asset dependencies and use calibrated procedural Three.js geometry.
 */

import * as THREE from 'three';

export function createVehicle3DModel({
  vehicleId = 'V1',
  makeModel = 'Tesla Model 3',
  type = 'Electric Sedan',
  primaryColor = '#2563EB',
  dimensions = { width: 1.85, length: 4.69, height: 1.44 }
} = {}) {
  const group = new THREE.Group();
  group.name = `VehicleModel_${vehicleId}`;

  const { width: w, length: l, height: h } = dimensions;
  const isSUV = type.toLowerCase().includes('suv') || vehicleId === 'V2';
  const isCompact = type.toLowerCase().includes('compact') || vehicleId === 'V3';

  // Ground clearance / ride height
  const rideHeight = isSUV ? 0.38 : 0.28;
  const wheelR = isSUV ? 0.42 : 0.33;
  const wheelW = isSUV ? 0.26 : 0.22;

  // 1. Materials - High-Fidelity Forensic Vehicle Shading
  const bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(primaryColor),
    roughness: 0.25,
    metalness: 0.68,
    envMapIntensity: 1.3
  });

  const secondaryTrimMat = new THREE.MeshStandardMaterial({
    color: isSUV ? 0x1E293B : 0x0F172A,
    roughness: 0.65,
    metalness: 0.25
  });

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x1E293B,
    roughness: 0.08,
    metalness: 0.92,
    transparent: true,
    opacity: 0.88
  });

  const wheelMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.92,
    metalness: 0.08
  });

  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xE2E8F0,
    roughness: 0.18,
    metalness: 0.88
  });

  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xFEF9C3,
    emissive: 0xFEF9C3,
    emissiveIntensity: 1.15
  });

  const brakeLightMat = new THREE.MeshStandardMaterial({
    color: 0xEF4444,
    emissive: 0xDC2626,
    emissiveIntensity: 0.35
  });

  // 2. Chassis Lower Body
  const chassisH = isSUV ? h * 0.48 : h * 0.42;
  const chassisGeom = new THREE.BoxGeometry(w, chassisH, l);
  const chassisMesh = new THREE.Mesh(chassisGeom, bodyMat);
  chassisMesh.position.y = rideHeight + chassisH / 2;
  chassisMesh.castShadow = true;
  group.add(chassisMesh);

  // Lower bumper cladding / diffuser
  const bumperH = chassisH * 0.25;
  const bumperGeom = new THREE.BoxGeometry(w * 1.01, bumperH, l * 1.01);
  const bumperMesh = new THREE.Mesh(bumperGeom, secondaryTrimMat);
  bumperMesh.position.y = rideHeight + bumperH / 2;
  group.add(bumperMesh);

  // 3. Cabin / Greenhouse Structure
  const cabinH = isSUV ? h * 0.52 : h * 0.46;
  const cabinW = w * 0.84;
  const cabinL = isSUV ? l * 0.68 : (isCompact ? l * 0.50 : l * 0.54);
  const cabinZOffset = isSUV ? l * 0.04 : -l * 0.03;

  const cabinGeom = new THREE.BoxGeometry(cabinW, cabinH, cabinL);
  const cabinMesh = new THREE.Mesh(cabinGeom, glassMat);
  cabinMesh.position.set(0, rideHeight + chassisH + cabinH / 2 - 0.04, cabinZOffset);
  cabinMesh.castShadow = true;
  group.add(cabinMesh);

  // Roof Panel
  const roofGeom = new THREE.BoxGeometry(cabinW * 0.96, 0.06, cabinL * 0.92);
  const roofMesh = new THREE.Mesh(roofGeom, bodyMat);
  roofMesh.position.set(0, rideHeight + chassisH + cabinH - 0.02, cabinZOffset);
  group.add(roofMesh);

  // SUV Roof Rails (distinctive feature for V2 Ford Explorer)
  if (isSUV) {
    const railGeom = new THREE.BoxGeometry(0.06, 0.08, cabinL * 0.88);
    const railMat = new THREE.MeshStandardMaterial({ color: 0x94A3B8, metalness: 0.8, roughness: 0.3 });

    const railLeft = new THREE.Mesh(railGeom, railMat);
    railLeft.position.set(-cabinW * 0.45, rideHeight + chassisH + cabinH + 0.06, cabinZOffset);
    group.add(railLeft);

    const railRight = new THREE.Mesh(railGeom, railMat);
    railRight.position.set(cabinW * 0.45, rideHeight + chassisH + cabinH + 0.06, cabinZOffset);
    group.add(railRight);
  }

  // Sloping Hood / Bonnet (Front is -Z in Three.js standard)
  const hoodL = isSUV ? l * 0.28 : l * 0.32;
  const hoodW = w * 0.92;
  const hoodH = 0.05;
  const hoodGeom = new THREE.BoxGeometry(hoodW, hoodH, hoodL);
  const hoodMesh = new THREE.Mesh(hoodGeom, bodyMat);
  hoodMesh.position.set(0, rideHeight + chassisH + hoodH / 2, -l / 2 + hoodL / 2);
  hoodMesh.rotation.x = -0.06; // slight aerodynamic rake
  group.add(hoodMesh);

  // 4. Wheels & Wheel Wells
  const wheelX = w / 2 - wheelW / 3.5;
  const wheelZFront = -l * 0.33;
  const wheelZRear = l * 0.33;

  const createWheel = (x, z) => {
    const wheelGroup = new THREE.Group();
    // Tire
    const tireGeom = new THREE.CylinderGeometry(wheelR, wheelR, wheelW, 20);
    tireGeom.rotateZ(Math.PI / 2);
    const tireMesh = new THREE.Mesh(tireGeom, wheelMat);
    tireMesh.castShadow = true;
    wheelGroup.add(tireMesh);

    // Rim
    const rimGeom = new THREE.CylinderGeometry(wheelR * 0.62, wheelR * 0.62, wheelW + 0.015, 14);
    rimGeom.rotateZ(Math.PI / 2);
    const rimMesh = new THREE.Mesh(rimGeom, rimMat);
    wheelGroup.add(rimMesh);

    wheelGroup.position.set(x, wheelR, z);
    return wheelGroup;
  };

  group.add(createWheel(wheelX, wheelZFront));
  group.add(createWheel(-wheelX, wheelZFront));
  group.add(createWheel(wheelX, wheelZRear));
  group.add(createWheel(-wheelX, wheelZRear));

  // 5. Front Headlights (Forward orientation indicator along -Z)
  const hlW = 0.36;
  const hlH = 0.12;
  const hlGeom = new THREE.BoxGeometry(hlW, hlH, 0.08);

  const hlLeft = new THREE.Mesh(hlGeom, headlightMat);
  hlLeft.position.set(-w * 0.36, rideHeight + chassisH * 0.72, -l / 2 - 0.03);
  group.add(hlLeft);

  const hlRight = new THREE.Mesh(hlGeom, headlightMat);
  hlRight.position.set(w * 0.36, rideHeight + chassisH * 0.72, -l / 2 - 0.03);
  group.add(hlRight);

  // Forward Headlight Beam Wedge on road surface (visual indicator of vehicle orientation and heading)
  const beamL = 6.5;
  const beamW = w * 1.25;
  const beamGeom = new THREE.PlaneGeometry(beamW, beamL);
  beamGeom.rotateX(-Math.PI / 2);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xFEF9C3,
    transparent: true,
    opacity: 0.14,
    side: THREE.DoubleSide
  });
  const beamMesh = new THREE.Mesh(beamGeom, beamMat);
  beamMesh.position.set(0, 0.035, -l / 2 - beamL / 2);
  group.add(beamMesh);

  // Front License Plate / Identifier Badge
  const plateGeom = new THREE.BoxGeometry(0.65, 0.22, 0.03);
  const plateMat = new THREE.MeshBasicMaterial({ color: 0xF8FAFC });
  const frontPlate = new THREE.Mesh(plateGeom, plateMat);
  frontPlate.position.set(0, rideHeight + chassisH * 0.35, -l / 2 - 0.03);
  group.add(frontPlate);

  // 6. Rear Tail & Brake Lights (Rear orientation indicator along +Z)
  const blW = 0.38;
  const blH = isSUV ? 0.22 : 0.12;
  const blGeom = new THREE.BoxGeometry(blW, blH, 0.08);

  const blLeft = new THREE.Mesh(blGeom, brakeLightMat);
  blLeft.position.set(-w * 0.36, rideHeight + chassisH * 0.75, l / 2 + 0.03);
  group.add(blLeft);

  const blRight = new THREE.Mesh(blGeom, brakeLightMat);
  blRight.position.set(w * 0.36, rideHeight + chassisH * 0.75, l / 2 + 0.03);
  group.add(blRight);

  // Rear Plate
  const rearPlate = new THREE.Mesh(plateGeom, plateMat);
  rearPlate.position.set(0, rideHeight + chassisH * 0.35, l / 2 + 0.03);
  group.add(rearPlate);

  // 7. Interactive Selection Halo (Ground ring under vehicle)
  const ringGeom = new THREE.RingGeometry(w * 0.72, w * 0.95, 32);
  ringGeom.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x527D70,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.0
  });
  const selectionRing = new THREE.Mesh(ringGeom, ringMat);
  selectionRing.position.y = 0.04;
  group.add(selectionRing);

  // 8. Overhead HUD Pill Sprite & Vertical Leader (positioned cleanly between roof and collision banner)
  const leaderGeom = new THREE.CylinderGeometry(0.015, 0.015, 0.75, 8);
  const leaderMat = new THREE.MeshBasicMaterial({ color: 0x64748B, transparent: true, opacity: 0.6 });
  const leaderMesh = new THREE.Mesh(leaderGeom, leaderMat);
  leaderMesh.position.set(0, h + 0.38, 0);
  group.add(leaderMesh);

  const hudCanvas = document.createElement('canvas');
  hudCanvas.width = 280;
  hudCanvas.height = 92;
  const hudCtx = hudCanvas.getContext('2d');

  const updateHudCanvas = (vehId, speedText, isBraking) => {
    hudCtx.clearRect(0, 0, 280, 92);

    // Pill container with vehicle-coded border
    hudCtx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    hudCtx.strokeStyle = isBraking ? '#B85C5C' : primaryColor;
    hudCtx.lineWidth = 4;
    hudCtx.beginPath();
    hudCtx.roundRect(6, 6, 268, 80, 14);
    hudCtx.fill();
    hudCtx.stroke();

    // Vehicle ID Badge
    hudCtx.fillStyle = primaryColor;
    hudCtx.font = 'bold 30px sans-serif';
    hudCtx.textAlign = 'left';
    hudCtx.fillText(vehId, 18, 52);

    // Model name subtitle
    hudCtx.fillStyle = '#697586';
    hudCtx.font = '15px sans-serif';
    hudCtx.fillText(makeModel, 18, 74);

    // Speed Metric
    hudCtx.fillStyle = isBraking ? '#B85C5C' : '#25364A';
    hudCtx.font = 'bold 26px monospace';
    hudCtx.textAlign = 'right';
    hudCtx.fillText(speedText || '0.0 km/h', 260, 52);

    if (isBraking) {
      hudCtx.fillStyle = '#B85C5C';
      hudCtx.font = 'bold 14px sans-serif';
      hudCtx.fillText('BRAKING', 260, 74);
    }
  };

  updateHudCanvas(vehicleId, '0.0 km/h', false);

  const hudTexture = new THREE.CanvasTexture(hudCanvas);
  const hudSpriteMat = new THREE.SpriteMaterial({ map: hudTexture, transparent: true });
  const hudSprite = new THREE.Sprite(hudSpriteMat);
  hudSprite.position.set(0, h + 1.05, 0);
  hudSprite.scale.set(4.5, 1.48, 1);
  group.add(hudSprite);

  // Attach dynamic control methods & metadata to userData
  group.userData = {
    vehicleId,
    makeModel,
    type,
    dimensions,
    dimensionsClassification: 'MODEL_ASSUMPTION',
    provenance: 'OEM factory catalog specifications; physical post-crash laser scan unavailable',
    setBraking: (isBraking) => {
      if (isBraking) {
        brakeLightMat.color.setHex(0xEF4444);
        brakeLightMat.emissive.setHex(0xDC2626);
        brakeLightMat.emissiveIntensity = 1.0;
      } else {
        brakeLightMat.color.setHex(0x991B1B);
        brakeLightMat.emissive.setHex(0x7F1D1D);
        brakeLightMat.emissiveIntensity = 0.25;
      }
    },
    setSelected: (selected) => {
      ringMat.opacity = selected ? 0.95 : 0.0;
      ringMat.color.setHex(selected ? 0x2563EB : 0x527D70);
    },
    updateHud: (speedText, isBraking) => {
      updateHudCanvas(vehicleId, speedText, isBraking);
      hudTexture.needsUpdate = true;
    }
  };

  return group;
}
