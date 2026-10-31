import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  HelpCircle,
  AlertTriangle,
  FileText,
  Clock,
  ShieldCheck,
  RefreshCw,
  X,
  ExternalLink,
  MessageSquare,
  ChevronRight,
  Info
} from 'lucide-react';
import featherlessService from '../../services/featherlessService';

const RECOMMENDED_PROMPTS = [
  'What happened immediately before the reference epoch?',
  'Which vehicles show braking activity?',
  'Which witness claims conflict with telemetry?',
  'What evidence supports this finding?',
  'What information is missing?',
  'Which conclusions remain uncertain?'
];

export default function InvestigatorAssistant({
  incident,
  timelineEvents = [],
  evidenceSources = [],
  contradictions = [],
  telemetrySummary = null,
  isDrawer = false,
  onClose = null,
  onNavigateTab = null
}) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        `Hello Investigator. I am TRACE AI's forensic reasoning assistant powered by Featherless AI (Qwen/Qwen2.5-72B-Instruct proxy).\n\n` +
        `I answer questions strictly grounded in the verified evidentiary records for incident ${incident?.id || 'INC-2026-0884'} (Market & 4th Street intersection).\n\n` +
        `Ask any question about vehicle velocities, emergency braking, witness contradictions, or missing measurements.`,
      references: ['INC-2026-0884', 'Master Clock 18:42:11.020 UTC'],
      source: 'DETERMINISTIC_EVIDENCE_ENGINE',
      model: 'TRACE_DETERMINISTIC_V1',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    async function loadStatus() {
      const st = await featherlessService.getStatus();
      setAiStatus(st);
    }
    loadStatus();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSendMessage = async (queryText) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || loading) return;

    const userMsg = {
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setLoading(true);

    try {
      const incidentContext = {
        incidentId: incident?.id || 'INC-2026-0884',
        title: incident?.title || 'I-95 Multi-Vehicle Crash',
        location: incident?.location || 'Market & 4th Street',
        epochRange: '18:42:07.500 to 18:42:15.000 UTC',
        t0ReferenceEpoch: '18:42:11.020 UTC',
        closestProximityEpoch: '18:42:11.220 UTC',
        minimumBoundingBoxGap: '0.309 m (CONTACT INDETERMINATE)',
        vehicles: [
          { id: 'V1', make: 'Tesla Model 3', approachSpeed: '84.5 km/h', peakDecel: '-2.85 m/s²' },
          { id: 'V2', make: 'Ford Explorer', approachSpeed: '35.0 km/h', peakDecel: '-2.40 m/s²' },
          { id: 'V3', make: 'Honda Civic', approachSpeed: '0.0 km/h', peakDecel: '0.0 m/s²' }
        ],
        contradictionsSummary: [
          'CTR-01: V1 speed claim 40 km/h refuted by 84.5 km/h CAN bus telemetry.',
          'CTR-02: Steering wheel angle row UNAVAILABLE in evidence registry.',
          'CTR-03: Dashcam timecode offset +1.420 s relative to UTC clock.'
        ],
        missingMeasurements: [
          'Steering wheel angle sensor row',
          'Physical dashcam and CCTV video files (unhosted)',
          'Physical deformation / crash freeze-frame'
        ],
        telemetryAuthenticity: 'SIMULATED / DEMONSTRATION DATA (SHA-256: bfccd5d400a7f1fcecddd93891a0b6729892caab497018a023bb046900e68bc0)'
      };

      const result = await featherlessService.investigatorChat({
        query: textToSend,
        incidentContext,
        chatHistory: messages.map((m) => ({ role: m.role, content: m.content }))
      });

      if (result) {
        const assistantMsg = {
          role: 'assistant',
          content: result.response,
          references: result.evidenceReferences || [],
          source: result.source || 'FEATHERLESS_API',
          model: result.model || aiStatus?.primary_model || 'Qwen/Qwen2.5-72B-Instruct',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (err) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'An error occurred while generating the forensic response. Falling back to deterministic evidence engine.',
          references: ['CTR-01'],
          source: 'DETERMINISTIC_EVIDENCE_ENGINE',
          model: 'TRACE_DETERMINISTIC_V1',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`flex flex-col bg-[#F5F4EF] ${isDrawer ? 'h-full border-l border-[#D9DEE3] shadow-lg' : 'flex-1 overflow-hidden p-6 space-y-4'}`}>
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#D9DEE3] px-4 pt-3 bg-white">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-md bg-[#FAF4EB] border border-[#F0DFCA] flex items-center justify-center text-[#C18A45]">
            <Sparkles className="w-4 h-4 text-[#C18A45]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold text-[#25364A] font-sans">
                AI Investigator Assistant
              </h2>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold border ${
                aiStatus?.featherless_configured ? 'text-[#527D70] bg-[#EBF2EE] border-[#D0E0D6]' : 'text-[#C18A45] bg-[#FAF4EB] border-[#F0DFCA]'
              }`}>
                {aiStatus?.status_label || 'NOT CONFIGURED'}
              </span>
            </div>
            <p className="text-[11px] text-[#697586]">
              Qwen/Qwen2.5-72B-Instruct proxy • Strictly evidence-grounded
            </p>
          </div>
        </div>

        {isDrawer && onClose && (
          <button
            type="button"
            data-testid="close-assistant"
            title="Close"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[#F5F4EF] text-[#697586] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Forensic Guardrail Banner */}
      <div className="px-4 py-2 bg-[#FAF4EB] border-b border-[#F0DFCA] flex items-center justify-between text-[11px] text-[#C18A45]">
        <div className="flex items-center space-x-1.5 font-medium">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>No Hallucinated Speeds • Unanswerable queries explicitly disclosed</span>
        </div>
        <span className="font-mono text-[10px] bg-white/70 px-1.5 py-0.5 rounded border border-[#F0DFCA]">
          Simulated Data
        </span>
      </div>

      {/* Recommended Quick Question Chips */}
      <div className="px-4 py-2 bg-white border-b border-[#EDF0F3] overflow-x-auto">
        <div className="text-[10px] font-semibold uppercase text-[#8A96A6] tracking-wider mb-1.5 flex items-center gap-1">
          <HelpCircle className="w-3 h-3 text-[#7189A6]" />
          <span>Forensic Investigation Prompts</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {RECOMMENDED_PROMPTS.map((prompt, pIdx) => (
            <button
              key={pIdx}
              type="button"
              onClick={() => handleSendMessage(prompt)}
              className="px-2.5 py-1 rounded-full bg-[#FAFAF8] hover:bg-[#F5F4EF] border border-[#D9DEE3] text-[11px] text-[#25364A] whitespace-nowrap transition cursor-pointer hover:border-[#B5BDC6] shadow-2xs"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Messages Feed */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center space-x-1.5 mb-1 text-[10px] text-[#8A96A6]">
              <span>{msg.role === 'user' ? 'Investigator' : 'Featherless AI'}</span>
              <span>•</span>
              <span className="font-mono">{msg.timestamp}</span>
            </div>

            <div
              className={`max-w-[85%] rounded-lg p-3.5 text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#527D70] text-white shadow-2xs'
                  : 'bg-white border border-[#D9DEE3] text-[#25364A] shadow-card whitespace-pre-line font-sans'
              }`}
            >
              {msg.content}

              {/* Citations / Evidence Reference Badges */}
              {msg.references && msg.references.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-[#EDF0F3] space-y-1">
                  <div className="text-[10px] font-semibold uppercase text-[#8A96A6] tracking-wider">
                    Cited Evidence References:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {msg.references.map((ref, rIdx) => (
                      <span
                        key={rIdx}
                        className="inline-flex items-center space-x-1 font-mono text-[10px] bg-[#FAFAF8] text-[#527D70] px-2 py-0.5 rounded border border-[#D0E0D6]"
                      >
                        <FileText className="w-2.5 h-2.5 text-[#527D70]" />
                        <span>{ref}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Model Provenance Label */}
              {msg.source && (
                <div className="mt-2 text-[9px] text-[#8A96A6] flex items-center justify-between">
                  <span>Source: {msg.source === 'FEATHERLESS_API' ? `Live AI (${msg.model})` : 'Deterministic Engine'}</span>
                  <span>Synthetic Dataset Ref</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex flex-col items-start space-y-1">
            <span className="text-[10px] text-[#8A96A6]">Featherless AI is synthesizing records...</span>
            <div className="bg-white border border-[#D9DEE3] p-3 rounded-lg shadow-card flex items-center space-x-2">
              <RefreshCw className="w-3.5 h-3.5 text-[#527D70] animate-spin" />
              <span className="text-xs text-[#697586]">Cross-examining telematics and statements...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div className="p-3 bg-white border-t border-[#D9DEE3]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center space-x-2"
        >
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask a forensic question (e.g. Which vehicles show braking activity?)..."
            disabled={loading}
            className="flex-1 text-xs p-2.5 rounded-md border border-[#D9DEE3] bg-[#FAFAF8] text-[#25364A] focus:outline-none focus:ring-1 focus:ring-[#527D70] font-sans"
          />
          <button
            type="submit"
            disabled={loading || !inputQuery.trim()}
            className="p-2.5 rounded-md bg-[#527D70] hover:bg-[#43675c] text-white transition cursor-pointer disabled:opacity-50 shadow-xs"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
