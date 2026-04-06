import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api.ts';
import { Card, CardHeader } from '../components/ui/Card.tsx';
import { RefreshCw, Clock, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/Button.tsx';
import { format } from 'date-fns';

function formatLogged(p: any) {
  const d = p.updatedAt || p.createdAt || p.date;
  if (!d) return '—';
  try {
    return format(new Date(d), 'MMM d, yyyy HH:mm');
  } catch {
    return '—';
  }
}

type AgentOption = { _id: string; name: string; email?: string };

type PaymentsProps = { view: 'pending' | 'received' };

export const Payments: React.FC<PaymentsProps> = ({ view }) => {
  const [payments, setPayments] = useState<any[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [agentId, setAgentId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const loadAgents = useCallback(async () => {
    try {
      const res = await api.get('/users/agents');
      setAgents(Array.isArray(res.data) ? res.data : []);
    } catch {
      setAgents([]);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {
        status: view === 'pending' ? 'Pending' : 'Received',
      };
      if (agentId.trim()) params.agentId = agentId.trim();
      const res = await api.get('/admin/payments', { params });
      setPayments(res.data.payments ?? []);
    } catch (e) {
      console.error(e);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [view, agentId]);

  useEffect(() => {
    void loadAgents();
  }, [loadAgents]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = useMemo(() => {
    let sum = 0;
    for (const p of payments) sum += Number(p.amount) || 0;
    return sum;
  }, [payments]);

  const formatClearance = (p: any) => {
    if (p.status !== 'Pending') return '—';
    if (p.expectedClearanceAt) {
      return format(new Date(p.expectedClearanceAt), 'MMM d, yyyy HH:mm');
    }
    if (p.expectedDate) {
      return format(new Date(p.expectedDate), 'MMM d, yyyy');
    }
    return '—';
  };

  const isPending = view === 'pending';

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-app-text-muted">Finance</p>
          <h1 className="text-2xl font-bold text-app-text-active mt-1 flex items-center gap-2">
            {isPending ? (
              <>
                <Clock className="text-amber-400 shrink-0" size={28} />
                Pending payments
              </>
            ) : (
              <>
                <CheckCircle2 className="text-emerald-400 shrink-0" size={28} />
                Received payments
              </>
            )}
          </h1>
          <p className="text-sm text-app-text-muted mt-1">
            {isPending
              ? 'Money not yet cleared — filter by agent to review a single rep.'
              : 'Cleared collections — filter by agent to see totals for one person.'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <label className="flex flex-col gap-1 min-w-[200px]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-app-text-muted">Agent</span>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="px-3 py-2 rounded-xl bg-app-root border border-app-border text-sm text-app-text-active font-medium"
            >
              <option value="">All agents</option>
              {agents.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <Button variant="secondary" size="md" type="button" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <p className="text-xs font-bold uppercase text-app-text-muted">
          {isPending ? 'Pending total (filtered)' : 'Received total (filtered)'}
        </p>
        <p
          className={`text-3xl font-black mt-1 tabular-nums ${isPending ? 'text-amber-400' : 'text-emerald-400'}`}
        >
          ₹{total.toLocaleString()}
        </p>
        <p className="text-xs text-app-text-muted mt-1">
          {payments.length} payment{payments.length !== 1 ? 's' : ''}
          {agentId ? ` · agent filter` : ''}
        </p>
      </Card>

      <Card padding={false} className={`overflow-hidden ${isPending ? 'border-amber-500/25' : 'border-emerald-500/25'}`}>
        <div className={`p-6 border-b border-app-border ${isPending ? 'bg-amber-500/5' : 'bg-emerald-500/5'}`}>
          <CardHeader
            title="Ledger"
            description={
              isPending
                ? 'Expected clearance when agents set date/time.'
                : 'Logged time is last update (or created).'
            }
          />
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <p className="p-8 text-center text-app-text-muted">Loading…</p>
          ) : payments.length === 0 ? (
            <p className="p-8 text-center text-app-text-muted text-sm">
              No {isPending ? 'pending' : 'received'} payments{agentId ? ' for this agent' : ''}.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-app-border bg-app-root/50 text-left text-xs font-bold uppercase tracking-wider text-app-text-muted">
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Agent</th>
                  <th className="px-4 py-3 tabular-nums">Amount</th>
                  <th className="px-4 py-3">Method / UPI</th>
                  {isPending ? (
                    <th className="px-4 py-3">Expected clearance</th>
                  ) : (
                    <th className="px-4 py-3">Logged</th>
                  )}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const clientName =
                    p.leadId?.name != null && String(p.leadId.name).trim() !== ''
                      ? String(p.leadId.name)
                      : p.leadId?._id
                        ? 'Lead removed'
                        : '—';
                  return (
                  <tr key={p._id} className="border-b border-app-border/80 hover:bg-app-surface-hover/50">
                    <td className="px-4 py-3 font-medium text-app-text-active">
                      {clientName}
                      <span className="block text-[10px] text-app-text-muted font-normal">{p.leadId?.phone ?? ''}</span>
                    </td>
                    <td className="px-4 py-3 text-app-text">{p.agentId?.name ?? '—'}</td>
                    <td className="px-4 py-3 tabular-nums text-app-text-active">₹{Number(p.amount).toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className="text-app-text">{p.accountUsed ?? '—'}</span>
                      {p.collectionAccountLabel ? (
                        <span className="block text-violet-400 mt-0.5">UPI: {p.collectionAccountLabel}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-app-text">
                      {isPending ? formatClearance(p) : formatLogged(p)}
                    </td>
                    <td className="px-4 py-3">
                      {p.leadId?._id ? (
                        <Link
                          to={`/leads/${p.leadId._id}`}
                          className="text-xs font-bold uppercase text-blue-400 hover:text-blue-300"
                        >
                          Lead
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
};
