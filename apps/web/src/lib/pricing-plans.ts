export type PricingPlan = {
  name: string;
  price: string;
  sub: string;
  items: string[];
  popular: boolean;
};

/** Shared pricing tiers used by the landing page and the guide pages. */
export const pricingPlans: PricingPlan[] = [
  {
    name: "Starter",
    price: "Rs. 499",
    sub: "Up to 15 rooms",
    items: ["Unlimited tenants", "Email billing", "UPI QR payments", "Daily backups"],
    popular: false,
  },
  {
    name: "Growing",
    price: "Rs. 799",
    sub: "16 to 40 rooms",
    items: [
      "Everything in Starter",
      "Automatic payment reminders",
      "Multi property support",
      "Priority delivery",
    ],
    popular: true,
  },
  {
    name: "Scale",
    price: "Rs. 1,499",
    sub: "41 to 100 rooms",
    items: [
      "Everything in Growing",
      "Custom bill templates",
      "Dedicated onboarding",
      "Priority support",
    ],
    popular: false,
  },
];

/** Included on every plan, no matter the tier. */
export const includedOnEveryPlan: string[] = [
  "14 day free trial, no card required",
  "Unlimited tenant records and history",
  "Monthly bill generation with manual approval",
  "PDF bills and bulk month export",
  "UPI QR collection and payment ledger",
  "Dues, collection and occupancy reports",
  "Electricity meter readings and per unit charges",
  "Daily automatic backups",
  "Dark mode and full mobile access",
];

export type ComparisonRow = { feature: string; starter: string; growing: string; scale: string };

/** Full plan comparison used by the pricing table. */
export const planComparison: ComparisonRow[] = [
  { feature: "Rooms included", starter: "Up to 15", growing: "16 to 40", scale: "41 to 100" },
  { feature: "Properties", starter: "1", growing: "Unlimited", scale: "Unlimited" },
  { feature: "Admin users", starter: "1", growing: "3", scale: "10" },
  { feature: "Email bill delivery", starter: "Yes", growing: "Yes", scale: "Yes" },
  {
    feature: "Automatic payment reminders",
    starter: "Manual only",
    growing: "Scheduled daily",
    scale: "Scheduled daily",
  },
  {
    feature: "Custom bill template and logo",
    starter: "Logo only",
    growing: "Logo and colors",
    scale: "Full template",
  },
  {
    feature: "Rent agreement templates",
    starter: "Included",
    growing: "Included",
    scale: "Included",
  },
  { feature: "Data export (CSV and PDF)", starter: "Yes", growing: "Yes", scale: "Yes" },
  {
    feature: "Onboarding",
    starter: "Self serve guide",
    growing: "Guided setup call",
    scale: "Dedicated onboarding",
  },
  {
    feature: "Support",
    starter: "Email, 48h",
    growing: "Priority, 24h",
    scale: "Priority, same day",
  },
];

export type PricingFaq = { q: string; a: string };

export const pricingFaqs: PricingFaq[] = [
  {
    q: "How does billing work?",
    a: "Plans are billed monthly per property owner account and are based on the number of rooms you manage. There are no setup fees and no per tenant charges.",
  },
  {
    q: "What happens if I cross my room limit?",
    a: "Nothing breaks. You keep working and we prompt you to move to the next tier from Settings whenever you are ready.",
  },
  {
    q: "Can I cancel any time?",
    a: "Yes. Cancel from Settings and you keep access until the end of the paid month. Your data stays exportable as PDF and CSV.",
  },
  {
    q: "Do you charge for tenants or bills?",
    a: "No. Tenants, bills, reminders and PDF exports are unlimited on every plan.",
  },
  {
    q: "Do you need more than 100 rooms?",
    a: "Write to us and we will price a custom plan with the same features plus bulk import and account management.",
  },
];

export type PlanKey = "starter" | "growing" | "scale";

export type PlanTier = {
  key: PlanKey;
  name: string;
  /** Monthly price in rupees. */
  amount: number;
  rank: number;
};

/** Canonical tier list used for proration, gating and checkout. */
export const planTiers: PlanTier[] = [
  { key: "starter", name: "Starter", amount: 499, rank: 0 },
  { key: "growing", name: "Growing", amount: 799, rank: 1 },
  { key: "scale", name: "Scale", amount: 1499, rank: 2 },
];

export const tierByKey = (key: string): PlanTier =>
  planTiers.find((t) => t.key === key) ?? planTiers[0]!;

export const planRank = (key: string): number => tierByKey(key).rank;
