'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertTriangle,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ShieldAlert,
} from 'lucide-react';

export function DataPurgeCard() {
  const [target, setTarget] = useState<'contacts' | 'listings'>('contacts');
  const [scope, setScope] = useState<'all' | 'range' | 'list'>('range');
  const [fromSerial, setFromSerial] = useState('');
  const [toSerial, setToSerial] = useState('');
  const [serialList, setSerialList] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  function handleOpenConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) {
      toast.error('Please enter your account password to authorize deletion.');
      return;
    }
    if (scope === 'range' && (!fromSerial.trim() || !toSerial.trim())) {
      toast.error('Please specify both starting and ending Serial Numbers.');
      return;
    }
    if (scope === 'list' && !serialList.trim()) {
      toast.error('Please enter at least one Serial Number to delete.');
      return;
    }
    setIsDialogOpen(true);
  }

  async function handleExecutePurge() {
    setLoading(true);
    try {
      const res = await fetch('/api/account/data-purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target,
          scope,
          fromSerial: fromSerial.trim(),
          toSerial: toSerial.trim(),
          serialList: serialList.trim(),
          password: password.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to purge data.');
      }

      toast.success(data.message || `Deleted ${data.deletedCount} records.`);
      setIsDialogOpen(false);
      setPassword('');
      setFromSerial('');
      setToSerial('');
      setSerialList('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error deleting data';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  const targetLabel = target === 'contacts' ? 'Contacts / Leads' : 'Property Listings';

  return (
    <>
      <Card className="border-destructive/30 bg-destructive/[0.02]">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-destructive" />
            <CardTitle className="text-base text-destructive">
              Danger Zone: Bulk Data Purge
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-muted-foreground leading-relaxed">
            Quickly remove mistakenly imported leads or properties. Choose a Serial Number range
            (e.g. C-1 to C-50 or L-1 to L-100) or wipe all records. Requires password confirmation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleOpenConfirm} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Target Data */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  Select Page / Data to Purge
                </Label>
                <Select
                  value={target}
                  onValueChange={(val) => setTarget(val as 'contacts' | 'listings')}
                >
                  <SelectTrigger className="h-9 text-xs bg-background border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contacts" className="text-xs">
                      Contacts & Leads
                    </SelectItem>
                    <SelectItem value="listings" className="text-xs">
                      Property Listings
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Scope */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  Deletion Scope
                </Label>
                <Select
                  value={scope}
                  onValueChange={(val) => setScope(val as 'all' | 'range' | 'list')}
                >
                  <SelectTrigger className="h-9 text-xs bg-background border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="range" className="text-xs">
                      By Serial Number Range (e.g. 1 to 50)
                    </SelectItem>
                    <SelectItem value="list" className="text-xs">
                      Specific Serial Numbers (Comma-separated)
                    </SelectItem>
                    <SelectItem value="all" className="text-xs text-destructive font-medium">
                      ⚠️ Delete ALL {targetLabel}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Scope Inputs */}
            {scope === 'range' && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                <Label className="text-xs font-medium text-muted-foreground block">
                  Serial Number Range
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="from-serial" className="text-[11px] text-muted-foreground mb-1 block">
                      From Serial No
                    </Label>
                    <Input
                      id="from-serial"
                      value={fromSerial}
                      onChange={(e) => setFromSerial(e.target.value)}
                      placeholder={target === 'contacts' ? 'e.g. C-1 or 1' : 'e.g. L-1 or 1'}
                      className="h-8 text-xs bg-background border-border text-foreground"
                    />
                  </div>
                  <div>
                    <Label htmlFor="to-serial" className="text-[11px] text-muted-foreground mb-1 block">
                      To Serial No
                    </Label>
                    <Input
                      id="to-serial"
                      value={toSerial}
                      onChange={(e) => setToSerial(e.target.value)}
                      placeholder={target === 'contacts' ? 'e.g. C-50 or 50' : 'e.g. L-50 or 50'}
                      className="h-8 text-xs bg-background border-border text-foreground"
                    />
                  </div>
                </div>
              </div>
            )}

            {scope === 'list' && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
                <Label htmlFor="serial-list" className="text-xs font-medium text-muted-foreground block">
                  List of Serial Numbers to Delete
                </Label>
                <Input
                  id="serial-list"
                  value={serialList}
                  onChange={(e) => setSerialList(e.target.value)}
                  placeholder={target === 'contacts' ? 'C-1, C-2, C-5, C-12' : 'P-1, P-2, P-3'}
                  className="h-9 text-xs bg-background border-border text-foreground"
                />
              </div>
            )}

            {/* Password input */}
            <div className="space-y-1.5 pt-1">
              <Label htmlFor="purge-password" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Lock className="size-3 text-muted-foreground" />
                Confirm Account Password
              </Label>
              <div className="relative">
                <Input
                  id="purge-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your account password to authorize deletion"
                  className="h-9 text-xs bg-background border-border text-foreground pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                type="submit"
                variant="destructive"
                disabled={!password.trim()}
                className="h-9 px-4 text-xs font-medium"
              >
                <Trash2 className="size-3.5 mr-1.5" />
                Purge Selected {targetLabel}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md border-destructive/40 bg-popover text-popover-foreground">
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              <DialogTitle className="text-base text-destructive">
                Are you absolutely sure?
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground pt-1.5 leading-relaxed">
              This will permanently delete the selected {targetLabel} from your account:
              <br />
              <strong>
                {scope === 'all'
                  ? 'All records in this account'
                  : scope === 'range'
                  ? `Range: ${fromSerial} to ${toSerial}`
                  : `Selected: ${serialList}`}
              </strong>
              . This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDialogOpen(false)}
              disabled={loading}
              className="text-xs border-border"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleExecutePurge}
              disabled={loading}
              className="text-xs"
            >
              {loading && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
              Yes, Permanently Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
