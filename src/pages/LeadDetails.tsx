import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { useNotifications } from '../context/NotificationContext.tsx';
import { 
  ArrowLeft, 
  Phone, 
  Mail, 
  Calendar, 
  MessageSquare, 
  History,
  Save,
  User as UserIcon,
  TrendingUp,
  Tag
} from 'lucide-react';
import { format } from 'date-fns';
import api from '../services/api.ts';
import { canConvertForRole, getConversionBlockReason } from '../lib/leadRules.ts';
import { formatLeadStatus } from '../lib/leadStatusDisplay.ts';

interface LeadDetailsProps {
  inlineId?: string;
}

export const LeadDetails: React.FC<LeadDetailsProps> = ({ inlineId }) => {
  const params = useParams();
  const id = inlineId || params.id;
  const isInline = !!inlineId;

  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [note, setNote] = useState('');
  const [updating, setUpdating] = useState(false);
  const [addingTrade, setAddingTrade] = useState(false);
  const [tradeCapital, setTradeCapital] = useState('');
  const [tradeBuyQuantity, setTradeBuyQuantity] = useState('');
  const [tradeProfit, setTradeProfit] = useState('');
  const [tradeError, setTradeError] = useState('');
  const [tradeOpen, setTradeOpen] = useState(false);
  const [dailyTradeSlots, setDailyTradeSlots] = useState<string[]>([]);
  const [selectedTradeSlot, setSelectedTradeSlot] = useState('');

  const [addingPayment, setAddingPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('Pending');
  const [paymentAccount, setPaymentAccount] = useState('UPI');
  const [paymentExpectedDate, setPaymentExpectedDate] = useState('');
  const [paymentExpectedClearanceAt, setPaymentExpectedClearanceAt] = useState('');
  const [collectionLabels, setCollectionLabels] = useState<string[]>(['Prit', 'Abhay', 'Pradip']);
  const [paymentUPIHolder, setPaymentUPIHolder] = useState('Prit');
  const [paymentUPIOther, setPaymentUPIOther] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgent, setSelectedAgent] = useState('');

  const fetchLead = async () => {
    if (!id) return;
    try {
      const response = await api.get(`/leads/${id}`);
      const data = response.data;
      setLead(data);
      setStatus(data.status);
      setSelectedAgent(data.assignedAgent?._id || data.assignedAgent || '');
      if (data.nextFollowUpDate) {
        setNextFollowUpDate(new Date(data.nextFollowUpDate).toISOString().split('T')[0]);
      }
    } catch (error) {
      console.error('Error fetching lead:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAgents = async () => {
    try {
      const response = await api.get('/users/agents');
      setAgents(response.data);
    } catch (error) {
      console.error('Error fetching agents:', error);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchAgents();
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/leads/collection-labels');
        const labels: string[] = Array.isArray(res.data?.labels) ? res.data.labels : [];
        if (cancelled || labels.length === 0) return;
        setCollectionLabels(labels);
        setPaymentUPIHolder((prev) => (labels.includes(prev) ? prev : labels[0]));
      } catch {
        /* keep defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/leads/daily-trade-offers');
        const slots: string[] = Array.isArray(res.data?.slots) ? res.data.slots : [];
        if (cancelled) return;
        setDailyTradeSlots(slots);
        setSelectedTradeSlot((prev) => {
          if (slots.length === 0) return '';
          if (prev && slots.includes(prev)) return prev;
          return slots[0];
        });
      } catch {
        if (!cancelled) setDailyTradeSlots([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    fetchLead();
    // Reset panels when lead changes
    setTradeOpen(false);
    setPaymentOpen(false);
    setTradeError('');
    setPaymentError('');
  }, [id]);

  useEffect(() => {
    const st = location.state as { scrollToTrade?: boolean } | null;
    if (st?.scrollToTrade) {
      setTimeout(() => {
        document.getElementById('trade-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);

  // ─── Keyboard shortcuts (split-pane) ────────────────────────────────────────
  useEffect(() => {
    if (!isInline) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        setTradeOpen((v) => !v);
      }
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        setPaymentOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isInline]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !user) return;

    if (status === 'Converted' && !canConvertForRole(lead, user)) {
      addNotification({
        title: 'Cannot convert yet',
        message: getConversionBlockReason(lead, user) ?? 'Conversion requirements not met.',
        type: 'warning',
      });
      return;
    }

    setUpdating(true);
    try {
      await api.patch(`/leads/${id}/status`, {
        status,
        followUpDate: nextFollowUpDate, // Note: backend for status uses followUpDate, we align it inside the payload
        note
      });

      if (status !== lead.status) {
        addNotification({
          title: 'Lead Status Updated',
          message: `Status for ${lead.name} changed to ${formatLeadStatus(status)}`,
          type: 'info'
        });
      }

      setNote('');
      fetchLead();
    } catch (error: any) {
      console.error('Update failed:', error);
      const msg = error?.response?.data?.message;
      if (msg) addNotification({ title: 'Update blocked', message: msg, type: 'error' });
    } finally {
      setUpdating(false);
    }
  };

  const handleAssignAgent = async () => {
    if (!id || !selectedAgent) return;
    setUpdating(true);
    try {
      await api.patch(`/leads/${id}/assign`, { agentId: selectedAgent });
      addNotification({
        title: 'Agent Assigned',
        message: `Lead ${lead.name} has been assigned to a new agent.`,
        type: 'success'
      });
      fetchLead();
    } catch (error) {
      console.error('Assignment failed:', error);
    } finally {
      setUpdating(false);
    }
  };

  const handleAddTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setTradeError('');

    if (!tradeCapital || !tradeBuyQuantity) {
       setTradeError('Capital and Buy Qty are required.');
       return;
    }
    if (dailyTradeSlots.length > 0 && !selectedTradeSlot) {
      setTradeError('Select today\'s trade from the dropdown.');
      return;
    }
    if (Number(tradeCapital) > 500000) {
      if (!window.confirm('Large capital amount detected (> ₹5,00,000). Confirm?')) return;
    }
    
    setAddingTrade(true);
    try {
      const resp = await api.post(`/leads/${id}/trades`, {
        capital: tradeCapital,
        buyQuantity: tradeBuyQuantity,
        profit: tradeProfit,
        ...(dailyTradeSlots.length > 0 && selectedTradeSlot
          ? { tradeSlotName: selectedTradeSlot }
          : {}),
      });
      addNotification({
        title: 'Trade Recorded',
        message: 'Successfully recorded daily trade details.',
        type: 'success'
      });
      
      if (resp.data?.warnings) {
         resp.data.warnings.forEach((w: string) => addNotification({ title: 'Margin Warning', message: w, type: 'warning' }));
      }
      
      setTradeCapital('');
      setTradeBuyQuantity('');
      setTradeProfit('');
      setTradeError('');
      // Optimistically update if needed, but fetchLead works fast
      fetchLead();
    } catch (error: any) {
      console.error('Failed to add trade', error);
      setTradeError(error.response?.data?.message || 'Failed to add trade. Ensure inputs are valid.');
    } finally {
      setAddingTrade(false);
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setPaymentError('');

    if (!paymentAmount) {
       setPaymentError('Amount is required.');
       return;
    }
    if (Number(paymentAmount) > 200000) {
      if (!window.confirm('Large payment amount detected (> ₹2,00,000). Confirm?')) return;
    }
    if (paymentAccount === 'UPI' && paymentUPIHolder === 'Other' && !paymentUPIOther.trim()) {
      setPaymentError('Enter the UPI / account name for "Other".');
      return;
    }
    if (paymentStatus === 'Pending' && !paymentExpectedDate && !paymentExpectedClearanceAt) {
      setPaymentError('For pending payments, set expected clearance (date or date & time).');
      return;
    }

    const upiLabel =
      paymentAccount === 'UPI'
        ? paymentUPIHolder === 'Other'
          ? paymentUPIOther.trim()
          : paymentUPIHolder
        : '';

    setAddingPayment(true);
    try {
      const resp = await api.post(`/leads/${id}/payments`, {
        amount: paymentAmount,
        status: paymentStatus,
        accountUsed: paymentAccount,
        collectionAccountLabel: upiLabel || undefined,
        expectedDate: paymentExpectedDate || undefined,
        expectedClearanceAt: paymentExpectedClearanceAt || undefined,
      });
      addNotification({
        title: 'Payment Logged',
        message: 'Successfully recorded payment.',
        type: 'success'
      });
      if (resp.data?.warnings) {
         resp.data.warnings.forEach((w: string) => addNotification({ title: 'System Warning', message: w, type: 'warning' }));
      }
      setPaymentAmount('');
      setPaymentStatus('Pending');
      setPaymentAccount('UPI');
      setPaymentExpectedDate('');
      setPaymentExpectedClearanceAt('');
      setPaymentUPIHolder(collectionLabels[0] ?? 'Prit');
      setPaymentUPIOther('');
      setPaymentError('');
      fetchLead();
    } catch (error: any) {
      console.error('Failed to add payment', error);
      setPaymentError(error.response?.data?.message || 'Failed to add payment. Check your inputs.');
    } finally {
      setAddingPayment(false);
    }
  };

  if (loading) return <div className="animate-pulse space-y-8">
    <div className="h-10 w-32 bg-app-surface-hover rounded-lg"></div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 h-96 bg-app-surface-hover rounded-2xl"></div>
      <div className="h-96 bg-app-surface-hover rounded-2xl"></div>
    </div>
  </div>;

  if (!lead) return <div>Lead not found</div>;

  const convertBlocked = status === 'Converted' && user && !canConvertForRole(lead, user);
  const saveBlocked = convertBlocked;

  return (
    <div className="space-y-4 pb-12">
      {!isInline && (
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-app-text-muted hover:text-app-text-active transition-colors group mb-4"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back to Leads</span>
        </button>
      )}

      <div className={`grid grid-cols-1 gap-6 ${!isInline ? 'lg:grid-cols-3' : 'lg:grid-cols-1 text-sm'}`}>
        {/* Main Info */}
        <div className={`${!isInline ? 'lg:col-span-2' : ''} space-y-6`}>
          <div className="bg-app-surface p-6 rounded-xl border border-app-border shadow-sm shadow-black/5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-500/15 text-blue-400 border border-blue-500/25 rounded-xl flex items-center justify-center text-xl font-bold">
                  {lead.name.charAt(0)}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-app-text-active flex items-center gap-3">
                    {lead.name}
                    {lead.isFreshTrader && (
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold border border-emerald-200 uppercase tracking-widest shadow-sm shadow-black/5">
                        FT Tomorrow
                      </span>
                    )}
                  </h1>
                  <p className="text-app-text-muted flex items-center gap-2 mt-1">
                    <Tag size={16} />
                    {lead.investmentInterest || 'General Interest'}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="px-4 py-2 bg-blue-500/10 text-blue-300 rounded-xl text-sm font-bold border border-blue-500/25">
                  {formatLeadStatus(lead.status)}
                </span>
                <span className="text-[10px] text-app-text-muted font-medium max-w-[14rem] text-right leading-tight">
                  Pipeline status is updated in the form below (agents) or by admins here.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 border-y border-app-border text-sm">
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-app-text">
                  <Phone size={16} className="text-app-text-muted" />
                  <span className="font-medium">{lead.phone}</span>
                </div>
                <div className="flex items-center gap-3 text-app-text">
                  <Mail size={16} className="text-app-text-muted" />
                  <span className="font-medium">{lead.email || 'No email provided'}</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-app-text">
                  <UserIcon size={16} className="text-app-text-muted" />
                  <span className="font-medium">Agent: {lead.assignedAgent?.name || 'Unassigned'}</span>
                </div>
                <div className="flex items-center gap-3 text-app-text">
                  <Calendar size={16} className="text-app-text-muted" />
                  <span className="font-medium">Added: {lead.createdAt ? format(new Date(lead.createdAt), 'MMM d, yyyy') : 'N/A'}</span>
                </div>
              </div>
            </div>

            {user?.role === 'admin' && (
              <div className="mt-8">
                <h3 className="text-lg font-bold text-app-text-active mb-4 flex items-center gap-2">
                  <History size={16} className="text-blue-600" />
                  Lineage
                </h3>
                <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-app-surface-hover max-h-48 overflow-y-auto custom-scrollbar pr-2">
                  {lead.activityLog?.slice().reverse().map((log: any, i: number) => (
                    <div key={i} className="relative pl-8">
                      <div className="absolute left-[7px] top-1.5 w-2 h-2 bg-app-surface border-2 border-blue-600 rounded-full z-10"></div>
                      <p className="text-xs font-semibold text-app-text-active">{log.action}</p>
                      <p className="text-[10px] text-app-text-muted mt-0.5">
                        {log.timestamp ? format(new Date(log.timestamp), 'MMM d, HH:mm') : 'N/A'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-app-surface p-6 rounded-xl border border-app-border shadow-sm shadow-black/5">
            <h3 className="text-lg font-bold text-app-text-active mb-4 flex items-center gap-2">
              <MessageSquare size={16} className="text-blue-600" />
              Notes History
            </h3>
            <div className="space-y-4">
              {!lead.notes || lead.notes.length === 0 ? (
                <p className="text-app-text-muted text-sm italic">No notes added yet.</p>
              ) : (
                lead.notes.map((n: any, i: number) => (
                  <div key={i} className="p-4 bg-app-root rounded-xl">
                    <p className="text-sm text-app-text leading-relaxed">{n.text}</p>
                    <p className="text-xs text-app-text-muted mt-2">{n.createdAt ? format(new Date(n.createdAt), 'MMM d, yyyy HH:mm') : 'N/A'}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Action Sidebar / Sticky Forms */}
        <div className="space-y-6 max-w-full">
          
          <button
             onClick={async () => {
               try {
                 const resp = await api.patch(`/leads/${id}/mark-ft`);
                 addNotification({ title: 'Success', message: 'Client marked as Fresh Trader for tomorrow', type: 'success' });
                 if (resp.data?.warnings) {
                    resp.data.warnings.forEach((w: string) => addNotification({ title: 'Activity Warning', message: w, type: 'warning' }));
                 }
                 fetchLead();
               } catch(e: any) {
                 addNotification({ title: 'Error', message: e.response?.data?.message || 'Failed to mark FT', type: 'error' });
               }
             }}
             disabled={lead.isActiveClient}
             className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold rounded-2xl shadow-sm shadow-emerald-950/20 hover:scale-[1.02] active:scale-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
             <TrendingUp size={20} />
             {lead.isActiveClient ? "Already Active Client" : "Mark as Fresh Trader (FT)"}
          </button>

          <div className="bg-app-surface p-8 rounded-2xl border border-app-border shadow-sm shadow-black/5">
            <h3 className="text-lg font-bold text-app-text-active mb-6 flex items-center gap-2">
              <TrendingUp size={20} className="text-blue-600" />
              Pipeline & notes
            </h3>
            <p className="text-xs text-app-text-muted mb-6 -mt-2">
              Choose lead status, add a note if needed, then save. Callback requires a follow-up date.
            </p>
            <form onSubmit={handleUpdate} className="space-y-6">
              {user?.role === 'admin' && (
                <div>
                  <label className="block text-sm font-medium text-app-text mb-2">Assign Agent</label>
                  <div className="flex gap-2">
                    <select
                      value={selectedAgent}
                      onChange={(e) => setSelectedAgent(e.target.value)}
                      className="flex-1 px-4 py-3 bg-app-root border border-app-border rounded-xl focus:ring-2 focus:border-blue-500 focus:ring-1 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                    >
                      <option value="">Unassigned</option>
                      {agents.map(agent => (
                        <option key={agent._id} value={agent._id}>{agent.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAssignAgent}
                      disabled={updating || selectedAgent === (lead.assignedAgent?._id || lead.assignedAgent)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      Assign
                    </button>
                  </div>
                </div>
              )}

              {(user?.role === 'admin' || user?.role === 'agent') && (
                <div>
                  <label className="block text-sm font-medium text-app-text mb-2">Lead status (pipeline)</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-4 py-3 bg-app-root border border-app-border rounded-xl focus:ring-2 focus:border-blue-500 focus:ring-1 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  >
                    <option value="New">New</option>
                    <option value="Interested">Interested</option>
                    <option value="Callback">Callback</option>
                    <option value="Converted" disabled={user ? !canConvertForRole(lead, user) : true}>
                      Paid client
                    </option>
                    <option value="ReadyToWorkTomorrow">Ready to work tomorrow</option>
                  </select>
                </div>
              )}
              {(user?.role === 'admin' || user?.role === 'agent') &&
              status === 'Converted' &&
              user &&
              !canConvertForRole(lead, user) ? (
                <p className="text-xs text-amber-200 bg-amber-950/30 border border-amber-500/25 rounded-lg px-3 py-2">
                  {getConversionBlockReason(lead, user)}
                </p>
              ) : null}
              {user?.role === 'agent' && !canConvertForRole(lead, user) && status !== 'Converted' ? (
                <p className="text-[10px] text-app-text-muted leading-snug">
                  Paid client unlocks after a trade and a received payment (you).
                </p>
              ) : null}

              {status === 'Callback' && (
                <div>
                  <label className="block text-sm font-medium text-app-text mb-2">Pipeline Callback Date</label>
                  <input
                    type="date"
                    required
                    value={nextFollowUpDate}
                    onChange={(e) => setNextFollowUpDate(e.target.value)}
                    className="w-full px-4 py-3 bg-app-root border border-app-border rounded-xl focus:ring-2 focus:border-blue-500 focus:ring-1 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-app-text mb-2">Add Note</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 bg-app-root border border-app-border rounded-xl focus:ring-2 focus:border-blue-500 focus:ring-1 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all resize-none"
                  placeholder="Type your notes here..."
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={updating || saveBlocked}
                title={convertBlocked ? getConversionBlockReason(lead, user!) ?? undefined : undefined}
                className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 shadow-sm shadow-black/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save size={18} />
                {updating ? 'Saving...' : 'Save changes'}
              </button>
            </form>
          </div>

          <div id="trade-section" className="bg-app-surface p-8 rounded-2xl border border-app-border shadow-sm shadow-black/5 mt-8 scroll-mt-24">
            <h3 className="text-lg font-bold text-app-text-active mb-6 flex items-center gap-2">
              <TrendingUp size={20} className="text-blue-600" />
              Add Daily Trade Log
            </h3>
            {lead.trades?.length > 0 && (
              <p className="text-xs text-app-text-muted mb-4">
                Last trade
                {lead.trades[lead.trades.length - 1]?.tradeSlotName
                  ? ` (${lead.trades[lead.trades.length - 1].tradeSlotName})`
                  : ''}
                : profit ₹{lead.trades[lead.trades.length - 1]?.profit ?? 0} — use payment section below to log margin
                / commission after the trade.
              </p>
            )}
            <form onSubmit={handleAddTrade} className="space-y-4">
              {dailyTradeSlots.length > 0 ? (
                <div>
                  <label className="block text-xs font-bold text-app-text-muted uppercase tracking-wider mb-1">
                    Today&apos;s trade (admin list)
                  </label>
                  <select
                    required
                    value={selectedTradeSlot}
                    onChange={(e) => setSelectedTradeSlot(e.target.value)}
                    className="w-full px-4 py-3 bg-app-root border border-app-border rounded-xl text-app-text-active focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  >
                    {dailyTradeSlots.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-app-text-muted mt-1">
                    Names apply to today (UTC) only. Quantity is entered below.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-app-text-muted rounded-xl border border-app-border/80 bg-app-root/80 px-3 py-2">
                  No named trades for today (UTC) yet — admin can add Trade 1, Trade 2, etc. on the dashboard. You can still log capital, qty, and profit.
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-app-text mb-1">Capital (₹)</label>
                  <input type="number" required value={tradeCapital} onChange={e => setTradeCapital(e.target.value)} className="w-full px-4 py-2 bg-app-root border border-app-border rounded-xl focus:border-blue-500 focus:ring-1 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-app-text mb-1">Buy Qty</label>
                  <input type="number" required value={tradeBuyQuantity} onChange={e => setTradeBuyQuantity(e.target.value)} className="w-full px-4 py-2 bg-app-root border border-app-border rounded-xl focus:border-blue-500 focus:ring-1 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-app-text mb-1">Client Profit (₹)</label>
                  <input type="number" value={tradeProfit} onChange={e => setTradeProfit(e.target.value)} className="w-full px-4 py-2 bg-app-root border border-app-border rounded-xl focus:border-blue-500 focus:ring-1 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              
              {tradeError && (
                 <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-500 text-xs font-bold">
                    {tradeError}
                 </div>
              )}

              <button disabled={addingTrade} type="submit" className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 shadow-sm shadow-black/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2">
                <Save size={18} />
                {addingTrade ? 'Saving...' : 'Add Trade Log'}
              </button>
            </form>
          </div>

          <div className="bg-app-surface p-8 rounded-2xl border border-app-border shadow-sm shadow-black/5 mt-8">
            <h3 className="text-lg font-bold text-app-text-active mb-6 flex items-center gap-2">
              <TrendingUp size={20} className="text-emerald-600" />
              Log Financial Payment
            </h3>
            <form onSubmit={handleAddPayment} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-app-text mb-1">Amount Given (₹)</label>
                  <input type="number" required value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className="w-full px-4 py-2 bg-app-root border border-app-border rounded-xl focus:ring-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-app-text mb-1">Account Used</label>
                  <select value={paymentAccount} onChange={e => setPaymentAccount(e.target.value)} className="w-full px-4 py-2 bg-app-root border border-app-border rounded-xl focus:ring-emerald-500 outline-none">
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>
              </div>
              {paymentAccount === 'UPI' && (
                <div>
                  <label className="block text-xs font-medium text-app-text mb-1">UPI / collection account</label>
                  <select
                    value={paymentUPIHolder}
                    onChange={(e) => setPaymentUPIHolder(e.target.value)}
                    className="w-full px-4 py-2 bg-app-root border border-app-border rounded-xl focus:ring-emerald-500 outline-none mb-2"
                  >
                    {collectionLabels.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                    <option value="Other">Other</option>
                  </select>
                  {paymentUPIHolder === 'Other' && (
                    <input
                      type="text"
                      placeholder="Name or UPI id"
                      value={paymentUPIOther}
                      onChange={(e) => setPaymentUPIOther(e.target.value)}
                      className="w-full px-4 py-2 bg-app-root border border-app-border rounded-xl focus:ring-emerald-500 outline-none text-sm"
                    />
                  )}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-app-text mb-1">Status</label>
                <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)} className="w-full px-4 py-2 bg-app-root border border-app-border rounded-xl focus:ring-emerald-500 outline-none">
                  <option value="Pending">Pending</option>
                  <option value="Received">Received</option>
                </select>
              </div>
              {paymentStatus === 'Pending' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-app-text mb-1">Expected clearance (date)</label>
                    <input
                      type="date"
                      value={paymentExpectedDate}
                      onChange={(e) => setPaymentExpectedDate(e.target.value)}
                      className="w-full px-4 py-2 bg-app-root border border-app-border rounded-xl focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-app-text mb-1">Or date &amp; time</label>
                    <input
                      type="datetime-local"
                      value={paymentExpectedClearanceAt}
                      onChange={(e) => setPaymentExpectedClearanceAt(e.target.value)}
                      className="w-full px-4 py-2 bg-app-root border border-app-border rounded-xl focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>
              )}
              
              {paymentError && (
                 <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-500 text-xs font-bold">
                    {paymentError}
                 </div>
              )}

              <button disabled={addingPayment} type="submit" className="w-full py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 shadow-sm shadow-black/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2">
                <Save size={18} />
                {addingPayment ? 'Saving...' : 'Add Payment'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
