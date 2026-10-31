import React from 'react';
import {
  FileVideo,
  Car,
  GitCommit,
  AlertTriangle,
  ArrowUpRight,
  Activity,
  Layers,
  Info
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

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto font-sans">
      {/* Incident Header Dossier Banner */}
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

      {/* Critical Contradiction Banner */}
      {criticalContradiction && (
        <ContradictionAlertBanner
          contradiction={criticalContradiction}
          onReviewClick={() => typeof onNavigateTab === 'function' && onNavigateTab('contradictions')}
        />
      )}

      {/* Statistical Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Evidence sources"
          value={safeEvidence.length}
          subvalue="5 optical video / 2 telematics"
          icon={FileVideo}
          badgeText={`${safeEvidence.length} logged`}
          statusType="telemetry"
          onClick={() => typeof onNavigateTab === 'function' && onNavigateTab('evidence')}
        />

        <StatCard
          title="Tracked vehicles"
          value={safeVehicles.length}
          subvalue="Optical tracking & CAN bus logs"
          icon={Car}
          badgeText={`${safeVehicles.length} identified`}
          statusType="verified"
          onClick={() => typeof onNavigateTab === 'function' && onNavigateTab('trajectory')}
        />

        <StatCard
          title="Timeline events"
          value={safeTimeline.length}
          subvalue="t - 05.00s to t + 03.50s micro-sync"
          icon={GitCommit}
          badgeText="Aligned"
          statusType="default"
          onClick={() => typeof onNavigateTab === 'function' && onNavigateTab('timeline')}
        />

        <StatCard
          title="Evidentiary inconsistencies"
          value={safeContradictions.length}
          subvalue="1 statement refuted / 1 clock skew"
          icon={AlertTriangle}
          badgeText={`${safeContradictions.length} flagged`}
          statusType="contradiction"
          onClick={() => typeof onNavigateTab === 'function' && onNavigateTab('contradictions')}
        />
      </div>

      {/* Mid Section: Vehicles Telemetry & Observations */}
      <div className="rounded-lg bg-white border border-[#D9DEE3] p-6 lg:p-7 shadow-card">
        <div className="flex items-center justify-between pb-4 border-b border-[#EDF0F3]">
          <div className="flex items-center space-x-2.5">
            <Car className="w-4 h-4 text-[#7189A6]" />
            <h3 className="text-xs font-sans font-bold uppercase tracking-wider text-[#25364A]">
              Involved vehicles: kinematics & observations
            </h3>
          </div>
          <button
            onClick={() => typeof onNavigateTab === 'function' && onNavigateTab('trajectory')}
            className="text-xs font-sans text-[#697586] hover:text-[#527D70] font-medium flex items-center gap-1.5 transition"
          >
            <span>View complete trajectory curves</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
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

      {/* Lower Section: Processing Pipeline, Recent Incidents & Activity Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <EvidenceProcessingStatus pipeline={safePipeline} />
        <RecentIncidents
          incidents={safeIncidents}
          selectedIncident={incident}
          onSelectIncident={onSelectIncident}
        />
        <ActivityAuditTrail activities={safeActivities} />
      </div>
    </div>
  );
}
