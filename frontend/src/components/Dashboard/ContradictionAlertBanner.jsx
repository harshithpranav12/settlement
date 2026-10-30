import React from 'react';
import { AlertCircle, ArrowRight } from 'lucide-react';

export default function ContradictionAlertBanner({ contradiction, onReviewClick }) {
  if (!contradiction) return null;

  return (
    <div className="rounded-lg border border-[#F1D7D7] bg-[#FBF2F2] p-5 lg:p-6 mb-6 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex items-start space-x-4">
          <div className="p-2.5 rounded-lg bg-white border border-[#F1D7D7] text-[#B85C5C] shrink-0 mt-0.5 shadow-xs">
            <AlertCircle className="w-5 h-5 text-[#B85C5C]" />
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-xs font-sans font-medium px-2.5 py-0.5 rounded bg-white text-[#B85C5C] border border-[#F1D7D7]">
                Evidentiary inconsistency flagged
              </span>
              <span className="font-mono text-xs text-[#B85C5C] font-semibold">
                {contradiction.id}
              </span>
              <span className="text-[#D9DEE3]">•</span>
              <span className="font-mono text-xs text-[#697586]">
                Variance: {contradiction.confidenceDelta}
              </span>
            </div>

            <h4 className="text-base font-semibold text-[#25364A] font-sans">
              {contradiction.title}
            </h4>

            <div className="text-xs text-[#697586] leading-relaxed max-w-4xl space-y-2 pt-1">
              <div className="bg-white/80 p-3 rounded border border-[#F1D7D7]/60">
                <span className="text-[#C18A45] font-semibold">Witness statement (Claim — {contradiction.claimParty}):</span>{" "}
                <span className="italic text-[#25364A]">"{contradiction.claimText}"</span>
              </div>
              <div className="bg-white/80 p-3 rounded border border-[#D0E0D6]">
                <span className="text-[#527D70] font-semibold">Sensor observation (Telemetry — Observed):</span>{" "}
                <span className="text-[#25364A]">{contradiction.evidenceText}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 flex items-center lg:self-center">
          <button
            onClick={onReviewClick}
            className="w-full lg:w-auto px-4 py-2.5 rounded-md bg-white hover:bg-[#FAFAF8] border border-[#D9DEE3] hover:border-[#B85C5C] text-[#25364A] hover:text-[#B85C5C] text-xs font-sans font-medium flex items-center justify-center space-x-2 transition-colors shadow-sm whitespace-nowrap"
          >
            <span>Review inconsistency dossier</span>
            <ArrowRight className="w-4 h-4 text-[#B85C5C]" />
          </button>
        </div>
      </div>
    </div>
  );
}
