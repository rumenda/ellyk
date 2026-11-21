"use client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/states";

export default function StaffError({ reset }: { error: Error; reset: () => void }) {
  return <Card><ErrorState action={<Button onClick={reset}>Try again</Button>} /></Card>;
}
