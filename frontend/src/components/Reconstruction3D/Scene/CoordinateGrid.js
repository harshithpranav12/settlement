/**
 * TRACE AI - 3D Coordinate Grid & Spatial Reference Engine
 * 
 * Generates calibrated metric ground grids, coordinate axes, and cardinal direction indicators.
 * Standard Three.js convention: +X = East, -Z = North, +Y = Up.
 */

import * as THREE from 'three';

export function createCoordinateGrid({ size = 300, divisions = 30 } = {}) {
  const group = new THREE.Group();
  group.name = 'CoordinateGridGroup';

  // 1. Metric Grid Plane (10m grid cells, 50m major sections)
  const gridHelper = new THREE.GridHelper(size, divisions, 0x8A96A6, 0xD9DEE3);
  gridHelper.position.y = 0.01; // slightly above ground
  gridHelper.material.opacity = 0.75;
  gridHelper.material.transparent = true;
  group.add(gridHelper);

  // 2. Cardinal Direction Indicators (N, S, E, W)
  const createCardinalPill = (text, x, z, color = 0x25364A) => {
    // Create text canvas sprite
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(64, 64, 52, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 6;
    ctx.strokeStyle = '#527D70';
    ctx.stroke();

    ctx.fillStyle = '#25364A';
    ctx.font = 'bold 56px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.set(x, 1.5, z);
    sprite.scale.set(10, 10, 1);
    return sprite;
  };

  const extent = size * 0.46;
  group.add(createCardinalPill('N', 0, -extent)); // North = -Z
  group.add(createCardinalPill('S', 0, extent));  // South = +Z
  group.add(createCardinalPill('E', extent, 0));  // East = +X
  group.add(createCardinalPill('W', -extent, 0)); // West = -X

  // 3. Coordinate Origin Crosshairs (0, 0, 0)
  const originGeom = new THREE.RingGeometry(0.8, 1.2, 32);
  originGeom.rotateX(-Math.PI / 2);
  const originMat = new THREE.MeshBasicMaterial({ color: 0x527D70, side: THREE.DoubleSide });
  const originMesh = new THREE.Mesh(originGeom, originMat);
  originMesh.position.y = 0.02;
  group.add(originMesh);

  return group;
}
