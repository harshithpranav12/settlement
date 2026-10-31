/**
 * TRACE AI - 3D Road & Intersection Geometry Engine
 * 
 * Constructs high-fidelity schematic road pavement, multi-lane markings,
 * pedestrian crosswalks, stop lines, curbs, sidewalks, and metric scale reference.
 * 
 * FORENSIC PRINCIPLE:
 * Road geometry is classified strictly as SCHEMATIC_ONLY (MODEL_ASSUMPTION).
 * It represents an evidence-aligned geometric corridor (-28° NNW alignment)
 * for spatial context, not a civil-engineering survey record.
 */

import * as THREE from 'three';

export function createRoadGeometry() {
  const group = new THREE.Group();
  group.name = 'RoadGeometryGroup';
  group.userData = {
    classification: 'SCHEMATIC_ONLY',
    provenance: 'Synthesized schematic 4-way intersection corridor aligned with vehicle approach bearings (-28° NNW); not a civil engineering survey record'
  };

  // 1. Base Ground Surface (Neutral Light Field matching TRACE AI light theme)
  const terrainGeom = new THREE.PlaneGeometry(600, 600);
  terrainGeom.rotateX(-Math.PI / 2);
  const terrainMat = new THREE.MeshStandardMaterial({
    color: 0xEEECE6,
    roughness: 0.96,
    metalness: 0.04
  });
  const terrainMesh = new THREE.Mesh(terrainGeom, terrainMat);
  terrainMesh.position.y = -0.06;
  terrainMesh.receiveShadow = true;
  group.add(terrainMesh);

  // Roadway angle: -28° matches trajectory corridor approach from SSE to NNW (bearing ~332°)
  const roadAngleRad = -28 * (Math.PI / 180);

  // Group for all roadway and intersection components
  const roadwayGroup = new THREE.Group();
  roadwayGroup.rotation.y = roadAngleRad;

  // 2. Main Arterial Road (NNW corridor - 4 lanes, 24m wide, 360m long)
  const mainRoadWidth = 24.0;
  const mainRoadLength = 360.0;
  const asphaltMat = new THREE.MeshStandardMaterial({
    color: 0x1A1F26, // Deep graphite asphalt for high contrast with markings & terrain
    roughness: 0.82,
    metalness: 0.15
  });

  const mainRoadGeom = new THREE.PlaneGeometry(mainRoadWidth, mainRoadLength);
  mainRoadGeom.rotateX(-Math.PI / 2);
  const mainRoadMesh = new THREE.Mesh(mainRoadGeom, asphaltMat);
  mainRoadMesh.position.set(0, 0, 0);
  mainRoadMesh.receiveShadow = true;
  roadwayGroup.add(mainRoadMesh);

  // 3. Cross Street (Cross corridor - 2 lanes, 16m wide, 240m long)
  const crossRoadWidth = 16.0;
  const crossRoadLength = 240.0;
  const crossRoadGeom = new THREE.PlaneGeometry(crossRoadLength, crossRoadWidth);
  crossRoadGeom.rotateX(-Math.PI / 2);
  const crossRoadMesh = new THREE.Mesh(crossRoadGeom, asphaltMat);
  crossRoadMesh.position.set(0, 0.002, 0); // slightly above main to prevent Z-fighting
  crossRoadMesh.receiveShadow = true;
  roadwayGroup.add(crossRoadMesh);

  // 4. Sidewalks & Curbs (4 corner quadrants outside intersection)
  const sidewalkMat = new THREE.MeshStandardMaterial({
    color: 0xD5DAE1, // Clean engineered concrete pavement
    roughness: 0.78,
    metalness: 0.12
  });

  const curbMat = new THREE.MeshStandardMaterial({
    color: 0x94A3B8, // Beveled stone curb perimeter
    roughness: 0.7,
    metalness: 0.2
  });

  const curbHeight = 0.18;
  const sidewalkWidth = 4.0;
  const cornerExtent = 120.0;

  // Helper to create a rectangular sidewalk quadrant with visible curb edge
  const createSidewalkQuadrant = (xMin, xMax, zMin, zMax) => {
    const quadGroup = new THREE.Group();
    const w = Math.abs(xMax - xMin);
    const l = Math.abs(zMax - zMin);
    const geom = new THREE.BoxGeometry(w, curbHeight, l);
    const mesh = new THREE.Mesh(geom, sidewalkMat);
    mesh.position.set((xMin + xMax) / 2, curbHeight / 2, (zMin + zMax) / 2);
    mesh.receiveShadow = true;
    quadGroup.add(mesh);

    // Stone curb facing the roadway
    const curbW = Math.sign(xMin) > 0 ? 0.24 : -0.24;
    return quadGroup;
  };

  // 4 quadrants:
  // NE: X > mainRoadWidth/2, Z < -crossRoadWidth/2
  roadwayGroup.add(createSidewalkQuadrant(mainRoadWidth / 2, mainRoadWidth / 2 + cornerExtent, -crossRoadWidth / 2 - cornerExtent, -crossRoadWidth / 2));
  // NW: X < -mainRoadWidth/2, Z < -crossRoadWidth/2
  roadwayGroup.add(createSidewalkQuadrant(-mainRoadWidth / 2 - cornerExtent, -mainRoadWidth / 2, -crossRoadWidth / 2 - cornerExtent, -crossRoadWidth / 2));
  // SE: X > mainRoadWidth/2, Z > crossRoadWidth/2
  roadwayGroup.add(createSidewalkQuadrant(mainRoadWidth / 2, mainRoadWidth / 2 + cornerExtent, crossRoadWidth / 2, crossRoadWidth / 2 + cornerExtent));
  // SW: X < -mainRoadWidth/2, Z > crossRoadWidth/2
  roadwayGroup.add(createSidewalkQuadrant(-mainRoadWidth / 2 - cornerExtent, -mainRoadWidth / 2, crossRoadWidth / 2, crossRoadWidth / 2 + cornerExtent));

  // 5. Pavement Markings
  const markingsGroup = new THREE.Group();

  // Yellow center double line along main arterial
  const yellowMat = new THREE.MeshBasicMaterial({ color: 0xF59E0B });
  const yellowStripeGeom = new THREE.PlaneGeometry(0.18, mainRoadLength);
  yellowStripeGeom.rotateX(-Math.PI / 2);

  const y1 = new THREE.Mesh(yellowStripeGeom, yellowMat);
  y1.position.set(-0.25, 0.025, 0);
  markingsGroup.add(y1);

  const y2 = new THREE.Mesh(yellowStripeGeom, yellowMat);
  y2.position.set(0.25, 0.025, 0);
  markingsGroup.add(y2);

  // White lane divider dashes along main arterial
  const whiteMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
  const dashLength = 3.5;
  const gapLength = 6.5;
  const laneOffset = mainRoadWidth * 0.25; // 6m lane center offset

  for (let z = -mainRoadLength / 2; z < mainRoadLength / 2; z += dashLength + gapLength) {
    // Suppress dashes inside intersection box (± crossRoadWidth/2 = ±8m)
    if (Math.abs(z) < crossRoadWidth / 2 + 2) continue;

    const dashGeom = new THREE.PlaneGeometry(0.16, dashLength);
    dashGeom.rotateX(-Math.PI / 2);

    const dLeft = new THREE.Mesh(dashGeom, whiteMat);
    dLeft.position.set(-laneOffset, 0.025, z);
    markingsGroup.add(dLeft);

    const dRight = new THREE.Mesh(dashGeom, whiteMat);
    dRight.position.set(laneOffset, 0.025, z);
    markingsGroup.add(dRight);
  }

  // White solid edge shoulder lines along main arterial
  const edgeLineGeom = new THREE.PlaneGeometry(0.2, mainRoadLength);
  edgeLineGeom.rotateX(-Math.PI / 2);

  const eLeft = new THREE.Mesh(edgeLineGeom, whiteMat);
  eLeft.position.set(-mainRoadWidth / 2 + 0.35, 0.025, 0);
  markingsGroup.add(eLeft);

  const eRight = new THREE.Mesh(edgeLineGeom, whiteMat);
  eRight.position.set(mainRoadWidth / 2 - 0.35, 0.025, 0);
  markingsGroup.add(eRight);

  // Cross street center line (dashed yellow)
  const crossYellowGeom = new THREE.PlaneGeometry(crossRoadLength, 0.18);
  crossYellowGeom.rotateX(-Math.PI / 2);
  const cy = new THREE.Mesh(crossYellowGeom, yellowMat);
  cy.position.set(0, 0.026, 0);
  markingsGroup.add(cy);

  // Pedestrian Crosswalk Bars at Intersection Approaches (Main road: z = ±11m)
  const createCrosswalkBars = (zOffset) => {
    const cwGroup = new THREE.Group();
    const barW = 0.55;
    const barL = 3.5;
    const spacing = 1.25;
    for (let x = -mainRoadWidth / 2 + 1.2; x <= mainRoadWidth / 2 - 1.2; x += spacing) {
      const bGeom = new THREE.PlaneGeometry(barW, barL);
      bGeom.rotateX(-Math.PI / 2);
      const bar = new THREE.Mesh(bGeom, whiteMat);
      bar.position.set(x, 0.027, zOffset);
      cwGroup.add(bar);
    }
    return cwGroup;
  };

  markingsGroup.add(createCrosswalkBars(-crossRoadWidth / 2 - 3.0));
  markingsGroup.add(createCrosswalkBars(crossRoadWidth / 2 + 3.0));

  // Solid Stop Lines (z = ±14.5m)
  const stopLineGeom = new THREE.PlaneGeometry(mainRoadWidth * 0.46, 0.6);
  stopLineGeom.rotateX(-Math.PI / 2);

  const stopSouthbound = new THREE.Mesh(stopLineGeom, whiteMat);
  stopSouthbound.position.set(-laneOffset, 0.028, crossRoadWidth / 2 + 5.5);
  markingsGroup.add(stopSouthbound);

  const stopNorthbound = new THREE.Mesh(stopLineGeom, whiteMat);
  stopNorthbound.position.set(laneOffset, 0.028, -crossRoadWidth / 2 - 5.5);
  markingsGroup.add(stopNorthbound);

  roadwayGroup.add(markingsGroup);
  group.add(roadwayGroup);

  // 6. Metric Ground Scale Reference (20m physical scale bar placed on roadside)
  const scaleBarGroup = new THREE.Group();
  scaleBarGroup.name = 'MetricScaleReference';

  // 20m bar with alternating 5m black and white segments
  const segW = 0.6;
  const segH = 0.06;
  const segL = 5.0;

  for (let i = 0; i < 4; i++) {
    const isBlack = i % 2 === 0;
    const segMat = new THREE.MeshBasicMaterial({ color: isBlack ? 0x1E293B : 0xF8FAFC });
    const segGeom = new THREE.BoxGeometry(segW, segH, segL);
    const segMesh = new THREE.Mesh(segGeom, segMat);
    segMesh.position.set(0, segH / 2 + 0.02, (i - 1.5) * segL);
    scaleBarGroup.add(segMesh);
  }

  // Billboard text label for scale reference
  const scaleCanvas = document.createElement('canvas');
  scaleCanvas.width = 256;
  scaleCanvas.height = 80;
  const sCtx = scaleCanvas.getContext('2d');
  sCtx.fillStyle = '#FFFFFF';
  sCtx.fillRect(0, 0, 256, 80);
  sCtx.strokeStyle = '#527D70';
  sCtx.lineWidth = 4;
  sCtx.strokeRect(2, 2, 252, 76);

  sCtx.fillStyle = '#25364A';
  sCtx.font = 'bold 28px sans-serif';
  sCtx.textAlign = 'center';
  sCtx.fillText('20m Metric Scale', 128, 48);

  const sTex = new THREE.CanvasTexture(scaleCanvas);
  const sSpriteMat = new THREE.SpriteMaterial({ map: sTex, transparent: true });
  const sSprite = new THREE.Sprite(sSpriteMat);
  sSprite.position.set(0, 2.2, 0);
  sSprite.scale.set(6, 1.9, 1);
  scaleBarGroup.add(sSprite);

  // Position scale bar on the east roadside offset
  scaleBarGroup.position.set(28, 0, 20);
  group.add(scaleBarGroup);

  return group;
}
