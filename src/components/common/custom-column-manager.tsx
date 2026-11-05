'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import type { CustomField, CustomFieldType } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Plus,
  Trash2,
  Pencil,
  Columns3,
  X,
  Check,
} from 'lucide-react';

interface CustomColumnManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: 'contact' | 'listing';
  onFieldsChanged?: () => void;
}

export function CustomColumnManager({
  open,
  onOpenChange,
  entityType,
  onFieldsChanged,
}: CustomColumnManagerProps) {
  const supabase = createClient();
  const { user, accountId } = useAuth();

  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [fieldName, setFieldName] = useState('');
  const [fieldType, setFieldType] = useState<CustomFieldType>('text');
  const [options, setOptions] = useState<string[]>([]);
  const [newOptionInput, setNewOptionInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const entityTitle = entityType === 'listing' ? 'Property Listings' : 'Contacts';

  const fetchFields = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('custom_fields')
      .select('*')
      .eq('account_id', accountId)
      .eq('entity_type', entityType)
      .order('field_name');

    if (!error && data) {
      setFields(data as CustomField[]);
    }
    setLoading(false);
  }, [accountId, entityType, supabase]);

  useEffect(() => {
    if (open && accountId) {
      fetchFields();
      resetForm();
    }
  }, [open, accountId, fetchFields]);

  function resetForm() {
    setEditingFieldId(null);
    setFieldName('');
    setFieldType('text');
    setOptions([]);
    setNewOptionInput('');
  }

  function handleStartEdit(field: CustomField) {
    setEditingFieldId(field.id);
    setFieldName(field.field_name);
    setFieldType((field.field_type as CustomFieldType) || 'text');
    const existingOpts =
      (field.field_options as { options?: string[] })?.options || [];
    setOptions(existingOpts);
    setNewOptionInput('');
  }

  function handleAddOption() {
    const trimmed = newOptionInput.trim();
    if (!trimmed) return;
    if (options.some((opt) => opt.toLowerCase() === trimmed.toLowerCase())) {
      toast.error(`Option "${trimmed}" already exists.`);
      return;
    }
    setOptions([...options, trimmed]);
    setNewOptionInput('');
  }

  function handleRemoveOption(index: number) {
    setOptions(options.filter((_, i) => i !== index));
  }

  async function handleSaveField() {
    const name = fieldName.trim();
    if (!name) {
      toast.error('Column name is required.');
      return;
    }

    if (!accountId || !user) {
      toast.error('Not authenticated.');
      return;
    }

    // Check duplicate name
    const isDuplicate = fields.some(
      (f) =>
        f.id !== editingFieldId &&
        f.field_name.toLowerCase() === name.toLowerCase()
    );
    if (isDuplicate) {
      toast.error(`A column named "${name}" already exists.`);
      return;
    }

    if (fieldType === 'select' && options.length === 0) {
      toast.error('Please add at least one dropdown option.');
      return;
    }

    setSaving(true);
    try {
      const fieldOptionsPayload =
        fieldType === 'select' ? { options } : {};

      if (editingFieldId) {
        // Update existing field
        const { error } = await supabase
          .from('custom_fields')
          .update({
            field_name: name,
            field_type: fieldType,
            field_options: fieldOptionsPayload,
          })
          .eq('id', editingFieldId);

        if (error) throw error;
        toast.success(`Column "${name}" updated.`);
      } else {
        // Create new field
        const { error } = await supabase.from('custom_fields').insert({
          account_id: accountId,
          user_id: user.id,
          entity_type: entityType,
          field_name: name,
          field_type: fieldType,
          field_options: fieldOptionsPayload,
        });

        if (error) throw error;
        toast.success(`Column "${name}" created.`);
      }

      resetForm();
      await fetchFields();
      onFieldsChanged?.();
    } catch (err: unknown) {
      console.error('[custom-column-manager] save error:', err);
      toast.error('Failed to save column.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteField(field: CustomField) {
    if (
      !window.confirm(
        `Are you sure you want to delete column "${field.field_name}"? Existing data in this column will be removed.`
      )
    ) {
      return;
    }

    setDeletingId(field.id);
    try {
      const { error } = await supabase
        .from('custom_fields')
        .delete()
        .eq('id', field.id);

      if (error) throw error;
      toast.success(`Column "${field.field_name}" deleted.`);
      if (editingFieldId === field.id) resetForm();
      await fetchFields();
      onFieldsChanged?.();
    } catch (err: unknown) {
      console.error('[custom-column-manager] delete error:', err);
      toast.error('Failed to delete column.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-popover text-popover-foreground sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Columns3 className="size-5 text-primary" />
            Manage {entityTitle} Columns
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Create, edit, or delete custom columns with text or dropdown options.
            These columns will appear in your table, filter views, and Add/Edit forms.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* CREATE / EDIT FORM */}
          <div className="rounded-lg border border-border bg-muted/30 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                {editingFieldId ? 'Edit Column' : 'Add New Column'}
              </span>
              {editingFieldId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetForm}
                  className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Cancel Edit
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                  Column Name
                </label>
                <Input
                  value={fieldName}
                  onChange={(e) => setFieldName(e.target.value)}
                  placeholder="e.g. Budget, Investor, Area"
                  className="bg-muted text-foreground h-8 text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                  Column Type
                </label>
                <Select
                  value={fieldType}
                  onValueChange={(val) => setFieldType(val as CustomFieldType)}
                >
                  <SelectTrigger className="w-full bg-muted text-foreground h-8 text-xs">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text (General)</SelectItem>
                    <SelectItem value="number">Number / Price</SelectItem>
                    <SelectItem value="select">Dropdown (Options)</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* DROPDOWN OPTIONS BUILDER */}
            {fieldType === 'select' && (
              <div className="space-y-2 pt-1 border-t border-border/50">
                <label className="text-[11px] font-medium text-muted-foreground block">
                  Dropdown Options
                </label>
                <div className="flex items-center gap-1.5">
                  <Input
                    value={newOptionInput}
                    onChange={(e) => setNewOptionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddOption();
                      }
                    }}
                    placeholder="Type an option & press Enter (e.g. House)"
                    className="bg-muted text-foreground h-8 text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddOption}
                    className="h-8 text-xs shrink-0"
                  >
                    <Plus className="size-3 mr-1" /> Add
                  </Button>
                </div>

                {options.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {options.map((opt, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-medium text-primary"
                      >
                        {opt}
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(idx)}
                          className="hover:text-red-400 focus:outline-none"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground italic">
                    No options added yet. Add at least one option above.
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end pt-1">
              <Button
                size="sm"
                onClick={handleSaveField}
                disabled={saving || !fieldName.trim()}
                className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {saving ? (
                  <Loader2 className="size-3.5 animate-spin mr-1" />
                ) : (
                  <Check className="size-3.5 mr-1" />
                )}
                {editingFieldId ? 'Save Changes' : 'Create Column'}
              </Button>
            </div>
          </div>

          {/* EXISTING COLUMNS LIST */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Existing Custom Columns ({fields.length})
            </h4>

            {loading ? (
              <div className="flex items-center justify-center p-6">
                <Loader2 className="size-5 animate-spin text-primary" />
              </div>
            ) : fields.length === 0 ? (
              <div className="rounded-lg border border-border p-6 text-center text-xs text-muted-foreground">
                No custom columns created yet. Add one above or import a spreadsheet to auto-generate them!
              </div>
            ) : (
              <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
                {fields.map((f) => {
                  const opts =
                    (f.field_options as { options?: string[] })?.options || [];
                  return (
                    <div
                      key={f.id}
                      className="flex items-center justify-between p-2.5 hover:bg-muted/30 transition-colors"
                    >
                      <div className="space-y-0.5 min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-xs text-foreground truncate">
                            {f.field_name}
                          </span>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {f.field_type}
                          </Badge>
                        </div>
                        {f.field_type === 'select' && opts.length > 0 && (
                          <p className="text-[11px] text-muted-foreground truncate">
                            Options: {opts.join(', ')}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleStartEdit(f)}
                          className="size-7 p-0 text-muted-foreground hover:text-foreground"
                          title="Edit column"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteField(f)}
                          disabled={deletingId === f.id}
                          className="size-7 p-0 text-muted-foreground hover:text-red-400"
                          title="Delete column"
                        >
                          {deletingId === f.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
