// Single source of truth for what can be bought and for how much.
// Prices are EUR cents. The client-side PLANS object in index.html mirrors
// this for display only — the amount charged always comes from here.

export type PlanKey =
  | 'free' | 'day' | 'week' | 'month' | 'flex10' | 'season' | 'annual'
  | 'reserved' | 'fixed' | 'studio' | 'workation' | 'virtual' | 'founder' | 'event';

export interface Plan {
  name: string;
  unit: string;
  /** EUR cents in summer (15 May – 30 Sep). null = not payable online. */
  summer: number | null;
  /** EUR cents in winter (1 Oct – 14 May). null = not payable online. */
  winter: number | null;
}

export const PLANS: Record<PlanKey, Plan> = {
  free:      { name: 'Free First Day',    unit: 'one time',                     summer: 0,      winter: 0 },
  day:       { name: 'Day Pass',          unit: 'per day',                      summer: 1500,   winter: 1200 },
  week:      { name: 'Week Pass',         unit: 'per week',                     summer: 5500,   winter: 4500 },
  month:     { name: 'Monthly Flex',      unit: 'per month',                    summer: 13900,  winter: 9900 },
  flex10:    { name: 'Flex 10',           unit: '10 days over 6 months',        summer: 8900,   winter: 8900 },
  season:    { name: 'Season Pass',       unit: '16 weeks',                     summer: 39900,  winter: 39900 },
  annual:    { name: 'Annual (locals)',   unit: 'per year',                     summer: 99000,  winter: 99000 },
  reserved:  { name: 'Reserved Seat',     unit: 'per month',                    summer: 1900,   winter: 1900 },
  fixed:     { name: 'Private Desk',      unit: 'per month',                    summer: 17900,  winter: 17900 },
  studio:    { name: 'Team Studio',       unit: 'per month',                    summer: 69000,  winter: 69000 },
  workation: { name: 'Workation Package', unit: 'per month',                    summer: 119000, winter: 119000 },
  virtual:   { name: 'Virtual Office',    unit: 'per month',                    summer: 2900,   winter: 2900 },
  founder:   { name: 'Founders 15',       unit: 'per month · locked for life',  summer: 9900,   winter: 9900 },
  event:     { name: 'Event Rental',      unit: 'evening / weekend',            summer: null,   winter: null },
};

export function isPlanKey(v: unknown): v is PlanKey {
  return typeof v === 'string' && v in PLANS;
}

/** Summer season: 15 May – 30 Sep (per pricing strategy). Must match seasonFor() in index.html. */
export function isSummer(dateStr: string): boolean {
  const [, m, d] = dateStr.split('-').map(Number);
  return (m === 5 && d >= 15) || (m >= 6 && m <= 9);
}

/** EUR cents due for a plan starting on dateStr, or null if not payable online. */
export function priceCents(plan: PlanKey, dateStr: string): number | null {
  const p = PLANS[plan];
  return isSummer(dateStr) ? p.summer : p.winter;
}

/** Validates YYYY-MM-DD, must be a real calendar date and today or later (Sofia time, roughly). */
export function isValidBookingDate(dateStr: unknown): dateStr is string {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const date = new Date(dateStr + 'T00:00:00Z');
  if (Number.isNaN(date.getTime())) return false;
  if (date.toISOString().slice(0, 10) !== dateStr) return false; // rejects 2026-02-31 etc.
  const today = new Date(Date.now() + 3 * 3600 * 1000); // UTC+3 buffer so "today" in Bulgaria is bookable
  const todayStr = today.toISOString().slice(0, 10);
  return dateStr >= todayStr;
}

export function isValidEmail(v: unknown): v is string {
  return typeof v === 'string' && v.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
}

export function formatEur(cents: number): string {
  return '€' + (cents / 100).toFixed(2).replace(/\.00$/, '');
}
