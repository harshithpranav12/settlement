import React from 'react';
import {
  FileVideo,
  Car,
  GitCommit,
  AlertTriangle,
  ArrowUpRight,
  Activity,
  Layers,
  Info,
  Box,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  UploadCloud,
  FileText,
  Compass
} from 'lucide-react';
import StatCard from './StatCard';
import ContradictionAlertBanner from './ContradictionAlertBanner';
import EvidenceProcessingStatus from './EvidenceProcessingStatus';
import RecentIncidents from './RecentIncidents';
import ActivityAuditTrail from './ActivityAuditTrail';

export default function Dashboard({
  incident,
  incidents = [],
  onSelectIncident,
  onCreateIncidentClick,
  evidenceSources = [],
  vehicles = [],
  timelineEvents = [],
  contradictions = [],
  pipelineStatus = [],
  activities = [],
  onNavigateTab
}) {
  const safeIncidents = Array.isArray(incidents) ? incidents : [];
  const safeEvidence = Array.isArray(evidenceSources) ? evidenceSources : [];
  const safeVehicles = Array.isArray(vehicles) ? vehicles : [];
  const safeTimeline = Array.isArray(timelineEvents) ? timelineEvents : [];
  const safeContradictions = Array.isArray(contradictions) ? contradictions : [];
  const safePipeline = Array.isArray(pipelineStatus) ? pipelineStatus : [];
  const safeActivities = Array.isArray(activities) ? activities : [];

  const criticalContradiction = safeContradictions.length > 0
    ? safeContradictions.find((c) => c && c.severity === 'CRITICAL') || safeContradictions[0]
    : null;

  // 7-Stage End-to-End Forensic Investigation Workflow
  const WORKFLOW_STEPS = [
    { id: 'overview', step: '01', title: 'Case Dossier', desc: 'Scope & Benchmarks', icon: Info, status: 'Active' },
    { id: 'evidence', step: '02', title: 'Evidence Ingestion', desc: `${safeEvidence.length} sources logged`, icon: UploadCloud, status: safeEvidence.length > 0 ? 'Verified' : 'Pending' },
    { id: 'timeline', step: '03', title: 'Timeline Sync', desc: `${safeTimeline.length} events aligned`, icon: GitCommit, status: safeTimeline.length > 0 ? 'Aligned' : 'Pending' },
    { id: 'reconstruction3d', step: '04', title: '3D Spatial Scene', desc: 'Geodetic WGS84 / ENU', icon: Box, status: 'Interactive 3D' },
    { id: 'contradictions', step: '05', title: 'Contradiction Audit', desc: `${safeContradictions.length} flags identified`, icon: AlertTriangle, status: `${safeContradictions.length} Flags` },
    { id: 'trajectory', step: '06', title: 'Kinematic Curves', desc: 'Velocity & Decel profiles', icon: Activity, status: 'Computed' },
    { id: 'reports', step: '07', title: 'Forensic Report', desc: 'Formal Dossier & PDF', icon: FileText, status: 'Export Ready' }
  ];

  return (
    <div className="p-6 lg:p-8 space-y-7 max-w-7xl mx-auto font-sans">
      {/* 1. Incident Header Dossier Banner */}
      <div className="rounded-lg bg-white border border-[#D9DEE3] p-6 lg:p-7 shadow-card flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <span className="text-xs font-sans font-medium px-2.5 py-0.5 rounded bg-[#EBF2EE] text-[#527D70] border border-[#D0E0D6]">
              Investigation dossier
            </span>
            <span className="font-mono text-xs text-[#25364A] font-semibold">
              {incident?.id || 'INC-2026-0884'}
            </span>
            <span className="text-[#D9DEE3]">•</span>
            <span className="font-mono text-xs text-[#697586]">
              {incident?.timestamp || '2026-10-24 18:42:11 UTC'}
            </span>
            <span className="text-[#D9DEE3]">•</span>
            <span className="text-xs font-sans text-[#697586] bg-[#F5F4EF] px-2 py-0.5 rounded border border-[#D9DEE3] flex items-center gap-1">
              <Info className="w-3 h-3 text-[#7189A6]" />
              Simulated demonstration dataset
            </span>
          </div>

          <h1 className="text-2xl font-bold text-[#25364A] tracking-tight">
            {incident?.title || 'Multi-Vehicle Collision Reconstruction'}
          </h1>

          <div className="text-xs text-[#697586] flex flex-wrap gap-x-6 gap-y-1.5 pt-1">
            <span>Location: <strong className="text-[#25364A] font-medium">{incident?.location || 'Intersection'}</strong></span>
            <span>Conditions: <strong className="text-[#25364A] font-medium">{incident?.weather || 'Clear'}</strong></span>
            <span>Lead analyst: <strong className="text-[#25364A] font-medium">{incident?.leadInvestigator || 'Accident Recon Unit'}</strong></span>
          </div>
        </div>

        {/* Forensic Recon Confidence Box */}
        <div className="shrink-0 flex items-center space-x-4 bg-[#FAFAF8] border border-[#D9DEE3] px-6 py-4 rounded-lg shadow-xs">
          <div>
            <div className="text-xs font-sans text-[#697586] font-medium">
              Model consistency score
            </div>
            <div className="text-3xl font-bold font-mono text-[#527D70] tracking-tight mt-0.5">
              {incident?.reconstructionConfidence || 94.2}%
            </div>
            <div className="text-xs text-[#697586] font-sans mt-0.5">
              Multi-sensor corroboration (Simulated)
            </div>
          </div>
          <div className="w-12 h-12 rounded-lg border border-[#D0E0D6] flex items-center justify-center bg-[#EBF2EE]">
            <Activity className="w-6 h-6 text-[#527D70]" />
          </div>
        </div>
      </div>

      {/* 2. Guided Forensic Investigation Workflow Progression Ribbon */}
      <div className="rounded-lg bg-white border border-[#D9DEE3] p-4 lg:p-5 shadow-card">
        <div className="flex items-center justify-between pb-3 border-b border-[#EDF0F3] mb-3">
          <div className="flex items-center space-x-2">
            <Compass className="w-4 h-4 text-[#527D70]" />
            <h2 className="text-xs font-sans font-bold uppercase tracking-wider text-[#25364A]">
              Forensic Investigation Workflow
            </h2>
          </div>
          <span className="text-[11px] text-[#697586] font-medium">
            Guided demonstration pipeline — Click any module to navigate
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {WORKFLOW_STEPS.map((ws, idx) => {
            const StepIcon = ws.icon;
            const isClickable = typeof onNavigateTab === 'function';
            return (
              <button
                key={ws.id}
                onClick={() => isClickable && onNavigateTab(ws.id)}
                className="p-3 rounded-lg border border-[#D9DEE3] hover:border-[#527D70] bg-[#FAFAF8] hover:bg-[#EBF2EE]/50 transition-all text-left group cursor-pointer shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-[10px] text-[#8A96A6] font-mono pb-1">
                    <span>STEP {ws.step}</span>
                    <StepIcon className="w-3.5 h-3.5 text-[#7189A6] group-hover:text-[#527D70] transition-colors" />
                  </div>
                  <div className="text-xs font-bold text-[#25364A] group-hover:text-[#527D70] transition-colors truncate">
                    {ws.title}
                  </div>
                  <div className="text-[10px] text-[#697586] mt-0.5 truncate leading-tight">
                    {ws.desc}
                  </div>
                </div>
                <div className="mt-2.5 pt-1.5 border-t border-[#EDF0F3] flex items-center justify-between text-[10px]">
                  <span className="font-medium text-[#527D70]">{ws.status}</span>
                  <ChevronRight className="w-3 h-3 text-[#8A96A6] group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Critical Contradiction Alert Banner */}
      {criticalContradiction && (
        <ContradictionAlertBanner
          contradiction={criticalContradiction}
          onReviewClick={() => typeof onNavigateTab === 'function' && onNavigateTab('contradictions')}
        />
      )}

      {/* 4. Statistical Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Evidence sources"
          value={safeEvidence.length}
          subvalue={`${safeEvidence.filter(e => (e.type || '').includes('Video')).length} optical video / ${safeEvidence.filter(e => (e.type || '').includes('Sensor')).length} telematics`}
          icon={FileVideo}
          badgeText={`${safeEvidence.length} logged`}
          statusType="telemetry"
          onClick={() => typeof onNavigateTab === 'function' && onNavigateTab('evidence')}
        />

        <StatCard
          title="Tracked vehicles"
          value={safeVehicles.length}
          subvalue="Multi-vehicle kinematic tracking"
          icon={Car}
          badgeText={`${safeVehicles.length} identified`}
          statusType="verified"
          onClick={() => typeof onNavigateTab === 'function' && onNavigateTab('trajectory')}
        />

        <StatCard
          title="Timeline events"
          value={safeTimeline.length}
          subvalue="Deterministic chronological sequence"
          icon={GitCommit}
          badgeText="Aligned"
          statusType="default"
          onClick={() => typeof onNavigateTab === 'function' && onNavigateTab('timeline')}
        />

        <StatCard
          title="Evidentiary inconsistencies"
          value={safeContradictions.length}
          subvalue="Cross-examination discrepancies"
          icon={AlertTriangle}
          badgeText={`${safeContradictions.length} flagged`}
          statusType="contradiction"
          onClick={() => typeof onNavigateTab === 'function' && onNavigateTab('contradictions')}
        />
      </div>

      {/* 5. Involved Vehicles: Kinematics & Observations */}
      <div className="rounded-lg bg-white border border-[#D9DEE3] p-6 lg:p-7 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#EDF0F3] gap-3">
          <div className="flex items-center space-x-2.5">
            <Car className="w-4 h-4 text-[#7189A6]" />
            <h3 className="text-xs font-sans font-bold uppercase tracking-wider text-[#25364A]">
              Involved vehicles: kinematics & observations
            </h3>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => typeof onNavigateTab === 'function' && onNavigateTab('reconstruction3d')}
              className="text-xs font-sans text-[#527D70] hover:text-[#43675C] font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Box className="w-4 h-4" />
              <span>Launch 3D Reconstruction</span>
            </button>
            <span className="text-[#D9DEE3]">|</span>
            <button
              onClick={() => typeof onNavigateTab === 'function' && onNavigateTab('trajectory')}
              className="text-xs font-sans text-[#697586] hover:text-[#25364A] font-medium flex items-center gap-1.5 transition cursor-pointer"
            >
              <span>View trajectory curves</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5">
          {safeVehicles.map((v) => {
            const isContradicted = v.status === 'CONTRADICTED_PROFILE';
            return (
              <div
                key={v.id || Math.random()}
                className={`p-5 rounded-lg border transition bg-[#FAFAF8] ${
                  isContradicted
                    ? 'border-[#F1D7D7] hover:border-[#B85C5C]'
                    : 'border-[#D9DEE3] hover:border-[#B5BDC6]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold text-[#25364A]">{v.id}</span>
                    <span className="font-mono text-xs text-[#697586]">({v.licensePlate})</span>
                  </div>
                  <span
                    className={`text-xs font-sans px-2.5 py-0.5 rounded border font-medium ${
                      isContradicted
                        ? 'text-[#B85C5C] bg-[#FBF2F2] border-[#F1D7D7]'
                        : 'text-[#527D70] bg-[#EBF2EE] border-[#D0E0D6]'
                    }`}
                  >
                    {isContradicted ? 'Claim contradicted' : 'Telemetry verified'}
                  </span>
                </div>

                <div className="mt-2.5 text-sm font-semibold text-[#25364A] font-sans">
                  {v.makeModel}
                </div>
                <div className="text-xs text-[#697586] mt-0.5">{v.primaryRole}</div>

                <div className="mt-4 pt-3 border-t border-[#EDF0F3] grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-xs text-[#8A96A6]">Impact speed (Observed)</div>
                    <div className="text-[#25364A] font-mono font-bold mt-0.5">{v.speedAtImpact}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[#8A96A6]">Delta-V (Inferred)</div>
                    <div className="text-[#B85C5C] font-mono font-bold mt-0.5">{v.impactDeltaV}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[#8A96A6]">Peak decel (Sensor)</div>
                    <div className="text-[#C18A45] font-mono font-bold mt-0.5">{v.peakDeceleration}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[#8A96A6]">Driver claim (Unverified)</div>
                    <div className={`font-mono font-bold mt-0.5 ${isContradicted ? 'text-[#B85C5C] line-through' : 'text-[#697586]'}`}>
                      {v.driverClaimSpeed}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Forensic Uncertainty, Limitations & Demonstration Scope Panel */}
      <div className="rounded-lg bg-[#FAF4EB]/70 border border-[#F0DFCA] p-5 shadow-xs text-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-[#EBDCC8]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#C18A45]" />
            <span className="font-bold uppercase tracking-wider text-[#C18A45] text-xs">
              Forensic Reconstruction Uncertainty & Demonstration Scope
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white text-[#C18A45] border border-[#F0DFCA] font-semibold">
            SIMULATED / DEMONSTRATION DATA
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[#697586] text-[11px] leading-relaxed">
          <div>
            <strong className="text-[#25364A] block mb-0.5">Spatial Bounding Accuracy:</strong>
            5-decimal geodetic precision yields ±0.709m max radial cell quantization. Configured illustrative GPS receiver error is ±2.50m (CEP95).
          </div>
          <div>
            <strong className="text-[#25364A] block mb-0.5">Contact Assessment:</strong>
            Oriented bounding boxes (OBB) evaluate to a nominal 0.309m separation gap. Physical contact remains <strong className="text-[#B85C5C]">CONTACT INDETERMINATE</strong> from GPS alone.
          </div>
          <div>
            <strong className="text-[#25364A] block mb-0.5">Integrity Verification:</strong>
            The SHA-256 cryptographic digest verifies digital file integrity against the hashed repository version, not real-world physical evidence authenticity.
          </div>
        </div>

        <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs border-t border-[#EBDCC8]">
          <span className="text-[#8A96A6] text-[11px]">
            Ready to review findings or inspect spatial kinematics?
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => typeof onNavigateTab === 'function' && onNavigateTab('reconstruction3d')}
              className="px-3 py-1.5 rounded-md bg-white border border-[#D9DEE3] hover:border-[#527D70] text-[#25364A] font-semibold transition cursor-pointer shadow-xs"
            >
              Launch 3D Reconstruction
            </button>
            <button
              onClick={() => typeof onNavigateTab === 'function' && onNavigateTab('reports')}
              className="px-3 py-1.5 rounded-md bg-[#527D70] hover:bg-[#43675C] text-white font-semibold transition cursor-pointer shadow-xs"
            >
              Preview Forensic Report
            </button>
          </div>
        </div>
      </div>

      {/* 7. Lower Section: Processing Pipeline, Recent Incidents & Activity Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <EvidenceProcessingStatus pipeline={safePipeline} />
        <RecentIncidents
          incidents={safeIncidents}
          selectedIncident={incident}
          onSelectIncident={onSelectIncident}
          onCreateIncidentClick={onCreateIncidentClick}
        />
        <ActivityAuditTrail activities={safeActivities} />
      </div>
    </div>
  );
}
