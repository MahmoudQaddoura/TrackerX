import { Bell, CheckCheck, Circle, FolderKanban } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useNotificationMutations, useNotifications } from "@/hooks/useNotifications";

export function NotificationCenter() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const notifications = useNotifications();
  const mutations = useNotificationMutations();
  const items = notifications.data ?? [];
  const unread = items.filter((item) => !item.is_read).length;

  async function openItem(id: number, link: string | null) {
    await mutations.read.mutateAsync(id);
    setOpen(false);
    if (link) navigate(link);
  }

  return <div className="relative">
    <Button variant="ghost" size="icon" aria-label={`${unread} unread notifications`} onClick={() => setOpen((value) => !value)} className="relative">
      <Bell className="h-4 w-4" />
      {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
    </Button>
    {open && <div className="absolute right-0 top-11 z-50 w-[min(390px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
      <div className="flex items-center justify-between border-b border-border px-4 py-3"><div><p className="font-display font-semibold text-fg">Updates</p><p className="text-xs text-fg-muted">Assignments and live project activity</p></div>{unread > 0 && <Button variant="ghost" size="sm" onClick={() => mutations.readAll.mutate()}><CheckCheck className="h-4 w-4" /> Mark all read</Button>}</div>
      <div className="max-h-[420px] overflow-y-auto">
        {notifications.isLoading ? <p className="p-6 text-center text-sm text-fg-muted">Loading updates…</p> : items.length === 0 ? <div className="p-8 text-center"><Bell className="mx-auto h-7 w-7 text-fg-subtle" /><p className="mt-2 text-sm font-medium text-fg">You’re up to date</p><p className="mt-1 text-xs text-fg-muted">Project and task changes will appear here.</p></div> : items.map((item) => <button key={item.id} type="button" className="flex w-full items-start gap-3 border-b border-border/70 px-4 py-3 text-left last:border-0 hover:bg-raised" onClick={() => openItem(item.id, item.link)}>
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"><FolderKanban className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1"><span className="flex items-center gap-2 text-sm font-semibold text-fg">{!item.is_read && <Circle className="h-2 w-2 fill-accent text-accent" />}{item.title}</span><span className="mt-0.5 block text-xs leading-relaxed text-fg-muted">{item.message}</span><span className="mt-1 block text-[10px] text-fg-subtle">{new Date(item.created_at).toLocaleString()}</span></span>
        </button>)}
      </div>
    </div>}
  </div>;
}
