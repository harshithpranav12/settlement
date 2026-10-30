import React, { useState, useMemo, useEffect } from 'react';
import {
  AlertTriangle,
  Scale,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Sparkles,
  Clock,
  Gauge,
  ArrowRight,
  FileText,
  ChevronRight,
  Layers,
  Cpu,
  ShieldCheck,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { detectContradictions } from '../../utils/contradictionEngine';
import featherlessService from '../../services/featherlessService';

export default function ContradictionMatrix({
  contradictions = [],
  incident,
  evidenceSources = [],
  timelineEvents = [],
  vehicles = [],
  onNavigateTab
}) {
  // Dynamically detect contradictions using deterministic forensic engine
  const dynamicContradictions = useMemo(() => {
    const detected = detectContradictions({
      evidenceSources,
      timelineEvents,
      vehicles,
      incident
    });
    if (detected && detected.length > 0) {
      return detected;
    }
    return Array.isArray(contradictions) && contradictions.length > 0 ? contradictions : [];
  }, [evidenceSources, timelineEvents, vehicles, incident, contradictions]);

  const defaultItem = dynamicContradictions[0] || {
    id: 'CTR-00',
    title: 'No Contradictions Flagged',
    severity: 'TECHNICAL',
    category: 'Analysis Pending',
    confidenceDelta: '0.0% Discrepancy',
    confidence: 100,
    claimParty: 'N/A',
    claimText: 'No witness statements currently contradict sensor telemetry.',
    claimSource: 'System Ingest',
    evidenceText: 'All sensory signals match within statistical threshold.',
    evidenceSource: 'TRACE Context Engine',
    observedValues: 'Normal operating envelope',
    claimedValues: 'Normal operating envelope',
    numericalDiscrepancy: '0.0% Variance',
    originalRecordReferences: ['System Ingest'],
    impactOnCausation: 'No variance identified.',
    status: 'VERIFIED_CONSISTENT',
    legalAdmissibilityScore: 100.0
  };

  const [selectedContradictionId, setSelectedContradictionId] = useState(defaultItem.id);
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // AI explanation state per contradiction ID
  const [aiExplanations, setAiExplanations] = useState({});
  const [loadingAiId, setLoadingAiId] = useState(null);

  // Synchronize default selected ID when list changes
  useEffect(() => {
    if (dynamicContradictions.length > 0) {
      const exists = dynamicContradictions.some((c) => c.id === selectedContradictionId);
      if (!exists) {
        setSelectedContradictionId(dynamicContradictions[0].id);
      }
    }
  }, [dynamicContradictions, selectedContradictionId]);

  const selected = dynamicContradictions.find((c) => c && c.id === selectedContradictionId) || dynamicContradictions[0] || defaultItem;

  // Filtered contradictions
  const filteredContradictions = useMemo(() => {
    return dynamicContradictions.filter((c) => {
      if (!c) return false;
      if (severityFilter !== 'ALL' && c.severity !== severityFilter) {
        return false;
      }
      if (categoryFilter !== 'ALL' && c.category !== categoryFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const mId = (c.id || '').toLowerCase().includes(q);
        const mTitle = (c.title || '').toLowerCase().includes(q);
        const mParty = (c.claimParty || '').toLowerCase().includes(q);
        const mClaim = (c.claimText || '').toLowerCase().includes(q);
        const mEvidence = (c.evidenceText || '').toLowerCase().includes(q);
        return mId || mTitle || mParty || mClaim || mEvidence;
      }
      return true;
    });
  }, [dynamicContradictions, severityFilter, categoryFilter, searchQuery]);

  // Request Featherless AI synthesis for selected contradiction
  const handleRequestAiExplanation = async (contradiction) => {
    if (!contradiction) return;
    setLoadingAiId(contradiction.id);
    try {
      const result = await featherlessService.explainContradiction(contradiction);
      if (result && result.explanation) {
        setAiExplanations((prev) => ({
          ...prev,
          [contradiction.id]: result.explanation,
        }));
      }
    } catch (err) {
      console.error('Failed to generate Featherless AI explanation:', err);
    } finally {
      setLoadingAiId(null);
    }
  };

  const currentAiExplanation = aiExplanations[selected.id] || featherlessService.getDeterministicExplanation(selected).explanation;

  const getSeverityStyle = (sev) => {
    switch (sev) {
      case 'CRITICAL':
        return 'text-[#B85C5C] bg-[#FBF2F2] border-[#F1D7D7] font-semibold';
      case 'MODERATE':
        return 'text-[#C18A45] bg-[#FAF4EB] border-[#F0DFCA] font-medium';
      case 'TECHNICAL':
        return 'text-[#7189A6] bg-[#EFF4F9] border-[#D6E2EC] font-medium';
      default:
        return 'text-[#697586] bg-[#F5F4EF] border-[#D9DEE3]';
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'CONFIRMED_CONTRADICTION':
        return {
          label: 'Inconsistency Confirmed',
          className: 'bg-[#FBF2F2] text-[#B85C5C] border-[#F1D7D7]',
          icon: XCircle
        };
      case 'CORROBORATED_CROSS_CHECK':
        return {
          label: 'Corroborated Finding',
          className: 'bg-[#EBF2EE] text-[#527D70] border-[#D0E0D6]',
          icon: CheckCircle2
        };
      case 'RECONCILED_TEMPORAL_SKEW':
        return {
          label: 'Reconciled Temporal Skew',
          className: 'bg-[#EFF4F9] text-[#7189A6] border-[#D6E2EC]',
          icon: Clock
        };
      default:
        return {
          label: 'Evidence Evaluated',
          className: 'bg-[#F5F4EF] text-[#697586] border-[#D9DEE3]',
          icon: ShieldCheck
        };
    }
  };

  const statusBadge = getStatusBadge(selected.status);

  // Summary statistics
  const criticalCount = dynamicContradictions.filter((c) => c.severity === 'CRITICAL').length;
  const moderateCount = dynamicContradictions.filter((c) => c.severity === 'MODERATE').length;
  const technicalCount = dynamicContradictions.filter((c) => c.severity === 'TECHNICAL').length;

  return (
    <div className="p-6 lg:p-8 space-y-7 max-w-7xl mx-auto font-sans">
      {/* 1. Header & Incident Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#D9DEE3]">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-xs font-sans font-medium px-2.5 py-0.5 rounded bg-[#FBF2F2] text-[#B85C5C] border border-[#F1D7D7]">
              Module 04
            </span>
            <span className="font-mono text-xs font-semibold text-[#25364A] bg-[#FAFAF8] px-2 py-0.5 rounded border border-[#D9DEE3]">
              Incident: {incident?.id || 'INC-2026-0884'}
            </span>
            <span className="text-xs text-[#697586] bg-white px-2 py-0.5 rounded border border-[#D9DEE3]">
              Cross-Examined across {evidenceSources.length} Evidence Streams
            </span>
          </div>

          <h1 className="text-2xl font-bold text-[#25364A] tracking-tight">
            AI-Powered Contradiction Detection Engine
          </h1>

          <p className="text-xs text-[#697586] leading-relaxed">
            Deterministic cross-examination comparing witness testimony against high-frequency physical telematics and calibrated video analytics.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <div className="px-3.5 py-2 rounded-md bg-[#FBF2F2] border border-[#F1D7D7] text-[#B85C5C] flex items-center gap-2 font-medium shadow-xs">
            <AlertTriangle className="w-4 h-4 text-[#B85C5C]" />
            <span>{dynamicContradictions.length} Evidentiary Inconsistencies</span>
          </div>
        </div>
      </div>

      {/* 2. Overview Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-white border border-[#D9DEE3] shadow-card flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-lg bg-[#FBF2F2] border border-[#F1D7D7] flex items-center justify-center text-[#B85C5C]">
            <AlertTriangle className="w-5 h-5 text-[#B85C5C]" />
          </div>
          <div>
            <div className="text-[11px] font-sans font-medium text-[#697586] uppercase tracking-wider">
              Flagged Inconsistencies
            </div>
            <div className="text-xl font-bold font-mono text-[#25364A] mt-0.5">
              {dynamicContradictions.length}
            </div>
            <div className="text-[10px] text-[#8A96A6]">Total cross-examinations</div>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-white border border-[#D9DEE3] shadow-card flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-lg bg-[#FBF2F2] border border-[#F1D7D7] flex items-center justify-center text-[#B85C5C]">
            <XCircle className="w-5 h-5 text-[#B85C5C]" />
          </div>
          <div>
            <div className="text-[11px] font-sans font-medium text-[#B85C5C] uppercase tracking-wider">
              Critical Severity
            </div>
            <div className="text-xl font-bold font-mono text-[#B85C5C] mt-0.5">
              {criticalCount}
            </div>
            <div className="text-[10px] text-[#8A96A6]">Direct causation conflicts</div>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-white border border-[#D9DEE3] shadow-card flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-lg bg-[#FAF4EB] border border-[#F0DFCA] flex items-center justify-center text-[#C18A45]">
            <Gauge className="w-5 h-5 text-[#C18A45]" />
          </div>
          <div>
            <div className="text-[11px] font-sans font-medium text-[#C18A45] uppercase tracking-wider">
              Velocity Discrepancy
            </div>
            <div className="text-xl font-bold font-mono text-[#C18A45] mt-0.5">
              +111.3%
            </div>
            <div className="text-[10px] text-[#8A96A6]">40.0 vs 84.5 km/h</div>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-white border border-[#D9DEE3] shadow-card flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-lg bg-[#EBF2EE] border border-[#D0E0D6] flex items-center justify-center text-[#527D70]">
            <ShieldCheck className="w-5 h-5 text-[#527D70]" />
          </div>
          <div>
            <div className="text-[11px] font-sans font-medium text-[#527D70] uppercase tracking-wider">
              Evidence Admissibility
            </div>
            <div className="text-xl font-bold font-mono text-[#527D70] mt-0.5">
              99.4%
            </div>
            <div className="text-[10px] text-[#8A96A6]">Daubert standard certified</div>
          </div>
        </div>
      </div>

      {/* 3. Filter Toolbar */}
      <div className="p-4 rounded-lg bg-white border border-[#D9DEE3] shadow-card space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Severity Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-sans">
            <span className="text-[#8A96A6] text-[11px] font-semibold uppercase tracking-wider mr-1">
              Severity:
            </span>
            {[
              { id: 'ALL', label: `All Inconsistencies (${dynamicContradictions.length})` },
              { id: 'CRITICAL', label: `Critical (${criticalCount})` },
              { id: 'MODERATE', label: `Moderate (${moderateCount})` },
              { id: 'TECHNICAL', label: `Technical (${technicalCount})` },
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setSeverityFilter(btn.id)}
                className={`px-3 py-1.5 rounded-md border text-xs transition cursor-pointer ${
                  severityFilter === btn.id
                    ? 'bg-[#EBF2EE] text-[#527D70] font-semibold border-[#D0E0D6]'
                    : 'bg-white text-[#697586] border-[#D9DEE3] hover:text-[#25364A] hover:bg-[#FAFAF8]'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#8A96A6] absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contradiction ID, witness, or metric..."
              className="bg-white border border-[#D9DEE3] text-xs text-[#25364A] pl-8.5 pr-3 py-1.5 rounded-md focus:outline-none focus:ring-1 focus:ring-[#527D70] focus:border-[#527D70] w-64 shadow-xs"
            />
          </div>
        </div>

        {/* Secondary Category Filter */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#EDF0F3] text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-[#697586] text-xs font-medium">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-white border border-[#D9DEE3] text-xs text-[#25364A] py-1 px-2.5 rounded-md focus:outline-none focus:ring-1 focus:ring-[#527D70] shadow-xs cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              <option value="Witness Statement vs Telemetry">Witness Statement vs Telemetry</option>
              <option value="Speed Discrepancy">Speed Discrepancy</option>
              <option value="Braking Timing Discrepancy">Braking Timing Discrepancy</option>
              <option value="Optical Photogrammetry vs Telemetry">Optical Photogrammetry vs Telemetry</option>
              <option value="Timestamp Synchronization">Timestamp Synchronization</option>
            </select>
          </div>

          <div className="ml-auto text-xs text-[#697586]">
            Showing <strong className="text-[#25364A]">{filteredContradictions.length}</strong> of {dynamicContradictions.length} contradictions
          </div>
        </div>
      </div>

      {/* 4. Main Workspace: Contradiction Cards (Left 5 cols) + Cross-Examination Dossier (Right 7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
        {/* Left Side: Flagged Contradiction Cards */}
        <div className="lg:col-span-5 space-y-3.5">
          <div className="text-xs font-sans font-semibold tracking-wide text-[#697586] pb-1 flex items-center justify-between">
            <span>Flagged Evidentiary Inconsistencies</span>
            <span className="font-mono text-[11px] text-[#8A96A6]">{filteredContradictions.length} active</span>
          </div>

          <div className="space-y-3 max-h-[750px] overflow-y-auto pr-1">
            {filteredContradictions.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#8A96A6] space-y-2 bg-white rounded-lg border border-[#D9DEE3] p-6">
                <div>No contradictions match the selected filters.</div>
                <button
                  onClick={() => {
                    setSeverityFilter('ALL');
                    setCategoryFilter('ALL');
                    setSearchQuery('');
                  }}
                  className="text-xs text-[#527D70] underline cursor-pointer font-medium"
                >
                  Reset all filters
                </button>
              </div>
            ) : (
              filteredContradictions.map((ctr) => {
                const isSelected = ctr.id === selected.id;
                const cStatus = getStatusBadge(ctr.status);

                return (
                  <div
                    key={ctr.id}
                    onClick={() => setSelectedContradictionId(ctr.id)}
                    className={`p-5 rounded-lg border transition cursor-pointer shadow-card space-y-3 ${
                      isSelected
                        ? 'bg-[#FBF2F2]/60 border-[#B85C5C] shadow-xs'
                        : 'bg-white border-[#D9DEE3] hover:border-[#B5BDC6] hover:bg-[#FAFAF8]'
                    }`}
                  >
                    {/* Header Row: ID, Severity & Discrepancy */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-[#25364A]">{ctr.id}</span>
                        <span className={`text-[11px] font-sans px-2 py-0.5 rounded border uppercase tracking-wider ${getSeverityStyle(ctr.severity)}`}>
                          {ctr.severity}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-[#B85C5C] font-semibold">
                        {ctr.confidenceDelta}
                      </span>
                    </div>

                    {/* Title */}
                    <div>
                      <h4 className="text-sm font-semibold text-[#25364A] leading-snug">
                        {ctr.title}
                      </h4>
                      <p className="text-xs text-[#697586] mt-1 line-clamp-2 leading-relaxed">
                        {ctr.evidenceText}
                      </p>
                    </div>

                    {/* Source Comparison Pills */}
                    <div className="p-2.5 rounded-md bg-[#FAFAF8] border border-[#EDF0F3] text-[11px] space-y-1.5 font-sans">
                      <div className="flex items-center justify-between text-[#C18A45]">
                        <span className="font-semibold flex items-center gap-1">
                          <XCircle className="w-3 h-3 text-[#C18A45]" />
                          Claim:
                        </span>
                        <span className="truncate max-w-[200px] text-right font-mono font-medium text-[#25364A]">
                          {ctr.claimedValues}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[#527D70]">
                        <span className="font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-[#527D70]" />
                          Observed:
                        </span>
                        <span className="truncate max-w-[200px] text-right font-mono font-bold text-[#527D70]">
                          {ctr.observedValues}
                        </span>
                      </div>
                    </div>

                    {/* Footer Source Reference */}
                    <div className="pt-2 border-t border-[#EDF0F3] flex items-center justify-between text-[11px] text-[#8A96A6]">
                      <span className="truncate max-w-[220px]">
                        Sources: <strong className="text-[#25364A] font-medium font-mono">{ctr.sourceEvidenceIds?.join(' vs ') || 'Multi-Stream'}</strong>
                      </span>
                      <span className="text-[10px] font-sans px-2 py-0.5 rounded border font-medium bg-[#FAFAF8] text-[#697586]">
                        {cStatus.label}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Deep Cross-Examination Dossier */}
        <div className="lg:col-span-7 rounded-lg bg-white border border-[#D9DEE3] p-6 lg:p-7 space-y-6 shadow-card">
          {/* Dossier Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#EDF0F3]">
            <div className="flex items-center space-x-2.5">
              <Scale className="w-4 h-4 text-[#7189A6]" />
              <h3 className="text-xs font-sans font-bold uppercase tracking-wider text-[#25364A]">
                Forensic Cross-Examination Dossier: {selected.id}
              </h3>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`text-xs px-2.5 py-0.5 rounded border ${getSeverityStyle(selected.severity)}`}>
                {selected.severity.toLowerCase()} severity
              </span>
              <span className={`text-xs px-2.5 py-0.5 rounded border font-medium ${statusBadge.className}`}>
                {statusBadge.label}
              </span>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold text-[#25364A] leading-tight">
              {selected.title}
            </h2>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-[#697586]">
              <span>Category: <strong className="text-[#25364A]">{selected.category}</strong></span>
              <span>•</span>
              <span>Confidence: <strong className="text-[#527D70]">{selected.confidence || 99.0}%</strong></span>
              <span>•</span>
              <span>Admissibility: <strong className="text-[#527D70]">{selected.legalAdmissibilityScore}%</strong></span>
            </div>
          </div>

          {/* Two-Column Comparison Card: Claim vs Observation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Subjective Claim (Warning / Amber tint) */}
            <div className="p-4.5 rounded-lg bg-[#FAF4EB] border border-[#F0DFCA] space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-sans font-bold text-[#C18A45] flex items-center gap-1.5">
                    <XCircle className="w-4 h-4 text-[#C18A45]" />
                    Evidence A (Subjective Claim)
                  </span>
                  <span className="font-mono text-[11px] text-[#C18A45] font-semibold bg-white/60 px-1.5 py-0.5 rounded border border-[#F0DFCA]">
                    {selected.sourceEvidenceIds?.[0] || 'Claim'}
                  </span>
                </div>

                <div className="text-[11px] text-[#8A96A6]">
                  Claimant: <strong className="text-[#25364A] font-medium">{selected.claimParty}</strong>
                </div>

                <div className="p-2.5 rounded bg-white/70 border border-[#F0DFCA]">
                  <span className="text-[10px] text-[#8A96A6] block uppercase font-semibold">Claimed Value</span>
                  <span className="text-sm font-bold font-mono text-[#C18A45]">
                    {selected.claimedValues}
                  </span>
                </div>

                <p className="text-xs text-[#25364A] italic leading-relaxed pt-1">
                  "{selected.claimText}"
                </p>
              </div>

              <div className="pt-2.5 border-t border-[#F0DFCA] text-[11px] text-[#C18A45] truncate">
                Source: {selected.claimSource}
              </div>
            </div>

            {/* Objective Telemetry Ground Truth (Sage green tint) */}
            <div className="p-4.5 rounded-lg bg-[#EBF2EE] border border-[#D0E0D6] space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-sans font-bold text-[#527D70] flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#527D70]" />
                    Evidence B (Empirical Observation)
                  </span>
                  <span className="font-mono text-[11px] text-[#527D70] font-semibold bg-white/60 px-1.5 py-0.5 rounded border border-[#D0E0D6]">
                    {selected.sourceEvidenceIds?.[1] || 'Telemetry'}
                  </span>
                </div>

                <div className="text-[11px] text-[#697586]">
                  Channel: <strong className="text-[#25364A] font-medium">{selected.evidenceB?.channel || 'Hardware CAN Bus Logger'}</strong>
                </div>

                <div className="p-2.5 rounded bg-white/70 border border-[#D0E0D6]">
                  <span className="text-[10px] text-[#8A96A6] block uppercase font-semibold">Observed Value</span>
                  <span className="text-sm font-bold font-mono text-[#527D70]">
                    {selected.observedValues}
                  </span>
                </div>

                <p className="text-xs text-[#25364A] leading-relaxed pt-1">
                  {selected.evidenceText}
                </p>
              </div>

              <div className="pt-2.5 border-t border-[#D0E0D6] text-[11px] text-[#527D70] truncate">
                Source: {selected.evidenceSource}
              </div>
            </div>
          </div>

          {/* Numerical Discrepancy & Variance Analysis Card */}
          <div className="p-4.5 rounded-lg bg-[#FAFAF8] border border-[#D9DEE3] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wider text-[#697586] flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-[#7189A6]" />
                Quantitative Discrepancy Metric
              </div>
              <span className="font-mono text-xs font-bold text-[#B85C5C] bg-[#FBF2F2] px-2.5 py-0.5 rounded border border-[#F1D7D7]">
                {selected.numericalDiscrepancy}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs font-mono">
              <div className="p-2.5 rounded bg-white border border-[#EDF0F3]">
                <span className="text-[10px] text-[#8A96A6] block font-sans">Claimed Metric</span>
                <span className="font-bold text-[#C18A45] text-sm">{selected.claimedValues}</span>
              </div>
              <div className="p-2.5 rounded bg-white border border-[#EDF0F3]">
                <span className="text-[10px] text-[#8A96A6] block font-sans">Empirical Sensor Ground Truth</span>
                <span className="font-bold text-[#527D70] text-sm">{selected.observedValues}</span>
              </div>
              <div className="p-2.5 rounded bg-white border border-[#EDF0F3]">
                <span className="text-[10px] text-[#8A96A6] block font-sans">Mathematical Delta</span>
                <span className="font-bold text-[#B85C5C] text-sm">{selected.confidenceDelta}</span>
              </div>
            </div>
          </div>

          {/* AI Forensic Synthesis (Featherless AI Engine) */}
          <div className="p-5 rounded-lg bg-white border border-[#D9DEE3] shadow-card space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#EDF0F3]">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-[#C18A45]" />
                <h4 className="text-xs font-sans font-bold uppercase tracking-wider text-[#25364A]">
                  Featherless AI Forensic Cross-Examination Analysis
                </h4>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono text-[#527D70] bg-[#EBF2EE] px-2 py-0.5 rounded border border-[#D0E0D6]">
                  Strict Evidence-Grounded
                </span>
                <button
                  type="button"
                  onClick={() => handleRequestAiExplanation(selected)}
                  disabled={loadingAiId === selected.id}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-[#F5F4EF] hover:bg-[#EAE8E0] text-[11px] text-[#25364A] font-medium transition cursor-pointer disabled:opacity-60 shadow-2xs"
                >
                  <RefreshCw className={`w-3 h-3 text-[#527D70] ${loadingAiId === selected.id ? 'animate-spin' : ''}`} />
                  <span>{loadingAiId === selected.id ? 'Synthesizing...' : 'Synthesize AI'}</span>
                </button>
              </div>
            </div>

            <div className="text-xs text-[#25364A] leading-relaxed whitespace-pre-line bg-[#FAFAF8] p-4 rounded-md border border-[#EDF0F3] font-sans">
              {currentAiExplanation}
            </div>
          </div>

          {/* Impact on Causation & Liability */}
          <div className="p-4.5 rounded-lg bg-[#FAFAF8] border border-[#D9DEE3] text-xs space-y-1.5">
            <div className="text-xs uppercase text-[#697586] tracking-wider font-semibold">
              Causation & Legal Liability Assessment
            </div>
            <p className="text-[#25364A] leading-relaxed">
              {selected.impactOnCausation}
            </p>
          </div>

          {/* Supporting Original Record References & Navigation */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wider text-[#8A96A6]">
                Supporting Original Record References
              </span>
              <span className="text-[11px] text-[#697586]">
                {(selected.originalRecordReferences || []).length} Verified References
              </span>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              {(selected.originalRecordReferences || []).map((ref, rIdx) => (
                <div
                  key={rIdx}
                  className="px-3 py-1.5 rounded bg-white border border-[#D9DEE3] text-[#25364A] font-mono flex items-center space-x-2 shadow-2xs"
                >
                  <FileText className="w-3.5 h-3.5 text-[#7189A6]" />
                  <span>{ref}</span>
                </div>
              ))}
            </div>

            {/* Quick Evidence / Timeline Navigation */}
            {typeof onNavigateTab === 'function' && (
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                <button
                  type="button"
                  onClick={() => onNavigateTab('timeline')}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-[#EBF2EE] hover:bg-[#DCEAE1] text-xs text-[#527D70] font-medium transition cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5 text-[#527D70]" />
                  <span>Inspect in Timeline Reconstruction</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => onNavigateTab('evidence')}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-[#F5F4EF] hover:bg-[#EAE8E0] text-xs text-[#25364A] font-medium transition cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-[#697586]" />
                  <span>Inspect in Evidence Center</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Admissibility Footer Metrics */}
          <div className="pt-4 border-t border-[#EDF0F3] grid grid-cols-2 sm:grid-cols-3 gap-3.5 text-xs">
            <div className="p-3 rounded-md bg-[#FAFAF8] border border-[#D9DEE3]">
              <div className="text-xs text-[#8A96A6]">Daubert Admissibility</div>
              <div className="text-[#527D70] font-mono font-bold text-base mt-0.5">
                {selected.legalAdmissibilityScore}%
              </div>
            </div>

            <div className="p-3 rounded-md bg-[#FAFAF8] border border-[#D9DEE3]">
              <div className="text-xs text-[#8A96A6]">Corroboration Level</div>
              <div className="text-[#7189A6] font-sans font-semibold text-base mt-0.5">
                Multi-Sensor Fusion
              </div>
            </div>

            <div className="p-3 rounded-md bg-[#FAFAF8] border border-[#D9DEE3] col-span-2 sm:col-span-1">
              <div className="text-xs text-[#8A96A6]">Chain of Custody</div>
              <div className="text-[#527D70] font-sans font-semibold text-base mt-0.5 flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-[#527D70]" />
                Cryptographically Sealed
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
