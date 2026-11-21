import type { NextRequest } from "next/server";
import { callbackRoute } from "@/lib/mpesa/route";
import { handleConfirmation } from "@/lib/mpesa/service";

/** Daraja C2B ConfirmationURL: register as https://<host>/api/mpesa/c2b/confirmation?token=<MPESA_CALLBACK_TOKEN> */
export async function POST(req: NextRequest) {
  return callbackRoute(req, (raw, ip, authed) => handleConfirmation(raw, ip, authed));
}
