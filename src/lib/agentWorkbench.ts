/** UTC day bounds aligned with server `getUTCDayBounds`. */
export function utcDayBounds(d = new Date()) {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
  return { start, end };
}

const PRIORITY_ORDER: Record<string, number> = {
  Callback: 0,
  Interested: 1,
  Ringing: 2,
  New: 3,
  ReadyToWorkTomorrow: 4,
  Converted: 5,
  SwitchOff: 10,
  NumberNotValid: 11,
};

export function sortLeadsForQueue(leads: any[]) {
  return [...leads].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.status] ?? 99;
    const pb = PRIORITY_ORDER[b.status] ?? 99;
    if (pa !== pb) return pa - pb;
    if (a.nextFollowUpDate && b.nextFollowUpDate)
      return new Date(a.nextFollowUpDate).getTime() - new Date(b.nextFollowUpDate).getTime();
    return 0;
  });
}

export function categorizeLeads(leads: any[]) {
  const now = new Date();
  const { start: todayStart, end: todayEnd } = utcDayBounds(now);
  const overdue: any[] = [];
  const dueToday: any[] = [];
  const highPriority: any[] = [];

  for (const l of leads) {
    if (l.priority === 'high') highPriority.push(l);
    const fu = l.nextFollowUpDate ? new Date(l.nextFollowUpDate) : null;
    if (fu) {
      if (fu < todayStart) overdue.push(l);
      else if (fu.getTime() >= todayStart.getTime() && fu.getTime() <= todayEnd.getTime()) dueToday.push(l);
    }
  }

  return { overdue, dueToday, highPriority };
}

/** One prioritized queue: overdue → due today → high priority → remaining sorted. */
export function buildWorkQueue(leads: any[]) {
  const sorted = sortLeadsForQueue(leads);
  const { overdue, dueToday, highPriority } = categorizeLeads(leads);
  const seen = new Set<string>();
  const out: any[] = [];

  const pushUnique = (arr: any[]) => {
    for (const l of sortLeadsForQueue(arr)) {
      const id = String(l._id);
      if (!seen.has(id)) {
        seen.add(id);
        out.push(l);
      }
    }
  };

  pushUnique(overdue);
  pushUnique(dueToday);
  pushUnique(highPriority);
  for (const l of sorted) {
    const id = String(l._id);
    if (!seen.has(id)) {
      seen.add(id);
      out.push(l);
    }
  }
  return out;
}

export function nextUtcDateIso(daysFromToday: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromToday);
  return d.toISOString().split('T')[0];
}
