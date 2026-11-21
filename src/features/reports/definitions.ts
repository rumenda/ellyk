import "server-only";
import type { ServerClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/auth/constants";
import { fullName, toNumber, todayKE } from "@/lib/format";

export type ColType = "text" | "money" | "number" | "date" | "status" | "percent";
export interface Col { key: string; label: string; type?: ColType }
export interface Filters { from: string; to: string; location?: string; course?: string; status?: string }
export interface ReportResult { columns: Col[]; rows: Record<string, string | number | null>[]; totals?: Record<string, number> }
export interface ReportDef {
  slug: string; title: string; description: string; group: "Students" | "Training" | "NTSA" | "Finance";
  roles: AppRole[]; filters: ("date" | "location" | "course")[];
  run: (sb: ServerClient, f: Filters) => Promise<ReportResult>;
}

const FIN: AppRole[] = ["manager", "accountant"];
const OPS: AppRole[] = ["manager", "admin"];
const ALL: AppRole[] = ["manager", "admin", "accountant"];
const startTs = (d: string) => new Date(`${d}T00:00:00+03:00`).toISOString();
const endTs = (d: string) => new Date(`${d}T23:59:59+03:00`).toISOString();
const kday = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(new Date(iso));
const sumBy = (rows: Record<string, unknown>[], k: string) => rows.reduce((s, r) => s + toNumber(r[k] as number), 0);

async function names(sb: ServerClient) {
  const [l, c] = await Promise.all([sb.from("locations").select("id, name"), sb.from("courses").select("id, name")]);
  return { loc: new Map((l.data ?? []).map((x) => [x.id, x.name])), course: new Map((c.data ?? []).map((x) => [x.id, x.name])) };
}

export const REPORTS: ReportDef[] = [
  {
    slug: "student-register", title: "Student register", group: "Students", roles: ALL, filters: ["date", "location"],
    description: "Students registered in the period with contact details and status.",
    async run(sb, f) {
      let q = sb.from("students").select("student_number, first_name, middle_name, last_name, phone, status, registered_at, home_location_id").is("anonymized_at", null)
        .gte("registered_at", startTs(f.from)).lte("registered_at", endTs(f.to)).order("registered_at");
      if (f.location) q = q.eq("home_location_id", f.location);
      const [{ data }, n] = await Promise.all([q, names(sb)]);
      return { columns: [{ key: "number", label: "Student no." }, { key: "name", label: "Name" }, { key: "phone", label: "Phone" }, { key: "location", label: "Location" }, { key: "status", label: "Status", type: "status" }, { key: "registered", label: "Registered", type: "date" }],
        rows: (data ?? []).map((s) => ({ number: s.student_number, name: fullName(s), phone: s.phone, location: n.loc.get(s.home_location_id) ?? "", status: s.status, registered: kday(s.registered_at) })) };
    },
  },
  {
    slug: "enrolments", title: "Course enrolments", group: "Students", roles: ALL, filters: ["date", "location", "course"],
    description: "Enrolments created in the period by course and location.",
    async run(sb, f) {
      let q = sb.from("enrolments").select("enrolment_number, status, created_at, course_id, location_id, student:students(student_number, first_name, middle_name, last_name)")
        .gte("created_at", startTs(f.from)).lte("created_at", endTs(f.to)).order("created_at");
      if (f.location) q = q.eq("location_id", f.location);
      if (f.course) q = q.eq("course_id", f.course);
      const [{ data }, n] = await Promise.all([q, names(sb)]);
      return { columns: [{ key: "enr", label: "Enrolment" }, { key: "student", label: "Student" }, { key: "course", label: "Course" }, { key: "location", label: "Location" }, { key: "status", label: "Status", type: "status" }, { key: "date", label: "Created", type: "date" }],
        rows: (data ?? []).map((e) => ({ enr: e.enrolment_number, student: e.student ? `${fullName(e.student)} (${e.student.student_number})` : "", course: n.course.get(e.course_id) ?? "", location: n.loc.get(e.location_id) ?? "", status: e.status, date: kday(e.created_at) })) };
    },
  },
  {
    slug: "students-by-location", title: "Location comparison", group: "Students", roles: ALL, filters: ["date"],
    description: "Registrations, active students, collections, outstanding balances and pass rates per location.",
    async run(sb, f) {
      const [locs, studs, enrs, pays, bal] = await Promise.all([
        sb.from("locations").select("id, name"), sb.from("students").select("home_location_id, registered_at"),
        sb.from("enrolments").select("location_id, status"), sb.from("payments").select("location_id, amount, received_at").eq("status", "confirmed").gte("received_at", startTs(f.from)).lte("received_at", endTs(f.to)),
        sb.from("v_enrolment_balances").select("location_id, total_outstanding, status"),
      ]);
      const rows = (locs.data ?? []).map((l) => ({
        location: l.name,
        registrations: (studs.data ?? []).filter((s) => s.home_location_id === l.id && kday(s.registered_at) >= f.from && kday(s.registered_at) <= f.to).length,
        active: (enrs.data ?? []).filter((e) => e.location_id === l.id && ["active", "training_complete"].includes(e.status)).length,
        completed: (enrs.data ?? []).filter((e) => e.location_id === l.id && e.status === "completed").length,
        collected: sumBy((pays.data ?? []).filter((p) => p.location_id === l.id), "amount"),
        outstanding: sumBy((bal.data ?? []).filter((b) => b.location_id === l.id && b.status !== "cancelled" && b.status !== "withdrawn"), "total_outstanding"),
      }));
      return { columns: [{ key: "location", label: "Location" }, { key: "registrations", label: "Registrations", type: "number" }, { key: "active", label: "Active", type: "number" }, { key: "completed", label: "Completed", type: "number" }, { key: "collected", label: "Collected", type: "money" }, { key: "outstanding", label: "Outstanding", type: "money" }],
        rows, totals: { registrations: sumBy(rows, "registrations"), active: sumBy(rows, "active"), completed: sumBy(rows, "completed"), collected: sumBy(rows, "collected"), outstanding: sumBy(rows, "outstanding") } };
    },
  },
  {
    slug: "admissions", title: "Admissions conversion", group: "Students", roles: OPS, filters: ["date", "location"],
    description: "Leads by source and how many converted to students.",
    async run(sb, f) {
      let q = sb.from("leads").select("source, stage").gte("created_at", startTs(f.from)).lte("created_at", endTs(f.to));
      if (f.location) q = q.eq("preferred_location_id", f.location);
      const { data } = await q;
      const src = [...new Set((data ?? []).map((l) => l.source))];
      const rows = src.map((s) => {
        const all = (data ?? []).filter((l) => l.source === s);
        const conv = all.filter((l) => l.stage === "converted").length;
        return { source: s, leads: all.length, converted: conv, lost: all.filter((l) => l.stage === "lost").length, rate: all.length ? Math.round((conv / all.length) * 100) : 0 };
      }).sort((a, b) => b.leads - a.leads);
      return { columns: [{ key: "source", label: "Source", type: "status" }, { key: "leads", label: "Leads", type: "number" }, { key: "converted", label: "Converted", type: "number" }, { key: "lost", label: "Lost", type: "number" }, { key: "rate", label: "Conversion", type: "percent" }], rows };
    },
  },
  {
    slug: "attendance", title: "Attendance", group: "Training", roles: OPS, filters: ["date", "location"],
    description: "Attendance marks per student in the period.",
    async run(sb, f) {
      let q = sb.from("attendance").select("status, student:students(student_number, first_name, middle_name, last_name), session:training_sessions!inner(starts_at, location_id)")
        .gte("session.starts_at", startTs(f.from)).lte("session.starts_at", endTs(f.to));
      if (f.location) q = q.eq("session.location_id", f.location);
      const { data } = await q;
      const by = new Map<string, Record<string, string | number>>();
      for (const a of data ?? []) {
        const k = a.student?.student_number ?? "";
        const r = by.get(k) ?? { number: k, name: a.student ? fullName(a.student) : "", present: 0, late: 0, absent: 0, excused: 0 };
        r[a.status] = toNumber(r[a.status] as number) + 1;
        by.set(k, r);
      }
      const rows = [...by.values()].map((r) => ({ ...r, rate: Math.round(((toNumber(r.present as number) + toNumber(r.late as number)) / Math.max(1, toNumber(r.present as number) + toNumber(r.late as number) + toNumber(r.absent as number) + toNumber(r.excused as number))) * 100) }));
      return { columns: [{ key: "number", label: "Student no." }, { key: "name", label: "Name" }, { key: "present", label: "Present", type: "number" }, { key: "late", label: "Late", type: "number" }, { key: "absent", label: "Absent", type: "number" }, { key: "excused", label: "Excused", type: "number" }, { key: "rate", label: "Rate", type: "percent" }], rows };
    },
  },
  {
    slug: "instructor-workload", title: "Instructor workload", group: "Training", roles: OPS, filters: ["date", "location"],
    description: "Sessions, teaching hours and students taught per instructor.",
    async run(sb, f) {
      let q = sb.from("training_sessions").select("instructor_id, starts_at, ends_at, status, session_bookings(id, is_live), instructor:instructors(profile:profiles(full_name))")
        .gte("starts_at", startTs(f.from)).lte("starts_at", endTs(f.to)).not("status", "in", "(cancelled,rescheduled)");
      if (f.location) q = q.eq("location_id", f.location);
      const { data } = await q;
      const by = new Map<string, { name: string; sessions: number; hours: number; seats: number }>();
      for (const s of data ?? []) {
        const r = by.get(s.instructor_id) ?? { name: s.instructor?.profile?.full_name ?? "", sessions: 0, hours: 0, seats: 0 };
        r.sessions++; r.hours += (Date.parse(s.ends_at) - Date.parse(s.starts_at)) / 3_600_000; r.seats += s.session_bookings.filter((b) => b.is_live).length;
        by.set(s.instructor_id, r);
      }
      return { columns: [{ key: "name", label: "Instructor" }, { key: "sessions", label: "Sessions", type: "number" }, { key: "hours", label: "Hours", type: "number" }, { key: "seats", label: "Student bookings", type: "number" }],
        rows: [...by.values()].map((r) => ({ ...r, hours: Math.round(r.hours * 10) / 10 })) };
    },
  },
  {
    slug: "training-completion", title: "Training completion & test readiness", group: "Training", roles: OPS, filters: ["location"],
    description: "Active students' lesson and competency progress; who is ready for the NTSA test.",
    async run(sb, f) {
      let q = sb.from("v_enrolment_progress").select("*").in("status", ["active", "training_complete"]);
      if (f.location) q = q.eq("location_id", f.location);
      const { data } = await q;
      const ids = (data ?? []).map((p) => p.student_id!).filter(Boolean);
      const { data: st } = ids.length ? await sb.from("students").select("id, student_number, first_name, middle_name, last_name").in("id", ids) : { data: [] };
      return { columns: [{ key: "number", label: "Student no." }, { key: "name", label: "Name" }, { key: "lessons", label: "Lessons" }, { key: "skills", label: "Skills", type: "percent" }, { key: "ready", label: "Ready for test" }, { key: "status", label: "Status", type: "status" }],
        rows: (data ?? []).map((p) => { const s = (st ?? []).find((x) => x.id === p.student_id);
          return { number: s?.student_number ?? "", name: s ? fullName(s) : "", lessons: `${toNumber(p.theory_attended) + toNumber(p.practical_attended)}/${toNumber(p.theory_required) + toNumber(p.practical_required)}`,
            skills: toNumber(p.competency_progress_pct), ready: p.competencies_complete ? "Yes" : "No", status: p.status }; })
          .sort((a, b) => b.skills - a.skills) };
    },
  },
  {
    slug: "ntsa-pipeline", title: "NTSA pipeline & test performance", group: "NTSA", roles: ALL, filters: ["date"],
    description: "Students per NTSA stage, days in stage, and test results in the period.",
    async run(sb, f) {
      const [{ data: np }, { data: att }] = await Promise.all([
        sb.from("ntsa_processes").select("status, status_changed_at, student:students(student_number, first_name, middle_name, last_name)"),
        sb.from("ntsa_test_attempts").select("result, test_date").gte("test_date", startTs(f.from)).lte("test_date", endTs(f.to)),
      ]);
      const done = (att ?? []).filter((a) => a.result !== "pending");
      const pass = done.filter((a) => a.result === "passed").length;
      return { columns: [{ key: "number", label: "Student no." }, { key: "name", label: "Name" }, { key: "status", label: "Stage", type: "status" }, { key: "days", label: "Days in stage", type: "number" }],
        rows: (np ?? []).map((p) => ({ number: p.student?.student_number ?? "", name: p.student ? fullName(p.student) : "", status: p.status, days: Math.floor((Date.now() - Date.parse(p.status_changed_at)) / 86_400_000) })).sort((a, b) => b.days - a.days),
        totals: { tests_taken: done.length, passed: pass, pass_rate: done.length ? Math.round((pass / done.length) * 100) : 0 } };
    },
  },
  {
    slug: "collections", title: "Fee collections", group: "Finance", roles: FIN, filters: ["date", "location"],
    description: "Every confirmed payment in the period with method and reference.",
    async run(sb, f) {
      let q = sb.from("payments").select("receipt_number, amount, received_at, source, external_reference, location_id, student:students(student_number, first_name, middle_name, last_name)")
        .eq("status", "confirmed").gte("received_at", startTs(f.from)).lte("received_at", endTs(f.to)).order("received_at");
      if (f.location) q = q.eq("location_id", f.location);
      const [{ data }, n] = await Promise.all([q, names(sb)]);
      const rows = (data ?? []).map((p) => ({ date: kday(p.received_at), receipt: p.receipt_number, student: p.student ? `${fullName(p.student)} (${p.student.student_number})` : "", location: p.location_id ? n.loc.get(p.location_id) ?? "" : "", method: p.source === "mpesa_c2b" ? "M-Pesa" : p.source, reference: p.external_reference, amount: toNumber(p.amount) }));
      return { columns: [{ key: "date", label: "Date", type: "date" }, { key: "receipt", label: "Receipt" }, { key: "student", label: "Student" }, { key: "location", label: "Location" }, { key: "method", label: "Method" }, { key: "reference", label: "Reference" }, { key: "amount", label: "Amount", type: "money" }],
        rows, totals: { amount: sumBy(rows, "amount") } };
    },
  },
  {
    slug: "collections-by-course", title: "Collections by location & course", group: "Finance", roles: FIN, filters: ["date"],
    description: "Allocated fees in the period split by location, course and component.",
    async run(sb, f) {
      const { data } = await sb.from("payment_allocations").select("amount, allocated_at, line:invoice_lines!inner(component, invoice:invoices!inner(location_id, enrolment:enrolments(course_id)))")
        .gte("allocated_at", startTs(f.from)).lte("allocated_at", endTs(f.to));
      const n = await names(sb);
      const by = new Map<string, Record<string, string | number>>();
      for (const a of data ?? []) {
        const loc = n.loc.get(a.line!.invoice!.location_id) ?? ""; const course = n.course.get(a.line!.invoice!.enrolment?.course_id ?? "") ?? "Other";
        const k = `${loc}|${course}`;
        const r = by.get(k) ?? { location: loc, course, registration: 0, tuition: 0, ntsa: 0, service_fee: 0, other: 0, total: 0 };
        r[a.line!.component] = toNumber(r[a.line!.component] as number) + toNumber(a.amount); r.total = toNumber(r.total as number) + toNumber(a.amount);
        by.set(k, r);
      }
      const rows = [...by.values()];
      return { columns: [{ key: "location", label: "Location" }, { key: "course", label: "Course" }, { key: "registration", label: "Registration", type: "money" }, { key: "tuition", label: "Tuition", type: "money" }, { key: "ntsa", label: "NTSA (held)", type: "money" }, { key: "service_fee", label: "Service fee (developer)", type: "money" }, { key: "total", label: "Total", type: "money" }],
        rows, totals: Object.fromEntries(["registration", "tuition", "ntsa", "service_fee", "total"].map((k) => [k, sumBy(rows, k)])) };
    },
  },
  {
    slug: "outstanding", title: "Outstanding balances", group: "Finance", roles: ALL, filters: ["location"],
    description: "Students with unpaid fees, split by component.",
    async run(sb, f) {
      let q = sb.from("v_enrolment_balances").select("*").gt("total_outstanding", 0).in("status", ["awaiting_deposit", "active", "training_complete", "suspended", "completed"]);
      if (f.location) q = q.eq("location_id", f.location);
      const { data } = await q;
      const ids = (data ?? []).map((b) => b.student_id!).filter(Boolean);
      const { data: st } = ids.length ? await sb.from("students").select("id, student_number, first_name, middle_name, last_name, phone").in("id", ids) : { data: [] };
      const rows = (data ?? []).map((b) => { const s = (st ?? []).find((x) => x.id === b.student_id);
        return { number: s?.student_number ?? "", name: s ? fullName(s) : "", phone: s?.phone ?? "", status: b.status, due: toNumber(b.total_due), paid: toNumber(b.total_paid), tuition: toNumber(b.tuition_due) - toNumber(b.tuition_paid), ntsa: toNumber(b.ntsa_due) - toNumber(b.ntsa_paid), outstanding: toNumber(b.total_outstanding) }; })
        .sort((a, b) => b.outstanding - a.outstanding);
      return { columns: [{ key: "number", label: "Student no." }, { key: "name", label: "Name" }, { key: "phone", label: "Phone" }, { key: "status", label: "Status", type: "status" }, { key: "due", label: "Billed", type: "money" }, { key: "paid", label: "Paid", type: "money" }, { key: "ntsa", label: "NTSA unpaid", type: "money" }, { key: "outstanding", label: "Outstanding", type: "money" }],
        rows, totals: { due: sumBy(rows, "due"), paid: sumBy(rows, "paid"), ntsa: sumBy(rows, "ntsa"), outstanding: sumBy(rows, "outstanding") } };
    },
  },
  {
    slug: "ageing", title: "Payment ageing", group: "Finance", roles: ALL, filters: ["location"],
    description: "Overdue instalments grouped by days past due.",
    async run(sb, f) {
      const { data } = await sb.from("v_instalments").select("enrolment_id, label, due_date, amount_outstanding, status").gt("amount_outstanding", 0).lt("due_date", todayKE());
      const ids = [...new Set((data ?? []).map((i) => i.enrolment_id!))];
      let eq = sb.from("enrolments").select("id, location_id, status, student:students(student_number, first_name, middle_name, last_name, phone)").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      if (f.location) eq = eq.eq("location_id", f.location);
      const { data: enrs } = await eq;
      const rows = (data ?? []).flatMap((i) => {
        const e = (enrs ?? []).find((x) => x.id === i.enrolment_id);
        if (!e || !["awaiting_deposit", "active", "training_complete"].includes(e.status)) return [];
        const days = Math.floor((Date.parse(todayKE()) - Date.parse(i.due_date!)) / 86_400_000);
        return [{ number: e.student?.student_number ?? "", name: e.student ? fullName(e.student) : "", phone: e.student?.phone ?? "", instalment: i.label, due: i.due_date, days, bucket: days <= 30 ? "1–30" : days <= 60 ? "31–60" : "60+", outstanding: toNumber(i.amount_outstanding) }];
      }).sort((a, b) => b.days - a.days);
      return { columns: [{ key: "number", label: "Student no." }, { key: "name", label: "Name" }, { key: "phone", label: "Phone" }, { key: "instalment", label: "Instalment" }, { key: "due", label: "Due", type: "date" }, { key: "days", label: "Days overdue", type: "number" }, { key: "bucket", label: "Bucket" }, { key: "outstanding", label: "Amount", type: "money" }],
        rows, totals: { outstanding: sumBy(rows, "outstanding") } };
    },
  },
  {
    slug: "developer-fees", title: "Developer service-fee report", group: "Finance", roles: [...FIN, "platform_owner"], filters: ["date"],
    description: "Service fees collected per payment and their settlement status.",
    async run(sb, f) {
      const { data } = await sb.rpc("platform_fee_ledger", { p_from: f.from, p_to: f.to, p_limit: 500, p_offset: 0 });
      const rows = (data ?? []).map((r) => ({ date: r.collected_on, receipt: r.receipt_number, student: r.student_number, course: r.course, location: r.location, amount: toNumber(r.amount), settlement: r.settlement_number ?? "Unsettled", status: r.settlement_status ?? "unsettled" }));
      return { columns: [{ key: "date", label: "Collected", type: "date" }, { key: "receipt", label: "Receipt" }, { key: "student", label: "Student no." }, { key: "course", label: "Course" }, { key: "location", label: "Location" }, { key: "amount", label: "Amount", type: "money" }, { key: "settlement", label: "Batch" }, { key: "status", label: "Settlement", type: "status" }],
        rows, totals: { amount: sumBy(rows, "amount") } };
    },
  },
  {
    slug: "ntsa-payable", title: "NTSA payable", group: "Finance", roles: FIN, filters: [],
    description: "NTSA amounts billed, collected, paid to NTSA and still held, per student.",
    async run(sb) {
      const { data } = await sb.from("v_ntsa_funds").select("*");
      const ids = (data ?? []).map((x) => x.student_id!).filter(Boolean);
      const { data: st } = ids.length ? await sb.from("students").select("id, student_number, first_name, middle_name, last_name").in("id", ids) : { data: [] };
      const rows = (data ?? []).map((x) => { const s = (st ?? []).find((y) => y.id === x.student_id);
        return { number: s?.student_number ?? "", name: s ? fullName(s) : "", status: x.status, billed: toNumber(x.ntsa_billed), collected: toNumber(x.ntsa_collected), remitted: toNumber(x.ntsa_remitted), held: toNumber(x.ntsa_held) }; });
      return { columns: [{ key: "number", label: "Student no." }, { key: "name", label: "Name" }, { key: "status", label: "NTSA stage", type: "status" }, { key: "billed", label: "Billed", type: "money" }, { key: "collected", label: "Collected", type: "money" }, { key: "remitted", label: "Paid to NTSA", type: "money" }, { key: "held", label: "Held", type: "money" }],
        rows, totals: Object.fromEntries(["billed", "collected", "remitted", "held"].map((k) => [k, sumBy(rows, k)])) };
    },
  },
  {
    slug: "income-statement", title: "Monthly financial summary", group: "Finance", roles: FIN, filters: ["date", "location"],
    description: "Revenue and expenses by account from the general ledger (school income only).",
    async run(sb, f) {
      let q = sb.from("journal_lines").select("debit, credit, location_id, account:chart_of_accounts!inner(code, name, account_type), entry:journal_entries!inner(entry_date)")
        .in("account.account_type", ["revenue", "expense"]).gte("entry.entry_date", f.from).lte("entry.entry_date", f.to);
      if (f.location) q = q.eq("location_id", f.location);
      const { data } = await q;
      const by = new Map<string, { code: string; account: string; type: string; amount: number }>();
      for (const l of data ?? []) {
        const a = l.account!; const r = by.get(a.code) ?? { code: a.code, account: a.name, type: a.account_type, amount: 0 };
        r.amount += a.account_type === "revenue" ? toNumber(l.credit) - toNumber(l.debit) : toNumber(l.debit) - toNumber(l.credit);
        by.set(a.code, r);
      }
      const rows = [...by.values()].sort((a, b) => a.code.localeCompare(b.code));
      const rev = rows.filter((r) => r.type === "revenue").reduce((s, r) => s + r.amount, 0);
      const exp = rows.filter((r) => r.type === "expense").reduce((s, r) => s + r.amount, 0);
      return { columns: [{ key: "code", label: "Code" }, { key: "account", label: "Account" }, { key: "type", label: "Type", type: "status" }, { key: "amount", label: "Amount", type: "money" }],
        rows, totals: { revenue: rev, expenses: exp, surplus: rev - exp } };
    },
  },
  {
    slug: "tax-summary", title: "Tax summary", group: "Finance", roles: FIN, filters: ["date"],
    description: "Taxable sales and VAT output from invoices issued in the period.",
    async run(sb, f) {
      const { data } = await sb.from("invoice_lines").select("component, net_amount, tax_amount, gross_amount, tax_rate, invoice:invoices!inner(issue_date)").gte("invoice.issue_date", f.from).lte("invoice.issue_date", f.to);
      const by = new Map<string, { component: string; rate: number; net: number; tax: number; gross: number }>();
      for (const l of data ?? []) {
        const k = `${l.component}|${l.tax_rate}`; const r = by.get(k) ?? { component: l.component, rate: Math.round(toNumber(l.tax_rate) * 100), net: 0, tax: 0, gross: 0 };
        r.net += toNumber(l.net_amount); r.tax += toNumber(l.tax_amount); r.gross += toNumber(l.gross_amount); by.set(k, r);
      }
      const rows = [...by.values()];
      return { columns: [{ key: "component", label: "Component", type: "status" }, { key: "rate", label: "Rate", type: "percent" }, { key: "net", label: "Net", type: "money" }, { key: "tax", label: "Tax", type: "money" }, { key: "gross", label: "Gross", type: "money" }],
        rows, totals: { net: sumBy(rows, "net"), tax: sumBy(rows, "tax"), gross: sumBy(rows, "gross") } };
    },
  },
  {
    slug: "daily-reconciliation", title: "Daily reconciliation", group: "Finance", roles: FIN, filters: ["date"],
    description: "Per day: M-Pesa transactions received, matched, unmatched and amounts.",
    async run(sb, f) {
      const { data } = await sb.from("mpesa_transactions").select("trans_time, amount, status").gte("trans_time", startTs(f.from)).lte("trans_time", endTs(f.to));
      const by = new Map<string, { day: string; received: number; matched: number; unmatched: number; amount: number; unmatched_amount: number }>();
      for (const t of data ?? []) {
        const d = kday(t.trans_time); const r = by.get(d) ?? { day: d, received: 0, matched: 0, unmatched: 0, amount: 0, unmatched_amount: 0 };
        r.received++; r.amount += toNumber(t.amount);
        if (t.status === "matched") r.matched++; if (t.status === "unmatched") { r.unmatched++; r.unmatched_amount += toNumber(t.amount); }
        by.set(d, r);
      }
      const rows = [...by.values()].sort((a, b) => b.day.localeCompare(a.day));
      return { columns: [{ key: "day", label: "Date", type: "date" }, { key: "received", label: "Transactions", type: "number" }, { key: "matched", label: "Matched", type: "number" }, { key: "unmatched", label: "Unmatched", type: "number" }, { key: "amount", label: "Total", type: "money" }, { key: "unmatched_amount", label: "Unmatched amount", type: "money" }],
        rows, totals: { amount: sumBy(rows, "amount"), unmatched_amount: sumBy(rows, "unmatched_amount") } };
    },
  },
  {
    slug: "expenses", title: "Expenses", group: "Finance", roles: FIN, filters: ["date", "location"],
    description: "Expenses recorded in the period by category.",
    async run(sb, f) {
      let q = sb.from("expenses").select("expense_number, expense_date, description, vendor, amount, category:expense_categories(name), location_id").gte("expense_date", f.from).lte("expense_date", f.to).order("expense_date");
      if (f.location) q = q.eq("location_id", f.location);
      const { data } = await q;
      const rows = (data ?? []).map((e) => ({ date: e.expense_date, number: e.expense_number, category: e.category?.name ?? "", description: e.description, vendor: e.vendor, amount: toNumber(e.amount) }));
      return { columns: [{ key: "date", label: "Date", type: "date" }, { key: "number", label: "No." }, { key: "category", label: "Category" }, { key: "description", label: "Description" }, { key: "vendor", label: "Vendor" }, { key: "amount", label: "Amount", type: "money" }], rows, totals: { amount: sumBy(rows, "amount") } };
    },
  },
];

export function findReport(slug: string) {
  return REPORTS.find((r) => r.slug === slug);
}

export function parseFilters(sp: Record<string, string | undefined>): Filters {
  const today = todayKE();
  const valid = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined);
  return { from: valid(sp.from) ?? `${today.slice(0, 7)}-01`, to: valid(sp.to) ?? today, location: sp.location || undefined, course: sp.course || undefined };
}

/** CSV with BOM for Excel; neutralises spreadsheet formula injection. */
export function toCsv(r: ReportResult): string {
  const esc = (v: unknown) => {
    let s = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [r.columns.map((c) => esc(c.label)).join(","), ...r.rows.map((row) => r.columns.map((c) => esc(row[c.key])).join(","))];
  if (r.totals) lines.push("", ...Object.entries(r.totals).map(([k, v]) => `${esc(k)},${v}`));
  return "﻿" + lines.join("\r\n");
}
