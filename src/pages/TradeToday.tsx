import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api.ts';
import { useNotifications } from '../context/NotificationContext.tsx';
import { Card, CardHeader } from '../components/ui/Card.tsx';
import { Button } from '../components/ui/Button.tsx';
import { TrendingUp, XCircle, Phone, ExternalLink, RefreshCw } from 'lucide-react';
import { formatLeadStatus } from '../lib/leadStatusDisplay.ts';

type QueueItem = {
  _id: string;
  name: string;
  phone: string;
  status: string;
  isActiveClient?: boolean;
  isFreshTrader?: boolean;
};

type TradedItem = { _id: string; name: string; phone: string; buyQtyToday: number };

export const TradeToday: React.FC = () => {
  const { addNotification } = useNotifications();
  const navigate = useNavigate();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [tradedToday, setTradedToday] = useState<TradedItem[]>([]);
  const [utcDate, setUtcDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/leads/agent/trade-queue');
      setQueue(res.data.queue ?? []);
      setTradedToday(res.data.tradedToday ?? []);
      setUtcDate(res.data.utcDate ?? '');
    } catch (e: any) {
      addNotification({
        title: 'Error',
        message: e?.response?.data?.message ?? 'Could not load trade queue.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    void load();
  }, [load]);

  const skipNoTrade = async (leadId: string) => {
    const note = window.prompt('Optional note (why no trade today):', '');
    if (note === null) return;
    setBusyId(leadId);
    try {
      await api.post(`/leads/${leadId}/trade-skip`, { note: note || undefined });
      addNotification({ title: 'Recorded', message: 'No trade logged for today.', type: 'success' });
      await load();
    } catch (e: any) {
      addNotification({
        title: 'Error',
        message: e?.response?.data?.message ?? 'Failed to record.',
        type: 'error',
      });
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto animate-pulse space-y-4">
        <div className="h-10 w-48 bg-app-surface-hover rounded-lg" />
        <div className="h-64 bg-app-surface-hover rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-app-text-muted">Daily trade run</p>
          <h1 className="text-2xl font-bold text-app-text-active mt-1">Today&apos;s trade list</h1>
          <p className="text-sm text-app-text-muted mt-1">
            UTC day <strong>{utcDate}</strong>. Includes <strong>paid clients</strong> from the day after they become paid
            (ongoing daily), plus other active / pipeline clients. Log a <strong>buy trade</strong> or{' '}
            <strong>no trade today</strong>. After a trade, log payment on the lead.
          </p>
        </div>
        <Button variant="secondary" size="md" type="button" onClick={() => void load()}>
          <RefreshCw size={16} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader
          title="Still need action"
          description={`${queue.length} client(s) — log buy trade or mark no trade`}
        />
        {queue.length === 0 ? (
          <p className="text-app-text-muted text-sm py-6 text-center">All caught up for today.</p>
        ) : (
          <ul className="space-y-3">
            {queue.map((l) => (
              <li
                key={l._id}
                className="flex flex-col gap-3 rounded-xl border border-app-border bg-app-root/50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-bold text-app-text-active">{l.name}</p>
                  <p className="text-xs text-app-text-muted flex items-center gap-2 mt-1">
                    <Phone size={12} /> {l.phone}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-app-text-muted mt-1">
                    {formatLeadStatus(l.status)}
                    {l.isActiveClient ? ' · Active' : ''}
                    {l.isFreshTrader ? ' · FT' : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    type="button"
                    onClick={() => navigate(`/leads/${l._id}`, { state: { scrollToTrade: true } })}
                  >
                    <TrendingUp size={14} />
                    Log buy trade
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    disabled={busyId === l._id}
                    onClick={() => skipNoTrade(l._id)}
                  >
                    <XCircle size={14} />
                    No trade today
                  </Button>
                  <Link to={`/leads/${l._id}`}>
                    <Button variant="ghost" size="sm" type="button" className="border border-app-border">
                      <ExternalLink size={14} />
                      Open
                    </Button>
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Already traded today (buy qty)" description="Review or add payment on the lead record" />
        {tradedToday.length === 0 ? (
          <p className="text-app-text-muted text-sm py-4 text-center">No buy trades logged yet today.</p>
        ) : (
          <ul className="divide-y divide-app-border">
            {tradedToday.map((t) => (
              <li key={t._id} className="py-3 flex justify-between items-center gap-2">
                <div>
                  <span className="font-semibold text-app-text-active">{t.name}</span>
                  <span className="text-xs text-app-text-muted ml-2">{t.phone}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-emerald-400 font-mono tabular-nums">Qty {t.buyQtyToday}</span>
                  <Link
                    to={`/leads/${t._id}`}
                    className="text-xs font-bold uppercase text-blue-400 hover:text-blue-300"
                  >
                    Payment
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};
