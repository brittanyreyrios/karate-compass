import { ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { conversionCounts, type ConversionResult } from "@/lib/audit-conversion";

export function ConvertImportButton({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  return <Button variant="outline" disabled={busy} onClick={onClick} className="h-11 w-full sm:w-auto"><ArrowRightLeft className="h-4 w-4" />Convert to unclaimed student</Button>;
}

export function ConvertAllDialog({ count, open, onOpenChange, onConfirm, busy }: { count: number; open: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void; busy: boolean }) {
  return <AlertDialog open={open} onOpenChange={onOpenChange}><AlertDialogContent>
    <AlertDialogHeader><AlertDialogTitle>Convert {count} pending students?</AlertDialogTitle>
      <AlertDialogDescription>These students will be unclaimed, with photos OFF. Likely duplicates will be skipped. Students without a matching class will be listed as “In no class”. Parent emails stay private for linking after confirmed sign-in.</AlertDialogDescription>
    </AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={onConfirm}>{busy ? "Converting…" : `Convert ${count}`}</AlertDialogAction></AlertDialogFooter>
  </AlertDialogContent></AlertDialog>;
}

export function ConversionResults({ results }: { results: ConversionResult[] }) {
  if (results.length === 0) return null;
  const counts = conversionCounts(results);
  return <section aria-label="Conversion results" className="mt-4 border-t border-border pt-4">
    <h3 className="font-semibold">Conversion results</h3>
    <p role="status" className="mt-1 text-sm">Converted: {counts.converted} · In no class: {counts.noClass} · Skipped: {counts.skipped} · Failed: {counts.failed}</p>
    <ul className="mt-2 space-y-2 text-sm">{results.map((r) => <li key={r.import_id} className="break-words">
      <span className="font-semibold">{[r.first_name, r.last_name].filter(Boolean).join(" ") || "Import"}</span>{" — "}
      {r.status === "converted" ? r.in_no_class ? `In no class (${r.source_class_name})` : "Converted" : r.reason}
    </li>)}</ul>
  </section>;
}