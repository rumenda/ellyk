# M-Pesa (Daraja C2B Paybill)

## Payment reference strategy

Students pay to the school **Paybill** with their **student number** as the account number (e.g. `EK00012`). It is short and easy to type. Matching is forgiving: case, spaces and punctuation are ignored (`ek 00012` matches). Enrolment numbers are also accepted. If the reference is unknown and the payer's full MSISDN is present, its SHA-256 hash is compared against student phone numbers, and a payment matches only if exactly one student fits.

Anything else lands in **Payments → Unmatched**. The money is already recorded in the ledger (Dr 1000 / Cr 2300), and finance assigns it to a student with a mandatory note. Matching, reassigning and reversing are all audited.

## Endpoints

| Daraja URL | Route |
| --- | --- |
| ValidationURL | `POST /api/mpesa/c2b/validation?token=<MPESA_CALLBACK_TOKEN>` |
| ConfirmationURL | `POST /api/mpesa/c2b/confirmation?token=<MPESA_CALLBACK_TOKEN>` |

Register them from **Settings → Integrations → Register C2B URLs** (uses `MPESA_CONSUMER_KEY/SECRET` and `MPESA_SHORTCODE`, ResponseType `Completed`), or manually in the Daraja portal. External validation must be enabled by Safaricom for the validation URL to be called.

## Never trusting a callback

Each request goes through, in order:

1. **Rate limit** per source IP.
2. **Secret token** in the URL, compared in constant time (≥ 24 characters required).
3. Optional **IP allow-list** (`MPESA_ALLOWED_IPS`).
4. **Size limit** (20 KB) and JSON parse.
5. **Strict schema** (`src/lib/mpesa/c2b.ts`): TransID format, positive bounded amount, 14-digit TransTime, numeric shortcode.
6. **Replay window:** confirmations older than 72 hours, or from the future, are acknowledged but **not** auto-recorded. They're logged for manual review.
7. **Shortcode must equal the configured Paybill** (re-checked inside SQL).
8. **Idempotency:** `trans_id` is unique. A duplicate returns `{"status":"duplicate"}` and creates nothing.
9. Payment creation, journal and allocation happen in **one transaction** (`mpesa_record_confirmation`).

Responses: well-formed callbacks get `{"ResultCode":"0"}`, including duplicates, so Safaricom stops retrying. Transient database errors return HTTP 500 so Safaricom retries, and idempotency makes that safe. Validation rejects with `C2B00012` (unknown account, only if the school sets the policy to *reject*), `C2B00013` (invalid amount) or `C2B00016` (other).

## Data minimisation

Safaricom increasingly masks MSISDNs. When a full number arrives, only a masked form (`254712***678`) and a SHA-256 hash are stored. The raw payload is kept **sanitised** (masked phone, payer first name plus last initial) in `mpesa_transactions.raw_payload` for audit. Every request, including unauthorised ones, is logged in `mpesa_webhook_logs` with outcome, HTTP status and error, and that log is visible to finance and the platform owner.

## Sandbox

With `MPESA_ENV=sandbox`, **Payments → M-Pesa sandbox** builds a Daraja-shaped confirmation and runs it through the exact production handler. Transactions are tagged `sandbox` and labelled in the UI. The simulator returns 404 and its action refuses when `MPESA_ENV=production`.

## Going live checklist

- [ ] `MPESA_ENV=production`, production consumer key/secret and shortcode
- [ ] Long random `MPESA_CALLBACK_TOKEN`; optionally `MPESA_ALLOWED_IPS` with Safaricom's published callback IPs
- [ ] Paybill number set in Settings → School (callbacks for other shortcodes are rejected)
- [ ] C2B URLs registered (HTTPS public domain)
- [ ] One real low-value payment confirmed end to end, then checked in Finance → Daily reconciliation
