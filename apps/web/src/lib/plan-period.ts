/**
 * Subscription period and buffer (grace) window math.
 *
 * `settings.current_period_end` is the last date covered by the owner's last
 * payment. Payment is not expected to land exactly on that date, so every
 * account gets a buffer of GRACE_DAYS afterwards during which the account keeps
 * working normally and is only reminded, never blocked. Access is deliberately
 * never revoked here: a PG owner locked out mid-month cannot bill their tenants,
 * which costs them real money over our billing convenience.
 *
 * Pure and date-only so it can be unit tested and used from both the browser
 * and the nightly lifecycle job.
 */

/** Days after current_period_end during which payment is still "on time enough". */
export const GRACE_DAYS = 7;

/** How early to start nudging, before current_period_end. */
export const DUE_SOON_DAYS = 5;

/** Length of a monthly billing cycle, in days. Matches the column default. */
export const CYCLE_DAYS = 30;

/** Length of an annual billing cycle, in days. */
export const ANNUAL_CYCLE_DAYS = 365;

export type PlanPhase =
  /** Paid and comfortably inside the period. */
  | "active"
  /** Period ends within DUE_SOON_DAYS. Nothing is wrong yet. */
  | "due_soon"
  /** Past current_period_end but inside the buffer. Still fully usable. */
  | "grace"
  /** Buffer exhausted. Still not blocked, but the account is overdue. */
  | "lapsed"
  /** Never paid and never redeemed a trial coupon. No grace buffer at all. */
  | "unpaid";

export type PlanPeriod = {
  phase: PlanPhase;
  /** Whole days until current_period_end. Negative once it has passed. */
  daysUntilDue: number;
  /** Last date payment still counts as inside the buffer. */
  bufferEnd: Date;
  /** Buffer days remaining, counting today. Zero once the buffer has run out. */
  bufferDaysLeft: number;
  /** True while the owner has never paid and is on the signup trial. */
  isTrial: boolean;
  /** True from due_soon onwards: worth showing a pay prompt. */
  needsPayment: boolean;
  /** True once payment is genuinely overdue. */
  isOverdue: boolean;
  /** Short headline for the banner. */
  title: string;
  /** One line of plain language explaining what happens next. */
  detail: string;
};

const MS_PER_DAY = 86_400_000;

/**
 * Midnight UTC for a date-only value. Postgres `date` columns arrive as
 * "2026-08-06" and parse as UTC midnight, while `new Date()` is local, so both
 * sides are normalised before subtracting or day counts drift by one near
 * midnight in +05:30.
 */
function startOfDay(value: string | Date): Date {
  if (typeof value === "string") {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (match) {
      return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid date: ${value}`);
    return startOfDay(parsed);
  }
  if (Number.isNaN(value.getTime())) throw new Error("Invalid date");
  // Already normalised: re-reading an existing UTC midnight through the local
  // calendar getters would shift it a day west of Greenwich, where UTC midnight
  // is still the previous afternoon.
  if (value.getTime() % MS_PER_DAY === 0) return value;
  return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
}

const wholeDaysBetween = (from: Date, to: Date) =>
  Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);

/**
 * Buffer days remaining including today, so the buffer's last date is still a
 * buffer day rather than the first overdue one. Clamped to GRACE_DAYS so the
 * number reads sensibly before the period has even ended.
 */
const bufferLeft = (today: Date, bufferEnd: Date) =>
  Math.max(0, Math.min(GRACE_DAYS, wholeDaysBetween(today, bufferEnd) + 1));

export const addDays = (date: Date, days: number): Date =>
  new Date(date.getTime() + days * MS_PER_DAY);

/** Formats for Indian owners: "6 Aug 2026". */
export const formatDate = (value: string | Date): string =>
  startOfDay(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function describePlanPeriod(input: {
  /** settings.current_period_end */
  periodEnd: string | Date;
  /** settings.plan_status */
  planStatus?: string | null;
  now?: Date;
}): PlanPeriod {
  const due = startOfDay(input.periodEnd);
  const today = startOfDay(input.now ?? new Date());
  const isTrial = input.planStatus === "trial";
  const isUnpaid = input.planStatus === "unpaid";

  const daysUntilDue = wholeDaysBetween(today, due);
  const bufferEnd = addDays(due, GRACE_DAYS);
  // An account that has never paid and never redeemed a trial coupon gets no
  // grace buffer at all: it is overdue from the moment it exists, which is
  // what keeps it locked out of the app (see _authenticated/route.tsx).
  const bufferDaysLeft = isUnpaid ? 0 : bufferLeft(today, bufferEnd);

  const phase: PlanPhase = isUnpaid
    ? "unpaid"
    : daysUntilDue > DUE_SOON_DAYS
      ? "active"
      : daysUntilDue >= 0
        ? "due_soon"
        : bufferDaysLeft > 0
          ? "grace"
          : "lapsed";

  const noun = isTrial ? "free trial" : "plan";
  const payWord = isTrial ? "Choose a plan" : "Renew";

  const copy: Record<PlanPhase, { title: string; detail: string }> = {
    unpaid: {
      title: "Choose a plan to get started",
      detail: "New accounts need an active paid plan, or a coupon code, before they can be used.",
    },
    active: {
      title: isTrial
        ? `Free trial runs to ${formatDate(due)}`
        : `Plan active to ${formatDate(due)}`,
      detail: isTrial
        ? `Pick a plan any time before ${formatDate(due)} to keep everything you have set up.`
        : `Your next payment is due on ${formatDate(due)}.`,
    },
    due_soon: {
      title:
        daysUntilDue === 0
          ? `Your ${noun} ends today`
          : `Your ${noun} ends in ${plural(daysUntilDue, "day")}`,
      detail: `${payWord} by ${formatDate(due)}. You also get ${plural(GRACE_DAYS, "buffer day")} after that, so nothing breaks if payment is a little late.`,
    },
    grace: {
      title: `Payment due — ${plural(bufferDaysLeft, "buffer day")} left`,
      detail: `Your ${noun} ended on ${formatDate(due)}. You are inside the ${plural(GRACE_DAYS, "day")} buffer, so the app keeps working normally. ${payWord} by ${formatDate(bufferEnd)}.`,
    },
    lapsed: {
      title: "Payment overdue",
      detail: `Your ${noun} ended on ${formatDate(due)} and the ${plural(GRACE_DAYS, "day")} buffer ran out on ${formatDate(bufferEnd)}. Your data is safe and the app still works — ${payWord.toLowerCase()} whenever you are ready.`,
    },
  };

  return {
    phase,
    daysUntilDue,
    bufferEnd,
    bufferDaysLeft,
    isTrial,
    needsPayment: phase !== "active",
    isOverdue: phase === "lapsed" || phase === "unpaid",
    ...copy[phase],
  };
}

/**
 * Where the next billing cycle starts when a renewal is paid.
 *
 * Inside the buffer the renewal date is anchored to the old period end so the
 * billing day never drifts earlier each month. Once the buffer is gone the
 * account is treated as a restart and gets a full cycle from today, so nobody
 * pays for days that have already passed.
 */
export function nextPeriod(input: {
  periodEnd: string | Date;
  now?: Date;
  /** Length of the cycle being bought. Defaults to a monthly cycle. */
  cycleDays?: number;
}): {
  start: string;
  end: string;
  /** True when the old renewal day was kept. */
  anchored: boolean;
} {
  const due = startOfDay(input.periodEnd);
  const today = startOfDay(input.now ?? new Date());
  const anchored = bufferLeft(today, addDays(due, GRACE_DAYS)) > 0;
  const start = anchored ? due : today;
  return {
    start: toDateString(start),
    end: toDateString(addDays(start, input.cycleDays ?? CYCLE_DAYS)),
    anchored,
  };
}

/** YYYY-MM-DD, the shape a Postgres `date` column expects. */
export const toDateString = (date: Date): string => startOfDay(date).toISOString().slice(0, 10);
