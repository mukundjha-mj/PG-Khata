# WhatsApp "Bill Ready" Template — Plan & Spec

No code changed. This is a design/content spec to submit in Meta Business Manager
under WhatsApp Manager → Message templates → Create template.

## 1. What triggers this message

`notifyTenantAboutBill()` in `apps/web/src/lib/bill-notify.server.ts` already
runs whenever an owner generates or updates a bill (`message_type:
"bill-generated"`). Today it only sends email via `buildBillEmailHtml`. This
template is the WhatsApp counterpart — same trigger point, same data, no new
plumbing needed once the template exists. (Wiring the actual send call is a
separate follow-up; you asked for the template only, so nothing in
`bill-notify.server.ts` was touched.)

## 2. Fields used, and where they come from

| Field | Source | Notes |
|---|---|---|
| Tenant name | `tenants.full_name` | |
| Property name | `properties.name` | |
| Room number | `rooms.room_number` | |
| Month | `bills.bill_month` | formatted via existing `monthLabel()` |
| Rent | `bills.rent_amount` | |
| Electricity | `bills.electricity_amount` + `bills.electricity_units_consumed` | "₹450 (32 units)" |
| Other charges | `bills.other_charges` (jsonb array `{label, amount}`) | summed as one line; itemizing needs a variable-length list, which templates can't do — total is the practical choice |
| Total | `bills.total_amount` | |
| Due date | `bills.due_date` | |
| UPI ID | `settings.upi_vpa` | owner's own VPA, already used in `upi.ts` / `reminders.server.ts` |
| Payee name | `settings.upi_payee_name` (falls back to `brand_name` → property name) | |

Meta template variables are positional (`{{1}}`, `{{2}}`, ...) with **no
conditionals** — so unlike the email/PDF versions, this can't cleanly skip the
electricity line if it's zero, or itemize a variable number of other charges.
Kept to a fixed 7 variables; if `other_charges` is empty, pass "—" for that slot
rather than trying to omit the line.

## 3. Category: Utility

Bill notifications are transactional (informing about a charge already
incurred), which is exactly what Meta's Utility category is for — same
category as the existing `rent_payment_reminder` template. Utility templates
are cheaper per conversation and don't require the recipient to have
opted in the way Marketing does. A Marketing-styled promo look (like the
groceries screenshot) is more appropriate for future things like "refer a
friend" or seasonal offers, not a monthly bill.

## 4. Header: Image

Per your choice, this uses an image header. Meta needs an actual image file
uploaded at template-submission time (1:1 minimum, JPEG/PNG under 5MB is safe)
— that file has to be created/sourced outside this session; I can't generate
or upload it. Spec for whoever builds it:

- Simple horizontal banner, roughly 1200×600 or 1200×628 (WhatsApp square-crops
  aggressively in some clients, so keep the logo + text within the center 80%)
- PGKhata wordmark or a simple house/receipt icon
- Background in the brand primary tone `#644a40` (from `styles.css`), or a
  lighter neutral if the icon needs contrast
- Short supporting text baked into the image is optional and risky — WhatsApp
  sometimes re-crops/compresses headers on low bandwidth, so don't rely on
  in-image text being legible. Keep all real information in the body.
- If no image is ready by the time you want to submit, switch the header
  type to **Text** instead (e.g. `"{{1}}'s bill is ready"`) — zero extra
  approval friction, and functionally identical for the recipient's ability to
  read the bill.

## 5. Buttons

WhatsApp template URL buttons only accept `http(s)://` links — not the
`upi://pay` deep link `buildUpiIntent()` builds. Two working options, both
included below:

- **Quick Reply button** "I've paid" — lets the tenant signal payment without
  typing; useful since `bill-notify.server.ts` already has a path that could
  log this back to `notification_logs` later (not built yet, but the hook
  point exists).
- **Copy code button** — puts the UPI ID directly on the tenant's clipboard, no
  new hosted page needed, matches the "Copy code" pattern from your reference
  screenshot.
- A **URL button** on `bills.payment_link_url` is possible in principle
  (worded "View bill") but that column exists in the `bills` table and is
  never populated anywhere in the codebase today — building an actual hosted
  bill page is out of scope here, so it's noted but not included below.

## 6. The template

```
Name:      monthly_bill_ready
Category:  UTILITY
Language:  English (en)

Header (IMAGE)
  [upload banner — see spec above]

Body
  Hi {{1}}, your {{2}} bill for {{3}} is ready.

  Rent: {{4}}
  Electricity: {{5}}
  Other charges: {{6}}
  ------------------
  Total due: {{7}}

  Due by {{8}}. Pay by UPI to {{9}}.

Footer
  Reply if anything looks wrong.

Buttons
  [Quick Reply]  I've paid
  [Copy code]    {{9}}   (same UPI ID as body var 9)
```

### Sample filled-in preview

```
┌──────────────────────────────────┐
│ [ banner: PGKhata wordmark on    │
│   #644a40 background ]           │
│                                   │
│ Hi Asha, your March 2026 bill    │
│ for Sunrise PG Room 12 is ready. │
│                                   │
│ Rent: ₹8,000                     │
│ Electricity: ₹450 (32 units)     │
│ Other charges: —                 │
│ ------------------                │
│ Total due: ₹8,450                 │
│                                   │
│ Due by 05 Mar 2026. Pay by UPI   │
│ to sunrisepg@upi.                │
│                                   │
│ Reply if anything looks wrong.   │
│                                   │
│  [ I've paid ]                    │
│  [ Copy code: sunrisepg@upi ]     │
└──────────────────────────────────┘
```

### Body parameter mapping (order matters — Meta only checks count, not meaning)

```ts
// Mirrors buildReminderTemplate() in reminder-message.ts — same pattern,
// new template name. Not added to the codebase; shown here as the shape
// the eventual sendTenantWhatsApp() call would need.
{
  name: "monthly_bill_ready",
  languageCode: "en",
  bodyParameters: [
    tenant.full_name,                          // {{1}}
    monthLabel,                                // {{2}}
    `${property.name} Room ${room.room_number}`, // {{3}}
    formatMoney(bill.rent_amount),             // {{4}}
    `${formatMoney(bill.electricity_amount)} (${bill.electricity_units_consumed ?? 0} units)`, // {{5}}
    otherChargesTotal > 0 ? formatMoney(otherChargesTotal) : "—", // {{6}}
    formatMoney(bill.total_amount),            // {{7}}
    bill.due_date ? formatDate(bill.due_date) : "as soon as possible", // {{8}}
    settings.upi_vpa ?? "—",                   // {{9}}
  ],
}
```

## 7. What's NOT included (deliberately, per "don't change any code")

- No edit to `bill-notify.server.ts` to actually call `sendTenantWhatsApp`
  with this new template — that's a real code change and wasn't asked for.
- No new `notification_logs` handling for the "I've paid" quick-reply button —
  the webhook (`whatsapp-webhook.server.ts`) already logs inbound messages via
  `console.info`, but reacting to a specific button payload is new logic.
- No image file — needs to be designed/exported outside this session.

## 8. Submitting it

Meta Business Manager → your WABA → Message templates → Create template →
paste the body above, select Utility category, upload the header image (or
switch to Text header if none is ready), add the two buttons, submit for
review. Typical turnaround is minutes to a few hours; Meta occasionally asks
for wording tweaks (e.g. removing "Reply if anything looks wrong" if it reads
as inviting free-form conversation outside policy — if rejected for that,
drop the footer line first before resubmitting).
