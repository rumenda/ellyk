"use client";
import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { useAction } from "@/components/forms/use-action";
import { uploadStudentDocument } from "@/features/documents/actions";

const OPTIONS = [
  ["national_id", "National ID / passport"], ["birth_certificate", "Birth certificate"], ["passport_photo", "Passport photo"],
  ["medical_certificate", "Medical certificate"], ["provisional_licence", "Provisional licence (PDL)"], ["ntsa_document", "NTSA document"],
  ["receipt", "Receipt"], ["certificate", "Certificate"], ["other", "Other"],
];

export function DocumentUpload({ studentId, label = "Upload document" }: { studentId: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const { run, pending } = useAction(uploadStudentDocument, { onSuccess: () => { setOpen(false); formRef.current?.reset(); } });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="secondary" size="sm"><Upload />{label}</Button></DialogTrigger>
      <DialogContent title="Upload a document" description="PDF or photo, up to 10 MB. Documents are private and only visible to authorised staff.">
        <form ref={formRef} className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(new FormData(e.currentTarget)); }}>
          <input type="hidden" name="student_id" value={studentId} />
          <Field label="Document type" htmlFor="document_type" required>
            <Select id="document_type" name="document_type" required defaultValue="national_id">
              {OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label="File" htmlFor="file" required>
            <Input id="file" name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" capture="environment" required className="py-2" />
          </Field>
          <Button type="submit" className="w-full" loading={pending}>Upload</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
