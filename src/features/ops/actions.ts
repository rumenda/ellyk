"use server";
import { revalidatePath } from "next/cache";
import { fail, friendlyDbError, ok, type ActionResult } from "@/lib/actions";
import { getSessionUser, hasRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

async function office() {
  const u = await getSessionUser();
  if (!u || !hasRole(u, "manager", "admin")) throw new Error("Not allowed");
  return u;
}
const refresh = () => revalidatePath("/staff", "layout");

export async function decideTimeOff(id: string, approve: boolean): Promise<ActionResult> {
  await office();
  const supabase = await createClient();
  const { error } = await supabase.from("instructor_time_off").update({ status: approve ? "approved" : "rejected" }).eq("id", id);
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(undefined, approve ? "Leave approved" : "Leave declined");
}

export async function addTimeOff(instructorId: string, start: string, end: string, reason: string): Promise<ActionResult> {
  const u = await getSessionUser();
  if (!u) return fail("Please sign in again.");
  if (end < start) return fail("End must be after start.");
  const supabase = await createClient();
  const { error } = await supabase.from("instructor_time_off").insert({
    instructor_id: instructorId, starts_at: new Date(`${start}T00:00:00+03:00`).toISOString(), ends_at: new Date(`${end}T23:59:00+03:00`).toISOString(),
    reason, status: hasRole(u, "manager", "admin") ? "approved" : "pending", created_by: u.id,
  });
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(undefined, hasRole(u, "manager", "admin") ? "Leave recorded" : "Leave request sent");
}

export async function setAvailability(instructorId: string, locationId: string, days: number[], start: string, end: string): Promise<ActionResult> {
  await office();
  if (end <= start) return fail("End time must be after start time.");
  const supabase = await createClient();
  await supabase.from("instructor_availability").delete().eq("instructor_id", instructorId).eq("location_id", locationId);
  if (days.length) {
    const { error } = await supabase.from("instructor_availability").insert(days.map((weekday) => ({ instructor_id: instructorId, location_id: locationId, weekday, start_time: start, end_time: end })));
    if (error) return fail(friendlyDbError(error));
  }
  refresh();
  return ok(undefined, "Availability saved");
}

export async function setInstructorLocations(instructorId: string, locationIds: string[]): Promise<ActionResult> {
  const u = await getSessionUser();
  if (!hasRole(u, "manager")) return fail("Only a manager can change instructor locations.");
  const supabase = await createClient();
  await supabase.from("instructor_locations").delete().eq("instructor_id", instructorId);
  if (locationIds.length) {
    const { error } = await supabase.from("instructor_locations").insert(locationIds.map((location_id) => ({ instructor_id: instructorId, location_id })));
    if (error) return fail(friendlyDbError(error));
  }
  refresh();
  return ok(undefined, "Locations updated");
}

type VStatus = Database["public"]["Enums"]["vehicle_status"];
export async function setVehicleStatus(id: string, status: VStatus, note?: string): Promise<ActionResult> {
  await office();
  const supabase = await createClient();
  const { error } = await supabase.from("vehicles").update({ status, ...(note ? { notes: note } : {}) }).eq("id", id);
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(undefined, "Status updated");
}

export async function saveVehicle(input: Record<string, string>, id?: string): Promise<ActionResult<{ id: string }>> {
  await office();
  const num = (v?: string) => (v ? Number(v) : null);
  const row = {
    asset_number: input.asset_number?.trim().toUpperCase(), registration: input.registration?.trim().toUpperCase(), make: input.make?.trim(),
    model: input.model?.trim(), year: num(input.year), engine_cc: num(input.engine_cc), location_id: input.location_id,
    odometer_km: num(input.odometer_km) ?? 0, next_service_km: num(input.next_service_km), next_service_date: input.next_service_date || null,
    insurance_expiry: input.insurance_expiry || null, inspection_expiry: input.inspection_expiry || null, notes: input.notes || null,
  };
  if (!row.asset_number || !row.registration || !row.make || !row.model || !row.location_id) return fail("Asset number, registration, make, model and location are required.");
  const supabase = await createClient();
  const res = id
    ? await supabase.from("vehicles").update(row as never).eq("id", id).select("id").single()
    : await supabase.from("vehicles").insert(row as never).select("id").single();
  if (res.error) return fail(friendlyDbError(res.error));
  refresh();
  return ok({ id: res.data.id }, id ? "Motorcycle updated" : "Motorcycle added");
}

export async function logMaintenance(vehicleId: string, input: Record<string, string>): Promise<ActionResult> {
  const u = await office();
  if (!input.description?.trim()) return fail("Describe the work done.");
  const supabase = await createClient();
  const { error } = await supabase.from("vehicle_maintenance").insert({
    vehicle_id: vehicleId, maintenance_type: input.maintenance_type as "service", performed_on: input.performed_on, description: input.description,
    odometer_km: input.odometer_km ? Number(input.odometer_km) : null, cost: Number(input.cost || 0), vendor: input.vendor || null,
    next_service_date: input.next_service_date || null, next_service_km: input.next_service_km ? Number(input.next_service_km) : null, recorded_by: u.id,
  });
  if (error) return fail(friendlyDbError(error));
  const upd: Record<string, unknown> = {};
  if (input.odometer_km) upd.odometer_km = Number(input.odometer_km);
  if (input.next_service_date) upd.next_service_date = input.next_service_date;
  if (input.next_service_km) upd.next_service_km = Number(input.next_service_km);
  if (input.return_to_service === "on") upd.status = "available";
  if (Object.keys(upd).length) await supabase.from("vehicles").update(upd as never).eq("id", vehicleId);
  refresh();
  return ok(undefined, "Maintenance logged");
}

export async function logFuel(vehicleId: string, litres: number, cost: number, odometer?: number): Promise<ActionResult> {
  const u = await getSessionUser();
  if (!u) return fail("Please sign in again.");
  const supabase = await createClient();
  const { error } = await supabase.from("fuel_logs").insert({ vehicle_id: vehicleId, filled_on: new Date().toISOString().slice(0, 10), litres, cost, odometer_km: odometer ?? null, recorded_by: u.id });
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(undefined, "Fuel logged");
}

export async function updateIncident(id: string, status: "open" | "investigating" | "closed", resolution?: string): Promise<ActionResult> {
  await office();
  const supabase = await createClient();
  const { error } = await supabase.from("vehicle_incidents").update({ status, resolution: resolution ?? null }).eq("id", id);
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(undefined, "Incident updated");
}
