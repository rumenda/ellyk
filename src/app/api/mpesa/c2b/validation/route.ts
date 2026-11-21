import type { NextRequest } from "next/server";
import { callbackRoute } from "@/lib/mpesa/route";
import { handleValidation } from "@/lib/mpesa/service";

/** Daraja C2B ValidationURL: register as https://<host>/api/mpesa/c2b/validation?token=<MPESA_CALLBACK_TOKEN> */
export async function POST(req: NextRequest) {
  return callbackRoute(req, handleValidation);
}
