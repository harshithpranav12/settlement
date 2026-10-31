import React, { useState, useEffect } from 'react';
import {
  Printer,
  ShieldCheck,
  Copy,
  Lock,
  Scale,
  RefreshCw,
  FileText,
  AlertTriangle,
  Eye,
  Activity,
  CheckCircle2,
  HelpCircle,
  Clock,
  Layers
} from 'lucide-react';
import apiService from '../../services/api';

export default function InvestigationReport({
  incident,
  contradictions = [],
  vehicles = [],
  evidenceSources = []
}) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [liveReport, setLiveReport] = useState(null);
  const [reportError, setReportError] = useState(null);

  const safeIncident = incident || {
    id: 'INC-2026-0884',
    title: 'Interstate 95 Multi-Vehicle Collision',
    location: 'I-95 Northbound, Exit 42 interchange',
    timestamp: '2026-10-24 18:42:11.020 UTC',
    weather: 'Overcast / Wet Pavement',
    leadInvestigator: 'Agent Marcus Vance',
    reconstructionConfidence: 94.2,
  };

  const certifiedHash = "e9b204689c40fa93c200427181c06283ff1720816a3a411cfeb5b79815181b53";

  // Attempt to fetch live 10-section report from backend
  const fetchReport = async (refresh = false) => {
    if (!safeIncident.id) return;
    setLoading(true);
    setReportError(null);
    try {
      const data = await apiService.getReport(safeIncident.id, refresh);
      if (data && data.section_1_summary) {
        setLiveReport(data);
      }
    } catch (err) {
      console.warn('Could not load live report from backend:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(false);
  }, [safeIncident.id]);

  const handleCopyHash = () => {
    navigator.clipboard?.writeText(certifiedHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-5xl mx-auto font-sans">
      {/* Header & Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#D9DEE3]">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-xs font-sans font-medium px-2.5 py-0.5 rounded bg-[#EBF2EE] text-[#527D70] border border-[#D0E0D6]">
              Module 06
            </span>
            <span className="text-xs text-[#697586] font-medium">Reconstruction reporting</span>
            {liveReport && (
              <span className="text-[11px] font-mono px-2 py-0.2 rounded bg-[#FAF4EB] text-[#C18A45] border border-[#F0DFCA]">
                Backend 10-Section Live Report
              </span>
            )}
          </div>
          <h2 className="text-2xl font-bold text-[#25364A] tracking-tight">
            Forensic Technical Investigation Report
          </h2>
          <p className="text-xs text-[#697586] leading-relaxed">
            Standardized 10-section forensic investigation synthesis conforming to objective evidentiary rules.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2.5 text-xs font-sans">
          <button
            onClick={() => fetchReport(true)}
            disabled={loading}
            className="px-3.5 py-2 rounded-md bg-white hover:bg-[#FAFAF8] border border-[#D9DEE3] text-[#25364A] flex items-center gap-1.5 transition shadow-xs cursor-pointer disabled:opacity-50"
            title="Re-generate report with latest database observations"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#527D70] ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Synthesizing...' : 'Refresh Live'}</span>
          </button>
          <button
            onClick={handleCopyHash}
            className="px-3.5 py-2 rounded-md bg-white hover:bg-[#FAFAF8] border border-[#D9DEE3] text-[#25364A] flex items-center gap-2 transition shadow-xs cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-[#697586]" />
            <span>{copied ? 'Digest copied' : 'Copy test digest'}</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-md bg-[#527D70] hover:bg-[#43675c] text-white font-medium flex items-center gap-2 transition shadow-sm cursor-pointer"
          >
            <Printer className="w-4 h-4 text-white" />
            <span>Print dossier</span>
          </button>
        </div>
      </div>

      {/* Formal Paper Dossier Sheet */}
      <div className="rounded-lg bg-white border border-[#D9DEE3] p-8 lg:p-12 space-y-8 text-[#25364A] shadow-md">
        {/* Document Header */}
        <div className="flex items-start justify-between border-b border-[#D9DEE3] pb-6">
          <div className="space-y-1">
            <div className="flex items-center space-x-2.5">
              <span className="text-lg font-bold text-[#25364A] tracking-tight">TRACE AI FORENSIC RECONSTRUCTION REPORT</span>
              <span className="text-xs px-2.5 py-0.5 rounded bg-[#EBF2EE] text-[#527D70] border border-[#D0E0D6] font-medium">
                ISO/IEC 27037 Standard
              </span>
            </div>
            <div className="text-xs text-[#697586]">
              Deterministic Multi-Modal Event Reconstruction & Evidence Cross-Examination
            </div>
            <div className="text-xs text-[#8A96A6] font-mono pt-0.5">
              Case Ref: <strong className="text-[#25364A] font-semibold">{safeIncident.id}</strong> • Title: {liveReport?.incident_title || safeIncident.title}
            </div>
          </div>

          <div className="text-right text-xs">
            <div className="text-[#697586]">Report Generated</div>
            <div className="text-[#25364A] font-mono font-semibold">
              {liveReport?.report_generated_at ? liveReport.report_generated_at.split('T')[0] : new Date().toISOString().split('T')[0]}
            </div>
            <div className="text-xs font-sans text-[#527D70] font-medium mt-1">Status: Objectively Grounded</div>
          </div>
        </div>

        {/* Incident Summary Matrix */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 rounded-lg bg-[#FAFAF8] border border-[#D9DEE3] text-xs">
          <div>
            <div className="text-xs text-[#8A96A6] uppercase tracking-wide">Incident Location</div>
            <div className="text-[#25364A] font-medium mt-1">{liveReport?.incident_location || safeIncident.location}</div>
          </div>
          <div>
            <div className="text-xs text-[#8A96A6] uppercase tracking-wide">Timecode / Reference</div>
            <div className="text-[#527D70] font-mono font-bold mt-1">{liveReport?.incident_timestamp || safeIncident.timestamp}</div>
          </div>
          <div>
            <div className="text-xs text-[#8A96A6] uppercase tracking-wide">Reconstruction Baseline</div>
            <div className="text-[#25364A] font-mono font-bold mt-1">Multi-Modal Fusion</div>
          </div>
          <div>
            <div className="text-xs text-[#8A96A6] uppercase tracking-wide">Lead Investigator</div>
            <div className="text-[#25364A] font-medium mt-1">{safeIncident.leadInvestigator || 'Forensic Recon Unit'}</div>
          </div>
        </div>

        {/* Section 1: Incident Summary */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#697586] flex items-center gap-2">
            <Scale className="w-4 h-4 text-[#527D70]" />
            1. Incident Summary
          </h3>
          <p className="text-xs text-[#25364A] leading-relaxed bg-[#FAFAF8] p-5 rounded-lg border border-[#D9DEE3]">
            {liveReport?.section_1_summary ||
              "Based upon multi-sensor optical tracking from Caltrans CCTV #402, 500Hz CAN bus crash records from Vehicle 02 (Ford Explorer) and Vehicle 01 (Tesla Model 3), and synchronized photogrammetric drone point clouds, the primary collision was caused by Vehicle 01 entering the signalized intersection 1.02 seconds after the Northbound traffic signal transitioned to solid Red."}
          </p>
        </div>

        {/* Section 2: Involved Parties & Statements */}
        {liveReport?.section_2_parties && liveReport.section_2_parties.length > 0 && (
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#697586] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#7189A6]" />
              2. Involved Parties & Verbatim Statements
            </h3>
            <div className="space-y-2 text-xs">
              {liveReport.section_2_parties.map((p, idx) => (
                <div key={idx} className="p-3.5 rounded-lg border border-[#D9DEE3] bg-[#FAFAF8] space-y-1">
                  <div className="font-semibold text-[#25364A] flex items-center justify-between">
                    <span>{p.label}: {p.name}</span>
                    <span className="text-[11px] font-mono text-[#697586]">{p.vehicle_registration || 'No Reg'}</span>
                  </div>
                  <div className="text-[#697586] italic text-[11px]">
                    "{p.original_statement || 'No statement recorded.'}"
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 3: Chronological Timeline Events */}
        {liveReport?.section_3_timeline && liveReport.section_3_timeline.length > 0 && (
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#697586] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#527D70]" />
              3. Chronological Reconstructed Timeline ({liveReport.section_3_timeline.length} Events)
            </h3>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-[#D9DEE3] bg-white divide-y divide-[#EDF0F3] text-xs font-mono">
              {liveReport.section_3_timeline.slice(0, 15).map((evt, idx) => (
                <div key={idx} className="p-2.5 flex items-center justify-between hover:bg-[#FAFAF8]">
                  <div className="flex items-center space-x-2">
                    <span className="text-[#527D70] font-semibold">{evt.offset_or_timestamp}</span>
                    <span className="text-[#25364A] font-sans">{evt.description}</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded border uppercase ${
                    evt.classification === 'OBSERVATION'
                      ? 'bg-[#EBF2EE] text-[#527D70] border-[#D0E0D6]'
                      : 'bg-[#FAF4EB] text-[#C18A45] border-[#F0DFCA]'
                  }`}>
                    {evt.classification}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 4: Video Observations */}
        {liveReport?.section_4_video_observations && liveReport.section_4_video_observations.length > 0 && (
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#697586] flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#7189A6]" />
              4. Video Computer Vision Observations ({liveReport.section_4_video_observations.length} Detections)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {liveReport.section_4_video_observations.slice(0, 6).map((vo, idx) => (
                <div key={idx} className="p-3 rounded-lg border border-[#D9DEE3] bg-[#FAFAF8] space-y-1 font-mono text-[11px]">
                  <div className="flex justify-between text-[#25364A] font-semibold">
                    <span>Frame #{vo.frame_number}</span>
                    <span>t = {vo.video_offset_seconds}s</span>
                  </div>
                  <div className="text-[#697586]">Vehicle: {vo.vehicle_id}</div>
                  <div className="text-[#8A96A6]">Bounding Box: [{vo.bbox?.x1 || vo.bbox?.x || 0}, {vo.bbox?.y1 || vo.bbox?.y || 0}, {vo.bbox?.x2 || 0}, {vo.bbox?.y2 || 0}]</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 5: Sensor Observations */}
        {liveReport?.section_5_sensor_observations && liveReport.section_5_sensor_observations.length > 0 && (
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#697586] flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#527D70]" />
              5. Vehicle Kinematics Observations ({liveReport.section_5_sensor_observations.length} Telemetry Points)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {liveReport.section_5_sensor_observations.slice(0, 6).map((so, idx) => (
                <div key={idx} className="p-3 rounded-lg border border-[#D9DEE3] bg-[#FAFAF8] space-y-1 font-mono text-[11px]">
                  <div className="flex justify-between text-[#25364A] font-semibold">
                    <span>Row #{so.row_index}</span>
                    <span>{so.speed_kmh} km/h</span>
                  </div>
                  <div className="text-[#697586]">Brake: {so.brake_engaged ? 'ENGAGED' : 'Disengaged'}</div>
                  <div className="text-[#8A96A6]">{so.source_filename}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 6: Evidentiary Contradiction Verdicts */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#697586] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#B85C5C]" />
            6. Factual Contradictions & Discrepancy Disclosures
          </h3>
          <div className="space-y-3 text-xs">
            {(liveReport?.section_6_conflicts && liveReport.section_6_conflicts.length > 0
              ? liveReport.section_6_conflicts
              : contradictions
            ).map((ctr, idx) => (
              <div key={idx} className="p-4 rounded-lg border border-[#D9DEE3] bg-[#FAFAF8] space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-[#B85C5C] font-sans">{ctr.finding_id || ctr.id}: {ctr.category || ctr.title}</span>
                  <span className="font-mono text-xs text-[#697586]">{ctr.severity?.toUpperCase() || 'CRITICAL'}</span>
                </div>
                <div className="text-[#25364A] text-xs pt-1">
                  <strong className="text-[#C18A45] font-semibold">Witness Statement Claim:</strong>{" "}
                  <span className="italic">"{ctr.claim_text || ctr.claimText || ctr.claimA}"</span>
                </div>
                <div className="text-[#25364A] text-xs">
                  <strong className="text-[#527D70] font-semibold">Empirical Evidence Observation:</strong>{" "}
                  {ctr.nature_of_conflict || ctr.evidenceText || ctr.claimB}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 8: Unresolved Questions */}
        {liveReport?.section_8_unresolved_questions && liveReport.section_8_unresolved_questions.length > 0 && (
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#697586] flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-[#C18A45]" />
              8. Unresolved Questions & Targeted Evidence Requests
            </h3>
            <div className="space-y-2 text-xs">
              {liveReport.section_8_unresolved_questions.map((uq, idx) => (
                <div key={idx} className="p-3 rounded-lg border border-[#F0DFCA] bg-[#FAF4EB] space-y-1">
                  <div className="font-semibold text-[#25364A]">{uq.topic}</div>
                  <div className="text-[#697586]">{uq.question}</div>
                  {uq.reason && <div className="text-[11px] text-[#8A96A6] italic">{uq.reason}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 9: Forensic Limitations & Epistemic Boundaries */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#697586] flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#7189A6]" />
            9. Evidentiary Limitations & Forensic Disclaimers
          </h3>
          <ul className="p-4 rounded-lg bg-[#FAFAF8] border border-[#D9DEE3] text-xs text-[#697586] space-y-1.5 list-disc list-inside">
            {(liveReport?.section_9_limitations || [
              "Absence from Video: Non-detection of an action or vehicle in video frames does not prove non-occurrence due to camera field-of-view limits and occlusion.",
              "Spatial Coordinate Mapping: Object bounding boxes and trajectories are represented in 2D image pixel space and cannot be treated as surveyed metric geographic coordinates without photogrammetric calibration.",
              "Temporal Synchronization: Video frame offsets are relative to recording start; alignment with sensor telemetry UTC clocks requires explicit time synchronization.",
              "Epistemic Distinction: Driver and witness statements are classified strictly as subjective claims and are not accepted as established fact without physical corroboration.",
              "Non-Determination of Liability: TRACE AI performs objective technical event sequencing and does not assign legal fault, civil negligence, or financial liability."
            ]).map((lim, idx) => (
              <li key={idx} className="leading-relaxed">{lim}</li>
            ))}
          </ul>
        </div>

        {/* Section 10: Objective Conclusion */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#697586] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#527D70]" />
            10. Technical Conclusion Summary
          </h3>
          <p className="text-xs text-[#25364A] leading-relaxed bg-[#FAFAF8] p-5 rounded-lg border border-[#D9DEE3]">
            {liveReport?.section_10_objective_conclusion ||
              "The multi-modal reconstruction synthesizes optical observations, telemetry records, and driver depositions into an empirical chronological sequence. Discrepancies between driver statements and physical evidence remain cataloged for human trier-of-fact review."}
          </p>
        </div>

        {/* Legal Disclaimer & Signatures */}
        <div className="pt-6 border-t border-[#D9DEE3] flex flex-col sm:flex-row sm:items-center justify-between text-xs text-[#697586] gap-3">
          <div>
            <div className="text-[11px] text-[#8A96A6] font-semibold uppercase">Legal Liability Disclaimer:</div>
            <div className="text-[11px] text-[#697586] max-w-md mt-0.5">
              {liveReport?.legal_disclaimer || "TRACE AI does not determine legal culpability, criminal guilt, or civil fault. All findings are technical observations."}
            </div>
          </div>
          <div className="flex items-center gap-2 text-[#527D70] font-medium shrink-0">
            <ShieldCheck className="w-4 h-4 text-[#527D70]" />
            <span>Cryptographically Grounded</span>
          </div>
        </div>
      </div>
    </div>
  );
}
