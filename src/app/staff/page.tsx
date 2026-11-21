import { redirect } from "next/navigation";
import { homeFor, requireStaff } from "@/lib/auth/session";

export default async function StaffIndex() {
  redirect(homeFor(await requireStaff()));
}
