import type {RateLimitSnapshot} from './protocol/v2/RateLimitSnapshot';
import type {RateLimitWindow} from './protocol/v2/RateLimitWindow';

export type UsageSnapshot = Partial<RateLimitSnapshot>;
export function mergeUsage(previous: UsageSnapshot | null, update: UsageSnapshot): UsageSnapshot {
  return {...previous, ...update,
    primary: update.primary ?? previous?.primary,
    secondary: update.secondary ?? previous?.secondary,
  };
}
export function codexUsage(data: {rateLimits?: UsageSnapshot; rateLimitsByLimitId?: Record<string, UsageSnapshot | undefined> | null}): UsageSnapshot | null {
  const snapshot = data.rateLimitsByLimitId?.codex ?? data.rateLimits;
  return snapshot && (!snapshot.limitId || snapshot.limitId === 'codex') ? snapshot : null;
}
export function usageWindows(snapshot: UsageSnapshot | null) {
  const windows = [snapshot?.primary, snapshot?.secondary];
  return [300, 10080].map((minutes, index) => ({
    label: index === 0 ? '5h limit' : 'Weekly limit',
    window: windows.find(w => w?.windowDurationMins === minutes)
      ?? (windows[index]?.windowDurationMins == null ? windows[index] : null),
  }));
}
export function remaining(window: RateLimitWindow | null | undefined): number | null {
  return window && Number.isFinite(window.usedPercent) ? Math.max(0, Math.min(100, 100 - window.usedPercent)) : null;
}
