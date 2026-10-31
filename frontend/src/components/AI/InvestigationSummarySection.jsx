import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RefreshCw,
  FileText,
  AlertTriangle,
  ShieldCheck,
  Check,
  X,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import featherlessService from '../../services/featherlessService';

export default function InvestigationSummarySection({
  incident,
  timelineEvents = [],
  contradictions = [],
  telemetrySummary = null,
  onNavigateTab = null
}) {
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState(null);
  const [reviewStatus, setReviewStatus] = useState('PENDING_REVIEW'); // PENDING_REVIEW, ACCEPTED, REJECTED, FLAGGED
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [expandedSections, setExpandedSections] = useState({
    chronology: true,
    vehicles: true,
    witnesses: true,
    contradictions: true,
    unresolved: true
  });

  useEffect(() => {
    async function loadInitial() {
      const status = await featherlessService.getStatus();
      setAiStatus(status);
      handleGenerateSummary();
    }
    loadInitial();
  }, [incident?.id]);

  const handleGenerateSummary = async () => {
    setLoading(true);
    try {
      const context = {
        incidentId: incident?.id || 'INC-2026-0884',
        title: incident?.title || 'I-95 Multi-Vehicle Crash',
        location: incident?.location || 'Market & 4th Street',
        epochRange: '18:42:07.500 to 18:42:15.000 UTC',
        t0ReferenceEpoch: '18:42:11.020 UTC',
        closestProximityEpoch: '18:42:11.220 UTC',
        telemetrySummary: telemetrySummary || {
          V1_peak_speed: '84.5 km/h',
          V1_peak_decel: '-2.85 m/s²',
          V2_peak_speed: '35.0 km/h',
          V2_peak_decel: '-2.40 m/s²',
          V3_status: 'Stationary (0.0 km/h)'
        }
      };
      const res = await featherlessService.generateInvestigationSummary(context);
      if (res) {
        setSummaryData(res);
        if (res.investigatorReviewStatus) {
          setReviewStatus(res.investigatorReviewStatus);
        }
      }
    } catch (err) {
      console.error('Failed to generate AI summary:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (sec) => {
    setExpandedSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  return (
    <div className="p-6 rounded-lg bg-white border border-[#D9DEE3] shadow-card space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#EDF0F3] gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-md bg-[#FAF4EB] border border-[#F0DFCA] flex items-center justify-center text-[#C18A45]">
            <Sparkles className="w-5 h-5 text-[#C18A45]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#25364A]">
                AI-Assisted Narrative Investigation Summary
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FAF4EB] text-[#C18A45] border border-[#F0DFCA] font-semibold">
                Featherless AI Synthesis
              </span>
            </div>
            <p className="text-xs text-[#697586] mt-0.5">
              Natural language evidentiary cross-examination and narrative synthesis with human investigator sign-off.
            </p>
          </div>
        </div>

        {/* Re-generate Action */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleGenerateSummary}
            disabled={loading}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded bg-[#F5F4EF] hover:bg-[#EAE8E0] text-xs text-[#25364A] font-semibold transition cursor-pointer border border-[#D9DEE3] disabled:opacity-60 shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#527D70] ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Synthesizing...' : 'Re-synthesize AI Summary'}</span>
          </button>
        </div>
      </div>

      {/* Human Investigator Review & Acceptance Controls */}
      <div className="p-4 rounded-lg bg-[#FAFAF8] border border-[#D9DEE3] flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div>
          <span className="text-[10px] uppercase font-bold text-[#8A96A6] tracking-wider block">
            Investigator Formal Review Status
          </span>
          <div className="flex items-center space-x-2 mt-1">
            <span
              className={`font-mono text-xs font-bold px-2.5 py-0.5 rounded border ${
                reviewStatus === 'ACCEPTED'
                  ? 'text-[#527D70] bg-[#EBF2EE] border-[#D0E0D6]'
                  : reviewStatus === 'REJECTED'
                  ? 'text-[#B85C5C] bg-[#FBF2F2] border-[#F1D7D7]'
                  : reviewStatus === 'FLAGGED'
                  ? 'text-[#C18A45] bg-[#FAF4EB] border-[#F0DFCA]'
                  : 'text-[#697586] bg-[#F5F4EF] border-[#D9DEE3]'
              }`}
            >
              {reviewStatus.replace('_', ' ')}
            </span>
            <span className="text-xs text-[#697586]">
              {reviewStatus === 'ACCEPTED'
                ? 'Investigator has reviewed and accepted AI narrative into official findings.'
                : 'Pending review by certified accident reconstruction investigator.'}
            </span>
          </div>
        </div>

        {/* Accept / Flag / Reject Buttons */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={() => setReviewStatus('ACCEPTED')}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-semibold border transition cursor-pointer ${
              reviewStatus === 'ACCEPTED'
                ? 'bg-[#527D70] text-white border-[#527D70]'
                : 'bg-white text-[#527D70] border-[#D0E0D6] hover:bg-[#EBF2EE]'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>Accept Narrative</span>
          </button>

          <button
            type="button"
            onClick={() => setReviewStatus('FLAGGED')}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-semibold border transition cursor-pointer ${
              reviewStatus === 'FLAGGED'
                ? 'bg-[#C18A45] text-white border-[#C18A45]'
                : 'bg-white text-[#C18A45] border-[#F0DFCA] hover:bg-[#FAF4EB]'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Flag Revision</span>
          </button>

          <button
            type="button"
            onClick={() => setReviewStatus('REJECTED')}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-semibold border transition cursor-pointer ${
              reviewStatus === 'REJECTED'
                ? 'bg-[#B85C5C] text-white border-[#B85C5C]'
                : 'bg-white text-[#B85C5C] border-[#F1D7D7] hover:bg-[#FBF2F2]'
            }`}
          >
            <X className="w-3.5 h-3.5" />
            <span>Reject</span>
          </button>
        </div>
      </div>

      {loading && (
        <div className="py-8 text-center space-y-2">
          <div className="w-8 h-8 border-2 border-[#527D70] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <span className="text-xs text-[#697586]">Generating cross-evidence narrative summary...</span>
        </div>
      )}

      {summaryData && !loading && (
        <div className="space-y-5 text-xs text-[#25364A]">
          {/* Section 1: Incident Overview */}
          <div className="p-4 rounded-md bg-[#FAFAF8] border border-[#EDF0F3] space-y-1.5">
            <div className="text-[10px] uppercase font-bold text-[#8A96A6] tracking-wider">
              1. Incident Overview & Scenario Scope
            </div>
            <p className="leading-relaxed">
              {summaryData.incidentOverview}
            </p>
          </div>

          {/* Section 2: Chronological Event Interpretation */}
          <div className="p-4 rounded-md bg-[#FAFAF8] border border-[#EDF0F3] space-y-2">
            <div
              onClick={() => toggleSection('chronology')}
              className="flex items-center justify-between cursor-pointer select-none"
            >
              <div className="text-[10px] uppercase font-bold text-[#8A96A6] tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#7189A6]" />
                <span>2. Chronological Event Interpretation</span>
              </div>
              {expandedSections.chronology ? <ChevronUp className="w-3.5 h-3.5 text-[#8A96A6]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#8A96A6]" />}
            </div>
            {expandedSections.chronology && (
              <p className="leading-relaxed pt-1">
                {summaryData.chronologicalEventInterpretation}
              </p>
            )}
          </div>

          {/* Section 3: Vehicle-Wise Observations */}
          <div className="p-4 rounded-md bg-[#FAFAF8] border border-[#EDF0F3] space-y-2">
            <div
              onClick={() => toggleSection('vehicles')}
              className="flex items-center justify-between cursor-pointer select-none"
            >
              <div className="text-[10px] uppercase font-bold text-[#8A96A6] tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#527D70]" />
                <span>3. Vehicle-Wise Kinematic Profiles</span>
              </div>
              {expandedSections.vehicles ? <ChevronUp className="w-3.5 h-3.5 text-[#8A96A6]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#8A96A6]" />}
            </div>
            {expandedSections.vehicles && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                {Object.entries(summaryData.vehicleWiseObservations || {}).map(([vKey, vDesc]) => (
                  <div key={vKey} className="p-3 rounded bg-white border border-[#D9DEE3] space-y-1">
                    <span className="font-mono text-xs font-bold text-[#527D70]">
                      Vehicle {vKey}
                    </span>
                    <p className="text-[11px] text-[#25364A] leading-relaxed">
                      {vDesc}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 4: Witness Statement Interpretation */}
          <div className="p-4 rounded-md bg-[#FAFAF8] border border-[#EDF0F3] space-y-1.5">
            <div className="text-[10px] uppercase font-bold text-[#8A96A6] tracking-wider">
              4. Eyewitness Statement Interpretation & Perceptual Calibration
            </div>
            <p className="leading-relaxed">
              {summaryData.witnessStatementInterpretation}
            </p>
          </div>

          {/* Section 5: Contradictions & Discrepancies */}
          <div className="p-4 rounded-md bg-[#FAF4EB]/60 border border-[#F0DFCA] space-y-1.5">
            <div className="text-[10px] uppercase font-bold text-[#C18A45] tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-[#C18A45]" />
              <span>5. Contradictions & Sensor Discrepancy Findings</span>
            </div>
            <p className="leading-relaxed text-[#25364A]">
              {summaryData.contradictionsSummary}
            </p>
          </div>

          {/* Section 6: Unresolved Questions & Missing Evidence */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-md bg-[#EFF4F9]/60 border border-[#D6E2EC] space-y-2">
              <span className="text-[10px] uppercase font-bold text-[#7189A6] tracking-wider block">
                6. Unresolved Forensic Inquiries
              </span>
              <ul className="space-y-1.5 text-[11px] text-[#25364A]">
                {(summaryData.unresolvedQuestions || []).map((q, qIdx) => (
                  <li key={qIdx} className="flex items-start space-x-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#7189A6] mt-1.5 shrink-0"></span>
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 rounded-md bg-[#FBF2F2]/60 border border-[#F1D7D7] space-y-2">
              <span className="text-[10px] uppercase font-bold text-[#B85C5C] tracking-wider block">
                7. Additional Hardware Evidence Required
              </span>
              <ul className="space-y-1.5 text-[11px] text-[#25364A]">
                {(summaryData.additionalEvidenceRequired || []).map((req, rIdx) => (
                  <li key={rIdx} className="flex items-start space-x-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#B85C5C] mt-1.5 shrink-0"></span>
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
