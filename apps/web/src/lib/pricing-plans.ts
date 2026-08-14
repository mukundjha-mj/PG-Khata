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
    items: [
      "Unlimited tenants",
      "Email billing",
      "UPI QR payments",
      "Daily backups",
      "150 WhatsApp messages/month",
    ],
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
      "500 WhatsApp messages/month",
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
      "1,500 WhatsApp messages/month",
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

export type ComparisonRow = {
  feature: string;
  starter: string;
  growing: string;
  scale: string;
  enterprise: string;
};

/** Full plan comparison used by the pricing table. */
export const planComparison: ComparisonRow[] = [
  {
    feature: "Rooms included",
    starter: "Up to 15",
    growing: "16 to 40",
    scale: "41 to 100",
    enterprise: "Unlimited",
  },
  {
    feature: "Properties",
    starter: "1",
    growing: "Unlimited",
    scale: "Unlimited",
    enterprise: "Unlimited",
  },
  { feature: "Admin users", starter: "1", growing: "3", scale: "10", enterprise: "Custom" },
  {
    feature: "Email bill delivery",
    starter: "Yes",
    growing: "Yes",
    scale: "Yes",
    enterprise: "Yes",
  },
  {
    feature: "Automatic payment reminders",
    starter: "Manual only",
    growing: "Scheduled daily",
    scale: "Scheduled daily",
    enterprise: "Scheduled daily",
  },
  {
    feature: "Custom bill template and logo",
    starter: "Logo only",
    growing: "Logo and colors",
    scale: "Full template",
    enterprise: "Full template",
  },
  {
    feature: "Rent agreement templates",
    starter: "Included",
    growing: "Included",
    scale: "Included",
    enterprise: "Included",
  },
  {
    feature: "Data export (CSV and PDF)",
    starter: "Yes",
    growing: "Yes",
    scale: "Yes",
    enterprise: "Yes",
  },
  {
    feature: "Onboarding",
    starter: "Self serve guide",
    growing: "Guided setup call",
    scale: "Dedicated onboarding",
    enterprise: "Dedicated onboarding",
  },
  {
    feature: "Support",
    starter: "Email, 48h",
    growing: "Priority, 24h",
    scale: "Priority, same day",
    enterprise: "Priority, same day",
  },
  {
    feature: "WhatsApp messages / month",
    starter: "150",
    growing: "500",
    scale: "1,500",
    enterprise: "Custom",
  },
];

export type EnterprisePlan = {
  name: string;
  /** Not a fixed number - priced per conversation with the founder. */
  price: string;
  sub: string;
  items: string[];
};

/**
 * The 4th tier: unlimited rooms and properties, no self-serve checkout.
 * Marketing-only for now - there is no "enterprise" settings.plan value and
 * no code path enforces or bills this tier. Signing one up is a manual,
 * out-of-band arrangement made by a super admin.
 */
export const enterprisePlan: EnterprisePlan = {
  name: "Enterprise",
  price: "Contact us",
  sub: "More than 100 rooms",
  items: [
    "Everything in Scale",
    "Unlimited rooms and properties",
    "Custom WhatsApp message volume",
    "Dedicated account management",
  ],
};

export type PricingFaq = { q: string; a: string };

export const pricingFaqs: PricingFaq[] = [
  {
    q: "How does billing work?",
    a: "Plans are billed monthly per property owner account and are based on the number of rooms you manage. There are no setup fees and no per tenant charges.",
  },
  {
    q: "What happens if I cross my room limit?",
    a: "Adding a room or property beyond your plan's limit is blocked with a prompt to upgrade. Everything you already have keeps working - you just can't add more until you move to the next tier.",
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
  /** null = unlimited. */
  maxProperties: number | null;
  /** Total rooms across every property this owner has, not per property. null = unlimited. */
  maxRooms: number | null;
  /** WhatsApp sends allowed per billing month. null = unlimited. */
  whatsappQuota: number | null;
  /**
   * Struck-through "was" price shown next to `amount` on the monthly tier
   * card. A real reference price, not a fake permanent "sale" - chosen once
   * and kept stable rather than churned for urgency.
   */
  mrpAmount?: number;
  /**
   * Real annual price (paid upfront, once a year). Roughly 10x the monthly
   * price - a genuine "2 months free" saving for prepaying, not a discount
   * off a fabricated MRP.
   */
  annualAmount?: number;
};

/** Canonical tier list used for proration, gating and checkout. */
export const planTiers: PlanTier[] = [
  {
    key: "starter",
    name: "Starter",
    amount: 499,
    rank: 0,
    maxProperties: 1,
    maxRooms: 15,
    whatsappQuota: 150,
    mrpAmount: 699,
    annualAmount: 4990,
  },
  {
    key: "growing",
    name: "Growing",
    amount: 799,
    rank: 1,
    maxProperties: null,
    maxRooms: 40,
    whatsappQuota: 500,
    mrpAmount: 1099,
    annualAmount: 7990,
  },
  {
    key: "scale",
    name: "Scale",
    amount: 1499,
    rank: 2,
    maxProperties: null,
    maxRooms: 100,
    whatsappQuota: 1500,
    mrpAmount: 1999,
    annualAmount: 14990,
  },
];

export const tierByKey = (key: string): PlanTier =>
  planTiers.find((t) => t.key === key) ?? planTiers[0]!;

export const planRank = (key: string): number => tierByKey(key).rank;
