import React, { useState } from 'react';
import {
  MessageSquareQuote,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  User,
  MapPin,
  Clock,
  AlertCircle,
  Sparkles
} from 'lucide-react';

export default function WitnessStatements({ statements = [], onAddStatement, onUpdateStatement, onDeleteStatement, onNavigateTab }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

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

  // New statement form state
  const [witnessId, setWitnessId] = useState('');
  const [witnessName, setWitnessName] = useState('');
  const [recordedAt, setRecordedAt] = useState('');
  const [statementText, setStatementText] = useState('');
  const [locationDetails, setLocationDetails] = useState('');
  const [formError, setFormError] = useState(null);

  // Edit statement form state
  const [editName, setEditName] = useState('');
  const [editText, setEditText] = useState('');
  const [editLocation, setEditLocation] = useState('');

  const initAddForm = () => {
    const nextNum = statements.length + 1;
    setWitnessId(`WIT-${String(nextNum).padStart(3, '0')}`);
    setWitnessName('');
    const now = new Date();
    // format as YYYY-MM-DDTHH:MM
    const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setRecordedAt(localIso);
    setStatementText('');
    setLocationDetails('');
    setFormError(null);
    setShowAddForm(true);
  };

  const handleCreateStatement = (e) => {
    e.preventDefault();
    if (!witnessName.trim()) {
      setFormError('Please enter a witness name or anonymous identifier.');
      return;
    }
    if (!statementText.trim()) {
      setFormError('Please enter the statement text.');
      return;
    }

    const newStatement = {
      id: `EVD-${witnessId || `WIT-${Date.now().toString().slice(-4)}`}`,
      witnessId: witnessId || `WIT-${Date.now().toString().slice(-4)}`,
      title: `Statement — ${witnessName.trim()}`,
      witnessName: witnessName.trim(),
      statementText: statementText.trim(),
      locationDetails: locationDetails.trim() || 'Accident vicinity',
      recordedAt: recordedAt.replace('T', ' ') + ' UTC',
      dateAdded: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
      type: 'Witness Statement',
      format: 'Interview Record / Affidavit',
      size: `${statementText.trim().length} chars`,
      status: 'Awaiting Analysis',
      origin: 'Actual Upload',
      source: 'Witness Deposition',
      details: statementText.trim(),
    };

    if (typeof onAddStatement === 'function') {
      onAddStatement(newStatement);
    }

    setShowAddForm(false);
    setFormError(null);
  };

  const startEditing = (stmt) => {
    setEditingId(stmt.id);
    setEditName(stmt.witnessName || stmt.title || '');
    setEditText(stmt.statementText || stmt.details || '');
    setEditLocation(stmt.locationDetails || '');
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const saveEditing = (id) => {
    if (!editText.trim()) return;

    if (typeof onUpdateStatement === 'function') {
      onUpdateStatement(id, {
        witnessName: editName.trim(),
        statementText: editText.trim(),
        locationDetails: editLocation.trim(),
        details: editText.trim(),
        title: `Statement — ${editName.trim()}`,
        size: `${editText.trim().length} chars`
      });
    }

    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-lg bg-white border border-[#D9DEE3] shadow-card">
        <div>
          <h3 className="text-sm font-semibold text-[#25364A]">
            Witness Depositions & Statements ({statements.length})
          </h3>
          <p className="text-xs text-[#697586] mt-0.5">
            Original recorded testimony preserved verbatim without automated rewriting or summarization.
          </p>
        </div>

        <button
          onClick={initAddForm}
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-md bg-[#527D70] hover:bg-[#43675c] text-white text-xs font-sans font-medium transition shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Record New Statement</span>
        </button>
      </div>

      {/* Add Statement Form */}
      {showAddForm && (
        <form onSubmit={handleCreateStatement} className="rounded-lg bg-white border border-[#D9DEE3] p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#EDF0F3]">
            <h4 className="text-xs font-sans font-bold uppercase tracking-wider text-[#25364A]">
              New Witness Deposition Form
            </h4>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-[#8A96A6] hover:text-[#25364A]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {formError && (
            <div className="p-3 rounded-md bg-[#FBF2F2] border border-[#F1D7D7] text-xs text-[#B85C5C] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#697586] mb-1">
                Witness ID
              </label>
              <input
                type="text"
                value={witnessId}
                onChange={(e) => setWitnessId(e.target.value)}
                placeholder="e.g. WIT-003"
                className="w-full bg-[#FAFAF8] border border-[#D9DEE3] text-xs text-[#25364A] font-mono px-3 py-2 rounded-md focus:outline-none focus:ring-1 focus:ring-[#527D70] focus:border-[#527D70]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#697586] mb-1">
                Witness Name / Identifier *
              </label>
              <input
                type="text"
                value={witnessName}
                onChange={(e) => setWitnessName(e.target.value)}
                placeholder="e.g. Jane Doe or Bystander #03"
                required
                className="w-full bg-white border border-[#D9DEE3] text-xs text-[#25364A] px-3 py-2 rounded-md focus:outline-none focus:ring-1 focus:ring-[#527D70] focus:border-[#527D70]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#697586] mb-1">
                Recorded Date & Time
              </label>
              <input
                type="datetime-local"
                value={recordedAt}
                onChange={(e) => setRecordedAt(e.target.value)}
                className="w-full bg-white border border-[#D9DEE3] text-xs text-[#25364A] font-mono px-3 py-2 rounded-md focus:outline-none focus:ring-1 focus:ring-[#527D70] focus:border-[#527D70]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#697586] mb-1">
              Observation Vantage Point / Location Details (Optional)
            </label>
            <input
              type="text"
              value={locationDetails}
              onChange={(e) => setLocationDetails(e.target.value)}
              placeholder="e.g. Northbound sidewalk, approximately 25m from the stop line with clear sightlines"
              className="w-full bg-white border border-[#D9DEE3] text-xs text-[#25364A] px-3 py-2 rounded-md focus:outline-none focus:ring-1 focus:ring-[#527D70] focus:border-[#527D70]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-[#697586]">
                Original Statement Text (Verbatim) *
              </label>
              <span className="text-[11px] text-[#8A96A6] font-mono">
                {statementText.length} characters
              </span>
            </div>
            <textarea
              rows={4}
              value={statementText}
              onChange={(e) => setStatementText(e.target.value)}
              placeholder="Enter the verbatim witness account as spoken or sworn in deposition..."
              required
              className="w-full bg-white border border-[#D9DEE3] text-xs text-[#25364A] p-3 rounded-md focus:outline-none focus:ring-1 focus:ring-[#527D70] focus:border-[#527D70] leading-relaxed"
            />
          </div>

          <div className="flex items-center justify-end space-x-2.5 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-md bg-[#F5F4EF] hover:bg-[#EAE8E0] text-xs text-[#25364A] font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-[#527D70] hover:bg-[#43675c] text-white text-xs font-medium shadow-xs"
            >
              Save Statement to Ledger
            </button>
          </div>
        </form>
      )}

      {/* Statements Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {statements.map((stmt) => {
          const isEditing = editingId === stmt.id;

          return (
            <div
              key={stmt.id}
              className="rounded-lg bg-white border border-[#D9DEE3] p-5 shadow-card space-y-3.5 flex flex-col justify-between"
            >
              {isEditing ? (
                // Edit Mode
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#EDF0F3]">
                    <span className="font-mono text-xs font-semibold text-[#25364A]">
                      Editing {stmt.witnessId || stmt.id}
                    </span>
                    <span className="text-xs text-[#697586]">Edit Mode</span>
                  </div>

                  <div>
                    <label className="block text-[11px] text-[#8A96A6] mb-1">Witness Identifier</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full bg-[#FAFAF8] border border-[#D9DEE3] text-xs text-[#25364A] p-2 rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-[#8A96A6] mb-1">Observation Location</label>
                    <input
                      type="text"
                      value={editLocation}
                      onChange={(e) => setEditLocation(e.target.value)}
                      className="w-full bg-[#FAFAF8] border border-[#D9DEE3] text-xs text-[#25364A] p-2 rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-[#8A96A6] mb-1">Verbatim Statement Text</label>
                    <textarea
                      rows={4}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full bg-white border border-[#D9DEE3] text-xs text-[#25364A] p-2.5 rounded-md leading-relaxed"
                    />
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="px-3 py-1.5 rounded-md bg-[#F5F4EF] hover:bg-[#EAE8E0] text-xs text-[#697586]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => saveEditing(stmt.id)}
                      className="px-3 py-1.5 rounded-md bg-[#527D70] hover:bg-[#43675c] text-white text-xs font-medium flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Changes</span>
                    </button>
                  </div>
                </div>
              ) : (
                // View Mode
                <>
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-[#25364A] bg-[#F5F4EF] px-2 py-0.5 rounded border border-[#D9DEE3]">
                          {stmt.witnessId || stmt.id}
                        </span>
                        <span className={`text-[10px] font-sans px-2 py-0.5 rounded border font-medium ${getOriginBadge(stmt.origin).className}`}>
                          {getOriginBadge(stmt.origin).label}
                        </span>
                        <h4 className="text-xs font-semibold text-[#25364A]">
                          {stmt.witnessName || stmt.title}
                        </h4>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          onClick={() => startEditing(stmt)}
                          title="Edit statement"
                          className="p-1 rounded text-[#8A96A6] hover:text-[#25364A] hover:bg-[#F5F4EF] transition cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteStatement(stmt.id)}
                          title="Delete statement"
                          className="p-1 rounded text-[#8A96A6] hover:text-[#B85C5C] hover:bg-[#FBF2F2] transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {stmt.locationDetails && (
                      <div className="flex items-center gap-1.5 text-xs text-[#7189A6]">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{stmt.locationDetails}</span>
                      </div>
                    )}

                    {/* Preserved Statement Quote Box */}
                    <div className="p-3.5 rounded-md bg-[#FAF4EB] border border-[#F0DFCA] text-xs text-[#25364A] leading-relaxed italic">
                      "{stmt.statementText || stmt.details}"
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#EDF0F3] flex flex-wrap items-center justify-between text-xs text-[#8A96A6] gap-2">
                    <span className="flex items-center gap-1 text-[11px] font-mono">
                      <Clock className="w-3.5 h-3.5" />
                      Recorded: {stmt.recordedAt || stmt.dateAdded || 'On-scene interview'}
                    </span>
                    <div className="flex items-center space-x-2">
                      {typeof onNavigateTab === 'function' && (
                        <button
                          type="button"
                          onClick={() => onNavigateTab('ai-intelligence')}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-[#FAF4EB] hover:bg-[#F3E7D5] text-[11px] text-[#C18A45] font-semibold border border-[#F0DFCA] transition cursor-pointer shadow-2xs"
                        >
                          <Sparkles className="w-3 h-3 text-[#C18A45]" />
                          <span>Analyze with Featherless AI</span>
                        </button>
                      )}
                      <span className="text-[11px] font-sans px-2 py-0.5 rounded border text-[#C18A45] bg-[#FAF4EB] border-[#F0DFCA] font-medium">
                        {stmt.status || 'Awaiting Analysis'}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {statements.length === 0 && !showAddForm && (
        <div className="p-12 text-center rounded-lg bg-white border border-[#D9DEE3] text-xs text-[#8A96A6]">
          No witness statements recorded for this incident yet. Click "Record New Statement" above.
        </div>
      )}
    </div>
  );
}
