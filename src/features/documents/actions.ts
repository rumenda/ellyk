"use server";
import { revalidatePath } from "next/cache";
import { fail, friendlyDbError, ok, type ActionResult } from "@/lib/actions";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

const MAX = 10 * 1024 * 1024;
const TYPES: Record<string, { ext: string; magic: number[] }> = {
  "application/pdf": { ext: "pdf", magic: [0x25, 0x50, 0x44, 0x46] },
  "image/jpeg": { ext: "jpg", magic: [0xff, 0xd8, 0xff] },
  "image/png": { ext: "png", magic: [0x89, 0x50, 0x4e, 0x47] },
  "image/webp": { ext: "webp", magic: [0x52, 0x49, 0x46, 0x46] },
};
type DocType = Database["public"]["Enums"]["document_type"];
const DOC_TYPES: DocType[] = ["national_id", "passport_photo", "birth_certificate", "medical_certificate", "provisional_licence", "ntsa_document", "receipt", "certificate", "other"];

/**
 * Upload a student document to the private bucket. The declared MIME type
 * must match the file's magic bytes; storage + table RLS decide who may upload.
 */
export async function uploadStudentDocument(formData: FormData): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("Please sign in again.");
  const studentId = String(formData.get("student_id") ?? "");
  const type = String(formData.get("document_type") ?? "") as DocType;
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Choose a file to upload.");
  if (!DOC_TYPES.includes(type)) return fail("Choose a document type.");
  if (file.size > MAX) return fail("Files must be 10 MB or smaller.");
  const spec = TYPES[file.type];
  if (!spec) return fail("Upload a PDF, JPG, PNG or WebP file.");
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (!spec.magic.every((b, i) => head[i] === b)) return fail("That file doesn't look like a valid " + spec.ext.toUpperCase() + ".");
  if (user.studentId && user.studentId !== studentId && !user.roles.some((r) => r !== "student")) return fail("Not allowed.");

  const supabase = await createClient();
  const path = `${studentId}/${crypto.randomUUID()}.${spec.ext}`;
  const up = await supabase.storage.from("student-documents").upload(path, file, { contentType: file.type, upsert: false });
  if (up.error) return fail("Upload failed – you may not have permission for this student.");
  const safeName = file.name.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || `document.${spec.ext}`;
  const { error } = await supabase.from("student_documents").insert({
    student_id: studentId, document_type: type, storage_path: path, file_name: safeName, mime_type: file.type,
    size_bytes: file.size, uploaded_by: user.id,
  });
  if (error) {
    await supabase.storage.from("student-documents").remove([path]);
    return fail(friendlyDbError(error));
  }
  revalidatePath("/app/profile");
  revalidatePath(`/staff/students/${studentId}`);
  return ok(undefined, "Document uploaded");
}

export async function verifyStudentDocument(documentId: string, approve: boolean, reason?: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("Please sign in again.");
  if (!approve && (!reason || reason.trim().length < 5)) return fail("Give a reason for rejecting the document.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("student_documents").update({
    status: approve ? "verified" : "rejected", verified_by: user.id, verified_at: new Date().toISOString(),
    rejection_reason: approve ? null : reason,
  }).eq("id", documentId).select("student_id").single();
  if (error) return fail(friendlyDbError(error));
  revalidatePath(`/staff/students/${data.student_id}`);
  return ok(undefined, approve ? "Document verified" : "Document rejected");
}
