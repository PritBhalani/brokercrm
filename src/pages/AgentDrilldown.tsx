import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api.ts';
import { ArrowLeft, Users, TrendingUp, DollarSign, Activity, Lock } from 'lucide-react';

export const AgentDrilldown: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const response = await api.get(`/admin/agent/${id}/summary`);
        setData(response.data);
      } catch (error) {
        console.error('Failed to fetch agent summary', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, [id]);

  if (loading) return (
    <div className="-m-8 min-h-[calc(100vh-4rem)] bg-slate-950 flex items-center justify-center">
      <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!data) return <div>Data not found</div>;

  // Calculate KPIs
  const totalBuyQty = data.tradesToday.reduce((sum: number, t: any) => sum + (t.buyQuantity || 0), 0);
  const totalReceived = data.payments.received.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
  const totalPending = data.payments.pending.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

  const bought = data.clientList?.bought?.length ?? 0;
  const passed = data.clientList?.notBought?.length ?? 0;

  return (
    <div className="-m-8 min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-300 p-8 font-mono">
      <div className="max-w-[1600px] mx-auto space-y-6">
        
        {/* Header & Lock */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
           <div>
             <button 
               onClick={() => navigate(-1)}
               className="flex items-center gap-2 text-slate-500 hover:text-slate-300 transition-colors group mb-2"
             >
               <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
               <span className="text-xs uppercase tracking-widest font-bold">Back to Command Center</span>
             </button>
             <h1 className="text-3xl font-black text-white flex items-center gap-3">
               <Activity className="text-blue-500" />
               {data.agent.name}
             </h1>
           </div>
           
           <div className="flex items-center gap-2 bg-amber-500/10 text-amber-500 px-3 py-1.5 rounded-lg border border-amber-500/20 shadow-sm text-sm font-bold uppercase tracking-widest">
             <Lock size={16} /> Locked to Today
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Summary API insights (today)</p>
            <p className="text-sm text-slate-300 leading-relaxed">
              <strong className="text-emerald-400">{bought}</strong> clients with trades today ·{' '}
              <strong className="text-rose-400">{passed}</strong> assigned without a trade today. Use this to spot execution gaps
              at a glance.
            </p>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-wrap gap-4 justify-between items-center">
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold">Received vs pending</p>
              <p className="text-lg font-black text-emerald-400 mt-1">₹{totalReceived.toLocaleString()}</p>
              <p className="text-xs text-slate-500">pending ₹{totalPending.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-500 uppercase font-bold">Buy qty (today)</p>
              <p className="text-lg font-black text-amber-400 mt-1">{totalBuyQty.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* TOP KPI BAR */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Total Buy Qty</p>
                <p className="text-2xl font-black text-amber-400">{totalBuyQty.toLocaleString()}</p>
              </div>
              <TrendingUp className="text-amber-500/20" size={40} />
           </div>
           <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Total Received</p>
                <p className="text-2xl font-black text-emerald-400">₹{totalReceived.toLocaleString()}</p>
              </div>
              <DollarSign className="text-emerald-500/20" size={40} />
           </div>
           <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Total Pending</p>
                <p className="text-2xl font-black text-rose-400">₹{totalPending.toLocaleString()}</p>
              </div>
              <DollarSign className="text-rose-500/20" size={40} />
           </div>
        </div>

        {/* 2-COLUMN OPERATION FLOW */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* COLUMN 1: CLIENTS (BOUGHT VS PASSED) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col h-[calc(100vh-18rem)] overflow-hidden">
             <div className="p-4 border-b border-slate-800 bg-slate-950/50">
               <h3 className="text-sm font-black uppercase tracking-widest text-slate-300 flex items-center gap-2">
                 <Users size={16} className="text-indigo-500" />
                 Client Activity
               </h3>
             </div>
             <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                
                {/* Bought Today */}
                <div>
                  <h4 className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-emerald-500 mb-3 border-b border-emerald-500/20 pb-2">
                    <span>Bought Today</span>
                    <span className="bg-emerald-500/20 px-2 py-0.5 rounded">{data.clientList.bought.length}</span>
                  </h4>
                  <div className="space-y-2">
                    {data.clientList.bought.length === 0 ? <p className="text-[10px] text-slate-600 italic">None</p> : 
                      data.clientList.bought.map((client: any) => (
                        <div key={client._id} onClick={() => navigate(`/leads/${client._id}`)} className="flex items-center justify-between p-3 bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/10 rounded-lg cursor-pointer transition-colors group">
                           <span className="font-bold text-sm text-emerald-200 group-hover:text-emerald-100">{client.name}</span>
                        </div>
                      ))
                    }
                  </div>
                </div>

                {/* Not Bought Today (Passed) */}
                <div>
                  <h4 className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-rose-500 mb-3 border-b border-rose-500/20 pb-2">
                    <span>Passed</span>
                    <span className="bg-rose-500/20 px-2 py-0.5 rounded">{data.clientList.notBought.length}</span>
                  </h4>
                  <div className="space-y-2">
                    {data.clientList.notBought.length === 0 ? <p className="text-[10px] text-slate-600 italic">None</p> : 
                      data.clientList.notBought.map((client: any) => (
                        <div key={client._id} onClick={() => navigate(`/leads/${client._id}`)} className="flex items-center justify-between p-3 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 rounded-lg cursor-pointer transition-colors group">
                           <span className="font-bold text-sm text-rose-200 group-hover:text-rose-100">{client.name}</span>
                        </div>
                      ))
                    }
                  </div>
                </div>

             </div>
          </div>

          {/* COLUMN 2: THE LEDGER (TRADES & PAYMENTS COMBINED) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col h-[calc(100vh-18rem)] overflow-hidden">
             <div className="p-4 border-b border-slate-800 bg-slate-950/50">
               <h3 className="text-sm font-black uppercase tracking-widest text-slate-300 flex items-center gap-2">
                 <DollarSign size={16} className="text-amber-500" />
                 Action Ledger
               </h3>
             </div>
             <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                
                {/* Trades */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-3 border-b border-blue-500/20 pb-2">Trades Booked</h4>
                  <div className="space-y-2">
                    {data.tradesToday.length === 0 ? <p className="text-[10px] text-slate-600 italic">No trades today.</p> : 
                      data.tradesToday.map((trade: any, idx: number) => (
                        <div key={idx} className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                           <div className="flex justify-between items-start mb-1">
                             <span className="font-bold text-blue-300 cursor-pointer hover:underline text-sm" onClick={() => navigate(`/leads/${trade.leadId}`)}>{trade.leadName}</span>
                             <span className="text-xs font-bold text-blue-400 text-right">+₹{trade.commission || trade.profit || 0}</span>
                           </div>
                           <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Qty: {trade.buyQuantity} | Cap: ₹{trade.capital}</p>
                        </div>
                      ))
                    }
                  </div>
                </div>

                {/* Payments */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-500 mb-3 border-b border-emerald-500/20 pb-2">Payments Logged</h4>
                  <div className="space-y-2">
                    {[...data.payments.received, ...data.payments.pending].length === 0 ? <p className="text-[10px] text-slate-600 italic">No payments today.</p> : 
                      [...data.payments.received, ...data.payments.pending].map((p: any, idx: number) => {
                         const isReceived = p.status === 'Received';
                         return (
                           <div key={idx} className={`p-3 border rounded-lg ${isReceived ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20'}`}>
                             <div className="flex justify-between items-start mb-1">
                               <span className={`font-bold hover:underline cursor-pointer text-sm ${isReceived ? 'text-emerald-300' : 'text-rose-300'}`} onClick={() => navigate(`/leads/${p.leadId._id}`)}>{p.leadId.name}</span>
                               <span className={`text-xs font-bold ${isReceived ? 'text-emerald-400' : 'text-rose-400'}`}>₹{p.amount} ({p.status})</span>
                             </div>
                             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Via {p.accountUsed}</p>
                           </div>
                         )
                      })
                    }
                  </div>
                </div>

             </div>
          </div>

        </div>
      </div>
    </div>
  );
};
