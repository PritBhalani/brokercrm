/** User-facing pipeline labels (DB / API still use enum values like `Converted`). */
export function formatLeadStatus(status: string | undefined | null): string {
  if (!status) return '';
  switch (status) {
    case 'Converted':
      return 'Paid client';
    case 'ReadyToWorkTomorrow':
      return 'Ready to work tomorrow';
    default:
      return status;
  }
}
