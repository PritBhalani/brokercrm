import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { useNotifications } from '../context/NotificationContext.tsx';
import { buildWorkQueue, categorizeLeads } from '../lib/agentWorkbench.ts';
import { canAgentConvertLead, getAgentConversionBlockReason, isLeadFollowUpOverdue } from '../lib/leadRules.ts';
import { formatLeadStatus } from '../lib/leadStatusDisplay.ts';
import api from '../services/api.ts';
import { Card, CardHeader } from '../components/ui/Card.tsx';
import { Button } from '../components/ui/Button.tsx';
import { format } from 'date-fns';
import { ArrowRight, Calendar, Phone, ListOrdered, ExternalLink, AlertCircle, TrendingUp, Users } from 'lucide-react';

const STATUS_BADGE: Record<string, string> = {
  New: 'text-blue-400',
  Interested: 'text-emerald-400',
  Callback: 'text-amber-400',
  Converted: 'text-violet-400',
  ReadyToWorkTomorrow: 'text-cyan-400',
};

export const AgentDashboard: React.FC = () => {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const fetchWorkbench = useCallback(async () => {
    try {
      const res = await api.get('/leads', { params: { workbench: 'true', limit: 200 } });
      const raw = Array.isArray(res.data) ? res.data : (res.data?.leads ?? []);
      setLeads(raw);
    } catch (e) {
      console.error(e);
      addNotification({ title: 'Error', message: 'Could not load your workbench.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    void fetchWorkbench();
  }, [fetchWorkbench]);

  const queue = useMemo(() => buildWorkQueue(leads), [leads]);
  const { overdue, dueToday, highPriority } = useMemo(() => categorizeLeads(leads), [leads]);
  const agentId = user?._id?.toString() ?? '';
  const overdueFollowUps = overdue.length;

  useEffect(() => {
    if (queue.length === 0) {
      setFocusId(null);
      return;
    }
    if (!focusId || !queue.some((l) => String(l._id) === focusId)) {
      setFocusId(String(queue[0]._id));
    }
  }, [queue, focusId]);

  const focused = queue.find((l) => String(l._id) === focusId) ?? null;
  const focusIndex = focused ? queue.findIndex((l) => String(l._id) === focusId) : -1;
  const nextLead = focusIndex >= 0 && focusIndex < queue.length - 1 ? queue[focusIndex + 1] : null;

  const runConverted = async () => {
    if (!focused || !agentId) return;
    const reason = getAgentConversionBlockReason(focused, agentId);
    if (reason) {
      addNotification({ title: 'Cannot convert yet', message: reason, type: 'warning' });
      return;
    }
    setBusy(true);
    try {
      await api.patch(`/leads/${focused._id}/status`, { status: 'Converted' });
      addNotification({ title: 'Paid client', message: `${focused.name} marked as paid client.`, type: 'success' });
      await fetchWorkbench();
      const idx = queue.findIndex((l) => String(l._id) === String(focused._id));
      const n = queue[idx + 1];
      setFocusId(n ? String(n._id) : null);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ??
        'Conversion requires trade + received payment — open the lead to complete.';
      addNotification({ title: 'Cannot convert yet', message: msg, type: 'warning' });
    } finally {
      setBusy(false);
    }
  };

  if (!user || user.role !== 'agent') {
    return null;
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
        <div className="h-10 w-48 rounded-lg bg-app-surface-hover" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-app-surface-hover" />
          ))}
        </div>
        <div className="h-72 rounded-2xl bg-app-surface-hover" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-app-text-muted">Today&apos;s work</p>
          <h1 className="text-2xl font-bold text-app-text-active mt-1">Hi {user.name.split(' ')[0]}</h1>
          <p className="text-sm text-app-text-muted mt-1 max-w-xl">
            Focus the next lead, open the full record to update status and notes, then move on.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="md" onClick={() => navigate('/today-trades')}>
            <TrendingUp size={18} />
            Today&apos;s trades
          </Button>
          <Button variant="secondary" size="md" onClick={() => navigate('/leads')}>
            <ListOrdered size={18} />
            Open call queue
          </Button>
        </div>
      </div>

      <section aria-label="Today metrics" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-app-border bg-app-surface p-5 shadow-sm shadow-black/10">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-app-text-muted">Leads in workbench</p>
              <p className="text-3xl font-black text-emerald-400 mt-1 tabular-nums">{leads.length}</p>
              <p className="text-xs text-app-text-muted mt-2">Assigned leads returned for your queue (same list as below).</p>
            </div>
            <Users className="text-emerald-500/80 shrink-0" size={28} />
          </div>
        </div>
        <div
          className={`rounded-2xl border p-5 shadow-sm shadow-black/10 ${
            overdueFollowUps > 0
              ? 'border-rose-500/50 bg-rose-950/30 ring-1 ring-rose-500/30'
              : 'border-app-border bg-app-surface'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-app-text-muted">Overdue follow-ups</p>
              <p className="text-3xl font-black text-rose-400 mt-1 tabular-nums">{overdueFollowUps}</p>
              <p className="text-xs text-app-text-muted mt-2">
                Before today (UTC). The call queue list is enforced by the server when due work exists.
              </p>
            </div>
            <AlertCircle className="text-rose-400 shrink-0" size={28} />
          </div>
        </div>
      </section>

      <section aria-label="Summary counts">
        <CardHeader title="Priorities" description="What needs attention first" className="mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => overdue[0] && setFocusId(String(overdue[0]._id))}
            className="text-left rounded-2xl border border-app-border bg-app-surface p-5 shadow-sm shadow-black/10 hover:border-rose-500/40 transition-colors"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-app-text-muted">Overdue</p>
            <p className="text-3xl font-black text-rose-400 mt-1 tabular-nums">{overdue.length}</p>
            <p className="text-xs text-app-text-muted mt-2">Follow-ups before today</p>
          </button>
          <button
            type="button"
            onClick={() => dueToday[0] && setFocusId(String(dueToday[0]._id))}
            className="text-left rounded-2xl border border-app-border bg-app-surface p-5 shadow-sm shadow-black/10 hover:border-amber-500/40 transition-colors"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-app-text-muted">Due today</p>
            <p className="text-3xl font-black text-amber-400 mt-1 tabular-nums">{dueToday.length}</p>
            <p className="text-xs text-app-text-muted mt-2">Scheduled for today (UTC)</p>
          </button>
          <button
            type="button"
            onClick={() => highPriority[0] && setFocusId(String(highPriority[0]._id))}
            className="text-left rounded-2xl border border-app-border bg-app-surface p-5 shadow-sm shadow-black/10 hover:border-violet-500/40 transition-colors"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-app-text-muted">High priority</p>
            <p className="text-3xl font-black text-violet-400 mt-1 tabular-nums">{highPriority.length}</p>
            <p className="text-xs text-app-text-muted mt-2">Flagged high in CRM</p>
          </button>
        </div>
      </section>

      <Card>
        <CardHeader
          title="Next up"
          description={queue.length ? `Lead ${focusIndex + 1} of ${queue.length} in your queue` : 'No leads assigned'}
          action={
            focused ? (
              <Link to={`/leads/${focused._id}`}>
                <Button variant="ghost" size="sm" type="button" className="border border-app-border">
                  <ExternalLink size={16} />
                  Full record
                </Button>
              </Link>
            ) : null
          }
        />

        {!focused ? (
          <p className="text-app-text-muted text-sm py-8 text-center">You&apos;re caught up — or no leads are assigned.</p>
        ) : (
          <div className="space-y-6">
            {isLeadFollowUpOverdue(focused) && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">
                <AlertCircle size={18} className="shrink-0" />
                <span>
                  <strong>Overdue follow-up</strong> — this lead should be worked before newer tasks.
                </span>
              </div>
            )}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-app-text-active">{focused.name}</h2>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${STATUS_BADGE[focused.status] ?? 'text-app-text-muted'}`}>
                    {formatLeadStatus(focused.status)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-sm text-app-text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Phone size={14} className="text-blue-400" />
                    {focused.phone}
                  </span>
                  {focused.nextFollowUpDate ? (
                    <span className="inline-flex items-center gap-1.5 text-amber-400/90">
                      <Calendar size={14} />
                      {format(new Date(focused.nextFollowUpDate), 'MMM d, yyyy')}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-app-text-muted mb-2">Quick actions</p>
              <p className="text-xs text-app-text-muted mb-3">
                Open the full lead to change pipeline status and notes. Convert here when requirements are met.
              </p>
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="md"
                    disabled={busy || !canAgentConvertLead(focused, agentId)}
                    title={getAgentConversionBlockReason(focused, agentId) ?? undefined}
                    onClick={runConverted}
                  >
                    Mark paid client
                  </Button>
                </div>
                {agentId && !canAgentConvertLead(focused, agentId) ? (
                  <p className="text-xs text-amber-200/90 bg-amber-950/30 border border-amber-500/25 rounded-lg px-3 py-2">
                    {getAgentConversionBlockReason(focused, agentId)}
                  </p>
                ) : null}
              </div>
            </div>

            {nextLead ? (
              <div className="rounded-xl border border-app-border bg-app-root/80 px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-app-text-muted">Then</p>
                  <p className="text-sm font-semibold text-app-text-active">{nextLead.name}</p>
                </div>
                <Button variant="ghost" size="sm" type="button" onClick={() => setFocusId(String(nextLead._id))}>
                  Skip to next
                  <ArrowRight size={16} />
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </Card>

      {queue.length > 1 && (
        <Card>
          <CardHeader title="Upcoming in queue" description="Tap to focus without opening the full queue" />
          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {queue.slice(0, 8).map((l, i) => (
              <li key={l._id}>
                <button
                  type="button"
                  onClick={() => setFocusId(String(l._id))}
                  className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                    String(l._id) === focusId
                      ? 'border-blue-500/50 bg-blue-950/30'
                      : isLeadFollowUpOverdue(l)
                        ? 'border-rose-500/35 bg-rose-950/20 hover:bg-rose-950/30'
                        : 'border-transparent hover:bg-app-surface-hover'
                  }`}
                >
                  <span className="text-xs text-app-text-muted font-mono mr-2">{i + 1}.</span>
                  {isLeadFollowUpOverdue(l) ? (
                    <span className="text-[9px] font-black uppercase text-rose-400 mr-1.5">Overdue</span>
                  ) : null}
                  <span className="font-medium text-app-text-active">{l.name}</span>
                  <span className={`ml-2 text-[10px] font-black uppercase ${STATUS_BADGE[l.status] ?? ''}`}>
                    {formatLeadStatus(l.status)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
};
