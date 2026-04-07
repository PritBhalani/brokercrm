import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api.ts';
import { TrendingUp, Lock, ChevronDown, ChevronRight, ExternalLink, RefreshCw, X, Loader2 } from 'lucide-react';

// ─── Inline Agent Ribbon ───────────────────────────────────────────────────────
const AgentRibbon: React.FC<{ agentId: string }> = ({ agentId }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/admin/agent/${agentId}/summary`)
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [agentId]);

  if (loading) return (
    <tr><td colSpan={7} className="bg-slate-900/50 px-8 py-4">
      <div className="flex gap-4">
        {[1,2,3].map(i => <div key={i} className="flex-1 h-16 bg-slate-800 rounded-xl animate-pulse" />)}
      </div>
    </td></tr>
  );
  if (!data) return null;

  const rows: any[] = Array.isArray(data.pipelineClients) ? data.pipelineClients : [];

  return (
    <tr className="border-b border-slate-800">
      <td colSpan={7} className="bg-slate-950/80 px-4 py-4 sm:px-6 border-l-4 border-l-blue-500/40">
        <div className="max-w-5xl">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2">
            Active &amp; FT pipeline <span className="text-slate-600 font-normal normal-case">(today / tomorrow UTC)</span>
          </p>
          <p className="text-[9px] text-slate-600 mb-3 leading-snug">
            Buy qty = buy trades logged today (UTC). Received = payments marked received today (UTC). Pending = all open
            pending on that client.
          </p>
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/90">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2 font-bold">Client</th>
                  <th className="px-3 py-2 font-bold">Tags</th>
                  <th className="px-3 py-2 font-bold tabular-nums text-right">Buy qty (today)</th>
                  <th className="px-3 py-2 font-bold tabular-nums text-right">Received</th>
                  <th className="px-3 py-2 font-bold tabular-nums text-right">Pending</th>
                  <th className="px-3 py-2 font-bold w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-slate-500 italic">
                      No active clients or FT scheduled for today / tomorrow (UTC).
                    </td>
                  </tr>
                ) : (
                  rows.map((row: any) => (
                    <tr key={String(row._id)} className="text-slate-200 hover:bg-slate-800/40">
                      <td className="px-3 py-2.5 font-semibold text-white">
                        {row.name}
                        {row.phone ? (
                          <span className="block text-[10px] text-slate-500 font-normal font-mono mt-0.5">{row.phone}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {(row.tags ?? []).map((t: string) => (
                            <span
                              key={t}
                              className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-slate-400 border border-slate-700"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-amber-400 font-bold">
                        {(row.buyQtyToday ?? 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-emerald-400 font-bold">
                        ₹{(row.receivedToday ?? 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-rose-400 font-bold">
                        ₹{(row.pendingOpen ?? 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-2.5">
                        <Link
                          to={`/leads/${row._id}`}
                          className="text-[10px] font-black uppercase text-blue-400 hover:text-blue-300 whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Lead
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </td>
    </tr>
  );
};

// ─── Filter Types ────────────────────────────────────────────────────────────
type FilterType = 'ALL' | 'HIGH_RISK' | 'TOP_PERFORMERS';

// ─── Main CommandCenter ────────────────────────────────────────────────────────
export const CommandCenter: React.FC = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [activeModalAgent, setActiveModalAgent] = useState<{ _id: string; name: string } | null>(null);
  const [activeClients, setActiveClients] = useState<any[]>([]);
  const [activeClientsLoading, setActiveClientsLoading] = useState(false);
  const navigate = useNavigate();

  const closeActiveModal = useCallback(() => {
    setActiveModalAgent(null);
    setActiveClients([]);
  }, []);

  const openActiveClientsForAgent = useCallback(async (agent: { _id: string; name: string }) => {
    setActiveModalAgent(agent);
    setActiveClientsLoading(true);
    setActiveClients([]);
    try {
      const r = await api.get('/leads', {
        params: {
          assignedAgent: agent._id,
          activeOnly: 'true',
          limit: 500,
        },
      });
      setActiveClients(Array.isArray(r.data?.leads) ? r.data.leads : []);
    } catch {
      setActiveClients([]);
    } finally {
      setActiveClientsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!activeModalAgent) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeActiveModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeModalAgent, closeActiveModal]);

  const fetchReports = useCallback(async () => {
    try {
      const response = await api.get('/daily-report/today');
      const data = response.data;
      setReports(Array.isArray(data) ? data : (data?.agents ?? data?.reports ?? []));
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to fetch daily reports:', error);
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
    const interval = setInterval(fetchReports, 30000);
    return () => clearInterval(interval);
  }, [fetchReports]);

  if (loading && reports.length === 0) {
    return (
      <div className="-m-8 min-h-[calc(100vh-4rem)] bg-slate-950 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const safeReports = Array.isArray(reports) ? reports : [];
  const totalCollection    = safeReports.reduce((s, r) => s + (r.paymentsCollected  || 0), 0);
  const totalPending       = safeReports.reduce((s, r) => s + (r.pendingPayments    || 0), 0);
  const totalFTToday     = safeReports.reduce((s, r) => s + (r.freshTradersDueToday  || 0), 0);
  const totalTodayPipe   = safeReports.reduce((s, r) => s + (r.todayPipelineCount   || 0), 0);
  const totalFT            = safeReports.reduce((s, r) => s + (r.freshTraders       || 0), 0);
  const totalTomorrowActive = safeReports.reduce((s, r) => s + (r.tomorrowActiveClients || 0), 0);
  const totalTrades        = safeReports.reduce((s, r) => s + (r.clientsBoughtCount || 0), 0);

  const filteredReports = safeReports.filter(report => {
    if (filter === 'ALL') return true;
    
    const pendingRatio = report.paymentsCollected > 0 
      ? (report.pendingPayments / report.paymentsCollected) 
      : report.pendingPayments > 0 ? 999 : 0;
      
    if (filter === 'HIGH_RISK') return pendingRatio >= 2;
    if (filter === 'TOP_PERFORMERS') return report.paymentsCollected > 0 || report.clientsBoughtCount > 0;
    
    return true;
  });

  // Sort Top Performers by collection descending if top performers filter is active
  if (filter === 'TOP_PERFORMERS') {
    filteredReports.sort((a, b) => b.paymentsCollected - a.paymentsCollected);
  }

  const toggleExpand = (agentId: string) =>
    setExpandedAgentId(prev => (prev === agentId ? null : agentId));

  return (
    <div className="-m-8 min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-300 font-mono">
      {activeModalAgent ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="active-clients-modal-title"
          onClick={closeActiveModal}
        >
          <div
            className="w-full max-w-lg max-h-[min(80vh,520px)] flex flex-col bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-800 bg-slate-950/80">
              <div>
                <h2 id="active-clients-modal-title" className="text-sm font-black text-white uppercase tracking-wider">
                  Active clients
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {activeModalAgent.name} — leads with <span className="text-slate-400">isActiveClient</span> (live data)
                </p>
              </div>
              <button
                type="button"
                onClick={closeActiveModal}
                className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3 min-h-[120px]">
              {activeClientsLoading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-slate-500 text-sm">
                  <Loader2 className="animate-spin" size={18} />
                  Loading…
                </div>
              ) : activeClients.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-10">No active clients for this agent.</p>
              ) : (
                <ul className="space-y-2">
                  {activeClients.map((lead: any) => (
                    <li key={lead._id}>
                      <Link
                        to={`/leads/${lead._id}`}
                        onClick={closeActiveModal}
                        className="flex items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 hover:border-blue-500/40 hover:bg-slate-800/40 transition-colors group"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-white text-sm block truncate">{lead.name}</span>
                          <span className="text-xs text-slate-500 font-mono mt-0.5 block">{lead.phone}</span>
                        </div>
                        <ExternalLink size={14} className="text-slate-600 group-hover:text-blue-400 shrink-0 mt-0.5" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <div className="max-w-[1500px] mx-auto p-8 space-y-6">

        {/* KPI Header */}
        <header className="flex flex-wrap items-center justify-between gap-6 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm shadow-black/15">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
              <TrendingUp className="text-emerald-400" size={28} />
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase flex items-center gap-2">
                Total Office Collection
                <span className="flex items-center gap-1 text-[9px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded border border-amber-500/20">
                  <Lock size={8} /> TODAY ONLY
                </span>
              </p>
              <p className="text-3xl font-black text-emerald-400">₹{totalCollection.toLocaleString('en-IN')}</p>
            </div>
          </div>
          <div className="flex gap-6 items-center">
            <div className="text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                Pending <span className="text-slate-600 normal-case font-medium">(today UTC)</span>
              </p>
              <p className="text-xl font-black text-rose-400">₹{totalPending.toLocaleString('en-IN')}</p>
            </div>
            <div className="w-px h-10 bg-slate-800" />
            <div className="text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">Trades</p>
              <p className="text-xl font-black text-amber-400">{totalTrades}</p>
            </div>
            <div className="w-px h-10 bg-slate-800" />
            <div className="text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">FT</p>
              <p className="text-xl font-black text-cyan-400">{totalFT}</p>
            </div>
            <div className="w-px h-10 bg-slate-800" />
            <div className="text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">Tmrw Active</p>
              <p className="text-xl font-black text-indigo-400">{totalTomorrowActive}</p>
            </div>
            <button
              onClick={fetchReports}
              title="Refresh now"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </header>

        {/* Auto-refresh note & Quick Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 -mt-2">
          <div className="flex gap-2 bg-slate-900 border border-slate-800 p-1 rounded-xl">
            {(
              [
                ['ALL', 'Office Total'],
                ['HIGH_RISK', 'High Risk'],
                ['TOP_PERFORMERS', 'Top Performers']
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filter === value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
                }`}
              >
                {label}
                {value !== 'ALL' && filter === value && (
                  <span className="ml-2 bg-blue-950 text-blue-300 text-[10px] px-1.5 py-0.5 rounded-full">
                    {filteredReports.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <p className="text-[10px] text-slate-700 text-right">
            Last refresh: {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · Auto every 30s
          </p>
        </div>

        {/* God Table */}
        <div className="w-full overflow-x-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-sm shadow-black/15">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-[10px] uppercase tracking-widest text-slate-500">
                <th className="p-3 pl-4 sticky left-0 z-10 bg-slate-950 border-r border-slate-800 w-8" />
                <th className="p-3 sticky left-8 z-10 bg-slate-950 border-r border-slate-800 font-bold">Agent</th>
                <th className="p-3 font-bold border-r border-slate-800">Active<br/><span className="text-[9px] text-slate-700">clients</span></th>
                <th className="p-3 font-bold border-r border-slate-800">Traded<br/><span className="text-[9px] text-slate-700">bought / qty</span></th>
                <th className="p-3 font-bold border-r border-slate-800">Payments<br/><span className="text-[9px] text-slate-700">coll / pend</span></th>
                <th className="p-3 font-bold border-r border-slate-800">
                  Today<br />
                  <span className="text-[9px] text-slate-700 font-normal">ft / active</span>{' '}
                  <span className="text-[8px] text-slate-600">(UTC)</span>
                </th>
                <th className="p-3 font-bold">
                  Tomorrow<br />
                  <span className="text-[9px] text-slate-700 font-normal">ft / active</span>{' '}
                  <span className="text-[8px] text-slate-600">(UTC)</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 font-bold">
                    No agents match this filter.
                  </td>
                </tr>
              ) : filteredReports.map((report) => {
                const hasCollection = report.paymentsCollected > 0;
                const pendingRatio  = report.paymentsCollected > 0
                  ? (report.pendingPayments / report.paymentsCollected)
                  : report.pendingPayments > 0 ? 999 : 0;
                let borderColor = 'border-l-transparent';
                if (pendingRatio >= 2) borderColor = 'border-l-rose-500';
                else if (hasCollection) borderColor = 'border-l-emerald-500';

                const isExpanded = expandedAgentId === report.agent._id;

                return (
                  <React.Fragment key={report.agent._id}>
                    <tr
                      className={`bg-slate-900 hover:bg-slate-800/60 cursor-pointer transition-colors border-l-4 ${borderColor} group`}
                      onClick={() => toggleExpand(report.agent._id)}
                    >
                      {/* Expand toggle */}
                      <td className="p-3 pl-4 sticky left-0 z-10 bg-slate-900 group-hover:bg-slate-800/60 border-r border-slate-800/40 text-slate-600">
                        {isExpanded
                          ? <ChevronDown size={14} />
                          : <ChevronRight size={14} />}
                      </td>

                      {/* Agent Name */}
                      <td className="p-3 sticky left-8 z-10 bg-slate-900 group-hover:bg-slate-800/60 border-r border-slate-800">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded bg-blue-500/10 text-blue-400 flex items-center justify-center font-black text-xs shrink-0">
                            {report.agent.name.charAt(0)}
                          </div>
                          <span className="font-bold text-white text-sm">{report.agent.name}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/agents/${report.agent._id}/summary`); }}
                            title="Full page drilldown"
                            className="ml-1 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-blue-400 transition-all"
                          >
                            <ExternalLink size={11} />
                          </button>
                        </div>
                      </td>

                      {/* Active — click lists leads with isActiveClient (same source as column count) */}
                      <td className="p-3 border-r border-slate-800">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void openActiveClientsForAgent(report.agent);
                          }}
                          className="text-base font-bold text-slate-300 hover:text-blue-400 underline decoration-transparent hover:decoration-blue-400/80 underline-offset-2 transition-colors text-left w-full min-w-[2rem]"
                          title="View active clients for this agent"
                        >
                          {report.activeClientsMorning}
                        </button>
                      </td>

                      {/* Trading */}
                      <td className="p-3 border-r border-slate-800 font-bold whitespace-nowrap text-sm">
                        <span className="text-emerald-400">{report.clientsBoughtCount}</span>
                        <span className="text-slate-700 mx-1.5">/</span>
                        <span className="text-amber-400">{(report.totalBuyQuantity || 0).toLocaleString()}</span>
                      </td>

                      {/* Payments */}
                      <td className="p-3 border-r border-slate-800 font-bold whitespace-nowrap text-sm">
                        <span className="text-emerald-400">₹{(report.paymentsCollected || 0).toLocaleString()}</span>
                        <span className="text-slate-700 mx-1.5">/</span>
                        <span className={pendingRatio >= 2 ? 'text-rose-400' : 'text-slate-400'}>
                          ₹{(report.pendingPayments || 0).toLocaleString()}
                        </span>
                      </td>

                      {/* Today: FT due today / pipeline (active ∪ FT today) */}
                      <td className="p-3 border-r border-slate-800 font-bold whitespace-nowrap text-sm tabular-nums">
                        <span className="text-cyan-400">{report.freshTradersDueToday ?? 0}</span>
                        <span className="text-slate-700 mx-1.5">/</span>
                        <span className="text-indigo-400">{report.todayPipelineCount ?? 0}</span>
                      </td>

                      {/* Tomorrow */}
                      <td className="p-3 font-bold whitespace-nowrap text-sm tabular-nums">
                        <span className="text-teal-400">{report.freshTraders ?? 0}</span>
                        <span className="text-slate-700 mx-1.5">/</span>
                        <span className="text-indigo-400">{report.tomorrowActiveClients ?? 0}</span>
                      </td>
                    </tr>

                    {/* Inline Ribbon */}
                    {isExpanded && <AgentRibbon agentId={report.agent._id} />}
                  </React.Fragment>
                );
              })}
            </tbody>

            {/* Totals footer */}
            {safeReports.length > 1 && (
              <tfoot>
                <tr className="bg-slate-950 border-t border-slate-700 text-xs font-black text-slate-400 uppercase tracking-wider">
                  <td className="p-3 pl-4 sticky left-0 z-10 bg-slate-950 border-r border-slate-800/40" />
                  <td className="p-3 sticky left-8 z-10 bg-slate-950 border-r border-slate-800">Office Total</td>
                  <td className="p-3 border-r border-slate-800 text-slate-300">
                    {safeReports.reduce((s, r) => s + (r.activeClientsMorning || 0), 0)}
                  </td>
                  <td className="p-3 border-r border-slate-800">
                    <span className="text-emerald-400">{totalTrades}</span>
                    <span className="text-slate-700 mx-1.5">/</span>
                    <span className="text-amber-400">{safeReports.reduce((s, r) => s + (r.totalBuyQuantity || 0), 0).toLocaleString()}</span>
                  </td>
                  <td className="p-3 border-r border-slate-800">
                    <span className="text-emerald-400">₹{totalCollection.toLocaleString()}</span>
                    <span className="text-slate-700 mx-1.5">/</span>
                    <span className="text-rose-400">₹{totalPending.toLocaleString()}</span>
                  </td>
                  <td className="p-3 border-r border-slate-800 tabular-nums">
                    <span className="text-cyan-400">{totalFTToday}</span>
                    <span className="text-slate-700 mx-1.5">/</span>
                    <span className="text-indigo-400">{totalTodayPipe}</span>
                  </td>
                  <td className="p-3 tabular-nums">
                    <span className="text-teal-400">{totalFT}</span>
                    <span className="text-slate-700 mx-1.5">/</span>
                    <span className="text-indigo-400">{totalTomorrowActive}</span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
