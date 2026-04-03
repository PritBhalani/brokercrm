import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useNotifications } from '../context/NotificationContext.tsx';
import { Search, Filter, Phone, Calendar, AlertTriangle, Trash2, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import api from '../services/api.ts';
import { LeadDetails } from './LeadDetails.tsx';
import { isLeadFollowUpOverdue } from '../lib/leadRules.ts';
import { formatLeadStatus } from '../lib/leadStatusDisplay.ts';

// Priority sort: Callback → Interested → New → rest
const PRIORITY_ORDER: Record<string, number> = {
  Callback: 0,
  Interested: 1,
  New: 2,
  ReadyToWorkTomorrow: 3,
  Converted: 4,
};

const sortLeads = (leads: any[]) =>
  [...leads].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.status] ?? 99;
    const pb = PRIORITY_ORDER[b.status] ?? 99;
    if (pa !== pb) return pa - pb;
    // Within same status: callbacks due soonest first
    if (a.nextFollowUpDate && b.nextFollowUpDate)
      return new Date(a.nextFollowUpDate).getTime() - new Date(b.nextFollowUpDate).getTime();
    return 0;
  });

/** Agents: overdue follow-ups first, then priority sort (matches server emphasis on due work). */
const sortLeadsAgent = (leads: any[]) => {
  const overdue = leads.filter((l) => isLeadFollowUpOverdue(l));
  const rest = leads.filter((l) => !isLeadFollowUpOverdue(l));
  return [...sortLeads(overdue), ...sortLeads(rest)];
};

const STATUS_COLORS: Record<string, string> = {
  New: 'text-blue-400',
  Interested: 'text-emerald-400',
  Callback: 'text-amber-400',
  Converted: 'text-purple-400',
  ReadyToWorkTomorrow: 'text-cyan-400',
};

export const Leads: React.FC = () => {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [bulkAgentId, setBulkAgentId] = useState('');
  const [bulkWorking, setBulkWorking] = useState(false);
  const [totalInDb, setTotalInDb] = useState<number | null>(null);

  const isAdmin = user?.role === 'admin';

  const fetchLeads = useCallback(async () => {
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      // Admin list: request enough rows to match dashboard totals (API default is 50).
      if (user?.role === 'admin') params.limit = 2000;
      const res = await api.get('/leads', { params });
      const raw = Array.isArray(res.data) ? res.data : (res.data?.leads ?? []);
      const total = typeof res.data?.total === 'number' ? res.data.total : raw.length;
      setTotalInDb(total);
      const ordered = user?.role === 'agent' ? sortLeadsAgent(raw) : sortLeads(raw);
      setLeads(ordered);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, user?.role]);

  useEffect(() => {
    if (!isAdmin) return;
    api
      .get('/users/agents')
      .then((r) => setAgents(r.data))
      .catch(() => setAgents([]));
  }, [isAdmin]);

  const overdueCount = useMemo(
    () => leads.filter((l) => isLeadFollowUpOverdue(l)).length,
    [leads]
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectAll = () => {
    if (selectedIds.length === leads.length) setSelectedIds([]);
    else setSelectedIds(leads.map((l) => String(l._id)));
  };

  const runBulk = async (action: 'assign' | 'transfer' | 'delete') => {
    if (selectedIds.length === 0) return;
    if (action === 'delete' && !window.confirm(`Delete ${selectedIds.length} leads permanently?`)) return;
    if ((action === 'assign' || action === 'transfer') && action === 'transfer' && !bulkAgentId) {
      addNotification({ title: 'Select agent', message: 'Choose an agent to transfer leads to.', type: 'warning' });
      return;
    }
    if (action === 'assign' && !bulkAgentId) {
      if (!window.confirm('Assign with round-robin (no specific agent selected)?')) return;
    }
    setBulkWorking(true);
    try {
      if (action === 'delete') {
        await api.post('/leads/bulk/delete', { leadIds: selectedIds });
        addNotification({ title: 'Deleted', message: `Removed ${selectedIds.length} leads.`, type: 'success' });
      } else if (action === 'transfer') {
        await api.post('/leads/bulk/transfer', { leadIds: selectedIds, agentId: bulkAgentId });
        addNotification({ title: 'Transferred', message: 'Leads moved to the selected agent.', type: 'success' });
      } else {
        const assignRes = await api.post('/leads/bulk/assign', {
          leadIds: selectedIds,
          agentId: bulkAgentId || undefined,
        });
        const n = assignRes.data?.updatedCount ?? 0;
        const skipped = assignRes.data?.skippedAlreadyAssigned ?? 0;
        let msg = `Assigned ${n} lead(s).`;
        if (skipped > 0) {
          msg += ` ${skipped} skipped (already had an agent — use Transfer to move them).`;
        }
        addNotification({
          title: 'Assigned',
          message: msg,
          type: n === 0 && skipped > 0 ? 'warning' : 'success',
        });
      }
      setSelectedIds([]);
      fetchLeads();
    } catch (e: any) {
      addNotification({
        title: 'Bulk action failed',
        message: e?.response?.data?.message ?? 'Request failed',
        type: 'error',
      });
    } finally {
      setBulkWorking(false);
    }
  };

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // ─── Keyboard navigation ───────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      // Ignore when typing in inputs/textareas
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!leads.length) return;
        const idx = leads.findIndex(l => l._id === activeLeadId);
        if (e.key === 'ArrowDown') setActiveLeadId(leads[Math.min(idx + 1, leads.length - 1)]._id);
        else setActiveLeadId(leads[Math.max(idx - 1, 0)]._id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [leads, activeLeadId]);

  // ─── Auto-scroll to active lead ──────────────────────────────────────────
  useEffect(() => {
    if (activeLeadId) {
      const el = document.getElementById(`lead-${activeLeadId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeLeadId]);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // ─── Mobile: vertical stack ───────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="h-full overflow-y-auto bg-app-root p-4 space-y-3 font-mono">
        <h1 className="text-lg font-black text-app-text-active mb-2">Call queue</h1>
        {user?.role === 'agent' && overdueCount > 0 && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-950/25 px-3 py-2 text-xs text-rose-100 mb-3">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>
              <strong>{overdueCount} overdue</strong> follow-up(s). While due work exists, the server only returns due/overdue
              leads — clear these first.
            </span>
          </div>
        )}
        {leads.map(lead => (
          <div
            key={lead._id}
            onClick={() => setActiveLeadId(activeLeadId === lead._id ? null : lead._id)}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              activeLeadId === lead._id
                ? 'bg-blue-950/40 border-blue-500/40'
                : isLeadFollowUpOverdue(lead)
                  ? 'bg-rose-950/15 border-rose-500/35'
                  : 'bg-app-surface border-app-border'
            }`}
          >
            <div className="flex justify-between items-center mb-1 gap-2">
              {isAdmin && (
                <input
                  type="checkbox"
                  className="rounded border-app-border"
                  checked={selectedIds.includes(String(lead._id))}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleSelect(String(lead._id))}
                />
              )}
              <span className="font-bold text-app-text-active flex-1">{lead.name}</span>
              <span className={`text-[10px] font-black uppercase tracking-widest ${STATUS_COLORS[lead.status] ?? 'text-app-text-muted'}`}>
                {formatLeadStatus(lead.status)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-app-text-muted text-xs">
              <Phone size={11} /> {lead.phone}
            </div>
            {activeLeadId === lead._id && (
              <div className="mt-4 border-t border-app-border pt-4">
                <LeadDetails inlineId={lead._id} />
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // ─── Desktop: split-pane ──────────────────────────────────────────────────
  return (
    <div className="absolute inset-0 bg-app-root flex overflow-hidden font-mono">

      {/* LEFT — Scrollable Call Queue */}
      <div className="w-80 shrink-0 flex flex-col bg-app-surface border-r border-app-border shadow-md shadow-black/15">
        {/* Header */}
        <div className="p-4 border-b border-app-border bg-app-root shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-base font-black text-app-text-active tracking-wide uppercase">Call queue</h1>
            <span className="text-[10px] text-app-text-muted font-semibold">
              {totalInDb != null && totalInDb > leads.length
                ? `Showing ${leads.length} of ${totalInDb} · ↑↓ keys`
                : `${leads.length} leads · ↑↓ keys`}
            </span>
          </div>
          {user?.role === 'agent' && overdueCount > 0 && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-rose-500/35 bg-rose-950/25 px-3 py-2 text-[10px] text-rose-100 leading-snug">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>
                <strong>{overdueCount} overdue</strong> — shown first. Server restricts the list to due work until cleared.
              </span>
            </div>
          )}
          {isAdmin && (
            <div className="mb-3 space-y-2 rounded-lg border border-app-border bg-app-surface/80 p-3">
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-app-text-muted">
                  <input
                    type="checkbox"
                    className="rounded border-app-border"
                    checked={leads.length > 0 && selectedIds.length === leads.length}
                    onChange={selectAll}
                  />
                  Bulk ({selectedIds.length})
                </label>
                <select
                  value={bulkAgentId}
                  onChange={(e) => setBulkAgentId(e.target.value)}
                  className="max-w-[140px] flex-1 px-2 py-1 bg-app-root border border-app-border rounded text-[10px] text-app-text"
                >
                  <option value="">Round-robin / pick agent</option>
                  {agents.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  disabled={bulkWorking || selectedIds.length === 0}
                  onClick={() => runBulk('assign')}
                  className="px-2 py-1 rounded-md bg-blue-600/90 text-[10px] font-bold text-white disabled:opacity-40"
                >
                  Assign
                </button>
                <button
                  type="button"
                  disabled={bulkWorking || selectedIds.length === 0}
                  onClick={() => runBulk('transfer')}
                  className="px-2 py-1 rounded-md bg-violet-600/90 text-[10px] font-bold text-white disabled:opacity-40 flex items-center gap-1"
                >
                  <UserPlus size={10} /> Transfer
                </button>
                <button
                  type="button"
                  disabled={bulkWorking || selectedIds.length === 0}
                  onClick={() => runBulk('delete')}
                  className="px-2 py-1 rounded-md bg-rose-600/90 text-[10px] font-bold text-white disabled:opacity-40 flex items-center gap-1"
                >
                  <Trash2 size={10} /> Delete
                </button>
              </div>
            </div>
          )}
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" size={13} />
            <input
              type="text"
              placeholder="Search name / phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-app-root border border-app-border focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 rounded-lg outline-none text-app-text-active text-xs"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 bg-app-root border border-app-border focus:border-blue-500/60 rounded-lg outline-none text-app-text text-xs"
          >
            <option value="">All Statuses</option>
            <option value="New">New</option>
            <option value="Interested">Interested</option>
            <option value="Callback">Callback</option>
            <option value="Converted">Paid client</option>
            <option value="ReadyToWorkTomorrow">Ready Tomorrow</option>
          </select>
        </div>

        {/* Lead List */}
        <div ref={listRef} className="flex-1 overflow-y-auto py-1">
          {loading ? (
            <div className="p-6 text-center text-app-text-muted text-sm">Loading queue...</div>
          ) : leads.length === 0 ? (
            <div className="p-6 text-center text-app-text-muted text-sm">No leads found.</div>
          ) : (
            leads.map((lead, idx) => {
              const isActive = activeLeadId === lead._id;
              const overdue = isLeadFollowUpOverdue(lead);
              return (
                <div
                  key={lead._id}
                  id={`lead-${lead._id}`}
                  onClick={() => setActiveLeadId(lead._id)}
                  className={`mx-2 my-1 px-3 py-2.5 rounded-lg cursor-pointer transition-all border relative overflow-hidden ${
                    isActive
                      ? 'bg-blue-950/50 border-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.08)] ring-1 ring-blue-500/40'
                      : overdue
                        ? 'border-rose-500/40 bg-rose-950/20 hover:bg-rose-950/30'
                        : 'border-transparent hover:bg-app-surface-hover/90'
                  }`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-0 w-1 h-full bg-blue-500 shadow-[0_0_4px_rgba(59,130,246,0.45)]" />
                  )}
                  {!isActive && overdue && (
                    <div className="absolute left-0 top-0 w-1 h-full bg-rose-500/80" />
                  )}
                  <div className="flex justify-between items-start gap-2">
                    {isAdmin && (
                      <input
                        type="checkbox"
                        className="mt-1 rounded border-app-border shrink-0"
                        checked={selectedIds.includes(String(lead._id))}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleSelect(String(lead._id))}
                      />
                    )}
                    <span className={`font-bold text-sm truncate flex items-center gap-2 ${isActive ? 'text-app-text-active' : 'text-app-text'}`}>
                      {overdue && (
                        <span className="text-[8px] font-black uppercase text-rose-400 shrink-0">Due</span>
                      )}
                      {idx + 1}. {lead.name}
                      {isActive && (
                        <span className="flex items-center gap-1.5 text-[9px] bg-blue-500 text-white px-2 py-0.5 rounded uppercase font-black tracking-widest shadow-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          Calling
                        </span>
                      )}
                    </span>
                    <span className={`text-[9px] font-black uppercase tracking-widest shrink-0 ${STATUS_COLORS[lead.status] ?? 'text-app-text-muted'}`}>
                      {formatLeadStatus(lead.status)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className={`text-[11px] flex items-center gap-1 ${isActive ? 'text-blue-300 font-semibold' : 'text-app-text-muted'}`}>
                      <Phone size={9} /> {lead.phone}
                    </span>
                    {lead.nextFollowUpDate && (
                      <span className="text-amber-500/80 text-[9px] flex items-center gap-1 font-bold">
                        <Calendar size={9} /> {format(new Date(lead.nextFollowUpDate), 'MMM d')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-app-border bg-app-root/80 shrink-0">
          <p className="text-[10px] text-app-text-muted text-center tracking-wider">
            ↑↓ = navigate · T = trade panel · P = payment panel
          </p>
        </div>
      </div>

      {/* RIGHT — Action Panel */}
      <div className="flex-1 overflow-y-auto relative">
        {activeLeadId ? (
          <div className="p-6 max-w-3xl mx-auto">
            <LeadDetails inlineId={activeLeadId} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-app-text-muted select-none">
            <Filter size={40} className="mb-4 opacity-30" />
            <p className="text-base font-bold text-app-text uppercase tracking-widest">Select a lead to begin</p>
            <p className="text-xs text-app-text-muted mt-2">Use ↑↓ keys to navigate · T / P for trade and payment panels</p>
          </div>
        )}
      </div>

    </div>
  );
};
