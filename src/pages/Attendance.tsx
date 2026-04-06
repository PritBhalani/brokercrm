import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { CalendarDays, UserCheck } from 'lucide-react';
import api from '../services/api.ts';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type AttendanceRecord = {
  _id: string;
  userId: { _id: string; name: string; email?: string } | string;
  date: string;
  loginTime?: string;
  status?: string;
};

type Agent = { _id: string; name: string; email?: string; isActive?: boolean };

function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function uidString(userId: AttendanceRecord['userId']): string {
  if (!userId) return '';
  return typeof userId === 'object' && userId !== null && '_id' in userId
    ? String((userId as { _id: string })._id)
    : String(userId);
}

function isPresentRecord(r: AttendanceRecord | undefined): boolean {
  if (!r) return false;
  if (r.status === 'Present') return true;
  if (r.status === 'Absent') return false;
  if (r.status === 'Half Day') return false;
  return Boolean(r.loginTime);
}

function isHalfDayRecord(r: AttendanceRecord | undefined): boolean {
  return Boolean(r?.status === 'Half Day');
}

export const Attendance: React.FC = () => {
  const { user } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [agentsRes, attRes] = await Promise.all([
        api.get('/users/agents'),
        api.get(`/admin/attendance?month=${month}&year=${year}`),
      ]);
      setAgents(Array.isArray(agentsRes.data) ? agentsRes.data : []);
      setAttendance(Array.isArray(attRes.data) ? attRes.data : []);
    } catch (err) {
      console.error('Failed to fetch attendance', err);
      setAgents([]);
      setAttendance([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      void fetchAll();
    }
  }, [month, year, user]);

  const recordMap = useMemo(() => {
    const m = new Map<string, AttendanceRecord>();
    for (const r of attendance) {
      const uid = uidString(r.userId);
      if (uid && r.date) m.set(`${uid}:${r.date}`, r);
    }
    return m;
  }, [attendance]);

  const todayStr = localYmd(new Date());

  const calendarDays = useMemo(() => {
    const first = new Date(year, month - 1, 1);
    const last = new Date(year, month, 0);
    const daysInMonth = last.getDate();
    const startPad = first.getDay();
    const cells: ({ day: number; dateStr: string; dow: number } | null)[] = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dow = new Date(year, month - 1, d).getDay();
      cells.push({ day: d, dateStr, dow });
    }
    return cells;
  }, [year, month]);

  const summarizeAgent = (agentId: string) => {
    let present = 0;
    let absent = 0;
    let half = 0;
    let workingDaysInPastOrToday = 0;

    const first = new Date(year, month - 1, 1);
    const last = new Date(year, month, 0);
    for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
      const dateStr = localYmd(d);
      const dow = d.getDay();
      if (dow === 0) continue;
      if (dateStr > todayStr) continue;
      workingDaysInPastOrToday += 1;
      const rec = recordMap.get(`${agentId}:${dateStr}`);
      if (isHalfDayRecord(rec)) {
        half += 1;
        present += 0.5;
        absent += 0.5;
      } else if (isPresentRecord(rec)) {
        present += 1;
      } else {
        absent += 1;
      }
    }

    return { present, absent, half, workingDaysInPastOrToday };
  };

  if (user?.role !== 'admin') {
    return <div className="p-8 text-center text-red-500 font-bold">Unauthorized</div>;
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-app-border pb-6">
        <div>
          <h1 className="text-2xl font-bold text-app-text-active flex items-center gap-2">
            <CalendarDays className="text-blue-500" /> Agent attendance
          </h1>
          <p className="text-app-text-muted text-sm mt-1">
            Monthly calendar — green = present, red = absent, amber = half day. Sundays are closed (not counted).
          </p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="px-4 py-2 border border-app-border rounded-xl bg-app-root text-app-text-active font-medium"
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(0, i).toLocaleString('en', { month: 'long' })}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-4 py-2 border border-app-border rounded-xl bg-app-root text-app-text-active font-medium"
          >
            {Array.from({ length: 8 }, (_, i) => today.getFullYear() - 2 + i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-xs font-semibold text-app-text-muted border border-app-border rounded-xl px-4 py-3 bg-app-surface">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-emerald-500/80" /> Present
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-rose-500/80" /> Absent
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-amber-500/80" /> Half day
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-slate-600/50 border border-app-border" /> Closed (Sun)
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-app-surface-hover border border-dashed border-app-border" /> Future
        </span>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-6">
          {[1, 2].map((i) => (
            <div key={i} className="h-64 bg-app-surface-hover rounded-2xl" />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <div className="bg-app-surface p-12 rounded-2xl border border-app-border text-center">
          <UserCheck size={48} className="mx-auto text-app-text-muted mb-4" />
          <h3 className="text-lg font-bold text-app-text-active">No agents</h3>
          <p className="text-app-text-muted">Add agents to see attendance.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {agents.map((agent) => {
            const agentId = String(agent._id);
            const stats = summarizeAgent(agentId);

            return (
              <section
                key={agentId}
                className="rounded-2xl border border-app-border bg-app-surface shadow-sm shadow-black/5 overflow-hidden"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-app-border bg-app-root/80">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/25 flex items-center justify-center font-bold text-lg shrink-0">
                      {agent.name?.charAt(0) ?? '?'}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-app-text-active">{agent.name}</h2>
                      <p className="text-xs text-app-text-muted">
                        {agent.isActive === false ? 'Inactive' : 'Active'} · {agent.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm">
                    <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/25 px-3 py-2">
                      <span className="text-app-text-muted text-xs block">Present</span>
                      <span className="font-bold text-emerald-400 tabular-nums">{stats.present}</span>
                    </div>
                    <div className="rounded-lg bg-rose-500/10 border border-rose-500/25 px-3 py-2">
                      <span className="text-app-text-muted text-xs block">Absent</span>
                      <span className="font-bold text-rose-400 tabular-nums">{stats.absent}</span>
                    </div>
                    {stats.half > 0 && (
                      <div className="rounded-lg bg-amber-500/10 border border-amber-500/25 px-3 py-2">
                        <span className="text-app-text-muted text-xs block">Half days</span>
                        <span className="font-bold text-amber-400 tabular-nums">{stats.half}</span>
                      </div>
                    )}
                    <div className="rounded-lg bg-app-surface-hover border border-app-border px-3 py-2">
                      <span className="text-app-text-muted text-xs block">Working days (Mon–Sat, to date)</span>
                      <span className="font-bold text-app-text-active tabular-nums">
                        {stats.workingDaysInPastOrToday}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-6 overflow-x-auto">
                  <div className="min-w-[640px]">
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {WEEKDAYS.map((w, i) => (
                        <div
                          key={w}
                          className={`text-center text-[11px] font-bold uppercase tracking-wider py-2 rounded-lg ${
                            i === 0 ? 'text-slate-400 bg-slate-800/40' : 'text-app-text-muted bg-app-root/50'
                          }`}
                        >
                          {i === 0 ? `${w} · closed` : w}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {calendarDays.map((cell, idx) => {
                        if (!cell) {
                          return <div key={`pad-${idx}`} className="min-h-[52px]" />;
                        }
                        const { day, dateStr, dow } = cell;
                        const isSun = dow === 0;
                        const isFuture = dateStr > todayStr;
                        const rec = recordMap.get(`${agentId}:${dateStr}`);

                        let inner: React.ReactNode;
                        let cellClass =
                          'min-h-[52px] rounded-lg border flex flex-col items-center justify-center text-sm font-bold transition-colors';

                        if (isSun) {
                          cellClass += ' bg-slate-800/35 border-slate-600/40 text-slate-400';
                          inner = <span className="text-[10px] font-semibold">Off</span>;
                        } else if (isFuture) {
                          cellClass += ' bg-app-surface-hover/50 border-dashed border-app-border text-app-text-muted';
                          inner = <span>{day}</span>;
                        } else if (isHalfDayRecord(rec)) {
                          cellClass += ' bg-amber-500/20 border-amber-500/40 text-amber-300';
                          inner = <span>{day}</span>;
                        } else if (isPresentRecord(rec)) {
                          cellClass += ' bg-emerald-500/25 border-emerald-500/50 text-emerald-300 ring-1 ring-emerald-500/30';
                          inner = <span>{day}</span>;
                        } else {
                          cellClass += ' bg-rose-500/20 border-rose-500/45 text-rose-300 ring-1 ring-rose-500/25';
                          inner = <span>{day}</span>;
                        }

                        return (
                          <div key={dateStr} className={cellClass} title={`${dateStr}${isSun ? ' — Closed' : ''}`}>
                            {inner}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="px-5 py-4 border-t border-app-border bg-app-root/40 text-sm text-app-text-muted">
                  <strong className="text-app-text-active">Totals this month (Mon–Sat only, past &amp; today):</strong>{' '}
                  <span className="text-emerald-400 font-semibold">{stats.present}</span> present
                  {stats.half > 0 && (
                    <span className="text-amber-400">
                      {' '}
                      (incl. {stats.half} half day{stats.half !== 1 ? 's' : ''} counted as ½ + ½)
                    </span>
                  )}
                  , <span className="text-rose-400 font-semibold">{stats.absent}</span> absent — out of{' '}
                  <span className="text-app-text-active font-semibold">{stats.workingDaysInPastOrToday}</span> working
                  days.
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
