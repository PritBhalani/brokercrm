import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api.ts';
import { Card, CardHeader } from '../components/ui/Card.tsx';
import { RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/Button.tsx';
import { format } from 'date-fns';

export const Payments: React.FC = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'Pending' | 'Received'>('all');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const params = filter === 'all' ? {} : { status: filter };
      const res = await api.get('/admin/payments', { params });
      setPayments(res.data.payments ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [filter]);

  const totals = useMemo(() => {
    let pending = 0;
    let received = 0;
    for (const p of payments) {
      if (p.status === 'Pending') pending += Number(p.amount) || 0;
      if (p.status === 'Received') received += Number(p.amount) || 0;
    }
    return { pending, received };
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

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-app-text-muted">Finance</p>
          <h1 className="text-2xl font-bold text-app-text-active mt-1">Payments</h1>
          <p className="text-sm text-app-text-muted mt-1">
            Received vs pending; pending rows show expected clearance when agents enter date/time.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="px-3 py-2 rounded-xl bg-app-root border border-app-border text-sm text-app-text"
          >
            <option value="all">All</option>
            <option value="Pending">Pending</option>
            <option value="Received">Received</option>
          </select>
          <Button variant="secondary" size="md" type="button" onClick={() => void load()}>
            <RefreshCw size={16} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <p className="text-xs font-bold uppercase text-app-text-muted">Pending total (filtered)</p>
          <p className="text-2xl font-black text-amber-400 mt-1 tabular-nums">₹{totals.pending.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs font-bold uppercase text-app-text-muted">Received total (filtered)</p>
          <p className="text-2xl font-black text-emerald-400 mt-1 tabular-nums">₹{totals.received.toLocaleString()}</p>
        </Card>
      </div>

      <Card padding={false} className="overflow-hidden">
        <div className="p-6 border-b border-app-border">
          <CardHeader title="Ledger" description="Collection method + UPI label when provided" />
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <p className="p-8 text-center text-app-text-muted">Loading…</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-app-border bg-app-root/50 text-left text-xs font-bold uppercase tracking-wider text-app-text-muted">
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Agent</th>
                  <th className="px-4 py-3 tabular-nums">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Method / UPI</th>
                  <th className="px-4 py-3">Expected clearance</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p._id} className="border-b border-app-border/80 hover:bg-app-surface-hover/50">
                    <td className="px-4 py-3 font-medium text-app-text-active">
                      {p.leadId?.name ?? '—'}
                      <span className="block text-[10px] text-app-text-muted font-normal">{p.leadId?.phone}</span>
                    </td>
                    <td className="px-4 py-3 text-app-text">{p.agentId?.name ?? '—'}</td>
                    <td className="px-4 py-3 tabular-nums text-app-text-active">₹{Number(p.amount).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          p.status === 'Received' ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'
                        }
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="text-app-text">{p.accountUsed}</span>
                      {p.collectionAccountLabel ? (
                        <span className="block text-violet-400 mt-0.5">UPI: {p.collectionAccountLabel}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-app-text">{formatClearance(p)}</td>
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
                ))}
              </tbody>
            </table>
          )}
          {!loading && payments.length === 0 ? (
            <p className="p-8 text-center text-app-text-muted text-sm">No payments yet.</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
};
