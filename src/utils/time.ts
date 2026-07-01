import { DateTime } from 'luxon';
import type { Env } from '../config/env';

/** A scheduled check-in slot expressed as an absolute instant. */
export interface CheckInSlot {
  /** HH:mm label in business timezone. */
  label: string;
  /** Absolute instant (JS Date, UTC under the hood). */
  at: Date;
}

/**
 * All business-time calculations. Native Date is never used for business
 * logic - everything goes through Luxon with explicit timezones (docs/Scheduler.md).
 */
export class TimeService {
  private readonly tz: string;
  private readonly usTz: string;

  constructor(private readonly env: Env) {
    this.tz = env.TIMEZONE;
    this.usTz = env.US_TIMEZONE;
  }

  /** Current instant. */
  now(): DateTime {
    return DateTime.now();
  }

  /** Current instant in the business timezone. */
  nowBusiness(): DateTime {
    return DateTime.now().setZone(this.tz);
  }

  /** Business day key (YYYY-MM-DD) for a given instant (defaults to now). */
  businessDay(at?: Date): string {
    const dt = at ? DateTime.fromJSDate(at) : DateTime.now();
    return dt.setZone(this.tz).toFormat('yyyy-MM-dd');
  }

  private parseHHmm(value: string): { hour: number; minute: number } {
    const [h, m] = value.split(':').map((n) => Number.parseInt(n, 10));
    return { hour: h, minute: m };
  }

  /** Minutes since midnight (business tz) for the given instant. */
  private minutesOfDay(dt: DateTime): number {
    return dt.hour * 60 + dt.minute;
  }

  private minutesFromHHmm(value: string): number {
    const { hour, minute } = this.parseHHmm(value);
    return hour * 60 + minute;
  }

  /** True if the instant falls within working hours (business tz). */
  isWorkingHour(at?: Date): boolean {
    const dt = (at ? DateTime.fromJSDate(at) : DateTime.now()).setZone(this.tz);
    const cur = this.minutesOfDay(dt);
    return (
      cur >= this.minutesFromHHmm(this.env.WORK_START) &&
      cur < this.minutesFromHHmm(this.env.WORK_END)
    );
  }

  /** True if the instant falls inside the lunch break (business tz). */
  isLunch(at?: Date): boolean {
    const dt = (at ? DateTime.fromJSDate(at) : DateTime.now()).setZone(this.tz);
    const cur = this.minutesOfDay(dt);
    return (
      cur >= this.minutesFromHHmm(this.env.LUNCH_START) &&
      cur < this.minutesFromHHmm(this.env.LUNCH_END)
    );
  }

  /** True if it is Saturday or Sunday in the US timezone. */
  isUsWeekend(at?: Date): boolean {
    const dt = (at ? DateTime.fromJSDate(at) : DateTime.now()).setZone(this.usTz);
    return dt.weekday === 6 || dt.weekday === 7;
  }

  /** True if new check-ins may be created right now. */
  canScheduleCheckIn(at?: Date): boolean {
    return this.isWorkingHour(at) && !this.isLunch(at) && !this.isUsWeekend(at);
  }

  /**
   * Compute the check-in slots for the business day of `at`, at CHECK_INTERVAL
   * spacing from WORK_START, excluding lunch and the final WORK_END boundary.
   * Slots are computed dynamically - never hardcoded (docs/Scheduler.md).
   */
  checkInSlots(at?: Date, intervalMinutes?: number): CheckInSlot[] {
    const interval = intervalMinutes ?? this.env.CHECK_INTERVAL;
    const base = (at ? DateTime.fromJSDate(at) : DateTime.now()).setZone(this.tz).startOf('day');

    const start = this.minutesFromHHmm(this.env.WORK_START);
    const end = this.minutesFromHHmm(this.env.WORK_END);
    const lunchStart = this.minutesFromHHmm(this.env.LUNCH_START);
    const lunchEnd = this.minutesFromHHmm(this.env.LUNCH_END);

    const slots: CheckInSlot[] = [];
    // First slot is one interval after work start (matches docs default 02:30...).
    for (let m = start + interval; m < end; m += interval) {
      // Skip any slot inside the lunch window, including the closing boundary,
      // so check-ins resume one interval after lunch ends (docs default schedule).
      if (m >= lunchStart && m <= lunchEnd) continue;
      const dt = base.plus({ minutes: m });
      slots.push({ label: dt.toFormat('HH:mm'), at: dt.toJSDate() });
    }
    return slots;
  }

  /** Format a lead time (seconds) as "1m 34s" / "18s". */
  static formatLeadTime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  }
}
