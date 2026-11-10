'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import {
  Bot,
  Loader2,
  Maximize2,
  Minimize2,
  RotateCcw,
  Send,
  Sparkles,
  UserCircle2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

interface CrmAssistantDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SUGGESTIONS = [
  'Aaj ki CRM update aur summary do',
  'Available properties kitni hain?',
  'Bahria Town mein 5 Marla options dikhao',
  'Latest contacts, leads aur deals batao',
];

export function CrmAssistantDrawer({
  open,
  onOpenChange,
}: CrmAssistantDrawerProps) {
  const t = useTranslations('CrmAssistant');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [turns, sending, open]);

  const sendText = async (rawText: string) => {
    const text = rawText.trim();
    if (!text || sending) return;

    const next: Turn[] = [...turns, { role: 'user', content: text }];
    setTurns(next);
    setInput('');
    setNotConfigured(false);
    setSending(true);

    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map((item) => ({
            role: item.role,
            content: item.content,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === 'ai_not_configured') {
          setNotConfigured(true);
          toast.error(t('notConfigured'));
        } else {
          toast.error(data.error ?? t('noReply'));
        }
        setTurns(turns);
        setInput(text);
        return;
      }

      setTurns([
        ...next,
        {
          role: 'assistant',
          content:
            typeof data.reply === 'string' && data.reply.trim()
              ? data.reply
              : t('noReply'),
        },
      ]);
    } catch {
      toast.error(t('unreachable'));
      setTurns(turns);
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendText(input);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className={cn(
          'flex h-full flex-col gap-0 p-0',
          expanded ? 'w-full sm:max-w-2xl' : 'w-full sm:max-w-md',
        )}
      >
        <SheetHeader className="flex flex-row items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate">{t('title')}</span>
            </SheetTitle>
            <SheetDescription className="truncate text-xs">
              {t('subtitle')}
            </SheetDescription>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setTurns([])}
              disabled={turns.length === 0 || sending}
              title={t('reset')}
              aria-label={t('reset')}
              className="text-muted-foreground"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setExpanded((prev) => !prev)}
              title={expanded ? t('collapse') : t('expand')}
              aria-label={expanded ? t('collapse') : t('expand')}
              className="hidden text-muted-foreground sm:inline-flex"
            >
              {expanded ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onOpenChange(false)}
              aria-label={t('close')}
              className="text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        {/* Transcript */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
          {turns.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Bot className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-foreground">
                {t('emptyTitle')}
              </p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                {t('emptyDesc')}
              </p>

              <div className="mt-5 flex w-full max-w-sm flex-col gap-2">
                {SUGGESTIONS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void sendText(prompt)}
                    disabled={sending}
                    className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-left text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-muted"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {notConfigured && (
                <Link
                  href="/agents"
                  onClick={() => onOpenChange(false)}
                  className="mt-4 text-xs font-medium text-primary underline underline-offset-4"
                >
                  {t('goToSetup')}
                </Link>
              )}
            </div>
          )}

          {turns.map((turn, idx) => (
            <div
              key={idx}
              className={cn(
                'flex gap-2',
                turn.role === 'user' ? 'justify-end' : 'justify-start',
              )}
            >
              {turn.role === 'assistant' && (
                <Bot className="mt-1 h-5 w-5 shrink-0 text-primary" />
              )}
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                  turn.role === 'user'
                    ? 'rounded-br-sm bg-primary text-primary-foreground'
                    : 'rounded-bl-sm bg-muted text-foreground',
                )}
              >
                <p className="whitespace-pre-wrap break-words">{turn.content}</p>
              </div>
              {turn.role === 'user' && (
                <UserCircle2 className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
              )}
            </div>
          ))}

          {sending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Bot className="h-5 w-5 text-primary" />
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t('thinking')}</span>
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-border p-3">
          {notConfigured && turns.length > 0 && (
            <div className="mb-2 flex items-center justify-between rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs">
              <span className="text-muted-foreground">{t('notConfigured')}</span>
              <Link
                href="/agents"
                onClick={() => onOpenChange(false)}
                className="font-medium text-primary underline"
              >
                {t('goToSetup')}
              </Link>
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('placeholder')}
              rows={1}
              className="max-h-32 flex-1 resize-none rounded-xl border border-border bg-muted px-3.5 py-2.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary/50"
            />
            <Button
              size="sm"
              onClick={() => void sendText(input)}
              disabled={!input.trim() || sending}
              aria-label={t('send')}
              className="h-9 w-9 shrink-0 p-0"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

