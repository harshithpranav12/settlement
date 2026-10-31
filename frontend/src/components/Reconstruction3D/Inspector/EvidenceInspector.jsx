/**
 * TRACE AI - Collision & Evidentiary Stream Inspector
 * 
 * Displays physical collision markers, 5-channel forensic collision assessment,
 * provisional geodetic reference origin, and correlated contradiction flags.
 * 
 * FORENSIC STANDARDS:
 * - GPS-only contact assessment is classified strictly as INDETERMINATE.
 * - Reference origin is labeled PROVISIONAL LOCAL REFERENCE ORIGIN (not collision epicenter).
 * - Deceleration is documented as emergency braking/inertial force, not conclusive proof of contact.
 */

import React from 'react';
import {
  AlertTriangle,
  Scale,
  ShieldCheck,
  MapPin,
  ExternalLink,
  Clock,
  Layers,
  Activity,
  FileText
} from 'lucide-react';

export default function EvidenceInspector({
  sceneData,
  onNavigateTab,
  onJumpToTimestamp
}) {
  const collisionMarkers = sceneData?.collisionMarkers || [];
  const primaryCollision = collisionMarkers.find((m) => m.id.includes('PROVISIONAL') || m.id.includes('PRIMARY')) || collisionMarkers[0];
  const colAssess = sceneData?.collisionAssessment;
  const contradictions = sceneData?.contradictions || [];

  return (
    <div className="bg-white border border-[#D9DEE3] rounded-lg shadow-card p-5 space-y-5 text-xs font-sans">
      {/* 1. Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-[#EDF0F3]">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-[#B85C5C]" />
          <h3 className="font-sans font-bold uppercase tracking-wider text-[#25364A] text-xs">
            Collision & Evidence Stream
          </h3>
        </div>

        <span className="text-[10px] font-sans px-2 py-0.5 rounded bg-[#FBF2F2] text-[#B85C5C] border border-[#F1D7D7] font-semibold">
          GPS Contact: INDETERMINATE
        </span>
      </div>

      {/* 2. Five-Channel Forensic Collision Assessment */}
      {colAssess && (
        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#8A96A6] flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-[#527D70]" />
            5-Channel Forensic Assessment
          </div>

          <div className="space-y-1.5 text-xs">
            {/* Channel 1: EDR Source */}
            <div className="p-2.5 rounded bg-[#FAFAF8] border border-[#EDF0F3] flex items-center justify-between">
              <div>
                <span className="text-[10px] text-[#8A96A6] block uppercase font-semibold">1. EDR Source ID</span>
                <span className="font-mono text-[#25364A] text-[11px]">
                  V2: {colAssess.edrSourceIdentification.v2Source} ({colAssess.edrSourceIdentification.isEdrVerified ? 'EDR Tagged (Synthetic)' : 'CAN'})
                </span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FAF4EB] text-[#C18A45] font-semibold border border-[#F0DFCA]">
                Synthetic CSV
              </span>
            </div>

            {/* Channel 2: Inertial Deceleration */}
            <div className="p-2.5 rounded bg-[#FAFAF8] border border-[#EDF0F3]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#8A96A6] uppercase font-semibold">2. Inertial Deceleration</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FAF4EB] text-[#C18A45] font-semibold border border-[#F0DFCA]">
                  Direct Obs (Synthetic)
                </span>
              </div>
              <div className="font-mono text-[#25364A] text-[11px] mt-0.5">
                V1: {colAssess.crashEventRecording.v1Deceleration} | V2: {colAssess.crashEventRecording.v2Deceleration}
              </div>
              <div className="text-[10px] text-[#697586] italic mt-0.5">
                {colAssess.crashEventRecording.forensicCaveat}
              </div>
            </div>

            {/* Channel 3: Airbag Deployment */}
            <div className="p-2.5 rounded bg-[#FAFAF8] border border-[#EDF0F3] flex items-center justify-between">
              <div>
                <span className="text-[10px] text-[#8A96A6] block uppercase font-semibold">3. Airbag Trigger</span>
                <span className="text-[#697586] text-[11px]">Not recorded in telemetry stream</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F5F4EF] text-[#8A96A6] border border-[#D9DEE3]">
                Unavailable
              </span>
            </div>

            {/* Channel 4: Physical Damage */}
            <div className="p-2.5 rounded bg-[#FAFAF8] border border-[#EDF0F3] flex items-center justify-between">
              <div>
                <span className="text-[10px] text-[#8A96A6] block uppercase font-semibold">4. Physical Crush Depth</span>
                <span className="text-[#697586] text-[11px]">Requires on-scene vehicle inspection</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F5F4EF] text-[#8A96A6] border border-[#D9DEE3]">
                Unavailable
              </span>
            </div>

            {/* Channel 5: Geometric Collision Footprint */}
            <div className="p-2.5 rounded bg-[#FBF2F2]/60 border border-[#F1D7D7] space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#B85C5C] uppercase font-bold">5. Geometric Footprint</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white text-[#B85C5C] font-bold border border-[#F1D7D7]">
                  INDETERMINATE
                </span>
              </div>
              <div className="text-[11px] text-[#25364A] leading-tight">
                • Bounding Spheres: <strong className="text-[#527D70]">Intersect Nominally</strong> (4.26m ≤ 5.24m)
              </div>
              <div className="text-[11px] text-[#25364A] leading-tight">
                • Oriented Boxes (OBB): <strong className="text-[#B85C5C]">Nominal Gap = 0.31m</strong> (No overlap)
              </div>
              <div className="text-[10px] text-[#697586] leading-tight">
                Gap of 0.31m falls within illustrative GPS CEP (±2.5m). Contact cannot be proven from GPS alone.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Reference Geodetic Origin Card */}
      <div className="p-3 rounded-lg bg-[#FAFAF8] border border-[#D9DEE3] space-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold text-[#8A96A6] flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-[#527D70]" />
            Provisional Reference Origin (0, 0, 0)
          </span>
          <span className="font-mono text-[10px] text-[#527D70] font-semibold">WGS84</span>
        </div>
        <div className="font-mono text-[11px] text-[#25364A] font-bold">
          Lat: {sceneData?.referenceOrigin?.lat?.toFixed(6)}° N, Lon: {sceneData?.referenceOrigin?.lon?.toFixed(6)}° W
        </div>
        <div className="text-[10px] text-[#697586] leading-tight">
          Provisional reference frame origin for spatial alignment; not a verified physical collision contact point.
        </div>
      </div>

      {/* 4. Cross-Examined Contradiction Flags */}
      {contradictions.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-[#EDF0F3]">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[#25364A] flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-[#7189A6]" />
              Correlated Contradictions ({contradictions.length})
            </span>
            <button
              onClick={() => onNavigateTab && onNavigateTab('contradictions')}
              className="text-[11px] text-[#527D70] font-medium underline cursor-pointer"
            >
              View Matrix
            </button>
          </div>

          <div className="space-y-1.5">
            {contradictions.slice(0, 3).map((ctr) => (
              <div
                key={ctr.id}
                onClick={() => onNavigateTab && onNavigateTab('contradictions')}
                className="p-2.5 rounded bg-[#FAFAF8] border border-[#D9DEE3] hover:border-[#527D70] transition cursor-pointer flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-[#25364A] text-[11px] flex items-center gap-1">
                    <span className="font-mono text-[#B85C5C]">{ctr.id}</span>
                    <span className="text-[#697586] truncate max-w-[170px]">{ctr.title}</span>
                  </div>
                  <div className="text-[10px] text-[#8A96A6] mt-0.5">
                    Discrepancy: <strong className="text-[#B85C5C] font-mono">{ctr.numericalDiscrepancy}</strong>
                  </div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-[#8A96A6]" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Direct Report Link */}
      {onNavigateTab && (
        <div className="pt-2 border-t border-[#EDF0F3]">
          <button
            onClick={() => onNavigateTab('reports')}
            className="w-full py-2 px-3 rounded-md bg-[#527D70] hover:bg-[#43675C] text-white font-medium flex items-center justify-center gap-2 text-xs transition cursor-pointer shadow-xs"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Open Full Investigation Report</span>
          </button>
        </div>
      )}
    </div>
  );
}
