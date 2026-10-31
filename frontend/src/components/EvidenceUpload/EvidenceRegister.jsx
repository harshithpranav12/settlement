import React, { useState } from 'react';
import {
  Search,
  Filter,
  Trash2,
  Eye,
  FileVideo,
  MessageSquareQuote,
  Cpu,
  Layers,
  X,
  FileCheck,
  Clock,
  HardDrive
} from 'lucide-react';

export default function EvidenceRegister({
  evidenceItems = [],
  onRemoveItem,
  onViewDetails
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [originFilter, setOriginFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedDetailItem, setSelectedDetailItem] = useState(null);

  const safeItems = Array.isArray(evidenceItems) ? evidenceItems : [];

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

  const filteredItems = safeItems.filter((item) => {
    if (!item) return false;

    // Type filter
    if (typeFilter !== 'ALL') {
      const itemType = (item.type || '').toLowerCase();
      if (typeFilter === 'VIDEO' && !itemType.includes('video')) return false;
      if (typeFilter === 'WITNESS' && !itemType.includes('witness')) return false;
      if (typeFilter === 'SENSOR' && !itemType.includes('sensor') && !itemType.includes('telemetry') && !itemType.includes('crash')) return false;
    }

    // Origin filter
    if (originFilter !== 'ALL') {
      const itemOrigin = (item.origin || '').toLowerCase();
      if (originFilter === 'UPLOAD' && !itemOrigin.includes('upload') && !itemOrigin.includes('direct') && !itemOrigin.includes('user')) return false;
      if (originFilter === 'DEMO' && !itemOrigin.includes('preload') && !itemOrigin.includes('demo')) return false;
      if (originFilter === 'SIMULATED' && !itemOrigin.includes('simulate')) return false;
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      const itemStatus = (item.status || '').toUpperCase().replace(/\s+/g, '_');
      if (itemStatus !== statusFilter) return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = (item.id || '').toLowerCase().includes(q);
      const matchTitle = (item.title || item.fileName || item.witnessName || item.name || '').toLowerCase().includes(q);
      const matchSource = (item.source || '').toLowerCase().includes(q);
      const matchDetails = (item.details || item.statementText || '').toLowerCase().includes(q);
      const matchOrigin = (item.origin || '').toLowerCase().includes(q);
      return matchId || matchTitle || matchSource || matchDetails || matchOrigin;
    }

    return true;
  });

  const getStatusBadge = (status) => {
    const s = (status || '').toUpperCase();
    if (s.includes('AWAITING') || s.includes('PENDING') || s.includes('UNVERIFIED')) {
      return 'text-[#C18A45] bg-[#FAF4EB] border-[#F0DFCA]';
    }
    if (s.includes('PROGRESS')) {
      return 'text-[#7189A6] bg-[#EFF4F9] border-[#D6E2EC] font-medium';
    }
    if (s.includes('COMPLETE') || s.includes('VERIFIED')) {
      return 'text-[#527D70] bg-[#EBF2EE] border-[#D0E0D6]';
    }
    if (s.includes('FAILED') || s.includes('CONTRADICTED')) {
      return 'text-[#B85C5C] bg-[#FBF2F2] border-[#F1D7D7]';
    }
    return 'text-[#697586] bg-[#F5F4EF] border-[#D9DEE3]';
  };

  const getTypeIcon = (type) => {
    const t = (type || '').toLowerCase();
    if (t.includes('video')) return <FileVideo className="w-4 h-4 text-[#7189A6]" />;
    if (t.includes('witness')) return <MessageSquareQuote className="w-4 h-4 text-[#C18A45]" />;
    if (t.includes('sensor') || t.includes('telemetry')) return <Cpu className="w-4 h-4 text-[#527D70]" />;
    return <Layers className="w-4 h-4 text-[#697586]" />;
  };

  return (
    <div className="rounded-lg bg-white border border-[#D9DEE3] p-6 lg:p-7 shadow-card space-y-5">
      {/* Table Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#EDF0F3]">
        <div>
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-[#527D70]" />
            <h3 className="text-xs font-sans font-bold uppercase tracking-wider text-[#25364A]">
              Unified Evidence Register
            </h3>
          </div>
          <p className="text-xs text-[#697586] mt-0.5">
            Master repository of all physical observations, witness depositions, and telemetry logs.
          </p>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#8A96A6] absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search register..."
              className="bg-white border border-[#D9DEE3] text-xs text-[#25364A] pl-8.5 pr-3 py-1.5 rounded-md font-sans focus:outline-none focus:ring-1 focus:ring-[#527D70] focus:border-[#527D70] w-48 lg:w-56 shadow-xs"
            />
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-white border border-[#D9DEE3] text-xs text-[#25364A] py-1.5 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-[#527D70] focus:border-[#527D70] shadow-xs cursor-pointer"
          >
            <option value="ALL">All Types</option>
            <option value="VIDEO">Video Evidence</option>
            <option value="WITNESS">Witness Statements</option>
            <option value="SENSOR">Sensor Telemetry</option>
          </select>

          {/* Origin Filter */}
          <select
            value={originFilter}
            onChange={(e) => setOriginFilter(e.target.value)}
            className="bg-white border border-[#D9DEE3] text-xs text-[#25364A] py-1.5 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-[#527D70] focus:border-[#527D70] shadow-xs cursor-pointer"
          >
            <option value="ALL">All Origins</option>
            <option value="UPLOAD">Actual Upload</option>
            <option value="DEMO">Preloaded Demo</option>
            <option value="SIMULATED">Simulated Evidence</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-[#D9DEE3] text-xs text-[#25364A] py-1.5 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-[#527D70] focus:border-[#527D70] shadow-xs cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="UPLOADED">Uploaded</option>
            <option value="AWAITING_ANALYSIS">Awaiting Analysis</option>
            <option value="ANALYSIS_IN_PROGRESS">Analysis In Progress</option>
            <option value="ANALYSIS_COMPLETE">Analysis Complete</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>

      {/* Unified Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-sans">
          <thead>
            <tr className="border-b border-[#D9DEE3] text-[#697586] text-xs font-semibold">
              <th className="py-3 px-3">Evidence ID</th>
              <th className="py-3 px-3">Origin</th>
              <th className="py-3 px-3">Type</th>
              <th className="py-3 px-3">Filename / Identifier</th>
              <th className="py-3 px-3">Source Channel</th>
              <th className="py-3 px-3">Date Added</th>
              <th className="py-3 px-3">Size / Payload</th>
              <th className="py-3 px-3">Analysis Status</th>
              <th className="py-3 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EDF0F3]">
            {filteredItems.map((item) => {
              const originBadge = getOriginBadge(item.origin);
              return (
                <tr key={item.id} className="hover:bg-[#FAFAF8] transition">
                  <td className="py-3 px-3 font-mono font-semibold text-[#25364A] whitespace-nowrap">
                    {item.id}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span className={`text-[10px] font-sans px-2 py-0.5 rounded border font-medium ${originBadge.className}`}>
                      {originBadge.label}
                    </span>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <div className="flex items-center space-x-1.5">
                      {getTypeIcon(item.type)}
                      <span className="text-[#25364A]">{item.type}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 font-medium text-[#25364A] max-w-xs truncate" title={item.fileName || item.witnessName || item.title}>
                    {item.fileName || item.witnessName || item.title || item.name}
                  </td>
                  <td className="py-3 px-3 text-[#697586] whitespace-nowrap">
                    {item.source || 'Local File System'}
                  </td>
                  <td className="py-3 px-3 font-mono text-[11px] text-[#697586] whitespace-nowrap">
                    {(item.dateAdded || item.ingestTime || '').split(' ')[0]}
                  </td>
                  <td className="py-3 px-3 font-mono text-xs text-[#25364A] whitespace-nowrap">
                    {item.size || item.format || 'N/A'}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span className={`text-xs px-2.5 py-0.5 rounded border font-medium ${getStatusBadge(item.status)}`}>
                      {item.status || 'Awaiting Analysis'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end space-x-1.5">
                      <button
                        onClick={() => setSelectedDetailItem(item)}
                        title="Inspect evidence metadata"
                        className="p-1 rounded text-[#697586] hover:text-[#527D70] hover:bg-[#EBF2EE] transition cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onRemoveItem(item.id)}
                        title="Remove item"
                        className="p-1 rounded text-[#8A96A6] hover:text-[#B85C5C] hover:bg-[#FBF2F2] transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredItems.length === 0 && (
          <div className="py-10 text-center text-xs text-[#8A96A6]">
            No evidence matches the selected filter or search query.
          </div>
        )}
      </div>

      {/* Evidence Item Detail Inspection Modal */}
      {selectedDetailItem && (
        <div className="fixed inset-0 bg-[#25364A]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-[#D9DEE3] shadow-dropdown max-w-xl w-full p-6 space-y-4 font-sans">
            <div className="flex items-center justify-between pb-3 border-b border-[#EDF0F3]">
              <div>
                <span className="font-mono text-xs text-[#527D70] font-semibold">
                  {selectedDetailItem.id}
                </span>
                <h3 className="text-base font-semibold text-[#25364A] mt-0.5">
                  {selectedDetailItem.fileName || selectedDetailItem.witnessName || selectedDetailItem.title || selectedDetailItem.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDetailItem(null)}
                className="p-1 rounded hover:bg-[#F5F4EF] text-[#697586] hover:text-[#25364A]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-md bg-[#FAFAF8] border border-[#D9DEE3]">
                <div>
                  <span className="text-[#8A96A6]">Evidence Type:</span>
                  <div className="font-medium text-[#25364A] mt-0.5">{selectedDetailItem.type}</div>
                </div>
                <div>
                  <span className="text-[#8A96A6]">Evidence Origin:</span>
                  <div className="mt-0.5">
                    <span className={`px-2 py-0.5 rounded border text-[11px] font-medium ${getOriginBadge(selectedDetailItem.origin).className}`}>
                      {getOriginBadge(selectedDetailItem.origin).label}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-[#8A96A6]">Status:</span>
                  <div className="mt-0.5">
                    <span className={`px-2 py-0.5 rounded border text-xs ${getStatusBadge(selectedDetailItem.status)}`}>
                      {selectedDetailItem.status || 'Awaiting Analysis'}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-[#8A96A6]">Source Channel:</span>
                  <div className="font-medium text-[#25364A] mt-0.5">{selectedDetailItem.source || 'Local import'}</div>
                </div>
                <div className="col-span-2">
                  <span className="text-[#8A96A6]">Size / Format:</span>
                  <div className="font-mono text-[#25364A] mt-0.5">{selectedDetailItem.size || selectedDetailItem.format || 'Standard'}</div>
                </div>
              </div>

              <div>
                <span className="text-xs text-[#8A96A6] font-medium uppercase tracking-wide">
                  Description / Statement Transcript:
                </span>
                <div className="mt-1.5 p-3 rounded-md bg-[#FAFAF8] border border-[#D9DEE3] text-[#25364A] leading-relaxed max-h-48 overflow-y-auto">
                  {selectedDetailItem.details || selectedDetailItem.statementText || 'No extended textual notes provided.'}
                </div>
              </div>

              {selectedDetailItem.hashSHA256 && (
                <div className="p-3 rounded-md bg-[#FAFAF8] border border-[#D9DEE3] font-mono text-[11px] text-[#697586]">
                  <span className="text-[#8A96A6] block mb-1">Simulated Ingest Hash:</span>
                  <span className="text-[#25364A] break-all">{selectedDetailItem.hashSHA256}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-[#EDF0F3]">
              <button
                onClick={() => setSelectedDetailItem(null)}
                className="px-4 py-2 rounded-md bg-[#F5F4EF] hover:bg-[#EAE8E0] text-xs text-[#25364A] font-medium"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
