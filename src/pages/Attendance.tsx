import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Calendar, UserCheck, Clock, CalendarDays } from 'lucide-react';
import api from '../services/api.ts';

export const Attendance: React.FC = () => {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/admin/attendance?month=${month}&year=${year}`);
      setAttendance(res.data);
    } catch (err) {
      console.error('Failed to fetch attendance', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchAttendance();
    }
  }, [month, year, user]);

  if (user?.role !== 'admin') {
    return <div className="p-8 text-center text-red-500 font-bold">Unauthorized</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-app-border pb-6">
        <div>
          <h1 className="text-2xl font-bold text-app-text-active flex items-center gap-2">
            <CalendarDays className="text-blue-600" /> Agent Attendance
          </h1>
          <p className="text-app-text-muted text-sm mt-1">View monthly attendance records for all agents</p>
        </div>
        <div className="flex gap-4">
          <select 
            value={month} 
            onChange={(e) => setMonth(Number(e.target.value))}
            className="px-4 py-2 border border-app-border rounded-xl focus:ring-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-medium"
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('en', { month: 'long' })}</option>
            ))}
          </select>
          <select 
            value={year} 
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-4 py-2 border border-app-border rounded-xl focus:ring-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-medium"
          >
            {[2024, 2025, 2026, 2027].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-app-surface-hover rounded-xl"></div>)}
        </div>
      ) : attendance.length === 0 ? (
        <div className="bg-app-surface p-12 rounded-2xl border border-app-border text-center">
          <UserCheck size={48} className="mx-auto text-app-text-muted mb-4" />
          <h3 className="text-lg font-bold text-app-text-active">No Records Found</h3>
          <p className="text-app-text-muted">No attendance data exists for this month.</p>
        </div>
      ) : (
        <div className="bg-app-surface rounded-2xl border border-app-border overflow-hidden shadow-sm shadow-black/5">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-app-root border-b border-app-border text-sm font-semibold text-app-text text-transform uppercase tracking-wider">
                  <th className="p-4">Date</th>
                  <th className="p-4">Agent Name</th>
                  <th className="p-4">Login Time</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border/50">
                {attendance.map((record) => (
                  <tr key={record._id} className="hover:bg-app-root/50 transition-colors">
                    <td className="p-4 font-medium text-app-text-active border-r border-app-border align-top">
                      {new Date(record.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-blue-900/30 text-blue-400 border border-blue-500/20 flex items-center justify-center font-black text-xs shrink-0">
                           {record.agentId?.name?.charAt(0) || '?'}
                         </div>
                         <div className="font-medium text-app-text-active">{record.agentId?.name || 'Unknown Agent'}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-app-text bg-app-surface-hover px-3 py-1 rounded-lg w-max text-sm font-medium">
                        <Clock size={16} /> 
                        {new Date(record.loginTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="p-4">
                      {record.present ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">
                          Present
                        </span>
                      ) : (
                         <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/20">
                          Absent
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
