import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Private documents are never public URLs. The row must be visible to the user
 * under RLS; we then mint a 60-second signed URL (also RLS-checked by storage).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: doc } = await supabase.from("student_documents").select("storage_path, file_name").eq("id", id).maybeSingle();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data } = await supabase.storage.from("student-documents").createSignedUrl(doc.storage_path, 60, { download: doc.file_name });
  if (!data?.signedUrl) return NextResponse.json({ error: "Not available" }, { status: 403 });
  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "no-store" } });
}
