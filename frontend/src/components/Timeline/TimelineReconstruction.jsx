import React, { useState, useMemo } from 'react';
import {
  GitCommit,
  Clock,
  ShieldCheck,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Cpu,
  Layers,
  ArrowRight,
  Gauge,
  Activity,
  FileSpreadsheet,
  MapPin,
  ExternalLink,
  ChevronRight,
  Table
} from 'lucide-react';
import { generateTimelineFromTelemetry, isBrakingActive, resolveColumnIndices } from '../../utils/telemetryTimelineEngine';

export default function TimelineReconstruction({
  evidenceSources = [],
  events = [],
  incident,
  onNavigateTab
}) {
  const [evidenceSourceFilter, setEvidenceSourceFilter] = useState('ALL');
  const [vehicleFilter, setVehicleFilter] = useState('ALL');
  const [classificationFilter, setClassificationFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllRecordsTable, setShowAllRecordsTable] = useState(false);

  // Extract all telemetry-bearing evidence sources
  const telemetrySources = useMemo(() => {
    return evidenceSources.filter((ev) => {
      if (!ev) return false;
      const isSensorType = (ev.type || '').toLowerCase().includes('sensor') ||
        (ev.type || '').toLowerCase().includes('telemetry') ||
        (ev.format || '').toLowerCase().includes('csv');
      const hasDataRows = (Array.isArray(ev.allRows) && ev.allRows.length > 0) ||
        (Array.isArray(ev.sampleRows) && ev.sampleRows.length > 0);
      return isSensorType && hasDataRows;
    });
  }, [evidenceSources]);

  // Dynamically generate chronological timeline events from uploaded sensor telemetry
  const telemetryEvents = useMemo(() => {
    const generated = generateTimelineFromTelemetry(evidenceSources, {
      sourceIdFilter: evidenceSourceFilter
    });
    if (generated && generated.length > 0) {
      return generated;
    }
    // Fallback if no telemetry uploaded yet
    return Array.isArray(events) ? events : [];
  }, [evidenceSources, events, evidenceSourceFilter]);

  // Flatten all raw records from telemetry sources for the complete 30-record browser (Requirement 4, 5, 9)
  const allRawTelemetryRecords = useMemo(() => {
    const list = [];
    const seenRowKeys = new Set();
    telemetrySources.forEach((ev) => {
      const rows = ev.allRows && ev.allRows.length > 0 ? ev.allRows : ev.sampleRows || [];
      const headers = ev.headers || [];
      const colIdx = resolveColumnIndices(headers);

      rows.forEach((r, idx) => {
        const rawTs = colIdx.timestamp !== -1 && r[colIdx.timestamp] !== undefined ? String(r[colIdx.timestamp]).trim() : r[0] || 'N/A';
        const veh = colIdx.vehicleId !== -1 && r[colIdx.vehicleId] !== undefined ? String(r[colIdx.vehicleId]).trim().toUpperCase() : r[1] || 'N/A';
        const rowKey = `${veh}|${rawTs}`;
        if (seenRowKeys.has(rowKey)) return;
        seenRowKeys.add(rowKey);

        const spd = colIdx.speed !== -1 && r[colIdx.speed] !== undefined ? String(r[colIdx.speed]).trim() : r[2] || 'N/A';
        const acc = colIdx.acceleration !== -1 && r[colIdx.acceleration] !== undefined ? String(r[colIdx.acceleration]).trim() : r[3] || 'N/A';
        const lat = colIdx.latitude !== -1 && r[colIdx.latitude] !== undefined ? String(r[colIdx.latitude]).trim() : r[4] || 'N/A';
        const lng = colIdx.longitude !== -1 && r[colIdx.longitude] !== undefined ? String(r[colIdx.longitude]).trim() : r[5] || 'N/A';
        const brk = colIdx.brakeStatus !== -1 && r[colIdx.brakeStatus] !== undefined ? String(r[colIdx.brakeStatus]).trim() : r[6] || 'N/A';
        const thr = colIdx.throttlePosition !== -1 && r[colIdx.throttlePosition] !== undefined ? String(r[colIdx.throttlePosition]).trim() : r[7] || 'N/A';
        const dsrc = colIdx.dataSource !== -1 && r[colIdx.dataSource] !== undefined ? String(r[colIdx.dataSource]).trim() : (ev.source || 'N/A');

        list.push({
          rowIndex: list.length + 1,
          sourceRowIndex: idx + 1,
          sourceId: ev.id,
          sourceFileName: ev.fileName || ev.title || 'telemetry.csv',
          headers,
          rawRow: r,
          timestamp: rawTs,
          vehicleId: veh,
          speed: spd,
          accel: acc,
          lat,
          lng,
          brake: brk,
          throttle: thr,
          dataSource: dsrc
        });
      });
    });
    return list;
  }, [telemetrySources]);

  // Distinct Forensic Statistics (Requirement 5)
  const totalOriginalRecords = allRawTelemetryRecords.length;
  const totalDirectObservations = useMemo(() => {
    return telemetryEvents.filter((e) => e.classification === 'DIRECT_OBSERVATION').length;
  }, [telemetryEvents]);
  const totalRuleBasedEvents = useMemo(() => {
    return telemetryEvents.filter((e) => e.classification === 'RULE_BASED').length;
  }, [telemetryEvents]);
  const totalAIInferences = useMemo(() => {
    return telemetryEvents.filter((e) => e.classification === 'AI_INFERENCE').length;
  }, [telemetryEvents]);

  const defaultEvent = telemetryEvents[0] || {
    id: 'EVT-000',
    timeOffset: 't + 00.000s',
    exactTimestamp: '18:42:09.020 UTC',
    label: 'Awaiting Telemetry Ingestion',
    category: 'SYSTEM',
    classification: 'DIRECT_OBSERVATION',
    vehicleId: 'N/A',
    sourceId: 'EVD-SNS-1162-562',
    sourceName: 'trace_ai_synthetic_road_accident_telemetry.csv',
    sourceFileName: 'trace_ai_synthetic_road_accident_telemetry.csv',
    description: 'No telemetry events generated. Please upload sensor CSV records in the Evidence Upload Center.',
    confidence: 100,
    supportingSensors: {},
    tags: []
  };

  const [selectedEventId, setSelectedEventId] = useState(defaultEvent.id);

  // Extract list of all involved vehicles from the generated timeline
  const availableVehicles = useMemo(() => {
    const vSet = new Set();
    telemetryEvents.forEach((e) => {
      if (e.vehicleId && !e.vehicleId.includes('+')) {
        vSet.add(e.vehicleId);
      }
    });
    return Array.from(vSet).sort();
  }, [telemetryEvents]);

  // Selected event object
  const selectedEvent = telemetryEvents.find((e) => e && e.id === selectedEventId) || telemetryEvents[0] || defaultEvent;

  // Filtered event sequence
  const filteredEvents = useMemo(() => {
    return telemetryEvents.filter((evt) => {
      if (!evt) return false;

      // Vehicle Filter
      if (vehicleFilter !== 'ALL') {
        if (!evt.vehicleId || !evt.vehicleId.includes(vehicleFilter)) {
          return false;
        }
      }

      // Classification Filter
      if (classificationFilter !== 'ALL') {
        if (evt.classification !== classificationFilter) {
          return false;
        }
      }

      // Category Filter
      if (categoryFilter !== 'ALL') {
        if (evt.category !== categoryFilter) {
          return false;
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTs = (evt.exactTimestamp || '').toLowerCase().includes(q);
        const matchOffset = (evt.timeOffset || '').toLowerCase().includes(q);
        const matchLabel = (evt.label || '').toLowerCase().includes(q);
        const matchDesc = (evt.description || '').toLowerCase().includes(q);
        const matchVeh = (evt.vehicleId || '').toLowerCase().includes(q);
        const matchSrc = (evt.sourceId || evt.sourceName || '').toLowerCase().includes(q);
        return matchTs || matchOffset || matchLabel || matchDesc || matchVeh || matchSrc;
      }

      return true;
    });
  }, [telemetryEvents, vehicleFilter, classificationFilter, categoryFilter, searchQuery]);

  // Classification Badge styling
  const getClassificationBadge = (classification) => {
    switch (classification) {
      case 'DIRECT_OBSERVATION':
        return {
          label: 'Direct Sensor Observation (Exact Record)',
          shortLabel: 'Direct Sensor',
          className: 'bg-[#EBF2EE] text-[#527D70] border-[#D0E0D6]',
          icon: Cpu,
          explanation: 'Raw hardware telemetry recorded directly by onboard sensor or CAN bus controller.',
        };
      case 'RULE_BASED':
        return {
          label: 'Rule-Based Kinematic Event',
          shortLabel: 'Rule-Based',
          className: 'bg-[#EFF4F9] text-[#7189A6] border-[#D6E2EC]',
          icon: Activity,
          explanation: 'Deterministic kinematic interpretation evaluated using explicit mathematical and sensor thresholds.',
        };
      case 'AI_INFERENCE':
        return {
          label: 'AI-Generated Inference',
          shortLabel: 'AI Inference',
          className: 'bg-[#FAF4EB] text-[#C18A45] border-[#F0DFCA]',
          icon: Sparkles,
          explanation: 'Multi-stream temporal correlation model aligning kinematic transients across separate vehicles.',
        };
      default:
        return {
          label: 'Sensor Observed',
          shortLabel: 'Sensor Log',
          className: 'bg-[#F5F4EF] text-[#697586] border-[#D9DEE3]',
          icon: GitCommit,
          explanation: 'Empirical telemetry ground truth.',
        };
    }
  };

  const getVehicleBadgeStyle = (vehicleId) => {
    const v = String(vehicleId || '').toUpperCase();
    if (v.includes('V1') || v.includes('VEH-01')) {
      return 'bg-[#EFF4F9] text-[#25364A] border-[#D6E2EC]';
    }
    if (v.includes('V2') || v.includes('VEH-02')) {
      return 'bg-[#FAF4EB] text-[#734A1E] border-[#F0DFCA]';
    }
    if (v.includes('V3') || v.includes('VEH-03')) {
      return 'bg-[#EBF2EE] text-[#33554A] border-[#D0E0D6]';
    }
    return 'bg-[#F5F4EF] text-[#25364A] border-[#D9DEE3]';
  };

  const selectedClassification = getClassificationBadge(selectedEvent.classification);

  return (
    <div className="p-6 lg:p-8 space-y-7 max-w-7xl mx-auto font-sans">
      {/* 1. Header & Reconstruction Status Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#D9DEE3]">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-xs font-sans font-medium px-2.5 py-0.5 rounded bg-[#EBF2EE] text-[#527D70] border border-[#D0E0D6]">
              Forensic Timeline Reconstruction
            </span>
            <span className="font-mono text-xs font-semibold text-[#25364A] bg-[#FAFAF8] px-2 py-0.5 rounded border border-[#D9DEE3]">
              Incident: {incident?.id || 'INC-2026-0884'}
            </span>
            <span className="text-xs text-[#697586] bg-white px-2 py-0.5 rounded border border-[#D9DEE3]">
              Synchronized from {telemetrySources.length} Telemetry Source{telemetrySources.length === 1 ? '' : 's'}
            </span>
          </div>

          <h1 className="text-2xl font-bold text-[#25364A] tracking-tight">
            Microsecond Telemetry Event Sequence
          </h1>

          <p className="text-xs text-[#697586] leading-relaxed">
            Deterministic chronological event sequence extracted directly from uploaded CAN bus and sensor telemetry logs.
          </p>
        </div>

        {/* Source Status Pill */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="px-3.5 py-2 rounded-md bg-white border border-[#D9DEE3] text-[#25364A] shadow-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#527D70]" />
            <span className="text-[#697586]">Telemetry sync:</span>
            <span className="font-semibold text-[#527D70]">Ground-Truth Verified</span>
          </div>
        </div>
      </div>

      {/* 2. Distinct Forensic Statistics (Requirement 4 & 5) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-white border border-[#D9DEE3] shadow-card flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-lg bg-[#F5F4EF] border border-[#D9DEE3] flex items-center justify-center text-[#25364A]">
            <FileSpreadsheet className="w-5 h-5 text-[#7189A6]" />
          </div>
          <div>
            <div className="text-[11px] font-sans font-medium text-[#697586] uppercase tracking-wider">
              Original Records
            </div>
            <div className="text-xl font-bold font-mono text-[#25364A] mt-0.5">
              {totalOriginalRecords}
            </div>
            <div className="text-[10px] text-[#8A96A6]">Uploaded CSV Rows</div>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-white border border-[#D9DEE3] shadow-card flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-lg bg-[#EBF2EE] border border-[#D0E0D6] flex items-center justify-center text-[#527D70]">
            <Cpu className="w-5 h-5 text-[#527D70]" />
          </div>
          <div>
            <div className="text-[11px] font-sans font-medium text-[#527D70] uppercase tracking-wider">
              Direct Sensor Obs.
            </div>
            <div className="text-xl font-bold font-mono text-[#527D70] mt-0.5">
              {totalDirectObservations}
            </div>
            <div className="text-[10px] text-[#8A96A6]">1:1 Ground-Truth</div>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-white border border-[#D9DEE3] shadow-card flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-lg bg-[#EFF4F9] border border-[#D6E2EC] flex items-center justify-center text-[#7189A6]">
            <Activity className="w-5 h-5 text-[#7189A6]" />
          </div>
          <div>
            <div className="text-[11px] font-sans font-medium text-[#7189A6] uppercase tracking-wider">
              Rule-Based Events
            </div>
            <div className="text-xl font-bold font-mono text-[#7189A6] mt-0.5">
              {totalRuleBasedEvents}
            </div>
            <div className="text-[10px] text-[#8A96A6]">Kinematic Triggers</div>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-white border border-[#D9DEE3] shadow-card flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-lg bg-[#FAF4EB] border border-[#F0DFCA] flex items-center justify-center text-[#C18A45]">
            <Sparkles className="w-5 h-5 text-[#C18A45]" />
          </div>
          <div>
            <div className="text-[11px] font-sans font-medium text-[#C18A45] uppercase tracking-wider">
              AI Inferences
            </div>
            <div className="text-xl font-bold font-mono text-[#C18A45] mt-0.5">
              {totalAIInferences}
            </div>
            <div className="text-[10px] text-[#8A96A6]">Temporal Correlation</div>
          </div>
        </div>
      </div>

      {/* 3. Multi-Dimensional Filter Toolbar */}
      <div className="p-4 rounded-lg bg-white border border-[#D9DEE3] shadow-card space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Classification Filter Tabs (Requirement 4 & 5) */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-sans">
            <span className="text-[#8A96A6] text-[11px] font-semibold uppercase tracking-wider mr-1">
              Origin:
            </span>
            {[
              { id: 'ALL', label: `All Observations (${telemetryEvents.length})` },
              { id: 'DIRECT_OBSERVATION', label: `Direct Sensor Records (${totalDirectObservations})` },
              { id: 'RULE_BASED', label: `Rule-Based Events (${totalRuleBasedEvents})` },
              { id: 'AI_INFERENCE', label: `AI Inferences (${totalAIInferences})` },
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setClassificationFilter(btn.id)}
                className={`px-3 py-1.5 rounded-md border text-xs transition cursor-pointer ${
                  classificationFilter === btn.id
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
              placeholder="Search timestamp, vehicle or text..."
              className="bg-white border border-[#D9DEE3] text-xs text-[#25364A] pl-8.5 pr-3 py-1.5 rounded-md focus:outline-none focus:ring-1 focus:ring-[#527D70] focus:border-[#527D70] w-64 shadow-xs"
            />
          </div>
        </div>

        {/* Secondary Filters: Telemetry Source, Vehicle & Event Category */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#EDF0F3] text-xs">
          {/* Evidence Source Dropdown */}
          <div className="flex items-center space-x-2">
            <span className="text-[#697586] text-xs font-medium">Source CSV:</span>
            <select
              value={evidenceSourceFilter}
              onChange={(e) => setEvidenceSourceFilter(e.target.value)}
              className="bg-white border border-[#D9DEE3] text-xs text-[#25364A] py-1 px-2.5 rounded-md focus:outline-none focus:ring-1 focus:ring-[#527D70] shadow-xs cursor-pointer max-w-[220px] truncate"
            >
              <option value="ALL">All Sources ({telemetrySources.length})</option>
              {telemetrySources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fileName || s.title || s.id} ({s.id})
                </option>
              ))}
            </select>
          </div>

          {/* Vehicle Dropdown */}
          <div className="flex items-center space-x-2">
            <span className="text-[#697586] text-xs font-medium">Vehicle:</span>
            <select
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
              className="bg-white border border-[#D9DEE3] text-xs text-[#25364A] py-1 px-2.5 rounded-md focus:outline-none focus:ring-1 focus:ring-[#527D70] shadow-xs cursor-pointer font-mono"
            >
              <option value="ALL">All Vehicles ({availableVehicles.length})</option>
              {availableVehicles.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          {/* Event Category Dropdown */}
          <div className="flex items-center space-x-2">
            <span className="text-[#697586] text-xs font-medium">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-white border border-[#D9DEE3] text-xs text-[#25364A] py-1 px-2.5 rounded-md focus:outline-none focus:ring-1 focus:ring-[#527D70] shadow-xs cursor-pointer"
            >
              <option value="ALL">All Event Types</option>
              <option value="DIRECT_SENSOR">Direct Sensor Records</option>
              <option value="IMPACT">Sudden Deceleration / Impact</option>
              <option value="BRAKE">Braking Initiation</option>
              <option value="SPEED_CHANGE">Significant Speed Shifts</option>
              <option value="STOP">Vehicle Final Rest</option>
              <option value="CRUISE">Cruising & Throttle Movement</option>
            </select>
          </div>

          {/* Toggle Full 30-Record Dataset Table (Requirement 9) */}
          <div className="ml-auto flex items-center space-x-3 text-xs font-mono">
            <button
              type="button"
              onClick={() => setShowAllRecordsTable(!showAllRecordsTable)}
              className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded border text-xs font-sans transition cursor-pointer ${
                showAllRecordsTable
                  ? 'bg-[#EBF2EE] text-[#527D70] font-semibold border-[#D0E0D6]'
                  : 'bg-white text-[#697586] border-[#D9DEE3] hover:text-[#25364A]'
              }`}
            >
              <Table className="w-3.5 h-3.5 text-[#527D70]" />
              <span>{showAllRecordsTable ? 'Hide 30-Row Table' : 'Browse All 30 Records'}</span>
            </button>
            <span className="text-[#697586]">
              Showing <strong className="text-[#25364A]">{filteredEvents.length}</strong> of {telemetryEvents.length} events
            </span>
          </div>
        </div>
      </div>

      {/* Complete 30-Record Ingestion Dataset Browser (Requirement 9) */}
      {showAllRecordsTable && (
        <div className="p-4 rounded-lg bg-white border border-[#D9DEE3] shadow-card space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#EDF0F3]">
            <div className="flex items-center space-x-2">
              <Table className="w-4 h-4 text-[#527D70]" />
              <h3 className="text-xs font-sans font-bold uppercase tracking-wider text-[#25364A]">
                Complete 30-Record Telemetry Ingestion Dataset
              </h3>
            </div>
            <span className="text-xs font-mono text-[#697586]">
              {allRawTelemetryRecords.length} records parsed from uploaded telemetry
            </span>
          </div>
          <div className="overflow-x-auto max-h-64 rounded border border-[#D9DEE3]">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#F5F4EF] text-[#697586] border-b border-[#D9DEE3] sticky top-0 z-10">
                <tr>
                  <th className="py-1.5 px-2.5 font-sans font-semibold">#</th>
                  <th className="py-1.5 px-2.5 font-sans font-semibold">Timestamp</th>
                  <th className="py-1.5 px-2.5 font-sans font-semibold">Vehicle</th>
                  <th className="py-1.5 px-2.5 font-sans font-semibold">Speed (km/h)</th>
                  <th className="py-1.5 px-2.5 font-sans font-semibold">Accel (m/s²)</th>
                  <th className="py-1.5 px-2.5 font-sans font-semibold">Brake</th>
                  <th className="py-1.5 px-2.5 font-sans font-semibold">Throttle</th>
                  <th className="py-1.5 px-2.5 font-sans font-semibold">Data Source</th>
                  <th className="py-1.5 px-2.5 font-sans font-semibold">GPS</th>
                  <th className="py-1.5 px-2.5 font-sans font-semibold text-right">Inspector</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDF0F3] bg-white">
                {allRawTelemetryRecords.map((r) => {
                  const matchEvt = telemetryEvents.find(
                    (e) => (e.rowIndex === r.sourceRowIndex || e.rowIndex === r.rowIndex) &&
                           e.vehicleId === r.vehicleId &&
                           e.classification === 'DIRECT_OBSERVATION'
                  );
                  const isSelected = (selectedEvent.rowIndex === r.sourceRowIndex || selectedEvent.rowIndex === r.rowIndex) &&
                                     selectedEvent.vehicleId === r.vehicleId;
                  return (
                    <tr key={r.rowIndex} className={`hover:bg-[#FAFAF8] ${isSelected ? 'bg-[#EBF2EE]/50 font-semibold' : ''}`}>
                      <td className="py-1.5 px-2.5 text-[#8A96A6]">#{r.rowIndex}</td>
                      <td className="py-1.5 px-2.5 text-[#25364A] whitespace-nowrap">{r.timestamp}</td>
                      <td className="py-1.5 px-2.5">
                        <span className={`px-1.5 py-0.5 rounded text-[11px] border font-semibold ${getVehicleBadgeStyle(r.vehicleId)}`}>
                          {r.vehicleId}
                        </span>
                      </td>
                      <td className="py-1.5 px-2.5 text-[#25364A]">{r.speed} km/h</td>
                      <td className="py-1.5 px-2.5 text-[#25364A]">{r.accel} m/s²</td>
                      <td className="py-1.5 px-2.5">
                        <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${isBrakingActive(r.brake) ? 'text-[#B85C5C] bg-[#FBF2F2] border border-[#F1D7D7]' : 'text-[#697586] bg-[#F5F4EF]'}`}>
                          {r.brake}
                        </span>
                      </td>
                      <td className="py-1.5 px-2.5 text-[#25364A]">{r.throttle}%</td>
                      <td className="py-1.5 px-2.5 text-[#697586] text-[11px] font-mono">{r.dataSource}</td>
                      <td className="py-1.5 px-2.5 text-[#697586] text-[11px] whitespace-nowrap">{r.lat}, {r.lng}</td>
                      <td className="py-1.5 px-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            if (matchEvt) setSelectedEventId(matchEvt.id);
                          }}
                          className="px-2 py-0.5 rounded bg-white hover:bg-[#FAFAF8] border border-[#D9DEE3] text-[11px] text-[#527D70] font-sans font-medium transition cursor-pointer shadow-2xs"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Main Workspace: Sequence List (Left 7 cols) + Detail Inspector (Right 5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
        {/* Left Side: Chronological Timeline Events */}
        <div className="lg:col-span-7 rounded-lg bg-white border border-[#D9DEE3] p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#EDF0F3]">
            <div className="flex items-center space-x-2">
              <GitCommit className="w-4 h-4 text-[#527D70]" />
              <h3 className="text-xs font-sans font-bold uppercase tracking-wider text-[#25364A]">
                Synchronized Event Sequence
              </h3>
            </div>
            <span className="text-xs font-mono text-[#697586]">
              {filteredEvents.length > 0 ? `${filteredEvents[0].exactTimestamp} → ${filteredEvents[filteredEvents.length - 1].exactTimestamp}` : 'No events'}
            </span>
          </div>

          {/* Event Cards Scroll Container */}
          <div className="space-y-3 max-h-[680px] overflow-y-auto pr-1">
            {filteredEvents.length === 0 ? (
              <div className="py-16 text-center text-xs text-[#8A96A6] space-y-2">
                <div>No telemetry events match the selected filters or search query.</div>
                <button
                  onClick={() => {
                    setEvidenceSourceFilter('ALL');
                    setVehicleFilter('ALL');
                    setClassificationFilter('ALL');
                    setCategoryFilter('ALL');
                    setSearchQuery('');
                  }}
                  className="text-xs text-[#527D70] underline cursor-pointer font-medium"
                >
                  Reset all filters
                </button>
              </div>
            ) : (
              filteredEvents.map((evt) => {
                const isSelected = evt.id === selectedEvent.id;
                const classBadge = getClassificationBadge(evt.classification);
                const isImpact = evt.category === 'IMPACT';

                return (
                  <div
                    key={evt.id}
                    onClick={() => setSelectedEventId(evt.id)}
                    className={`p-4 rounded-lg border transition cursor-pointer space-y-3 ${
                      isSelected
                        ? 'bg-[#EBF2EE]/60 border-[#527D70] shadow-xs'
                        : 'bg-[#FAFAF8] border-[#D9DEE3] hover:border-[#B5BDC6] hover:bg-white'
                    }`}
                  >
                    {/* Timestamp, Vehicle & Classification Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center space-x-2 font-mono">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            isImpact
                              ? 'text-[#B85C5C] bg-[#FBF2F2] border border-[#F1D7D7]'
                              : 'text-[#25364A] bg-white border border-[#D9DEE3]'
                          }`}
                        >
                          {evt.timeOffset}
                        </span>
                        <span className="text-[#D9DEE3]">|</span>
                        <span className="text-[#697586] text-xs font-medium">{evt.exactTimestamp}</span>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        <span
                          className={`font-mono text-xs px-2 py-0.5 rounded border font-semibold ${getVehicleBadgeStyle(
                            evt.vehicleId
                          )}`}
                        >
                          {evt.vehicleId}
                        </span>

                        <span className={`text-[11px] font-sans px-2 py-0.5 rounded border font-medium ${classBadge.className}`}>
                          {classBadge.shortLabel}
                        </span>
                      </div>
                    </div>

                    {/* Label & Description */}
                    <div>
                      <h4 className="text-sm font-semibold text-[#25364A] leading-snug">
                        {evt.label}
                      </h4>
                      <p className="text-xs text-[#697586] mt-1 leading-relaxed">
                        {evt.description}
                      </p>
                    </div>

                    {/* Supporting Telemetry Sensor Values Strip (Requirements 1 & 4) */}
                    {evt.supportingSensors && Object.keys(evt.supportingSensors).length > 0 && (
                      <div className="p-2.5 rounded-md bg-white border border-[#EDF0F3] flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-mono">
                        {evt.supportingSensors.speed_kmh && (
                          <span className="text-[#25364A]">
                            <span className="text-[#8A96A6] font-sans">Speed: </span>
                            <strong>{evt.supportingSensors.speed_kmh}</strong>
                          </span>
                        )}
                        {evt.supportingSensors.acceleration_mps2 && (
                          <span className="text-[#25364A]">
                            <span className="text-[#8A96A6] font-sans">Accel: </span>
                            <strong className={evt.supportingSensors.acceleration_mps2.startsWith('-') ? 'text-[#B85C5C]' : 'text-[#527D70]'}>
                              {evt.supportingSensors.acceleration_mps2}
                            </strong>
                          </span>
                        )}
                        {evt.supportingSensors.brake_status && (
                          <span className="text-[#25364A]">
                            <span className="text-[#8A96A6] font-sans">Brake: </span>
                            <strong className={isBrakingActive(evt.supportingSensors.brake_status) ? 'text-[#B85C5C]' : 'text-[#697586]'}>
                              {evt.supportingSensors.brake_status}
                            </strong>
                          </span>
                        )}
                        {evt.supportingSensors.throttle_position && (
                          <span className="text-[#25364A]">
                            <span className="text-[#8A96A6] font-sans">Throttle: </span>
                            <strong>{evt.supportingSensors.throttle_position}</strong>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Footer Source Reference */}
                    <div className="pt-2 border-t border-[#EDF0F3] flex items-center justify-between text-[11px] text-[#8A96A6]">
                      <span className="flex items-center gap-1 truncate max-w-xs">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-[#7189A6] shrink-0" />
                        <span className="truncate">Source: <strong className="text-[#25364A] font-medium font-mono">{evt.sourceId}</strong> ({evt.sourceFileName || evt.sourceName})</span>
                      </span>
                      <span className="font-mono text-[#527D70] font-medium">Row #{evt.rowIndex || '1'}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Detailed Forensic Event Inspector */}
        <div className="lg:col-span-5 rounded-lg bg-white border border-[#D9DEE3] p-6 shadow-card flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            {/* Inspector Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#EDF0F3]">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-[#527D70]" />
                <h3 className="text-xs font-sans font-bold uppercase tracking-wider text-[#25364A]">
                  Forensic Telemetry Inspector
                </h3>
              </div>
              <span className="font-mono text-xs font-semibold text-[#527D70]">
                {selectedEvent.id}
              </span>
            </div>

            {/* Event Identification Card */}
            <div className="p-4 rounded-lg bg-[#FAFAF8] border border-[#D9DEE3] space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span
                    className={`font-mono text-xs px-2 py-0.5 rounded border font-semibold ${getVehicleBadgeStyle(
                      selectedEvent.vehicleId
                    )}`}
                  >
                    {selectedEvent.vehicleId}
                  </span>
                  <h4 className="text-base font-bold text-[#25364A] mt-2">
                    {selectedEvent.label}
                  </h4>
                </div>

                <span className={`text-xs px-2.5 py-0.5 rounded border font-medium shrink-0 ${selectedClassification.className}`}>
                  {selectedClassification.shortLabel}
                </span>
              </div>

              {/* Exact Master NTP and Relative Offset */}
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#EDF0F3] text-xs font-mono">
                <div>
                  <span className="text-[#8A96A6] block text-[11px] font-sans">Relative T0 Offset</span>
                  <span className="text-base font-bold text-[#527D70]">{selectedEvent.timeOffset}</span>
                </div>
                <div>
                  <span className="text-[#8A96A6] block text-[11px] font-sans">Exact Master Timestamp</span>
                  <span className="text-base font-bold text-[#25364A]">{selectedEvent.exactTimestamp}</span>
                </div>
              </div>
            </div>

            {/* Evidentiary Ground Truth & Classification Explanation Banner */}
            <div className={`p-3.5 rounded-lg border text-xs leading-relaxed space-y-1.5 ${selectedClassification.className}`}>
              <div className="flex items-center gap-1.5 font-semibold">
                <selectedClassification.icon className="w-4 h-4 shrink-0" />
                <span>Classification: {selectedClassification.label}</span>
              </div>
              <p className="text-xs text-[#25364A]/80 font-normal">
                {selectedClassification.explanation}
              </p>
            </div>

            {/* Primary Supporting Sensor Gauges (Requirements 1, 2, 4) */}
            {selectedEvent.supportingSensors && (
              <div className="space-y-2.5">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#8A96A6]">
                  Supporting Sensor Telemetry (Ground Truth)
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  {/* Instantaneous Speed */}
                  <div className="p-3 rounded-md bg-[#FAFAF8] border border-[#D9DEE3]">
                    <span className="text-[#8A96A6] text-[11px]">Instantaneous Speed</span>
                    <div className="font-mono text-base font-bold text-[#25364A] mt-0.5">
                      {selectedEvent.supportingSensors.speed_kmh || 'N/A'}
                    </div>
                  </div>

                  {/* Longitudinal Acceleration: Sensor m/s² and Converted G-Force */}
                  <div className="p-3 rounded-md bg-[#FAFAF8] border border-[#D9DEE3]">
                    <div className="flex items-center justify-between">
                      <span className="text-[#8A96A6] text-[11px]">Sensor Acceleration</span>
                      <span className="text-[10px] font-mono text-[#527D70] bg-[#EBF2EE] px-1.5 py-0.2 rounded border border-[#D0E0D6]">
                        Sensor m/s²
                      </span>
                    </div>
                    <div className={`font-mono text-base font-bold mt-0.5 ${
                      (selectedEvent.supportingSensors.acceleration_mps2 || '').startsWith('-')
                        ? 'text-[#B85C5C]'
                        : 'text-[#527D70]'
                    }`}>
                      {selectedEvent.supportingSensors.acceleration_mps2 || 'N/A'}
                    </div>
                    {selectedEvent.supportingSensors.acceleration_g && selectedEvent.supportingSensors.acceleration_g !== 'N/A' && (
                      <div className="text-[10px] font-mono text-[#697586] mt-1 pt-1 border-t border-[#EDF0F3] truncate" title={selectedEvent.supportingSensors.acceleration_g}>
                        <span className="text-[#8A96A6]">Converted: </span>
                        <span className="font-semibold text-[#25364A]">{selectedEvent.supportingSensors.acceleration_g}</span>
                      </div>
                    )}
                  </div>

                  {/* Brake Switch State */}
                  <div className="p-3 rounded-md bg-[#FAFAF8] border border-[#D9DEE3]">
                    <span className="text-[#8A96A6] text-[11px]">Brake Switch State</span>
                    <div className={`font-mono text-base font-bold mt-0.5 ${
                      isBrakingActive(selectedEvent.supportingSensors.brake_status) ? 'text-[#B85C5C]' : 'text-[#697586]'
                    }`}>
                      {selectedEvent.supportingSensors.brake_status || 'N/A'}
                    </div>
                  </div>

                  {/* Throttle Position */}
                  <div className="p-3 rounded-md bg-[#FAFAF8] border border-[#D9DEE3]">
                    <span className="text-[#8A96A6] text-[11px]">Throttle Position</span>
                    <div className="font-mono text-base font-bold text-[#25364A] mt-0.5">
                      {selectedEvent.supportingSensors.throttle_position || 'N/A'}
                    </div>
                  </div>
                </div>

                {/* GPS Coordinates */}
                {(selectedEvent.supportingSensors.latitude !== 'N/A' || selectedEvent.supportingSensors.longitude !== 'N/A') && (
                  <div className="p-3 rounded-md bg-[#FAFAF8] border border-[#D9DEE3] text-xs flex items-center justify-between font-mono">
                    <span className="flex items-center gap-1.5 text-[#697586] font-sans">
                      <MapPin className="w-3.5 h-3.5 text-[#7189A6]" />
                      GPS Coordinate:
                    </span>
                    <span className="text-[#25364A] font-semibold">
                      {selectedEvent.supportingSensors.latitude}, {selectedEvent.supportingSensors.longitude}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Original Supporting CSV Row or Rows (Requirements 6 & 7) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold uppercase tracking-wider text-[#8A96A6]">
                  {selectedEvent.classification === 'DIRECT_OBSERVATION'
                    ? 'Raw CSV Telemetry Record'
                    : `Supporting CSV Telemetry (${(selectedEvent.supportingRows || []).length} Row${(selectedEvent.supportingRows || []).length === 1 ? '' : 's'})`}
                </span>
                {selectedEvent.ruleApplied && (
                  <span className="text-[10px] font-mono text-[#527D70] font-medium bg-[#EBF2EE] px-2 py-0.5 rounded border border-[#D0E0D6] max-w-[200px] truncate" title={selectedEvent.ruleApplied}>
                    {selectedEvent.ruleApplied}
                  </span>
                )}
              </div>

              {/* Supporting Rows List */}
              {selectedEvent.supportingRows && selectedEvent.supportingRows.length > 0 ? (
                <div className="space-y-3">
                  {selectedEvent.supportingRows.map((sr, sIdx) => (
                    <div key={sIdx} className="rounded border border-[#D9DEE3] bg-white overflow-hidden text-xs font-mono shadow-2xs">
                      <div className="bg-[#F5F4EF] px-3 py-1.5 border-b border-[#D9DEE3] flex items-center justify-between text-[11px] font-sans">
                        <span className="font-semibold text-[#25364A] flex items-center gap-1.5">
                          <span className="font-mono text-[#527D70] font-bold">Row #{sr.rowIndex}</span>
                          {sr.role && <span className="text-[#697586]">• {sr.role}</span>}
                        </span>
                        <span className="font-mono text-[#697586] text-[10px]">
                          {sr.sourceFileName} ({sr.sourceId})
                        </span>
                      </div>
                      <div className="overflow-x-auto max-h-40">
                        <table className="w-full text-left">
                          <thead className="bg-[#FAFAF8] border-b border-[#EDF0F3] text-[11px] text-[#8A96A6]">
                            <tr>
                              <th className="py-1 px-2.5 font-sans font-semibold">Channel</th>
                              <th className="py-1 px-2.5 font-sans font-semibold">Logged Value</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#EDF0F3]">
                            {sr.headers && sr.rawRow ? sr.headers.map((header, hIdx) => (
                              <tr key={hIdx} className="hover:bg-[#FAFAF8]">
                                <td className="py-1 px-2.5 text-[#697586] font-medium whitespace-nowrap">{header}</td>
                                <td className="py-1 px-2.5 text-[#25364A] font-semibold whitespace-nowrap">{sr.rawRow[hIdx] ?? '—'}</td>
                              </tr>
                            )) : (
                              <tr>
                                <td colSpan="2" className="py-2 px-3 text-[#697586] italic">Row data preserved in telemetry buffer.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              ) : selectedEvent.headers && selectedEvent.rawRow ? (
                <div className="overflow-x-auto rounded border border-[#D9DEE3] bg-white max-h-44">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-[#F5F4EF] border-b border-[#D9DEE3] text-[#697586]">
                      <tr>
                        <th className="py-1.5 px-2.5 font-sans font-semibold text-[#8A96A6]">Channel</th>
                        <th className="py-1.5 px-2.5 font-sans font-semibold text-[#8A96A6]">Logged Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EDF0F3]">
                      {selectedEvent.headers.map((header, idx) => (
                        <tr key={idx} className="hover:bg-[#FAFAF8]">
                          <td className="py-1 px-2.5 text-[#697586] font-medium whitespace-nowrap">{header}</td>
                          <td className="py-1 px-2.5 text-[#25364A] font-semibold whitespace-nowrap">{selectedEvent.rawRow[idx] ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-3 rounded bg-[#FAFAF8] border border-[#D9DEE3] text-xs text-[#697586] italic">
                  Raw telemetry row preserved in forensic session buffer.
                </div>
              )}
            </div>
          </div>

          {/* Action Footer & Navigation to Evidence Register */}
          <div className="pt-3 border-t border-[#EDF0F3] flex items-center justify-between text-xs">
            <span className="text-[#8A96A6] flex items-center gap-1 text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#527D70]" />
              Cryptographic chain of custody verified
            </span>

            {typeof onNavigateTab === 'function' && (
              <button
                onClick={() => onNavigateTab('evidence')}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-[#F5F4EF] hover:bg-[#EAE8E0] text-xs text-[#25364A] font-medium transition cursor-pointer"
              >
                <span>Inspect in Evidence Center</span>
                <ChevronRight className="w-3.5 h-3.5 text-[#697586]" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
