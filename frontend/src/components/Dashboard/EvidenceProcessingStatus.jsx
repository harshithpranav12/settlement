import React from 'react';
import { CheckCircle2, Cpu, RefreshCw } from 'lucide-react';

export default function EvidenceProcessingStatus({ pipeline = [] }) {
  const safePipeline = Array.isArray(pipeline) ? pipeline : [];

  return (
    <div className="rounded-lg bg-white border border-[#D9DEE3] p-6 shadow-card">
      <div className="flex items-center justify-between pb-4 border-b border-[#EDF0F3]">
        <div className="flex items-center space-x-2.5">
          <Cpu className="w-4 h-4 text-[#527D70]" />
          <h3 className="text-xs font-sans font-bold uppercase tracking-wider text-[#25364A]">
            Processing pipeline status
          </h3>
        </div>
        <div className="flex items-center space-x-2 text-xs font-sans text-[#697586]">
          <span className="flex items-center gap-1.5 font-medium text-[#527D70]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#527D70]"></span>
            3 complete
          </span>
          <span className="text-[#D9DEE3]">|</span>
          <span className="flex items-center gap-1.5 font-medium text-[#C18A45]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C18A45]"></span>
            1 in progress
          </span>
        </div>
      </div>

      <div className="mt-4 space-y-3.5">
        {safePipeline.map((stage) => {
          const isComplete = stage.status === 'COMPLETE';
          return (
            <div
              key={stage.step}
              className="p-3.5 rounded-lg border border-[#D9DEE3] bg-[#FAFAF8] hover:bg-white hover:border-[#B5BDC6] transition"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start space-x-3">
                  <div className="mt-0.5">
                    {isComplete ? (
                      <CheckCircle2 className="w-4 h-4 text-[#527D70]" />
                    ) : (
                      <RefreshCw className="w-4 h-4 text-[#C18A45] animate-spin" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-sans font-semibold text-[#25364A]">
                        {stage.step}. {stage.name}
                      </span>
                      <span
                        className={`text-xs font-sans px-2 py-0.5 rounded border font-medium ${
                          isComplete
                            ? 'text-[#527D70] bg-[#EBF2EE] border-[#D0E0D6]'
                            : 'text-[#C18A45] bg-[#FAF4EB] border-[#F0DFCA]'
                        }`}
                      >
                        {isComplete ? 'Complete' : 'Processing'}
                      </span>
                    </div>
                    <p className="text-xs text-[#697586] mt-1 leading-snug">
                      {stage.description}
                    </p>
                  </div>
                </div>

                <div className="text-right text-xs shrink-0 font-sans pl-2">
                  <div className="text-[#25364A] font-medium font-mono">{stage.itemCount}</div>
                  <div className="text-xs text-[#8A96A6] mt-0.5">{stage.latency}</div>
                </div>
              </div>

              {/* Progress Track */}
              <div className="mt-3 w-full bg-[#E8EAE6] h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isComplete ? 'bg-[#527D70]' : 'bg-[#C18A45]'
                  }`}
                  style={{ width: `${stage.progress || 0}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
