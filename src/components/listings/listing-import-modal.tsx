'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { parseListingCsv, type ParsedListingRow } from '@/lib/listings/parse-listing-csv';
import type { DiscoveredCustomColumn } from '@/lib/contacts/parse-contact-csv';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle,
  Building2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ListingImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
  existingCount?: number;
}

export function ListingImportModal({
  open,
  onOpenChange,
  onImported,
  existingCount = 0,
}: ListingImportModalProps) {
  const t = useTranslations('Listings.importModal');
  const supabase = createClient();
  const { accountId } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedListingRow[]>([]);
  const [discoveredColumns, setDiscoveredColumns] = useState<DiscoveredCustomColumn[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    failed: number;
  } | null>(null);

  function reset() {
    setFile(null);
    setParsedRows([]);
    setDiscoveredColumns([]);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setResult(null);

    const text = await selected.text();
    const { rows, hasRecognizedColumns, discoveredCustomColumns } = parseListingCsv(text, existingCount);

    if (!hasRecognizedColumns || rows.length === 0) {
      toast.error(t('toastNoValidRows'));
      setParsedRows([]);
      setDiscoveredColumns([]);
      return;
    }

    setParsedRows(rows);
    setDiscoveredColumns(discoveredCustomColumns);
  }

  async function handleImport() {
    if (parsedRows.length === 0) return;
    setImporting(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('Not authenticated');
      if (!accountId) throw new Error('Not linked to an account');

      // Auto-create any discovered custom fields for listings
      if (discoveredColumns.length > 0) {
        const { data: existingFields } = await supabase
          .from('custom_fields')
          .select('field_name')
          .eq('account_id', accountId)
          .eq('entity_type', 'listing');

        const existingNames = new Set(
          (existingFields ?? []).map((f) => f.field_name.toLowerCase())
        );

        for (const col of discoveredColumns) {
          if (!existingNames.has(col.name.toLowerCase())) {
            const nonEmpties = col.sampleValues.filter(Boolean);
            const uniqueVals = Array.from(new Set(nonEmpties));
            let fType = 'text';
            let fOpts: Record<string, unknown> = {};

            if (uniqueVals.length > 0 && uniqueVals.length <= 6 && nonEmpties.length >= 2) {
              fType = 'select';
              fOpts = { options: uniqueVals };
            } else if (nonEmpties.length > 0 && nonEmpties.every((v) => !isNaN(Number(v.replace(/[,%$]/g, ''))))) {
              fType = 'number';
            }

            await supabase.from('custom_fields').insert({
              account_id: accountId,
              user_id: user.id,
              entity_type: 'listing',
              field_name: col.name,
              field_type: fType,
              field_options: fOpts,
            });
            existingNames.add(col.name.toLowerCase());
          }
        }
      }

      let imported = 0;
      let failed = 0;

      const chunkSize = 50;
      for (let i = 0; i < parsedRows.length; i += chunkSize) {
        const chunk = parsedRows.slice(i, i + chunkSize);
        const rowsToInsert = chunk.map((r) => ({
          account_id: accountId,
          created_by: user.id,
          serial_no: r.serial_no || null,
          title: r.title,
          contact_number: r.contact_number || null,
          city: r.city || null,
          area: r.area || null,
          address: r.address || null,
          property_type: r.property_type || null,
          size: r.size || null,
          storey: r.storey || null,
          front_dimension: r.front_dimension || null,
          length_dimension: r.length_dimension || null,
          demand_price: r.demand_price || null,
          potential_rent: r.potential_rent || null,
          utilities: r.utilities || null,
          documents: r.documents || null,
          status: r.status,
          description: r.description || null,
          tags: r.tags || [],
          custom_fields: r.customFieldValues || {},
        }));

        const { data, error } = await supabase
          .from('property_listings')
          .insert(rowsToInsert)
          .select('id');

        if (error) {
          // Retry single rows so one failure doesn't ruin the whole batch
          for (const singleRow of rowsToInsert) {
            const { error: singleErr } = await supabase
              .from('property_listings')
              .insert(singleRow);
            if (!singleErr) {
              imported++;
            } else {
              failed++;
              console.error('[listing import] single row failed:', singleErr);
            }
          }
        } else {
          imported += data?.length ?? 0;
        }
      }

      setResult({ imported, failed });
      toast.success(t('toastImported', { count: imported }));
      onImported();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('toastFailed');
      toast.error(msg);
    } finally {
      setImporting(false);
    }
  }

  const PREVIEW_LIMIT = 5;
  const previewRows = parsedRows.slice(0, PREVIEW_LIMIT);
  const remainingCount = parsedRows.length - previewRows.length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Building2 className="size-5 text-primary" />
            {t('title')}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs leading-relaxed">
            {t('desc')}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          /* RESULT SCREEN */
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 rounded-lg border border-border p-4">
              <CheckCircle className="size-6 text-green-500 shrink-0" />
              <div>
                <p className="font-medium text-foreground text-sm">{t('importComplete')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('resultImported', { count: result.imported })}
                  {result.failed > 0 && ` · ${t('resultFailed', { count: result.failed })}`}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)} className="w-full sm:w-auto">
                {t('close')}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          /* UPLOAD & PREVIEW */
          <div className="space-y-4 py-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt"
              onChange={handleFileChange}
              className="hidden"
            />

            {!file ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-8 text-center cursor-pointer hover:bg-muted/40 transition-colors"
              >
                <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                  <Upload className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{t('uploadDropzone')}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('uploadHint')}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="size-4 text-primary shrink-0" />
                    <span className="truncate text-xs font-medium text-foreground">{file.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      reset();
                      fileInputRef.current?.click();
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground h-7 px-2"
                  >
                    Change
                  </Button>
                </div>

                {parsedRows.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{t('preview', { count: previewRows.length })}</span>
                      <span className="font-medium text-foreground">
                        {t('rowsReady', { count: parsedRows.length })}
                      </span>
                    </div>

                    <div className="rounded-lg border border-border overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="border-b border-border text-muted-foreground font-medium">
                            <tr>
                              <th className="px-3 py-2">Ref</th>
                              <th className="px-3 py-2">Title</th>
                              <th className="px-3 py-2">Type</th>
                              <th className="px-3 py-2">Size</th>
                              <th className="px-3 py-2">Demand</th>
                              <th className="px-3 py-2">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {previewRows.map((r, idx) => (
                              <tr key={idx} className="hover:bg-muted/30">
                                <td className="px-3 py-2 font-mono text-[11px] text-primary">
                                  {r.serial_no || '-'}
                                </td>
                                <td className="px-3 py-2 text-foreground font-medium max-w-[150px] truncate">
                                  {r.title}
                                </td>
                                <td className="px-3 py-2 text-muted-foreground">{r.property_type || '-'}</td>
                                <td className="px-3 py-2 text-muted-foreground">{r.size || '-'}</td>
                                <td className="px-3 py-2 text-muted-foreground font-semibold">
                                  {r.demand_price || '-'}
                                </td>
                                <td className="px-3 py-2">
                                  <span
                                    className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                      r.status === 'sold'
                                        ? 'bg-red-500/10 text-red-500'
                                        : 'bg-emerald-500/10 text-emerald-500'
                                    }`}
                                  >
                                    {r.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {remainingCount > 0 && (
                      <p className="text-right text-[11px] text-muted-foreground">
                        {t('moreRows', { count: remainingCount })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={importing}>
                {t('cancel')}
              </Button>
              <Button
                onClick={handleImport}
                disabled={parsedRows.length === 0 || importing}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {importing && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
                {t('importBtn', { count: parsedRows.length })}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

