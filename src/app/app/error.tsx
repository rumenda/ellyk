"use client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/states";

export default function StudentError({ reset }: { error: Error; reset: () => void }) {
  return <Card><ErrorState description="We couldn't load this page. If you're offline, reconnect and try again." action={<Button onClick={reset}>Try again</Button>} /></Card>;
}
