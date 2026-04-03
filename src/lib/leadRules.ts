/**
 * Client-side mirrors of backend lead rules (see server/controllers/leadController.ts).
 * Used to disable buttons and show messages before API calls fail.
 */

import { utcDayBounds } from './agentWorkbench.ts';

export function hasTradeWithBuyQty(lead: any): boolean {
  return Array.isArray(lead?.trades) && lead.trades.some((t: any) => Number(t?.buyQuantity ?? 0) > 0);
}

/**
 * Heuristic: payments live in a separate collection; GET /leads/:id does not attach them.
 * Activity log entries are created when an agent logs payment — match Received.
 */
export function hasReceivedPaymentHint(lead: any, agentId: string): boolean {
  return (lead?.activityLog ?? []).some((log: any) => {
    const action = String(log?.action ?? '');
    const performedBy = log?.performedBy?.toString?.() ?? String(log?.performedBy ?? '');
    return (
      performedBy === agentId &&
      /Logged Payment/i.test(action) &&
      /\(Received\)/i.test(action)
    );
  });
}

/** Admin path: any received payment on record (activity log — mirrors typical logging). */
export function hasReceivedPaymentHintAny(lead: any): boolean {
  return (lead?.activityLog ?? []).some((log: any) => {
    const action = String(log?.action ?? '');
    return /Logged Payment/i.test(action) && /\(Received\)/i.test(action);
  });
}

/** Agent conversion: backend requires trade + Payment Received tied to agent. */
export function canAgentConvertLead(lead: any, agentId: string): boolean {
  return hasTradeWithBuyQty(lead) && hasReceivedPaymentHint(lead, agentId);
}

export function canAdminConvertLead(lead: any): boolean {
  return hasTradeWithBuyQty(lead) && hasReceivedPaymentHintAny(lead);
}

export function canConvertForRole(lead: any, user: { role: string; _id: string }): boolean {
  if (user.role === 'admin') return canAdminConvertLead(lead);
  return canAgentConvertLead(lead, user._id.toString());
}

export function getAgentConversionBlockReason(lead: any, agentId: string): string | null {
  if (canAgentConvertLead(lead, agentId)) return null;
  if (!hasTradeWithBuyQty(lead)) return 'Add a trade with buy quantity greater than 0 before converting.';
  if (!hasReceivedPaymentHint(lead, agentId))
    return 'Log a payment with status Received (by you) before converting.';
  return 'Cannot convert yet.';
}

export function getAdminConversionBlockReason(lead: any): string | null {
  if (canAdminConvertLead(lead)) return null;
  if (!hasTradeWithBuyQty(lead)) return 'Add at least one trade with buy quantity before converting.';
  return 'Log a received payment for this lead before converting.';
}

export function getConversionBlockReason(
  lead: any,
  user: { role: string; _id: string }
): string | null {
  if (user.role === 'admin') return getAdminConversionBlockReason(lead);
  return getAgentConversionBlockReason(lead, user._id.toString());
}

export function isLeadFollowUpOverdue(lead: any): boolean {
  if (!lead?.nextFollowUpDate) return false;
  const fu = new Date(lead.nextFollowUpDate);
  const { start: todayStart } = utcDayBounds(new Date());
  return fu < todayStart;
}
