/**
 * Development seed. Every record is created through the same database
 * functions the application uses (as signed-in users), so seeded balances,
 * journals and statuses are produced by real business logic.
 *
 *   pnpm db:reset && pnpm seed
 *
 * All people, phone numbers and references below are fictional.
 */
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../src/lib/supabase/database.types";
import { buildSchedule } from "../src/lib/finance/schedule";
import { formatTransTime } from "../src/lib/mpesa/c2b";
import { STUDENT_EMAIL_DOMAIN } from "../src/lib/auth/constants";
import { createHash } from "node:crypto";

config({ path: ".env.local" });
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!URL || !ANON || !SERVICE) throw new Error("Missing Supabase env vars (.env.local)");
if (process.env.APP_ENV === "production") throw new Error("Refusing to seed a production environment");

export const DEMO_PASSWORD = "EllyK-Demo-2026!";
type DB = SupabaseClient<Database>;
const admin: DB = createClient<Database>(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

// Deterministic RNG so the seed is reproducible.
let seed = 20261121;
const rand = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)]!;

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(new Date());
const dayOffset = (n: number) => addDays(today, n);
function addDays(d: string, n: number) {
  const [y, m, dd] = d.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, dd + n)).toISOString().slice(0, 10);
}
const at = (date: string, time: string) => new Date(`${date}T${time}:00+03:00`);
const weekday = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay();

function must<T>(res: { data: T; error: { message: string } | null }, what: string): NonNullable<T> {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data as NonNullable<T>;
}

const clients = new Map<string, DB>();
async function as(email: string): Promise<DB> {
  const existing = clients.get(email);
  if (existing) return existing;
  const c = createClient<Database>(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
  if (error) throw new Error(`sign in ${email}: ${error.message}`);
  clients.set(email, c);
  return c;
}

async function createUser(email: string, fullName: string, phone: string | null, roles: Database["public"]["Enums"]["app_role"][]) {
  const { data, error } = await admin.auth.admin.createUser({ email, password: DEMO_PASSWORD, email_confirm: true,
    user_metadata: { full_name: fullName } });
  if (error) throw new Error(`create user ${email}: ${error.message}`);
  const id = data.user.id;
  must(await admin.from("profiles").insert({ id, full_name: fullName, phone, email }), "profile");
  if (roles.length) must(await admin.from("user_roles").insert(roles.map((role) => ({ user_id: id, role }))), "roles");
  must(await admin.from("notification_preferences").insert({ user_id: id }), "prefs");
  return id;
}

async function main() {
  console.log("Seeding Elly K Driving School (development data)…");

  // ---------------------------------------------------------------- settings
  must(await admin.from("school_settings").update({
    legal_name: "Elly K Driving School Limited", trading_name: "Elly K Driving School",
    kra_pin: "P051234567X", postal_address: "P.O. Box 00000-00100, Nairobi",
    physical_address: "Demo Plaza, Thika Road, Nairobi", phone: "+254700100100", email: "info@ellyk.test",
    paybill_number: process.env.MPESA_SHORTCODE ?? "600999", default_service_fee: 500,
    vat_registered: false, prices_tax_inclusive: true,
  }).eq("id", 1), "settings");
  must(await admin.from("tax_rates").insert([
    { code: "VAT16", name: "VAT 16%", rate: 0.16, etims_tax_type: "B" },
    { code: "EXEMPT", name: "Exempt", rate: 0, etims_tax_type: "A" },
  ]), "tax rates");

  const year = Number(today.slice(0, 4));
  must(await admin.from("fiscal_periods").insert(
    Array.from({ length: 12 }, (_, i) => {
      const start = `${year}-${String(i + 1).padStart(2, "0")}-01`;
      const end = new Date(Date.UTC(year, i + 1, 0)).toISOString().slice(0, 10);
      return { name: `${year}-${String(i + 1).padStart(2, "0")}`, starts_on: start, ends_on: end };
    })), "fiscal periods");

  // --------------------------------------------------------------- locations
  const locs = must(await admin.from("locations").insert([
    { code: "TRD", name: "Thika Road Campus", address: "Demo Plaza, off Thika Superhighway, Roysambu", phone: "+254700100201", capacity: 60,
      opening_hours: hours() },
    { code: "KTG", name: "Kitengela Training Ground", address: "Namanga Road, near the stage, Kitengela", phone: "+254700100202", capacity: 40,
      opening_hours: hours() },
    { code: "RUI", name: "Ruiru Branch", address: "Kamiti Road, Ruiru Town", phone: "+254700100203", capacity: 30,
      opening_hours: hours() },
  ]).select(), "locations");
  const L = Object.fromEntries(locs.map((l) => [l.code, l.id])) as Record<"TRD" | "KTG" | "RUI", string>;

  // ------------------------------------------------------------------ users
  await createUser("platform@ellyk.test", "Platform Owner (Developer)", null, ["platform_owner"]);
  const managerId = await createUser("manager@ellyk.test", "Elizabeth Kerubo", "+254700100301", ["manager"]);
  const adminId = await createUser("admin@ellyk.test", "Grace Wanjiru", "+254700100302", ["admin"]);
  const admin2Id = await createUser("admin.ktg@ellyk.test", "Tom Ouko", "+254700100303", ["admin"]);
  const accountantId = await createUser("accounts@ellyk.test", "Daniel Kiprono", "+254700100304", ["accountant"]);
  must(await admin.from("staff").insert([
    { user_id: managerId, employee_number: "EKS-001", job_title: "School Manager", hire_date: "2022-01-10" },
    { user_id: adminId, employee_number: "EKS-002", job_title: "Front Office Administrator", hire_date: "2023-03-01" },
    { user_id: admin2Id, employee_number: "EKS-003", job_title: "Branch Administrator", hire_date: "2024-02-12" },
    { user_id: accountantId, employee_number: "EKS-004", job_title: "Accountant", hire_date: "2022-06-15" },
  ]), "staff");
  must(await admin.from("staff_locations").insert([
    { user_id: adminId, location_id: L.TRD }, { user_id: adminId, location_id: L.RUI }, { user_id: admin2Id, location_id: L.KTG },
  ]), "staff locations");
  must(await admin.from("locations").update({ manager_user_id: managerId }).in("id", Object.values(L)), "loc manager");

  const instructorDefs = [
    { email: "john.mwangi@ellyk.test", name: "John Mwangi", phone: "+254700100401", emp: "EKI-101", locs: ["TRD"] as const },
    { email: "ruth.akinyi@ellyk.test", name: "Ruth Akinyi", phone: "+254700100402", emp: "EKI-102", locs: ["KTG"] as const },
    { email: "ali.hassan@ellyk.test", name: "Ali Hassan", phone: "+254700100403", emp: "EKI-103", locs: ["RUI", "TRD"] as const },
  ];
  const instructors: { id: string; email: string; locs: readonly string[] }[] = [];
  for (const d of instructorDefs) {
    const uid = await createUser(d.email, d.name, d.phone, ["instructor"]);
    must(await admin.from("staff").insert({ user_id: uid, employee_number: d.emp, job_title: "Motorcycle Instructor", hire_date: "2023-05-02" }), "staff");
    const ins = must(await admin.from("instructors").insert({
      user_id: uid, employee_number: d.emp, qualifications: "NTSA-certified motorcycle instructor; First Aid (Red Cross)",
      driving_licence_classes: ["A2", "A3", "B"], hire_date: "2023-05-02",
    }).select().single(), "instructor");
    must(await admin.from("instructor_locations").insert(d.locs.map((c) => ({ instructor_id: ins.id, location_id: L[c] }))), "inst loc");
    must(await admin.from("instructor_availability").insert(
      [1, 2, 3, 4, 5, 6].map((wd) => ({ instructor_id: ins.id, location_id: L[d.locs[0]], weekday: wd, start_time: "07:30", end_time: "17:30" }))), "avail");
    must(await admin.from("instructor_certifications").insert({
      instructor_id: ins.id, certification_type: "NTSA Driving Instructor Licence", certificate_number: `DIL-${d.emp}`,
      issued_on: "2023-04-01", expires_on: d.emp === "EKI-102" ? dayOffset(25) : "2027-03-31",
    }), "cert");
    instructors.push({ id: ins.id, email: d.email, locs: d.locs.map((c) => L[c]) });
  }
  const mgr = await as("manager@ellyk.test");
  const acct = await as("accounts@ellyk.test");

  // ------------------------------------------------------- catalogue/pricing
  const lic = must(await admin.from("licence_classes").insert([
    { code: "A2", name: "Class A2 – Motorcycle", vehicle_category: "motorcycle", description: "Motorcycles for private and commercial riders", is_active: true },
    { code: "B", name: "Class B – Light vehicle", vehicle_category: "light_vehicle", description: "Saloon cars and light vehicles (future programme)", is_active: false },
  ]).select(), "licence classes");
  const A2 = lic.find((l) => l.code === "A2")!.id;

  const courses = must(await mgr.from("courses").insert([
    { code: "MC-A2", name: "Motorcycle Rider Training (Class A2)", licence_class_id: A2, duration_weeks: 6, theory_sessions: 4,
      practical_sessions: 10, description: "Complete rider programme: road safety, machine control and NTSA test preparation." },
    { code: "MC-PRO", name: "Commercial Rider Programme", licence_class_id: A2, duration_weeks: 8, theory_sessions: 6,
      practical_sessions: 14, description: "For boda boda and courier riders: defensive riding, passenger safety and customer care." },
  ]).select(), "courses");
  const C = Object.fromEntries(courses.map((c) => [c.code, c.id])) as Record<"MC-A2" | "MC-PRO", string>;
  must(await mgr.from("course_locations").insert([
    { course_id: C["MC-A2"], location_id: L.TRD }, { course_id: C["MC-A2"], location_id: L.KTG }, { course_id: C["MC-A2"], location_id: L.RUI },
    { course_id: C["MC-PRO"], location_id: L.TRD }, { course_id: C["MC-PRO"], location_id: L.KTG },
  ]), "course locations");

  async function publishVersion(courseId: string, version: number, label: string, tuition: number, extra: Partial<Database["public"]["Tables"]["course_price_versions"]["Insert"]> = {}) {
    const pv = must(await acct.from("course_price_versions").insert({
      course_id: courseId, version, label, deposit_amount: 4000, instalment_mode: "count", instalment_count: 6,
      instalment_frequency: "weekly", min_paid_before_training: 4000, min_paid_before_ntsa: 10000, ...extra,
    }).select().single(), "price version");
    must(await acct.from("course_price_items").insert([
      { price_version_id: pv.id, component: "registration", label: "Registration fee", amount: 1500, sort_order: 1 },
      { price_version_id: pv.id, component: "tuition", label: "Tuition – theory & practical lessons", amount: tuition, sort_order: 2 },
      { price_version_id: pv.id, component: "ntsa", label: "NTSA fees (PDL, test booking & licence)", amount: 1450, sort_order: 3 },
      { price_version_id: pv.id, component: "service_fee", label: "Platform service fee", amount: 500, sort_order: 4 },
    ]), "price items");
    must(await acct.from("course_price_versions").update({ status: "active" }).eq("id", pv.id), "publish");
    return pv.id;
  }
  await publishVersion(C["MC-A2"], 1, "2026 launch pricing", 9500);
  await publishVersion(C["MC-PRO"], 1, "2026 pricing", 13500, { instalment_count: 8, min_paid_before_ntsa: 14000 });

  // -------------------------------------------------------------- competencies
  const compDefs: [string, string, string][] = [
    ["PRE-RIDE", "Pre-ride checks (T-CLOCS)", "Pre-ride"], ["PPE", "Protective gear & helmet use", "Pre-ride"],
    ["START-STOP", "Starting, moving off & stopping", "Machine control"], ["BALANCE", "Balance & slow riding", "Machine control"],
    ["STEER", "Steering & cornering", "Machine control"], ["BRAKE", "Braking & emergency stops", "Machine control"],
    ["GEARS", "Clutch & gear control", "Machine control"], ["OBSERVE", "Observation & mirror use", "Road craft"],
    ["POSITION", "Road positioning & lane discipline", "Road craft"], ["JUNCTION", "Junctions & roundabouts", "Road craft"],
    ["TRAFFIC", "Traffic awareness & hazard perception", "Road craft"], ["HIGHWAY-CODE", "Highway Code & road signs (theory)", "Theory"],
    ["READINESS", "Overall practical test readiness", "Assessment"],
  ];
  const comps = must(await mgr.from("competencies").insert(compDefs.map(([code, name, category], i) => ({
    code, name, category, sort_order: i + 1, licence_class_id: A2, required_for_test: true,
  }))).select(), "competencies");

  // ------------------------------------------------------------------- fleet
  const bikes = [
    ["EK-M01", "KMGA 101A", "TVS", "HLX 125", 2024, 125, "TRD"], ["EK-M02", "KMGA 102B", "Honda", "Ace 110", 2023, 110, "TRD"],
    ["EK-M03", "KMGB 203C", "Bajaj", "Boxer 150", 2024, 150, "TRD"], ["EK-M04", "KMGC 304D", "TVS", "HLX 125", 2022, 125, "KTG"],
    ["EK-M05", "KMGC 305E", "Bajaj", "Boxer 150", 2023, 150, "KTG"], ["EK-M06", "KMGD 406F", "Honda", "Ace 110", 2021, 110, "KTG"],
    ["EK-M07", "KMGE 507G", "TVS", "Star HLX 100", 2024, 100, "RUI"], ["EK-M08", "KMGE 508H", "Bajaj", "Boxer 150", 2022, 150, "RUI"],
  ] as const;
  const vehicles = must(await mgr.from("vehicles").insert(bikes.map(([asset, reg, make, model, yr, cc, loc], i) => ({
    asset_number: asset, registration: reg, make, model, year: yr, engine_cc: cc, location_id: L[loc],
    odometer_km: 3000 + i * 1850, next_service_km: 3000 + i * 1850 + (i === 2 ? 150 : 1200),
    next_service_date: dayOffset(i === 2 ? 3 : 20 + i * 4), insurance_expiry: i === 5 ? dayOffset(12) : dayOffset(200 + i * 10),
    inspection_expiry: dayOffset(150 + i * 7), status: i === 6 ? "maintenance" : "available",
    notes: i === 6 ? "Clutch cable replacement – awaiting part" : null,
  }))).select(), "vehicles");
  must(await mgr.from("vehicle_maintenance").insert([
    { vehicle_id: vehicles[0]!.id, maintenance_type: "service", performed_on: dayOffset(-30), odometer_km: 2800, description: "3,000 km service: oil, chain, brakes", cost: 2800, vendor: "Roysambu Moto Works", recorded_by: managerId },
    { vehicle_id: vehicles[6]!.id, maintenance_type: "repair", performed_on: dayOffset(-1), odometer_km: 14100, description: "Clutch cable snapped during slow-riding drill", cost: 1500, vendor: "Ruiru Spares", recorded_by: managerId },
  ]), "maintenance");

  // ---------------------------------------------------------------- students
  const people: [string, string, string, "female" | "male"][] = [
    ["Brian", "Otieno", "Ouma", "male"], ["Faith", "Wanjiku", "Kamau", "female"], ["Kevin", "Kiprotich", "Rotich", "male"],
    ["Mercy", "Achieng", "Odhiambo", "female"], ["Dennis", "Mwangi", "Njoroge", "male"], ["Purity", "Chebet", "Langat", "female"],
    ["Collins", "Omondi", "Okoth", "male"], ["Esther", "Nyambura", "Wairimu", "female"], ["Samuel", "Kipchumba", "Kirui", "male"],
    ["Lilian", "Atieno", "Owino", "female"], ["Joseph", "Mutua", "Musyoka", "male"], ["Ann", "Wambui", "Gitau", "female"],
    ["Victor", "Kibet", "Koech", "male"], ["Caroline", "Moraa", "Nyaboke", "female"], ["Stephen", "Njuguna", "Karanja", "male"],
    ["Diana", "Awino", "Adhiambo", "female"], ["Peter", "Kamau", "Mburu", "male"], ["Joy", "Jepkosgei", "Cheruiyot", "female"],
    ["Martin", "Ochieng", "Onyango", "male"], ["Sharon", "Wangari", "Muthoni", "female"], ["Elvis", "Barasa", "Wafula", "male"],
    ["Naomi", "Nduta", "Kariuki", "female"], ["Ian", "Kiplagat", "Tanui", "male"], ["Gladys", "Kemunto", "Ondieki", "female"],
    ["Hassan", "Abdi", "Noor", "male"], ["Brenda", "Nekesa", "Simiyu", "female"],
  ];
  // profile: how the student behaves financially / how far along they are
  type Profile = "graduate" | "test_ready" | "on_track" | "behind" | "new_paid" | "awaiting_deposit" | "pending" | "applicant";
  const profiles: Profile[] = [
    "graduate", "test_ready", "test_ready", "on_track", "on_track", "behind", "on_track", "on_track", "behind", "new_paid",
    "on_track", "awaiting_deposit", "on_track", "test_ready", "behind", "new_paid", "on_track", "pending", "on_track", "awaiting_deposit",
    "on_track", "behind", "new_paid", "applicant", "on_track", "on_track",
  ];
  const startOffsets: Record<Profile, () => number> = {
    graduate: () => -63, test_ready: () => -45 - Math.floor(rand() * 5), on_track: () => -10 - Math.floor(rand() * 25),
    behind: () => -24 - Math.floor(rand() * 10), new_paid: () => -3 - Math.floor(rand() * 3),
    awaiting_deposit: () => -2, pending: () => 0, applicant: () => 0,
  };
  const locCycle: ("TRD" | "KTG" | "RUI")[] = ["TRD", "KTG", "TRD", "RUI", "KTG", "TRD", "RUI", "TRD", "KTG"];

  interface SeedStudent { id: string; number: string; phone: string; first: string; profile: Profile; loc: string; start: string;
    enrolmentId?: string; email?: string; schedule?: ReturnType<typeof buildSchedule> }
  const students: SeedStudent[] = [];

  for (let i = 0; i < people.length; i++) {
    const [first, middle, last, gender] = people[i]!;
    const profile = profiles[i]!;
    const locCode = locCycle[i % locCycle.length]!;
    const registrar = await as(locCode === "KTG" ? "admin.ktg@ellyk.test" : "admin@ellyk.test");
    const phone = `+2547001005${String(10 + i).padStart(2, "0")}`;
    const start = dayOffset(startOffsets[profile]());
    const sid = must(await registrar.rpc("register_student", { p: {
      first_name: first, middle_name: middle, last_name: last, gender,
      date_of_birth: `${1985 + (i % 20)}-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 27) + 1).padStart(2, "0")}`,
      id_type: "national_id", id_number: String(30000000 + i * 104729).slice(0, 8), phone,
      email: i % 3 === 0 ? `${first.toLowerCase()}.${last.toLowerCase()}@example.com` : null,
      residence: pick(["Roysambu", "Kasarani", "Githurai 45", "Kitengela Town", "Ruiru Bypass", "Juja", "Zimmerman", "Isinya"]),
      emergency_contact_name: `${pick(["Mary", "James", "Lucy", "Paul", "Agnes", "George"])} ${last}`,
      emergency_contact_phone: `+2547001009${String(10 + i).padStart(2, "0")}`,
      emergency_contact_relationship: pick(["Parent", "Sibling", "Spouse", "Guardian"]),
      home_location_id: L[locCode], consent_data_processing: true, consent_sms: true,
    } }), `register ${first}`) as unknown as string;
    const number = must(await admin.from("students").select("student_number").eq("id", sid).single(), "num").student_number;
    must(await admin.from("students").update({ registered_at: at(addDays(start, -1), "10:15").toISOString() }).eq("id", sid), "backdate");
    students.push({ id: sid, number, phone, first, profile, loc: L[locCode], start });
  }

  // ------------------------------------------------------- enrolments & plans
  const pickInstructor = (loc: string) => instructors.find((x) => x.locs[0] === loc) ?? instructors.find((x) => x.locs.includes(loc))!;
  for (const [i, s] of students.entries()) {
    if (s.profile === "applicant") continue;
    const locCode = Object.entries(L).find(([, v]) => v === s.loc)![0];
    const registrar = await as(locCode === "KTG" ? "admin.ktg@ellyk.test" : "admin@ellyk.test");
    const course = i % 6 === 4 && s.loc !== L.RUI ? C["MC-PRO"] : C["MC-A2"];
    const eid = must(await registrar.rpc("create_enrolment", {
      p_student: s.id, p_course: course, p_location: s.loc, p_start_date: s.start, p_instructor: pickInstructor(s.loc).id,
    }), "enrol") as unknown as string;
    s.enrolmentId = eid;
    must(await admin.from("enrolments").update({ created_at: at(s.start, "10:30").toISOString() }).eq("id", eid), "backdate enr");
    if (s.profile === "pending") continue;

    const enr = must(await admin.from("enrolments").select("price_version_id").eq("id", eid).single(), "enr");
    const q = must(await registrar.rpc("quote_price_version", { p_price_version: enr.price_version_id }), "quote") as {
      total: number; deposit: number; instalment_mode: "count" | "amount"; instalment_count: number; instalment_amount: number;
      frequency: "weekly" | "fortnightly" | "monthly" };
    const schedule = buildSchedule({ total: q.total, deposit: q.deposit, mode: q.instalment_mode, count: q.instalment_count,
      amount: q.instalment_amount, frequency: q.frequency, depositDueDate: s.start });
    s.schedule = schedule;
    must(await registrar.rpc("accept_enrolment_agreement", { p_enrolment: eid, p_schedule: schedule as unknown as Json, p_accepted_via: "in_person" }), `accept ${s.first}`);
    must(await admin.from("invoices").update({ issue_date: s.start }).eq("enrolment_id", eid), "backdate invoice");
  }

  // ----------------------------------------------------- portal accounts
  for (const s of students.filter((x) => x.profile !== "applicant").slice(0, 20)) {
    const email = `${s.number.toLowerCase()}@${STUDENT_EMAIL_DOMAIN}`;
    const uid = await createUser(email, `${s.first} ${people[students.indexOf(s)]![2]}`, s.phone, []);
    must(await admin.rpc("link_student_account", { p_student: s.id, p_user: uid }), "link");
    s.email = email;
  }

  // ------------------------------------------------------- M-Pesa payments
  let tx = 0;
  const transId = () => `SK${today.slice(2, 4)}${String.fromCharCode(65 + (tx % 26))}${String(4000 + tx++).padStart(5, "0")}Q`.slice(0, 10);
  async function mpesa(ref: string, amount: number, when: Date, phone: string, name: string) {
    const digits = phone.replace(/\D/g, "");
    const id = transId();
    return must(await admin.rpc("mpesa_record_confirmation", {
      p_trans_id: id, p_trans_type: "Pay Bill", p_trans_time: when.toISOString(), p_amount: amount,
      p_short_code: process.env.MPESA_SHORTCODE ?? "600999", p_bill_ref: ref,
      p_msisdn_masked: `${digits.slice(0, 6)}***${digits.slice(-3)}`, p_msisdn_hash: createHash("sha256").update(digits).digest("hex"),
      p_payer_name: name, p_org_balance: null as unknown as number, p_environment: "sandbox",
      p_raw: { TransID: id, TransTime: formatTransTime(when), TransAmount: amount, BillRefNumber: ref, source: "seed" },
    }), "mpesa");
  }

  let settled = false;
  const paymentOrder = [...students].sort((a, b) => Number(a.profile === "new_paid") - Number(b.profile === "new_paid"));
  for (const s of paymentOrder) {
    if (!s.schedule || s.profile === "awaiting_deposit") continue;
    if (s.profile === "new_paid" && !settled) {
      settled = true;
    // Developer settlement for fees collected so far (before the newest deposits), approved and paid
    const { data: settlementId, error: setErr } = await acct.rpc("create_developer_settlement", { p_period_end: today, p_notes: "Fortnightly settlement" });
    if (!setErr && settlementId) {
      must(await mgr.rpc("update_developer_settlement", { p_settlement: settlementId, p_action: "approve" }), "approve settlement");
      must(await acct.rpc("update_developer_settlement", { p_settlement: settlementId, p_action: "pay", p_reference: "MPESA-B2B-77120", p_method: "mpesa" }), "pay settlement");
    }
    }
    const rows = s.schedule;
    const lastDue = (n: number) => rows.filter((r) => r.due_date <= today).slice(0, n);
    let toPay = rows.filter((r) => r.due_date <= today);
    if (s.profile === "behind") toPay = lastDue(Math.max(1, toPay.length - 2));
    if (s.profile === "graduate" || s.profile === "test_ready") toPay = rows; // paid up (some early)
    for (const [k, r] of toPay.entries()) {
      const payDay = r.due_date > today ? today : addDays(r.due_date, k === 0 ? 0 : Math.floor(rand() * 2));
      const when = at(payDay > today ? today : payDay, `${String(8 + Math.floor(rand() * 9)).padStart(2, "0")}:${String(Math.floor(rand() * 59)).padStart(2, "0")}`);
      if (when > new Date()) when.setTime(Date.now() - 3_600_000);
      // A few students type their number with spaces / lowercase – still matched.
      const ref = k === 1 && s.profile === "on_track" ? s.number.toLowerCase().replace(/(\d)/, " $1") : s.number;
      await mpesa(ref, r.amount, when, s.phone, `${s.first.toUpperCase()}`);
    }
  }
  // Unmatched payments for the reconciliation queue
  await mpesa("ELLYK", 1500, at(dayOffset(-1), "18:42"), "+254700199001", "WILSON");
  await mpesa("EK1O0O4", 1500, at(dayOffset(-1), "07:55"), "+254700199002", "AGNES");
  const unmatchedForMatch = await mpesa("FEES", 2000, at(dayOffset(-2), "12:10"), "+254700199003", "PETER") as { payment_id: string };

  // Accountant reconciles one unmatched payment to Martin (who said he forgot his account number)
  const martin = students.find((s) => s.first === "Martin")!;
  must(await acct.rpc("match_payment", { p_payment: unmatchedForMatch.payment_id, p_student: martin.id,
    p_note: "Student called the office with M-Pesa SMS; paid using 'FEES' as account" }), "match");

  // Cash payment recorded by admin, verified by accountant; and one still pending
  const adminC = await as("admin@ellyk.test");
  const behind = students.filter((s) => s.profile === "behind" && s.loc !== L.KTG);
  const cashId = must(await adminC.rpc("record_manual_payment", { p_student: behind[0]!.id, p_amount: 1000, p_source: "cash",
    p_reference: "Cash book p.42", p_received_at: at(dayOffset(-1), "11:00").toISOString(), p_notes: "Paid at front desk" }), "cash") as unknown as string;
  must(await acct.rpc("verify_payment", { p_payment: cashId, p_approve: true, p_note: "Counted and banked" }), "verify");
  if (behind[1]) {
    must(await adminC.rpc("record_manual_payment", { p_student: behind[1].id, p_amount: 1500, p_source: "cash",
      p_reference: "Cash book p.43", p_received_at: at(dayOffset(-1), "09:20").toISOString(), p_notes: "Partial instalment" }), "cash2");
  }

  // ------------------------------------------------- sessions, bookings, attendance
  const vehiclesByLoc = new Map<string, string[]>();
  for (const v of vehicles) if (v.status === "available") vehiclesByLoc.set(v.location_id, [...(vehiclesByLoc.get(v.location_id) ?? []), v.id]);
  const balances = must(await admin.from("v_enrolment_balances").select("enrolment_id, training_gate_met"), "balances");
  const gate = new Map(balances.map((b) => [b.enrolment_id, b.training_gate_met]));
  const trainable = students.filter((s) => s.enrolmentId && gate.get(s.enrolmentId));

  interface SessionRow { id: string; starts: Date; type: "theory" | "practical"; instructor: string; loc: string }
  const sessions: SessionRow[] = [];
  for (let d = -21; d <= 12; d++) {
    const date = dayOffset(d);
    if (weekday(date) === 0) continue; // Sunday off
    for (const ins of instructors) {
      const loc = ins.locs[d % 2 === 0 || ins.locs.length === 1 ? 0 : 1]!;
      const slots: [string, string, "theory" | "practical", string, number][] = [
        ["08:00", "10:00", "practical", "Practical: machine control", 3],
        ["10:30", "12:30", "practical", "Practical: road riding", 3],
        ["14:00", "15:30", "theory", "Theory: Highway Code & safety", 12],
      ];
      for (const [st, en, type, title, cap] of slots) {
        if (type === "theory" && weekday(date) % 2 === 0) continue;
        const row = must(await mgr.from("training_sessions").insert({
          location_id: loc, instructor_id: ins.id, lesson_type: type, title, capacity: cap,
          starts_at: at(date, st).toISOString(), ends_at: at(date, en).toISOString(),
          course_id: C["MC-A2"], created_by: managerId,
        }).select("id").single(), "session");
        sessions.push({ id: row.id, starts: at(date, st), type, instructor: ins.id, loc });
      }
    }
  }

  const bookingsBySession = new Map<string, string[]>();
  for (const s of trainable) {
    if (s.profile === "graduate") continue;
    const mine = sessions.filter((x) => x.loc === s.loc && x.starts >= at(s.start, "00:00"));
    const used = new Set<string>();
    let count = 0;
    for (const sess of mine) {
      if (count >= 12) break;
      const key = sess.starts.toISOString();
      if (used.has(key)) continue;
      const booked = bookingsBySession.get(sess.id) ?? [];
      const cap = sess.type === "theory" ? 12 : 3;
      if (booked.length >= cap || rand() < 0.45) continue;
      const vehicle = sess.type === "practical" ? (vehiclesByLoc.get(s.loc) ?? [])[booked.length] ?? null : null;
      const { error } = await mgr.from("session_bookings").insert({ session_id: sess.id, student_id: s.id, enrolment_id: s.enrolmentId!,
        vehicle_id: vehicle, booked_by: managerId });
      if (error) {
        if (!/full|overlap|conflicting|exclusion/i.test(error.message)) throw new Error(`booking: ${error.message}`);
        continue;
      }
      booked.push(s.id); bookingsBySession.set(sess.id, booked); used.add(key); count++;
    }
  }

  // Attendance for past sessions, recorded by the session's instructor
  for (const sess of sessions.filter((x) => x.starts < new Date())) {
    const booked = bookingsBySession.get(sess.id);
    if (!booked?.length) continue;
    const ins = instructors.find((x) => x.id === sess.instructor)!;
    const c = await as(ins.email);
    const entries = booked.map((sid) => {
      const r = rand();
      return { student_id: sid, status: r < 0.8 ? "present" : r < 0.88 ? "late" : r < 0.96 ? "absent" : "excused",
               notes: r > 0.96 ? "Called in sick" : null };
    });
    must(await c.rpc("record_attendance", { p_session: sess.id, p_entries: entries }), "attendance");
  }

  // ------------------------------------------------------- competencies
  const ratings = ["needs_improvement", "developing", "competent", "ready_for_test"] as const;
  for (const s of students.filter((x) => x.enrolmentId && ["graduate", "test_ready", "on_track", "behind"].includes(x.profile))) {
    const enr = must(await admin.from("enrolments").select("status, assigned_instructor_id").eq("id", s.enrolmentId!).single(), "enr");
    if (!["active", "training_complete"].includes(enr.status)) continue;
    const ins = instructors.find((x) => x.id === enr.assigned_instructor_id)!;
    const c = await as(ins.email);
    const progress = s.profile === "graduate" || s.profile === "test_ready" ? 1 : Math.min(0.9, (Date.parse(today) - Date.parse(s.start)) / (42 * 86_400_000));
    const entries = comps.map((k, idx) => {
      const level = progress >= 1 ? 3 : Math.max(0, Math.min(2, Math.floor(progress * 3 + (rand() - 0.5) - idx * 0.05)));
      return { competency_id: k.id, rating: progress >= 1 ? (idx % 3 === 0 ? "ready_for_test" : "competent") : ratings[level]!,
               comment: level === 0 ? "Needs more practice – keep at it" : idx === 5 && level >= 2 ? "Confident emergency stop" : null };
    });
    must(await c.rpc("assess_competencies", { p_enrolment: s.enrolmentId!, p_session: null as unknown as string, p_entries: entries }), "assess");
  }

  // ------------------------------------------------------------ NTSA
  async function uploadIdDoc(s: SeedStudent) {
    const path = `${s.id}/${crypto.randomUUID()}.pdf`;
    const pdf = new TextEncoder().encode(`%PDF-1.4\n% Fictional ID scan for ${s.number} (development seed)\n%%EOF\n`);
    must(await admin.storage.from("student-documents").upload(path, pdf, { contentType: "application/pdf" }), "upload");
    const doc = must(await admin.from("student_documents").insert({ student_id: s.id, document_type: "national_id", storage_path: path,
      file_name: `national-id-${s.number}.pdf`, mime_type: "application/pdf", size_bytes: pdf.byteLength, uploaded_by: adminId }).select().single(), "doc");
    return doc.id;
  }
  const ntsaStudents = students.filter((s) => ["graduate", "test_ready"].includes(s.profile));
  for (const [i, s] of ntsaStudents.entries()) {
    const registrar = await as(s.loc === L.KTG ? "admin.ktg@ellyk.test" : "admin@ellyk.test");
    const docId = await uploadIdDoc(s);
    must(await registrar.from("student_documents").update({ status: "verified", verified_by: s.loc === L.KTG ? admin2Id : adminId, verified_at: new Date().toISOString() }).eq("id", docId), "verify doc");
    const np = must(await admin.from("ntsa_processes").select("id").eq("enrolment_id", s.enrolmentId!).single(), "np");
    must(await registrar.rpc("ntsa_transition", { p_process: np.id, p_to: "ready_for_payment", p_note: "ID verified" }), "ntsa1");
    if (i === ntsaStudents.length - 1) continue; // one waits at ready-for-payment
    must(await registrar.rpc("ntsa_transition", { p_process: np.id, p_to: "payment_pending" }), "ntsa2");
    must(await acct.rpc("record_ntsa_payment", { p_process: np.id, p_amount: 1450, p_paid_on: dayOffset(-10 + i),
      p_reference: `ECZ${String(880000 + i * 37)}`, p_paid_from: "1000" }), "ntsa pay");
    const insC = await as(instructors.find((x) => x.locs.includes(s.loc))!.email);
    const { error: tcErr } = await insC.rpc("mark_training_complete", { p_enrolment: s.enrolmentId!, p_note: "All competencies signed off" });
    if (tcErr) must(await mgr.rpc("mark_training_complete", { p_enrolment: s.enrolmentId!, p_note: "Signed off by manager" }), "tc");
    must(await registrar.rpc("ntsa_transition", { p_process: np.id, p_to: "booking_pending" }), "ntsa3");
    if (i === ntsaStudents.length - 2) continue; // one awaiting booking
    must(await registrar.rpc("ntsa_transition", { p_process: np.id, p_to: "test_booked", p_details: { booking_reference: `NTSA-TB-${4410 + i}` } }), "ntsa4");
    const testDate = s.profile === "graduate" ? at(dayOffset(-6), "09:00") : at(dayOffset(3 + i), "09:00");
    must(await registrar.rpc("ntsa_transition", { p_process: np.id, p_to: "test_scheduled",
      p_details: { test_date: testDate.toISOString(), test_centre: s.loc === L.KTG ? "NTSA Kitengela Test Centre" : "NTSA Likoni Road Test Centre" } }), "ntsa5");
    if (s.profile === "graduate") {
      must(await registrar.rpc("record_test_result", { p_process: np.id, p_result: "passed", p_notes: "Passed model town board and riding test" }), "result");
      must(await registrar.rpc("complete_enrolment", { p_enrolment: s.enrolmentId! }), "complete");
    }
  }

  // ----------------------------------------------- finance housekeeping
  const cats = must(await admin.from("expense_categories").select("id, name"), "cats");
  const cat = (n: string) => cats.find((c) => c.name.startsWith(n))!.id;
  for (const e of [
    { expense_date: dayOffset(-20), category_id: cat("Rent"), location_id: L.TRD, vendor: "Demo Plaza Ltd", description: "Monthly rent – Thika Road campus", amount: 45000, paid_from: "1000" },
    { expense_date: dayOffset(-14), category_id: cat("Fuel"), location_id: L.KTG, vendor: "Kitengela Service Station", description: "Fuel for training motorcycles", amount: 6200, paid_from: "1000" },
    { expense_date: dayOffset(-30), category_id: cat("Maintenance"), location_id: L.TRD, vendor: "Roysambu Moto Works", description: "3,000 km service EK-M01", amount: 2800, paid_from: "1000", vehicle_id: vehicles[0]!.id },
    { expense_date: dayOffset(-7), category_id: cat("Marketing"), location_id: null, vendor: "Print Hub Kasarani", description: "Flyers for roadshow", amount: 3500, paid_from: "1000" },
    { expense_date: dayOffset(-2), category_id: cat("M-Pesa"), location_id: null, vendor: "Safaricom", description: "Paybill charges", amount: 640, paid_from: "1000" },
  ]) must(await acct.rpc("record_expense", { p: e }), "expense");

  // Refund request (overpayment) – Brenda paid extra by mistake
  const brenda = students.find((s) => s.first === "Brenda")!;
  if (brenda.schedule) {
    await mpesa(brenda.number, 30000, at(dayOffset(-1), "16:05"), brenda.phone, "BRENDA");
    must(await adminC.rpc("request_refund", { p_student: brenda.id, p_amount: 2000, p_reason: "Paid more than total course fee (sent twice)", p_method: "mpesa" }), "refund");
  }

  // ------------------------------------------------------------ leads (CRM)
  const leadDefs: [string, string, keyof typeof L, Database["public"]["Enums"]["lead_source"], Database["public"]["Enums"]["lead_stage"], number | null][] = [
    ["Moses Kiptoo", "+254700120101", "TRD", "walk_in", "new", 1], ["Winnie Auma", "+254700120102", "KTG", "whatsapp", "contacted", 2],
    ["Eric Maina", "+254700120103", "TRD", "referral", "interested", 0], ["Cynthia Jeptoo", "+254700120104", "RUI", "social_media", "follow_up", -1],
    ["Abdi Hussein", "+254700120105", "TRD", "roadshow", "ready_to_enrol", 1], ["Linet Kwamboka", "+254700120106", "KTG", "phone", "new", null],
    ["Patrick Odera", "+254700120107", "TRD", "agent", "lost", null], ["Rose Wairimu", "+254700120108", "RUI", "website", "contacted", 3],
    ["Frank Kiprop", "+254700120109", "KTG", "walk_in", "interested", 2], ["Mary Naliaka", "+254700120110", "TRD", "social_media", "follow_up", -3],
    ["Duncan Omwenga", "+254700120111", "TRD", "referral", "ready_to_enrol", 0], ["Lucy Muthoni", "+254700120112", "KTG", "whatsapp", "new", 0],
    ["Allan Kimani", "+254700120113", "RUI", "roadshow", "interested", 5], ["Beatrice Anyango", "+254700120114", "TRD", "phone", "lost", null],
  ];
  for (const [name, phone, loc, source, stage, fu] of leadDefs) {
    const c = await as(loc === "KTG" ? "admin.ktg@ellyk.test" : "admin@ellyk.test");
    const lead = must(await c.from("leads").insert({ full_name: name, phone, preferred_location_id: L[loc], interested_course_id: C["MC-A2"],
      source, stage: "new", assigned_to: loc === "KTG" ? admin2Id : adminId, created_by: loc === "KTG" ? admin2Id : adminId,
      follow_up_at: fu === null ? null : at(dayOffset(fu), "10:00").toISOString(),
      referral_name: source === "referral" ? "Former student" : null,
      notes: stage === "lost" ? null : "Asked about weekly instalments and weekend lessons" }).select().single(), "lead");
    must(await c.from("lead_activities").insert({ lead_id: lead.id, activity_type: "call", body: "Explained fees, deposit and weekly plan", created_by: loc === "KTG" ? admin2Id : adminId }), "lead act");
    if (stage !== "new") must(await c.from("leads").update({ stage, lost_reason: stage === "lost" ? "Chose a cheaper school" : null }).eq("id", lead.id), "lead stage");
  }
  // Lead converted to student (Gladys – applicant)
  const gladys = students.find((s) => s.first === "Gladys")!;
  const conv = must(await adminC.from("leads").insert({ full_name: "Gladys Kemunto", phone: gladys.phone, preferred_location_id: gladys.loc,
    interested_course_id: C["MC-A2"], source: "referral", stage: "converted", converted_student_id: gladys.id, created_by: adminId }).select().single(), "conv lead");
  void conv;

  // ---------------------------------------------- operations extras
  const johnC = await as("john.mwangi@ellyk.test");
  const futureJohn = sessions.find((x) => x.instructor === instructors[0]!.id && x.starts > at(dayOffset(2), "00:00"));
  if (futureJohn) {
    must(await johnC.from("session_change_requests").insert({ session_id: futureJohn.id, requested_by: (await johnC.auth.getUser()).data.user!.id,
      reason: "Attending NTSA instructor refresher training that morning", proposed_starts_at: at(dayOffset(4), "14:00").toISOString() }), "change req");
  }
  must(await johnC.from("vehicle_incidents").insert({ vehicle_id: vehicles[1]!.id, location_id: L.TRD, occurred_at: at(dayOffset(-4), "09:20").toISOString(),
    severity: "minor", description: "Learner dropped the bike during slow-riding cones drill. Left mirror cracked, no injuries.",
    reported_by: (await johnC.auth.getUser()).data.user!.id, instructor_id: instructors[0]!.id }), "incident");
  must(await johnC.from("fuel_logs").insert({ vehicle_id: vehicles[0]!.id, filled_on: dayOffset(-3), litres: 6.5, cost: 1170, odometer_km: 3110,
    recorded_by: (await johnC.auth.getUser()).data.user!.id }), "fuel");
  must(await johnC.from("instructor_time_off").insert({ instructor_id: instructors[0]!.id, starts_at: at(dayOffset(20), "00:00").toISOString(),
    ends_at: at(dayOffset(22), "23:59").toISOString(), reason: "Family function", status: "pending" }), "time off");

  must(await mgr.from("announcements").insert({ title: "Saturday road-safety clinic", body: "All students are welcome to a free road-safety clinic this Saturday at 2pm at the Thika Road campus. Bring your helmet!", audience: "students", is_important: true, created_by: managerId }), "announcement");

  const run = must(await admin.rpc("run_scheduled_notifications"), "notifications");
  console.log("Scheduled notifications:", run);

  const { count } = await admin.from("journal_entries").select("*", { count: "exact", head: true });
  console.log(`Done. ${students.length} students, ${sessions.length} sessions, ${count} journal entries.`);
  console.log(`\nDemo logins (password: ${DEMO_PASSWORD})`);
  console.log("  manager@ellyk.test · admin@ellyk.test · admin.ktg@ellyk.test · accounts@ellyk.test");
  console.log("  john.mwangi@ellyk.test (instructor) · platform@ellyk.test (platform owner)");
  console.log(`  Student: ${students[3]!.number} or phone ${students[3]!.phone} (sign in with student number or phone)`);
}

function hours() {
  const day = { open: "07:00", close: "18:00" };
  return { mon: day, tue: day, wed: day, thu: day, fri: day, sat: { open: "08:00", close: "16:00" }, sun: null };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
