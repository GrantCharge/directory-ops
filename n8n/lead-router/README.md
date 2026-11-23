# n8n Lead Router: all 11 sites (Grant's fork)

This folder holds the n8n version of the **Pass on leads** helper (`skills/lead-routing`).
It does not use Hermes.

- Live workflow: "Lead Router - All 11 Sites (Pass on leads helper)" on n8n.aikanga.com (id `VFyMaMQFk16qVA0i`).
- Link for every site: `POST https://n8n.aikanga.com/webhook/lead-router`. The old Site 1 link `/webhook/lead-router-sydney-asbestos` still works.
- `check-lead-and-draft.js` is the code inside the "Check Lead + Draft" node.

## What it does with each lead

1. Looks up the email domain (MX check, same as `check_lead.py`).
2. Checks the lead with the helper rules: email, phone, date, fake name, spam, location.
3. Logs it to the Leads Google Sheet.
4. Makes an Attio deal (not for tests or rejects).
5. Emails Grant one of three things. It never emails a business itself.
   - `[APPROVE]`: a ready draft for the business (Template A, first lead free, or B2 after that).
   - `[NOT FORWARDED]`: the lead is fine, but no business email is on file.
   - `[HELD]`: the check failed (spam, fake, bad email).

## site_source values

sydney-asbestos-pro, sydney-bond-clean-pro, sydney-skip-bin-pro, sydney-tree-removal-pro,
central-coast-asbestos-pro, central-coast-bond-clean-pro, central-coast-skip-bin-pro,
newcastle-asbestos-pro, newcastle-bond-clean-pro, newcastle-skip-bin-pro,
morisset-directory (not built; frozen until 1 Mar 2027; slot is ready).

## Test lead

Add `"test": true` to the JSON. Test leads get no Attio deal, use no free lead, and every email says TEST.

## Still to fill in

At the top of the code: your sign off first name, postal address (email law), and price per lead.
