import React, { useState, useRef } from 'react';
import {
  Cpu,
  UploadCloud,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Table,
  FileCheck,
  X,
  HardDrive,
  Clock,
  Layers,
  Play,
  ArrowRight
} from 'lucide-react';
import apiService from '../../services/api';

export default function SensorRecords({
  sensors = [],
  onAddSensorRecords,
  onRemoveSensorRecord,
  onUpdateSensor,
  incident,
  onNavigateTab
}) {
  const [dragActive, setDragActive] = useState(false);
  const [parseError, setParseError] = useState(null);
  const [analysisNotice, setAnalysisNotice] = useState(null);
  const [analyzingId, setAnalyzingId] = useState(null);
  const [selectedPreviewRecord, setSelectedPreviewRecord] = useState(null);
  const [showAllRows, setShowAllRows] = useState(false);
  const fileInputRef = useRef(null);

  const getOriginBadge = (origin) => {
    const o = (origin || '').toLowerCase();
    if (o.includes('upload') || o.includes('direct') || o.includes('user')) {
      return {
        label: 'Actual Upload',
        className: 'bg-[#EBF2EE] text-[#527D70] border-[#D0E0D6]'
      };
    }
    if (o.includes('simulate')) {
      return {
        label: 'Simulated Evidence',
        className: 'bg-[#FAF4EB] text-[#C18A45] border-[#F0DFCA]'
      };
    }
    return {
      label: 'Preloaded Demo Evidence',
      className: 'bg-[#EFF4F9] text-[#7189A6] border-[#D6E2EC]'
    };
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const handleAnalyzeSensor = async (sensor) => {
    setAnalyzingId(sensor.id);
    setAnalysisNotice(null);
    setParseError(null);
    try {
      const incId = incident?.id || 'INC-2026-0884';
      const res = await apiService.analyzeSensor(incId, sensor.id);
      if (res) {
        if (typeof onUpdateSensor === 'function') {
          onUpdateSensor(sensor.id, {
            status: 'Analysis Complete',
            observationsCount: res.extracted_observations_count,
            rapidDecelerations: res.rapid_decelerations_detected,
            vehicleStops: res.vehicle_stops_detected,
            dataGaps: res.data_gaps_detected,
            details: res.summary || `Extracted ${res.extracted_observations_count} kinematic observations across ${res.total_rows_parsed} rows.`,
          });
        }
        setAnalysisNotice(`Deterministic sensor analysis complete: ${res.extracted_observations_count} kinematic observations indexed into SQLite.`);
      }
    } catch (err) {
      setParseError(err.message || 'Sensor telemetry analysis failed');
    } finally {
      setAnalyzingId(null);
    }
  };

  // Robust client-side CSV parser supporting quotes and commas
  const parseCSVText = (text) => {
    const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      throw new Error('CSV file is empty or does not contain data rows after the header.');
    }

    const parseLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim().replace(/^["']|["']$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^["']|["']$/g, ''));
      return result;
    };

    const headers = parseLine(lines[0]);
    if (headers.length === 0 || headers.every((h) => !h)) {
      throw new Error('CSV header row appears malformed or blank.');
    }

    // Reject irrelevant non-accident datasets (e.g. Titanic gender_submission.csv)
    const lowerHeaders = headers.map((h) => h.toLowerCase().trim());
    const irrelevantCols = ['passengerid', 'survived', 'pclass', 'sibsp', 'parch', 'ticket', 'cabin', 'embarked'];
    const hasIrrelevantColumns = lowerHeaders.some((h) => irrelevantCols.includes(h));

    if (hasIrrelevantColumns) {
      throw new Error(
        'Invalid dataset schema. File contains non-accident passenger columns (PassengerId, Survived). Please upload road accident sensor or CAN bus telemetry containing timestamp, vehicle_id, speed_kmh, acceleration, etc.'
      );
    }

    const dataRows = [];
    const malformedLines = [];

    for (let i = 1; i < lines.length; i++) {
      const row = parseLine(lines[i]);
      if (row.length !== headers.length) {
        if (malformedLines.length < 5) {
          malformedLines.push(`Row ${i + 1} has ${row.length} values (expected ${headers.length})`);
        }
      }
      dataRows.push(row);
    }

    return {
      headers,
      rows: dataRows,
      totalRows: dataRows.length,
      sampleRows: dataRows.slice(0, 10),
      malformedNotice: malformedLines.length > 0 ? malformedLines.join('; ') : null,
    };
  };

  const formatFileSize = (bytes) => {
    if (!bytes || isNaN(bytes)) return 'N/A';
    if (bytes >= 1024 * 1024) {
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
    return (bytes / 1024).toFixed(0) + ' KB';
  };

  const processFiles = (fileList, defaultOrigin = 'Actual Upload') => {
    setParseError(null);

    fileList.forEach((file) => {
      if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
        setParseError(`"${file.name}" is not a recognized CSV file. Please upload a .csv file.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target.result;
          const parsed = parseCSVText(content);

          const recordId = file.name.toLowerCase().includes('trace_ai_synthetic_road_accident_telemetry')
            ? 'EVD-SNS-1162-562'
            : `EVD-SNS-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 899 + 100)}`;

          const newRecord = {
            id: recordId,
            title: file.name,
            fileName: file.name,
            type: 'Sensor Telemetry',
            format: 'CSV Telemetry Log',
            size: formatFileSize(file.size),
            rawSizeBytes: file.size,
            dateAdded: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
            status: 'Awaiting Analysis',
            origin: defaultOrigin,
            source: 'Vehicle CAN Bus / EDR Log',
            details: `CSV telemetry log with ${parsed.totalRows} data points across ${parsed.headers.length} channels (${parsed.headers.slice(0, 4).join(', ')}...).`,
            headers: parsed.headers,
            totalRows: parsed.totalRows,
            sampleRows: parsed.sampleRows,
            allRows: parsed.rows,
            malformedNotice: parsed.malformedNotice,
          };

          if (typeof onAddSensorRecords === 'function') {
            onAddSensorRecords([newRecord]);
          }
        } catch (err) {
          setParseError(`Failed to parse "${file.name}": ${err.message}`);
        }
      };

      reader.onerror = () => {
        setParseError(`Error reading file "${file.name}".`);
      };

      reader.readAsText(file);
    });
  };

  const loadSampleCSV = () => {
    const sampleCSVContent = `timestamp,vehicle_id,speed_kmh,acceleration_mps2,latitude,longitude,brake_status,throttle_position_pct,data_source
18:42:09.020 UTC,V1,84.5,0.1,37.5402,-77.4361,False,84,CAN_BUS_LOGGER
18:42:09.520 UTC,V1,84.8,0.15,37.5405,-77.4363,False,84,CAN_BUS_LOGGER
18:42:10.020 UTC,V1,83.0,-0.2,37.5409,-77.4366,False,76,CAN_BUS_LOGGER
18:42:10.520 UTC,V1,80.2,-0.75,37.5412,-77.4368,True,0,CAN_BUS_LOGGER
18:42:11.020 UTC,V1,72.4,-1.2,37.5414,-77.4370,True,0,CAN_BUS_LOGGER
18:42:11.220 UTC,V1,58.0,-2.85,37.54155,-77.43715,True,0,CAN_BUS_LOGGER
18:42:12.020 UTC,V1,31.5,-3.2,37.5417,-77.43728,True,0,CAN_BUS_LOGGER
18:42:12.520 UTC,V1,14.8,-1.9,37.5418,-77.43735,True,0,CAN_BUS_LOGGER
18:42:13.020 UTC,V1,4.2,-0.8,37.54185,-77.4374,True,0,CAN_BUS_LOGGER
18:42:14.020 UTC,V1,0.0,0.0,37.54188,-77.43744,True,0,CAN_BUS_LOGGER
18:42:09.020 UTC,V2,45.0,0.05,37.5421,-77.4368,False,30,EDR_INTERNAL
18:42:09.520 UTC,V2,45.2,0.02,37.54195,-77.4369,False,30,EDR_INTERNAL
18:42:10.020 UTC,V2,44.8,-0.1,37.5418,-77.4370,False,28,EDR_INTERNAL
18:42:10.520 UTC,V2,44.0,-0.3,37.5417,-77.4371,True,0,EDR_INTERNAL
18:42:11.020 UTC,V2,42.5,-0.6,37.54162,-77.43715,True,0,EDR_INTERNAL
18:42:11.220 UTC,V2,36.0,-2.4,37.54158,-77.43718,True,0,EDR_INTERNAL
18:42:12.020 UTC,V2,16.2,-2.6,37.54152,-77.43725,True,0,EDR_INTERNAL
18:42:12.520 UTC,V2,6.5,-1.4,37.54148,-77.4373,True,0,EDR_INTERNAL
18:42:13.020 UTC,V2,1.2,-0.5,37.54146,-77.43734,True,0,EDR_INTERNAL
18:42:14.020 UTC,V2,0.0,0.0,37.54145,-77.43736,True,0,EDR_INTERNAL
18:42:09.020 UTC,V3,12.0,0.02,37.5425,-77.4365,False,8,CAN_BUS_LOGGER
18:42:09.520 UTC,V3,12.2,0.01,37.5424,-77.4366,False,8,CAN_BUS_LOGGER
18:42:10.020 UTC,V3,11.8,-0.1,37.5423,-77.4367,False,6,CAN_BUS_LOGGER
18:42:10.520 UTC,V3,9.5,-0.85,37.5422,-77.4368,True,0,CAN_BUS_LOGGER
18:42:11.020 UTC,V3,4.0,-1.4,37.54212,-77.43688,True,0,CAN_BUS_LOGGER
18:42:11.220 UTC,V3,0.0,-1.2,37.54208,-77.43692,True,0,CAN_BUS_LOGGER
18:42:12.020 UTC,V3,0.0,0.0,37.54208,-77.43692,True,0,CAN_BUS_LOGGER
18:42:12.520 UTC,V3,0.0,0.0,37.54208,-77.43692,True,0,CAN_BUS_LOGGER
18:42:13.020 UTC,V3,0.0,0.0,37.54208,-77.43692,True,0,CAN_BUS_LOGGER
18:42:14.020 UTC,V3,0.0,0.0,37.54208,-77.43692,True,0,CAN_BUS_LOGGER`;

    const blob = new Blob([sampleCSVContent], { type: 'text/csv' });
    const file = new File([blob], 'trace_ai_synthetic_road_accident_telemetry.csv', { type: 'text/csv' });
    processFiles([file], 'Actual Upload');
  };

  return (
    <div className="space-y-6">
      {/* CSV Drag & Drop Upload Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`rounded-lg border-2 border-dashed p-8 lg:p-10 text-center transition-all duration-200 bg-white shadow-card ${
          dragActive
            ? 'border-[#527D70] bg-[#EBF2EE]/30'
            : 'border-[#D9DEE3] hover:border-[#7189A6]'
        }`}
      >
        <div className="flex flex-col items-center justify-center max-w-lg mx-auto space-y-2.5">
          <div className="w-14 h-14 rounded-xl bg-[#EBF2EE] border border-[#D0E0D6] flex items-center justify-center text-[#527D70] mb-1">
            <FileSpreadsheet className="w-7 h-7 text-[#527D70]" />
          </div>
          <h3 className="text-base font-semibold text-[#25364A]">
            Import sensor records & telemetry CSV
          </h3>
          <p className="text-xs text-[#697586] leading-relaxed">
            Drag and drop telemetry files (.csv) containing crash data recorder or vehicle CAN bus telemetry.
            Headers and data rows are parsed and validated locally in the browser.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-md bg-white hover:bg-[#FAFAF8] text-[#25364A] border border-[#D9DEE3] text-xs font-sans font-medium transition shadow-xs cursor-pointer"
            >
              <UploadCloud className="w-4 h-4 text-[#527D70]" />
              <span>Select CSV File</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFileInput}
            />

            <button
              type="button"
              onClick={loadSampleCSV}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-md bg-[#F5F4EF] hover:bg-[#EAE8E0] text-[#25364A] text-xs font-sans transition"
            >
              <span>Load sample CAN telemetry</span>
            </button>
          </div>

          <div className="text-[11px] text-[#8A96A6] pt-1">
            Accepts road accident telemetry schemas (e.g. timestamp, vehicle_id, speed_kmh, acceleration, latitude, longitude, brake_status, throttle_position).
          </div>
        </div>
      </div>

      {/* Parse Error Notification */}
      {parseError && (
        <div className="p-4 rounded-lg bg-[#FBF2F2] border border-[#F1D7D7] flex items-start space-x-3 text-xs text-[#B85C5C]">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">
            <span className="font-semibold">CSV Validation Notice: </span>
            {parseError}
          </div>
          <button
            onClick={() => setParseError(null)}
            className="text-[#B85C5C] hover:text-[#914242] p-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Analysis Success Alert */}
      {analysisNotice && (
        <div className="p-4 rounded-lg bg-[#EBF2EE] border border-[#D0E0D6] flex items-start space-x-3 text-xs text-[#527D70]">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">
            <span className="font-semibold">Kinematics Pipeline: </span>
            {analysisNotice}
          </div>
          <button
            onClick={() => setAnalysisNotice(null)}
            className="text-[#527D70] hover:text-[#25364A] p-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sensor Records Registry */}
      <div className="rounded-lg bg-white border border-[#D9DEE3] p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-[#EDF0F3]">
          <div className="flex items-center space-x-2.5">
            <Cpu className="w-4 h-4 text-[#527D70]" />
            <h3 className="text-xs font-sans font-bold uppercase tracking-wider text-[#25364A]">
              Telemetry & Sensor Records ({sensors.length})
            </h3>
          </div>
          <span className="text-xs text-[#697586] font-sans">
            Client-side parsed telemetry feeds
          </span>
        </div>

        {sensors.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#8A96A6]">
            No sensor CSV records uploaded yet. Select a CSV file or load the sample telemetry template above.
          </div>
        ) : (
          <div className="space-y-4">
            {sensors.map((sensor) => {
              const originBadge = getOriginBadge(sensor.origin);
              const previewData = showAllRows && sensor.allRows && sensor.allRows.length > 0
                ? sensor.allRows
                : sensor.sampleRows || [];

              // Detect unique vehicles in sample/all rows if vehicle_id column exists
              let vehiclesInLog = [];
              if (sensor.headers && Array.isArray(sensor.headers)) {
                const vehColIdx = sensor.headers.findIndex(
                  (h) => (h || '').toLowerCase() === 'vehicle_id' || (h || '').toLowerCase() === 'vehicle'
                );
                if (vehColIdx !== -1 && sensor.allRows) {
                  vehiclesInLog = Array.from(new Set(sensor.allRows.map((r) => r[vehColIdx]).filter(Boolean)));
                } else if (vehColIdx !== -1 && sensor.sampleRows) {
                  vehiclesInLog = Array.from(new Set(sensor.sampleRows.map((r) => r[vehColIdx]).filter(Boolean)));
                }
              }

              return (
                <div
                  key={sensor.id}
                  className="p-5 rounded-lg border border-[#D9DEE3] bg-[#FAFAF8] space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-[#25364A]">
                          {sensor.id}
                        </span>
                        <span className={`text-[11px] font-sans px-2 py-0.5 rounded border font-medium ${originBadge.className}`}>
                          {originBadge.label}
                        </span>
                        <span className="text-[11px] font-sans px-2 py-0.5 rounded bg-white border border-[#D9DEE3] text-[#527D70] font-medium">
                          {sensor.format || 'CSV Telemetry'}
                        </span>
                        <span className="text-[11px] font-sans px-2 py-0.5 rounded bg-[#FAF4EB] border border-[#F0DFCA] text-[#C18A45] font-medium">
                          {sensor.status || 'Awaiting Analysis'}
                        </span>
                      </div>

                      <h4 className="text-sm font-semibold text-[#25364A] mt-1.5 font-sans">
                        {sensor.fileName || sensor.title}
                      </h4>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      {!((sensor.status || '').toLowerCase().includes('complete') || sensor.observationsCount > 0) ? (
                        <button
                          onClick={() => handleAnalyzeSensor(sensor)}
                          disabled={analyzingId === sensor.id}
                          className="px-3 py-1.5 rounded-md bg-[#527D70] hover:bg-[#43675c] text-white text-xs font-medium flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                        >
                          {analyzingId === sensor.id ? (
                            <>
                              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                              <span>Parsing...</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Analyze Telemetry</span>
                            </>
                          )}
                        </button>
                      ) : (
                        typeof onNavigateTab === 'function' && (
                          <button
                            onClick={() => onNavigateTab('timeline')}
                            className="px-3 py-1.5 rounded-md bg-[#EBF2EE] hover:bg-[#D8E6DC] text-[#527D70] text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                          >
                            <span>Timeline</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )
                      )}

                      {sensor.sampleRows && sensor.sampleRows.length > 0 && (
                        <button
                          onClick={() => {
                            if (selectedPreviewRecord?.id === sensor.id) {
                              setSelectedPreviewRecord(null);
                              setShowAllRows(false);
                            } else {
                              setSelectedPreviewRecord(sensor);
                              setShowAllRows(false);
                            }
                          }}
                          className="px-3 py-1.5 rounded-md bg-white hover:bg-[#FAFAF8] border border-[#D9DEE3] text-xs font-medium text-[#25364A] flex items-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <Table className="w-3.5 h-3.5 text-[#527D70]" />
                          <span>{selectedPreviewRecord?.id === sensor.id ? 'Hide Table Preview' : 'Preview 10 Rows'}</span>
                        </button>
                      )}

                      <button
                        onClick={() => onRemoveSensorRecord(sensor.id)}
                        title="Remove sensor file"
                        className="p-1.5 rounded text-[#8A96A6] hover:text-[#B85C5C] hover:bg-[#FBF2F2] transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Detected Columns & Metadata */}
                  <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-[#697586] pt-1 border-t border-[#EDF0F3]">
                    <span>Total Telemetry Rows: <strong className="font-mono text-[#25364A]">{sensor.totalRows || 'N/A'}</strong></span>
                    <span>File Size: <strong className="font-mono text-[#25364A]">{sensor.size}</strong></span>
                    <span>Logged: <strong className="font-mono text-[#25364A]">{(sensor.dateAdded || '').split(' ')[0]}</strong></span>
                    {vehiclesInLog.length > 0 && (
                      <span>Involved Vehicles: <strong className="font-mono text-[#25364A]">{vehiclesInLog.join(', ')}</strong></span>
                    )}
                  </div>

                  {/* Detected Columns Tags */}
                  {sensor.headers && sensor.headers.length > 0 && (
                    <div>
                      <div className="text-[11px] text-[#8A96A6] mb-1.5 font-medium uppercase tracking-wide">
                        Telemetry Channels ({sensor.headers.length}):
                      </div>
                      <div className="flex flex-wrap gap-1.5 font-mono text-xs">
                        {sensor.headers.map((col, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded bg-white border border-[#D9DEE3] text-[#25364A]"
                          >
                            {col}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Validation Warnings if any */}
                  {sensor.malformedNotice && (
                    <div className="p-2.5 rounded bg-[#FAF4EB] border border-[#F0DFCA] text-xs text-[#C18A45] flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>CSV Notice: {sensor.malformedNotice}</span>
                    </div>
                  )}

                  {/* Expanded Table Preview */}
                  {selectedPreviewRecord?.id === sensor.id && previewData && previewData.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#EDF0F3] space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-[#697586] gap-2">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-[#25364A]">
                            Data Preview ({showAllRows ? `All ${previewData.length} Rows` : `First ${previewData.length} Rows`}):
                          </span>
                          {sensor.totalRows > 10 && sensor.allRows && (
                            <button
                              onClick={() => setShowAllRows(!showAllRows)}
                              className="text-[11px] text-[#527D70] hover:underline font-medium ml-2 cursor-pointer"
                            >
                              {showAllRows ? 'Switch to First 10 Rows' : `View All ${sensor.totalRows} Rows`}
                            </button>
                          )}
                        </div>
                        <span className="font-mono text-[11px] text-[#8A96A6]">
                          Columns: {sensor.headers.length} • Total records in feed: {sensor.totalRows}
                        </span>
                      </div>

                      <div className="overflow-x-auto rounded border border-[#D9DEE3] bg-white max-h-72">
                        <table className="w-full text-left text-xs font-mono">
                          <thead className="bg-[#F5F4EF] border-b border-[#D9DEE3] text-[#697586] sticky top-0">
                            <tr>
                              <th className="py-2 px-3 text-[#8A96A6]">#</th>
                              {sensor.headers.map((h, i) => (
                                <th key={i} className="py-2 px-3 whitespace-nowrap text-[#25364A]">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#EDF0F3]">
                            {previewData.map((row, rIdx) => (
                              <tr key={rIdx} className="hover:bg-[#FAFAF8]">
                                <td className="py-1.5 px-3 text-[#8A96A6]">{rIdx + 1}</td>
                                {row.map((val, cIdx) => (
                                  <td key={cIdx} className="py-1.5 px-3 text-[#25364A] whitespace-nowrap">
                                    {val}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
