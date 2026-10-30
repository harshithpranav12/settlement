import React, { useState } from 'react';
import {
  Printer,
  ShieldCheck,
  Copy,
  Lock,
  Scale
} from 'lucide-react';

export default function InvestigationReport({
  incident,
  contradictions = [],
  vehicles = [],
  evidenceSources = []
}) {
  const [copied, setCopied] = useState(false);

  const safeContradictions = Array.isArray(contradictions) ? contradictions : [];
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
          </div>
          <h2 className="text-2xl font-bold text-[#25364A] tracking-tight">
            Forensic Technical Investigation Report
          </h2>
          <p className="text-xs text-[#697586] leading-relaxed">
            Demonstration of structured forensic report synthesis from physical telemetry and witness depositions.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2.5 text-xs font-sans">
          <button
            onClick={handleCopyHash}
            className="px-3.5 py-2 rounded-md bg-white hover:bg-[#FAFAF8] border border-[#D9DEE3] text-[#25364A] flex items-center gap-2 transition shadow-xs"
          >
            <Copy className="w-3.5 h-3.5 text-[#697586]" />
            <span>{copied ? 'Digest copied' : 'Copy test digest'}</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-md bg-[#527D70] hover:bg-[#43675c] text-white font-medium flex items-center gap-2 transition shadow-sm"
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
              <span className="text-lg font-bold text-[#25364A] tracking-tight">TRACE AI FORENSIC LABORATORY</span>
              <span className="text-xs px-2.5 py-0.5 rounded bg-[#EBF2EE] text-[#527D70] border border-[#D0E0D6] font-medium">
                Demonstration Report
              </span>
            </div>
            <div className="text-xs text-[#697586]">
              Transportation Forensics & Multi-Sensor Telemetry Simulation Division
            </div>
            <div className="text-xs text-[#8A96A6] font-mono pt-0.5">
              Case Ref: <strong className="text-[#25364A] font-semibold">{safeIncident.id}</strong> • Model Protocol: ISO/IEC 27037:2012 Reference
            </div>
          </div>

          <div className="text-right text-xs">
            <div className="text-[#697586]">Report generated</div>
            <div className="text-[#25364A] font-mono font-semibold">{new Date().toISOString().split('T')[0]}</div>
            <div className="text-xs font-sans text-[#527D70] font-medium mt-1">Status: Model Verified (Simulated)</div>
          </div>
        </div>

        {/* Incident Summary Matrix */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 rounded-lg bg-[#FAFAF8] border border-[#D9DEE3] text-xs">
          <div>
            <div className="text-xs text-[#8A96A6] uppercase tracking-wide">Incident location</div>
            <div className="text-[#25364A] font-medium mt-1">{safeIncident.location}</div>
          </div>
          <div>
            <div className="text-xs text-[#8A96A6] uppercase tracking-wide">Impact timecode (NTP)</div>
            <div className="text-[#527D70] font-mono font-bold mt-1">{safeIncident.timestamp}</div>
          </div>
          <div>
            <div className="text-xs text-[#8A96A6] uppercase tracking-wide">Model consistency</div>
            <div className="text-[#25364A] font-mono font-bold mt-1">{safeIncident.reconstructionConfidence}%</div>
          </div>
          <div>
            <div className="text-xs text-[#8A96A6] uppercase tracking-wide">Lead analyst</div>
            <div className="text-[#25364A] font-medium mt-1">{safeIncident.leadInvestigator}</div>
          </div>
        </div>

        {/* Section 1: Executive Forensic Findings */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#697586] flex items-center gap-2">
            <Scale className="w-4 h-4 text-[#527D70]" />
            1. Executive Forensic Synthesis & Findings
          </h3>
          <p className="text-xs text-[#25364A] leading-relaxed bg-[#FAFAF8] p-5 rounded-lg border border-[#D9DEE3]">
            Based upon multi-sensor optical tracking from Caltrans CCTV #402, 500Hz CAN bus crash records from Vehicle 02 (Ford Explorer) and Vehicle 01 (Tesla Model 3), and synchronized photogrammetric drone point clouds, the primary collision was caused by Vehicle 01 entering the signalized intersection 1.02 seconds after the Northbound traffic signal transitioned to solid Red.
          </p>
        </div>

        {/* Section 2: Evidentiary Contradiction Verdicts */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#697586] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#B85C5C]" />
            2. Evidentiary Inconsistency Disclosures
          </h3>
          <div className="space-y-3 text-xs">
            {safeContradictions.map((ctr) => (
              <div key={ctr.id} className="p-4 rounded-lg border border-[#D9DEE3] bg-[#FAFAF8] space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-[#B85C5C] font-sans">{ctr.id}: {ctr.title}</span>
                  <span className="font-mono text-xs text-[#697586]">{ctr.confidenceDelta}</span>
                </div>
                <div className="text-[#25364A] text-xs pt-1">
                  <strong className="text-[#C18A45] font-semibold">Witness deposition (Claim):</strong>{" "}
                  <span className="italic">"{ctr.claimText}"</span>
                </div>
                <div className="text-[#25364A] text-xs">
                  <strong className="text-[#527D70] font-semibold">Physical telemetry observation (Sensor):</strong> {ctr.evidenceText}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Telemetry Chain-of-Custody Manifest */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#697586] flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#7189A6]" />
            3. Demonstration Chain-of-Custody Manifest
          </h3>
          <div className="p-4 rounded-lg bg-[#FAFAF8] border border-[#D9DEE3] text-xs text-[#697586] font-mono space-y-2">
            <div className="flex justify-between">
              <span>REPORT_DIGEST:</span>
              <span className="text-[#527D70] font-semibold">{certifiedHash}</span>
            </div>
            <div className="flex justify-between">
              <span>TIME_SYNCHRONIZATION:</span>
              <span className="text-[#25364A]">NTP Stratum 1 Master (Simulated 0.0ms offset)</span>
            </div>
            <div className="flex justify-between">
              <span>ALGORITHMIC_VERIFICATION:</span>
              <span className="text-[#25364A]">Deterministic Multi-Agent Sensor Fusion</span>
            </div>
          </div>
        </div>

        {/* Signatures Footer */}
        <div className="pt-6 border-t border-[#D9DEE3] flex items-center justify-between text-xs text-[#697586]">
          <div>
            <div>Forensic Analyst Signature:</div>
            <div className="text-[#25364A] font-semibold mt-1">{safeIncident.leadInvestigator}</div>
          </div>
          <div className="flex items-center gap-2 text-[#527D70] font-medium">
            <ShieldCheck className="w-4 h-4 text-[#527D70]" />
            <span>Simulated report verified</span>
          </div>
        </div>
      </div>
    </div>
  );
}
