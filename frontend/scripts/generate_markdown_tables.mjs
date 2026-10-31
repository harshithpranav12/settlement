// generate_markdown_tables.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// WGS84 Constants
const WGS84_A = 6378137.0;
const WGS84_B = 6356752.314245;
const WGS84_F = 1.0 / 298.257223563;
const DEG_TO_RAD = Math.PI / 180.0;

function vincentyDistance(lat1, lon1, lat2, lon2) {
  if (lat1 === lat2 && lon1 === lon2) return 0.0;
  const phi1 = lat1 * DEG_TO_RAD, phi2 = lat2 * DEG_TO_RAD;
  const L = (lon2 - lon1) * DEG_TO_RAD;
  const U1 = Math.atan((1 - WGS84_F) * Math.tan(phi1));
  const U2 = Math.atan((1 - WGS84_F) * Math.tan(phi2));
  const sinU1 = Math.sin(U1), cosU1 = Math.cos(U1);
  const sinU2 = Math.sin(U2), cosU2 = Math.cos(U2);

  let lambda = L, lambdaP = 2 * Math.PI, iterLimit = 100;
  let cosSqAlpha, sinSigma, cos2SigmaM, cosSigma, sigma, sinLambda, cosLambda;

  while (Math.abs(lambda - lambdaP) > 1e-12 && --iterLimit > 0) {
    sinLambda = Math.sin(lambda); cosLambda = Math.cos(lambda);
    sinSigma = Math.sqrt((cosU2 * sinLambda) ** 2 + (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) ** 2);
    if (sinSigma === 0) return 0;
    cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
    sigma = Math.atan2(sinSigma, cosSigma);
    const sinAlpha = (cosU1 * cosU2 * sinLambda) / sinSigma;
    cosSqAlpha = 1 - sinAlpha * sinAlpha;
    cos2SigmaM = cosSqAlpha !== 0 ? cosSigma - (2 * sinU1 * sinU2) / cosSqAlpha : 0;
    const C = (WGS84_F / 16) * cosSqAlpha * (4 + WGS84_F * (4 - 3 * cosSqAlpha));
    lambdaP = lambda;
    lambda = L + (1 - C) * WGS84_F * sinAlpha * (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));
  }
  const uSq = (cosSqAlpha * (WGS84_A * WGS84_A - WGS84_B * WGS84_B)) / (WGS84_B * WGS84_B);
  const A = 1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const B = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
  const deltaSigma = B * sinSigma * (cos2SigmaM + (B / 4) * (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) - (B / 6) * cos2SigmaM * (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2SigmaM * cos2SigmaM)));
  return WGS84_B * A * (sigma - deltaSigma);
}

function parseTimestamp(tsStr) {
  const clean = tsStr.replace(' UTC', '').trim();
  const parts = clean.split(':');
  return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
}

const csvPath = path.resolve(__dirname, '../public/trace_ai_synthetic_road_accident_telemetry.csv');
const rawContent = fs.readFileSync(csvPath, 'utf8').trim();
const lines = rawContent.split(/\r?\n/);
const header = lines[0].split(',');

const records = [];
for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  const cols = line.split(',');
  const rowObj = {};
  header.forEach((h, idx) => { rowObj[h] = cols[idx]; });
  records.push({
    rowNumber: i,
    timestamp: rowObj.timestamp,
    tSec: parseTimestamp(rowObj.timestamp),
    vehicle_id: rowObj.vehicle_id,
    speed_kmh: parseFloat(rowObj.speed_kmh),
    acceleration_mps2: parseFloat(rowObj.acceleration_mps2),
    latitude: parseFloat(rowObj.latitude),
    longitude: parseFloat(rowObj.longitude),
    brake_status: rowObj.brake_status === 'True',
    throttle_position_pct: parseFloat(rowObj.throttle_position_pct),
    data_source: rowObj.data_source
  });
}

const vehicles = ['V1', 'V2', 'V3'];

vehicles.forEach(vid => {
  const vRecords = records.filter(r => r.vehicle_id === vid);
  console.log(`\n### Vehicle ${vid} Displacement Table\n`);
  console.log('| Step | Interval | Time Range (UTC) | $\\Delta t$ (s) | Geodesic $\\Delta s$ (m) | Implied $v_{\\text{GPS}}$ (km/h) | Sensor $v_{\\text{CAN}}$ (km/h) | Deviation (%) | Plausibility Assessment |');
  console.log('| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |');

  for (let i = 1; i < vRecords.length; i++) {
    const prev = vRecords[i - 1];
    const curr = vRecords[i];
    const deltaT = curr.tSec - prev.tSec;
    const distMeters = vincentyDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
    const impliedSpeedKmh = deltaT > 0 ? (distMeters / deltaT) * 3.6 : 0;
    const recordedSpeedKmh = (prev.speed_kmh + curr.speed_kmh) / 2.0;
    const deviationPct = recordedSpeedKmh > 0 ? ((impliedSpeedKmh - recordedSpeedKmh) / recordedSpeedKmh) * 100 : (impliedSpeedKmh === 0 ? 0 : 100);
    
    let plausibility = '';
    if (impliedSpeedKmh > 200) {
      plausibility = '❌ IMPLAUSIBLE (Extreme speed spike >200 km/h due to GPS quantization)';
    } else if (Math.abs(deviationPct) > 50 && impliedSpeedKmh > 30) {
      plausibility = '⚠️ IMPLAUSIBLE (>50% kinematic deviation)';
    } else if (impliedSpeedKmh === 0 && recordedSpeedKmh === 0) {
      plausibility = '✅ PLAUSIBLE (Stationary)';
    } else {
      plausibility = '⚠️ IMPLAUSIBLE (Quantization jitter vs sensor speed)';
    }

    console.log(`| ${i} | R${prev.rowNumber} $\\to$ R${curr.rowNumber} | ${prev.timestamp.slice(0, 12)} $\\to$ ${curr.timestamp.slice(0, 12)} | ${deltaT.toFixed(3)} | ${distMeters.toFixed(2)} | ${impliedSpeedKmh.toFixed(1)} | ${recordedSpeedKmh.toFixed(1)} | ${deviationPct >= 0 ? '+' : ''}${deviationPct.toFixed(1)}% | ${plausibility} |`);
  }
});
