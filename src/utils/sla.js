export const SLA_HOURS = {
  high: 24,
  medium: 72,
  low: 168
};

export const getSLAStatus = (complaint) => {
  if (complaint.status === 'resolved') return null;
  const created = complaint.createdAt?.toDate?.();
  if (!created) return null;
  const hoursElapsed = (Date.now() - created.getTime()) / 3600000;
  const limit = SLA_HOURS[complaint.priority];
  const percent = (hoursElapsed / limit) * 100;
  const remaining = Math.max(0, limit - hoursElapsed);
  return {
    hoursElapsed: Math.round(hoursElapsed),
    hoursRemaining: Math.round(remaining),
    percent: Math.min(100, Math.round(percent)),
    breached: hoursElapsed > limit,
    critical: percent >= 75,
    label: remaining < 1 ? 'Overdue'
      : remaining < 24 ? `${Math.round(remaining)}h left`
      : `${Math.round(remaining / 24)}d left`
  };
};
