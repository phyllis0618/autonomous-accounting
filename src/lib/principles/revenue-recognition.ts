/**
 * Canonical principle document loaded by the Auditor (Stage 3).
 * In production, swap for CMS / versioned policy store.
 */
export const PRINCIPLE_DOCUMENT = `
# Revenue recognition & double-entry invariants (excerpt)

1. **Double-entry**: Every journal entry must balance: sum(debits) = sum(credits).
2. **Revenue recognition (ASC 606 / IFRS 15 aligned summary)**: Recognize revenue when control of goods or services transfers to the customer, in an amount reflecting consideration entitled.
3. **Chesterton's Fence (operational)**: Before reclassifying or stopping a long-standing recurring entry, document why it existed; default to absent strong contrary evidence from source documents.
4. **Tax separation**: Indicated sales/VAT/GST amounts post to a liability (e.g., Sales Tax Payable), not net revenue, unless jurisdiction rules state otherwise.
5. **Bank feeds**: Treat bank description as weak evidence; corroborate with invoices or contracts where material.

Violations must lower confidence and be listed explicitly in the reasoning trace.
`.trim();
