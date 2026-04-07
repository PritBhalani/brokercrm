import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { useNotifications } from '../context/NotificationContext.tsx';
import {
  BarChart3,
  TrendingUp,
  Phone,
  IndianRupee,
  Lock,
  Unlock,
  AlertTriangle,
  ArrowUpDown,
  Upload,
  Star,
  TrendingDown,
  Plus,
  Trash2,
  Wallet,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import api from '../services/api.ts';
import { Card, CardHeader } from '../components/ui/Card.tsx';
import { Button } from '../components/ui/Button.tsx';
import { CSVUploadModal } from '../components/CSVUploadModal.tsx';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type LeadStats = {
  totalLeads?: number;
  statusBreakdown?: { _id: string; count: number }[];
  agentBreakdown?: { name: string; count: number }[];
  convertedCount?: number;
  callsToday?: number;
  overdueFollowUps?: number;
};

type StatsPeriod = 'all' | 'day' | 'month';

type AdminStats = {
  agentsStats?: any[];
  /** Company-wide received payments for the selected period (or all time). */
  totalRevenueInPeriod?: number;
  totalMonthlyCollection?: number;
  period?: StatsPeriod;
  periodLabel?: string;
};

type Settings = {
  isLocked?: boolean;
  officeStartTime?: string;
  officeEndTime?: string;
  collectionAccountLabels?: string[];
};

type CollectionAccountDraftItem = { id: string; label: string };

function toCollectionDraftItems(raw: unknown): CollectionAccountDraftItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => String(x).trim())
    .filter(Boolean)
    .slice(0, 50)
    .map((label) => ({ id: crypto.randomUUID(), label }));
}

function KpiCard({
  title,
  value,
  icon: Icon,
  accentClass,
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accentClass: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className={cn('absolute right-4 top-4 rounded-xl p-2.5 opacity-90', accentClass)}>
        <Icon size={22} className="text-white" />
      </div>
      <p className="text-xs font-bold uppercase tracking-wider text-app-text-muted pr-14">{title}</p>
      <p className="text-2xl font-black text-app-text-active mt-2 tabular-nums">{value}</p>
    </Card>
  );
}

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [togglingLock, setTogglingLock] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [collectionLabelDraft, setCollectionLabelDraft] = useState<CollectionAccountDraftItem[]>([]);
  /** When true, do not replace the UPI list from GET /admin/settings (avoids losing edits after refetch). */
  const collectionLabelsDirtyRef = useRef(false);
  /** Ignore stale GET /admin/settings that finish after a save (same race as refresh showing old UPI names). */
  const lastSettingsUpdatedAtMsRef = useRef(0);
  const [newCollectionLabel, setNewCollectionLabel] = useState('');
  const [savingCollectionLabels, setSavingCollectionLabels] = useState(false);
  const [dailyTradeSlotsDraft, setDailyTradeSlotsDraft] = useState<string[]>([]);
  const [newDailyTradeSlot, setNewDailyTradeSlot] = useState('');
  const [savingDailySlots, setSavingDailySlots] = useState(false);
  type SortKey = 'name' | 'activeClients' | 'clientsWithTrade' | 'totalBuyQuantity' | 'pendingPayment' | 'receivedPayment';
  const [sortKey, setSortKey] = useState<SortKey>('receivedPayment');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [statsPeriod, setStatsPeriod] = useState<StatsPeriod>('all');

  const fetchStats = useCallback(async () => {
    try {
      const [leadsRes, adminStatsRes, settingsRes, dailyOffersRes] = await Promise.all([
        api.get('/leads/stats'),
        api.get('/admin/stats', { params: { period: statsPeriod } }),
        api.get('/admin/settings'),
        api.get('/leads/daily-trade-offers'),
      ]);
      setStats(leadsRes.data);
      setAdminStats(adminStatsRes.data);
      setSettings(settingsRes.data);
      const settingsUpdatedMs = settingsRes.data?.updatedAt
        ? new Date(settingsRes.data.updatedAt).getTime()
        : 0;
      const staleFetch =
        lastSettingsUpdatedAtMsRef.current > 0 &&
        settingsUpdatedMs > 0 &&
        settingsUpdatedMs < lastSettingsUpdatedAtMsRef.current;
      if (!collectionLabelsDirtyRef.current && !staleFetch) {
        const raw = settingsRes.data?.collectionAccountLabels;
        setCollectionLabelDraft(toCollectionDraftItems(raw));
      }
      if (!staleFetch && settingsUpdatedMs > 0) {
        lastSettingsUpdatedAtMsRef.current = Math.max(
          lastSettingsUpdatedAtMsRef.current,
          settingsUpdatedMs
        );
      }
      const slots = dailyOffersRes.data?.slots;
      setDailyTradeSlotsDraft(Array.isArray(slots) ? slots : []);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  }, [statsPeriod]);

  useEffect(() => {
    if (user?.role === 'admin') {
      void fetchStats();
    } else {
      setLoading(false);
    }
  }, [user, fetchStats]);

  const handleAssignUnassigned = async () => {
    if (!window.confirm('Assign all unassigned leads equally to available agents?')) return;
    try {
      setAssigning(true);
      const response = await api.post('/leads/assign-unassigned');
      addNotification({
        title: 'Assignment complete',
        message: `Assigned ${response.data.assignedCount} leads.`,
        type: 'success',
      });
      await fetchStats();
    } catch (error) {
      console.error('Error assigning unassigned leads:', error);
      addNotification({
        title: 'Assignment failed',
        message: 'Could not assign unassigned leads.',
        type: 'error',
      });
    } finally {
      setAssigning(false);
    }
  };

  const persistCollectionLabels = async (
    items: CollectionAccountDraftItem[],
    options?: { notify?: boolean }
  ) => {
    const notify = options?.notify === true;
    try {
      setSavingCollectionLabels(true);
      const res = await api.put('/admin/settings', {
        collectionAccountLabels: items.map((x) => x.label),
      });
      setSettings(res.data);
      const raw = res.data?.collectionAccountLabels;
      setCollectionLabelDraft(toCollectionDraftItems(raw));
      const savedAt = res.data?.updatedAt ? new Date(res.data.updatedAt).getTime() : Date.now();
      lastSettingsUpdatedAtMsRef.current = savedAt;
      collectionLabelsDirtyRef.current = false;
      if (notify) {
        addNotification({
          title: 'Saved',
          message: 'UPI / collection account options updated for payment logging.',
          type: 'success',
        });
      }
    } catch (error) {
      console.error('Error saving collection labels:', error);
      addNotification({ title: 'Error', message: 'Could not save collection accounts.', type: 'error' });
    } finally {
      setSavingCollectionLabels(false);
    }
  };

  const addCollectionLabel = () => {
    const t = newCollectionLabel.trim();
    if (!t) return;
    collectionLabelsDirtyRef.current = true;
    setCollectionLabelDraft((prev) => {
      if (prev.some((x) => x.label === t)) return prev;
      const next = [...prev, { id: crypto.randomUUID(), label: t }];
      void persistCollectionLabels(next);
      return next;
    });
    setNewCollectionLabel('');
  };

  const removeCollectionLabel = (id: string) => {
    collectionLabelsDirtyRef.current = true;
    setCollectionLabelDraft((prev) => {
      const next = prev.filter((x) => x.id !== id);
      void persistCollectionLabels(next);
      return next;
    });
  };

  const addDailyTradeSlot = () => {
    const t = newDailyTradeSlot.trim();
    if (!t) return;
    setDailyTradeSlotsDraft((prev) => (prev.includes(t) ? prev : [...prev, t]));
    setNewDailyTradeSlot('');
  };

  const removeDailyTradeSlot = (index: number) => {
    setDailyTradeSlotsDraft((prev) => prev.filter((_, i) => i !== index));
  };

  const saveDailyTradeSlots = async () => {
    try {
      setSavingDailySlots(true);
      const res = await api.put('/admin/daily-trade-offers', { slots: dailyTradeSlotsDraft });
      setDailyTradeSlotsDraft(Array.isArray(res.data?.slots) ? res.data.slots : []);
      addNotification({
        title: 'Saved',
        message: `Today's trade names updated for UTC date ${res.data?.dayKey ?? ''}. Agents must pick one when logging a buy.`,
        type: 'success',
      });
    } catch (error) {
      console.error('Error saving daily trade slots:', error);
      addNotification({ title: 'Error', message: 'Could not save trade names.', type: 'error' });
    } finally {
      setSavingDailySlots(false);
    }
  };

  const saveCollectionLabels = async () => {
    await persistCollectionLabels(collectionLabelDraft, { notify: true });
  };

  const toggleOfficeHoursLock = async () => {
    try {
      setTogglingLock(true);
      const newStatus = !settings?.isLocked;
      const res = await api.put('/admin/settings', { isLocked: newStatus });
      setSettings(res.data);
      const u = res.data?.updatedAt ? new Date(res.data.updatedAt).getTime() : Date.now();
      lastSettingsUpdatedAtMsRef.current = Math.max(lastSettingsUpdatedAtMsRef.current, u);
      addNotification({
        title: newStatus ? 'Login locked' : 'Login unlocked',
        message: newStatus ? 'Agents cannot log in.' : 'Agents can log in.',
        type: 'success',
      });
    } catch (error) {
      console.error('Error toggling lock:', error);
      addNotification({ title: 'Error', message: 'Failed to update settings.', type: 'error' });
    } finally {
      setTogglingLock(false);
    }
  };

  const pendingPaymentsTotal = useMemo(() => {
    return (adminStats?.agentsStats ?? []).reduce((sum: number, a: any) => sum + (a.pendingPayment ?? 0), 0);
  }, [adminStats]);

  const lowPerformingAgents = useMemo(() => {
    return (adminStats?.agentsStats ?? []).filter(
      (a: any) => a.clientsWithTrade === 0 && (a.activeClients > 0 || (a.pendingPayment ?? 0) > 0)
    );
  }, [adminStats]);

  const sortedAgentRows = useMemo(() => {
    const rows = [...(adminStats?.agentsStats ?? [])];
    rows.sort((a: any, b: any) => {
      let av: number | string;
      let bv: number | string;
      if (sortKey === 'name') {
        av = a.agent.name;
        bv = b.agent.name;
      } else {
        av = Number(a[sortKey] ?? 0);
        bv = Number(b[sortKey] ?? 0);
      }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [adminStats, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir(key === 'name' ? 'asc' : 'desc');
      return key;
    });
  };

  const topTierIds = useMemo(() => {
    const rows = [...(adminStats?.agentsStats ?? [])];
    if (rows.length === 0) return new Set<string>();
    rows.sort((a: any, b: any) => b.receivedPayment - a.receivedPayment);
    const n = Math.min(3, rows.length);
    return new Set(rows.slice(0, n).map((r: any) => r.agent._id as string));
  }, [adminStats]);

  const lowTierIds = useMemo(() => {
    const rows = [...(adminStats?.agentsStats ?? [])];
    if (rows.length < 2) return new Set<string>();
    rows.sort((a: any, b: any) => {
      const ca = a.clientsWithTrade + a.receivedPayment / 1e6;
      const cb = b.clientsWithTrade + b.receivedPayment / 1e6;
      return ca - cb;
    });
    const n = Math.min(3, rows.length);
    return new Set(rows.slice(0, n).map((r: any) => r.agent._id as string));
  }, [adminStats]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto animate-pulse space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-app-surface-hover" />
          ))}
        </div>
        <div className="h-40 rounded-2xl bg-app-surface-hover" />
      </div>
    );
  }

  if (user?.role !== 'admin') {
    return null;
  }

  const alerts: { id: string; tone: 'warn' | 'danger'; text: string }[] = [];
  if ((stats?.overdueFollowUps ?? 0) > 0) {
    alerts.push({
      id: 'overdue',
      tone: 'danger',
      text: `${stats?.overdueFollowUps} leads have overdue follow-ups across the team.`,
    });
  }
  if (pendingPaymentsTotal > 0) {
    alerts.push({
      id: 'payments',
      tone: 'warn',
      text: `₹${pendingPaymentsTotal.toLocaleString()} total pending payments (sum across agents).`,
    });
  }
  lowPerformingAgents.forEach((a: any) => {
    alerts.push({
      id: `low-${a.agent._id}`,
      tone: 'warn',
      text: `${a.agent.name}: no trades yet while there is active/pending payment workload — consider coaching.`,
    });
  });

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-12">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-app-text-muted">Admin</p>
          <h1 className="text-2xl font-bold text-app-text-active mt-1">Command overview</h1>
          <p className="text-sm text-app-text-muted mt-1 max-w-xl">
            KPIs first, then risks, then team performance and revenue — fewer clicks for daily monitoring.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="md" type="button" onClick={() => setCsvOpen(true)}>
            <Upload size={18} />
            Import CSV
          </Button>
          <Button
            variant={settings?.isLocked ? 'danger' : 'success'}
            size="md"
            onClick={() => void toggleOfficeHoursLock()}
            disabled={togglingLock || !settings}
          >
            {settings?.isLocked ? <Lock size={18} /> : <Unlock size={18} />}
            {settings?.isLocked ? 'System locked' : 'System open'}
          </Button>
          <Button variant="primary" size="md" onClick={() => void handleAssignUnassigned()} disabled={assigning}>
            {assigning ? 'Assigning…' : 'Assign unassigned'}
          </Button>
          <Link to="/command-center">
            <Button variant="secondary" size="md" type="button">
              Command center
            </Button>
          </Link>
        </div>
      </div>

      {csvOpen ? (
        <CSVUploadModal onClose={() => setCsvOpen(false)} onSuccess={() => void fetchStats()} />
      ) : null}

      <section aria-label="UPI collection accounts">
        <Card>
          <CardHeader
            title="UPI / collection accounts"
            description="Names shown when agents log a payment with Account: UPI. Add or remove to update the list (saved automatically). Leave empty to use only “Other” on the lead form."
          />
          <div className="flex flex-wrap gap-2 mb-4">
            {collectionLabelDraft.map((item) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-app-border bg-app-root px-3 py-1.5 text-sm font-semibold text-app-text-active"
              >
                {item.label}
                <button
                  type="button"
                  disabled={savingCollectionLabels}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeCollectionLabel(item.id);
                  }}
                  className="inline-flex shrink-0 items-center justify-center min-h-9 min-w-9 -m-1 rounded-md p-1.5 text-rose-400 hover:bg-rose-500/20 disabled:opacity-40 disabled:pointer-events-none"
                  aria-label={`Remove ${item.label}`}
                >
                  <Trash2 size={16} className="pointer-events-none" aria-hidden />
                </button>
              </span>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-bold uppercase tracking-wider text-app-text-muted mb-1">
                New account name
              </label>
              <input
                type="text"
                value={newCollectionLabel}
                onChange={(e) => setNewCollectionLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCollectionLabel())}
                placeholder="e.g. Rahul"
                maxLength={80}
                className="w-full px-4 py-2 bg-app-root border border-app-border rounded-xl text-app-text-active outline-none focus:border-blue-500/60"
              />
            </div>
            <Button variant="secondary" type="button" onClick={addCollectionLabel} disabled={!newCollectionLabel.trim()}>
              <Plus size={18} />
              Add
            </Button>
            <Button
              variant="primary"
              type="button"
              onClick={() => void saveCollectionLabels()}
              disabled={savingCollectionLabels}
            >
              <Wallet size={18} />
              {savingCollectionLabels ? 'Saving…' : 'Save list'}
            </Button>
          </div>
        </Card>
      </section>

      <section aria-label="Daily trade names">
        <Card>
          <CardHeader
            title="Today's trade names (UTC day)"
            description="Agents see these in a dropdown on “Add Daily Trade Log” for today only (UTC). Add Trade 1, Trade 2, etc., then save. Leave empty to allow logging without a named slot."
          />
          <div className="flex flex-wrap gap-2 mb-4">
            {dailyTradeSlotsDraft.map((label, idx) => (
              <span
                key={`${label}-${idx}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-app-border bg-app-root px-3 py-1.5 text-sm font-semibold text-app-text-active"
              >
                {label}
                <button
                  type="button"
                  onClick={() => removeDailyTradeSlot(idx)}
                  className="rounded p-0.5 text-rose-400 hover:bg-rose-500/20"
                  aria-label={`Remove ${label}`}
                >
                  <Trash2 size={14} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-bold uppercase tracking-wider text-app-text-muted mb-1">
                New trade name
              </label>
              <input
                type="text"
                value={newDailyTradeSlot}
                onChange={(e) => setNewDailyTradeSlot(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDailyTradeSlot())}
                placeholder="e.g. Trade 1"
                maxLength={80}
                className="w-full px-4 py-2 bg-app-root border border-app-border rounded-xl text-app-text-active outline-none focus:border-blue-500/60"
              />
            </div>
            <Button variant="secondary" type="button" onClick={addDailyTradeSlot} disabled={!newDailyTradeSlot.trim()}>
              <Plus size={18} />
              Add
            </Button>
            <Button variant="primary" type="button" onClick={() => void saveDailyTradeSlots()} disabled={savingDailySlots}>
              <TrendingUp size={18} />
              {savingDailySlots ? 'Saving…' : 'Save for today'}
            </Button>
          </div>
        </Card>
      </section>

      <section aria-label="Team performance period" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-app-border bg-app-surface/60 px-4 py-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-app-text-muted">Team metrics period</p>
          <p className="text-sm text-app-text-muted mt-0.5">
            Received, trades, and buy qty follow the selected range (UTC). Pending is all open pending per agent (not tied to the period). Active = current pipeline snapshot.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-app-border p-1 bg-app-root">
            {(['all', 'month', 'day'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setStatsPeriod(p)}
                className={cn(
                  'px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors',
                  statsPeriod === p
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-app-text-muted hover:text-app-text-active hover:bg-app-surface-hover/80'
                )}
              >
                {p === 'all' ? 'All time' : p === 'month' ? 'Monthly' : 'Daily'}
              </button>
            ))}
          </div>
          {adminStats?.periodLabel ? (
            <span className="text-xs font-medium text-emerald-400/90 tabular-nums">{adminStats.periodLabel}</span>
          ) : null}
        </div>
      </section>

      <section aria-label="Key performance indicators">
        <CardHeader title="KPIs" description="Snapshot of pipeline health" className="mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Total leads" value={stats?.totalLeads ?? 0} icon={BarChart3} accentClass="bg-blue-600" />
          <KpiCard title="Status updates today" value={stats?.callsToday ?? 0} icon={Phone} accentClass="bg-cyan-600" />
          <KpiCard title="Conversions" value={stats?.convertedCount ?? 0} icon={TrendingUp} accentClass="bg-emerald-600" />
          <KpiCard
            title={
              statsPeriod === 'day'
                ? 'Revenue (UTC day)'
                : statsPeriod === 'month'
                  ? 'Revenue (UTC month)'
                  : 'Revenue (all time)'
            }
            value={`₹${(adminStats?.totalRevenueInPeriod ?? adminStats?.totalMonthlyCollection ?? 0).toLocaleString()}`}
            icon={IndianRupee}
            accentClass="bg-violet-600"
          />
        </div>
      </section>

      {alerts.length > 0 && (
        <Card>
          <CardHeader title="Alerts" description="Items that usually need a decision today" />
          <ul className="space-y-2">
            {alerts.map((a) => (
              <li
                key={a.id}
                className={cn(
                  'flex gap-3 rounded-xl border px-4 py-3 text-sm',
                  a.tone === 'danger' ? 'border-rose-500/40 bg-rose-950/20 text-rose-100' : 'border-amber-500/35 bg-amber-950/20 text-amber-100'
                )}
              >
                <AlertTriangle className="shrink-0 mt-0.5 opacity-80" size={18} />
                {a.text}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section aria-label="Revenue tracking">
        <Card>
          <CardHeader
            title="Revenue"
            description={
              statsPeriod === 'all'
                ? 'Received payments, company-wide (all time)'
                : statsPeriod === 'month'
                  ? 'Received payments this UTC calendar month (company-wide)'
                  : 'Received payments today (UTC calendar day, company-wide)'
            }
            action={
              <span className="text-lg font-black text-emerald-400 tabular-nums">
                ₹{(adminStats?.totalRevenueInPeriod ?? adminStats?.totalMonthlyCollection ?? 0).toLocaleString()}
              </span>
            }
          />
          <p className="text-sm text-app-text-muted">
            Per-agent received uses the period above; pending shows total outstanding. Use Command Center for more drill-downs.
          </p>
        </Card>
      </section>

      <section aria-label="Agent performance">
        <Card padding={false} className="overflow-hidden">
          <div className="p-6 border-b border-app-border">
            <CardHeader
              title="Agent performance"
              description="Sort columns — top tier (received) and watch list (low activity) use the selected period (UTC for daily/monthly). Active = clients marked active now."
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-app-border bg-app-root/50 text-left text-xs font-bold uppercase tracking-wider text-app-text-muted">
                  <th className="px-6 py-3">
                    <button
                      type="button"
                      onClick={() => toggleSort('name')}
                      className="inline-flex items-center gap-1 hover:text-app-text-active"
                    >
                      Agent <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-4 py-3 tabular-nums">
                    <button type="button" onClick={() => toggleSort('activeClients')} className="inline-flex items-center gap-1 hover:text-app-text-active">
                      Active <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-4 py-3 tabular-nums">
                    <button type="button" onClick={() => toggleSort('clientsWithTrade')} className="inline-flex items-center gap-1 hover:text-app-text-active">
                      Trades <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-4 py-3 tabular-nums">
                    <button type="button" onClick={() => toggleSort('totalBuyQuantity')} className="inline-flex items-center gap-1 hover:text-app-text-active">
                      Buy qty <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-4 py-3 tabular-nums">
                    <button type="button" onClick={() => toggleSort('pendingPayment')} className="inline-flex items-center gap-1 hover:text-app-text-active">
                      Pending ₹ <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-4 py-3 tabular-nums">
                    <button type="button" onClick={() => toggleSort('receivedPayment')} className="inline-flex items-center gap-1 hover:text-app-text-active">
                      Received ₹ <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-6 py-3 w-36">Tier</th>
                  <th className="px-6 py-3 w-28" />
                </tr>
              </thead>
              <tbody>
                {sortedAgentRows.map((row: any) => {
                  const isTop = topTierIds.has(row.agent._id);
                  const isLow = lowTierIds.has(row.agent._id) && !isTop;
                  return (
                  <tr
                    key={row.agent._id}
                    className={`border-b border-app-border/80 hover:bg-app-surface-hover/60 transition-colors ${
                      isTop ? 'bg-emerald-950/15' : isLow ? 'bg-amber-950/10' : ''
                    }`}
                  >
                    <td className="px-6 py-3 font-semibold text-app-text-active">{row.agent.name}</td>
                    <td className="px-4 py-3 tabular-nums text-app-text">{row.activeClients}</td>
                    <td className="px-4 py-3 tabular-nums text-app-text">{row.clientsWithTrade}</td>
                    <td className="px-4 py-3 tabular-nums text-app-text">{row.totalBuyQuantity}</td>
                    <td className="px-4 py-3 tabular-nums text-amber-400/90">₹{row.pendingPayment.toLocaleString()}</td>
                    <td className="px-4 py-3 tabular-nums text-emerald-400/90">₹{row.receivedPayment.toLocaleString()}</td>
                    <td className="px-6 py-3">
                      {isTop ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-emerald-400">
                          <Star size={12} /> Top
                        </span>
                      ) : isLow ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-amber-400">
                          <TrendingDown size={12} /> Watch
                        </span>
                      ) : (
                        <span className="text-app-text-muted text-[10px]">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <Link
                        to={`/agents/${row.agent._id}/summary`}
                        className="text-xs font-bold uppercase tracking-wider text-blue-400 hover:text-blue-300"
                      >
                        Drill down
                      </Link>
                    </td>
                  </tr>
                );})}
              </tbody>
            </table>
            {(adminStats?.agentsStats ?? []).length === 0 ? (
              <p className="p-6 text-center text-app-text-muted text-sm">No agent rows yet.</p>
            ) : null}
          </div>
        </Card>
      </section>
    </div>
  );
};
