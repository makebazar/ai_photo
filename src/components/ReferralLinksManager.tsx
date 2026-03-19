import { Copy, Link, Plus, Trash2, Edit2, Users, TrendingUp, DollarSign } from "lucide-react";
import * as React from "react";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Modal } from "./ui/Modal";
import { useToast } from "./ui/Toast";
import { cn } from "../lib/cn";
import type { ReferralLink } from "../lib/referralApi";
import {
  getReferralLinks,
  createReferralLink,
  updateReferralLink,
  deleteReferralLink,
  trackReferralClick,
} from "../lib/referralApi";

function rub(n: number) {
  return `${n.toLocaleString("ru-RU")} ₽`;
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

type LinkCardProps = {
  link: ReferralLink;
  onUpdate: (link: ReferralLink) => void;
  onDelete: (link: ReferralLink) => void;
};

function LinkCard({ link, onUpdate, onDelete }: LinkCardProps) {
  const toast = useToast();
  const [editOpen, setEditOpen] = React.useState(false);

  const isClient = link.kind === "client";
  const isExpired = link.status === "expired" || (link.expires_at && new Date(link.expires_at) < new Date());
  const isInactive = link.status === "inactive";
  const isDisabled = isExpired || isInactive;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link.url);
      toast.push({
        title: "Ссылка скопирована",
        description: "Можно делиться с аудиторией.",
        variant: "success",
      });
      // Track click
      trackReferralClick({ linkId: link.id }).catch(() => {});
    } catch {
      toast.push({ title: "Не удалось скопировать", variant: "danger" });
    }
  };

  const toggleStatus = async () => {
    try {
      const newStatus = link.status === "active" ? "inactive" : "active";
      const updated = await updateReferralLink(link.id, { status: newStatus as any });
      onUpdate(updated);
      toast.push({
        title: newStatus === "active" ? "Ссылка активирована" : "Ссылка деактивирована",
        variant: "success",
      });
    } catch {
      toast.push({ title: "Ошибка обновления", variant: "danger" });
    }
  };

  const handleDelete = async () => {
    if (!confirm("Удалить эту ссылку? Статистика будет потеряна.")) return;
    try {
      await deleteReferralLink(link.id);
      onDelete(link);
      toast.push({ title: "Ссылка удалена", variant: "success" });
    } catch {
      toast.push({ title: "Ошибка удаления", variant: "danger" });
    }
  };

  return (
    <>
      <Card className={cn("p-4 transition-all", isDisabled && "opacity-60")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                  isClient
                    ? "border-neonBlue/30 bg-neonBlue/10 text-white/85"
                    : "border-neonViolet/30 bg-neonViolet/10 text-white/85"
                )}
              >
                {isClient ? "ДЛЯ КЛИЕНТОВ" : "ДЛЯ ПАРТНЁРОВ"}
              </span>
              {isDisabled && (
                <span className="rounded-full border border-stroke bg-white/4 px-2.5 py-1 text-[11px] text-white/60">
                  {isExpired ? "ИСТЕКЛА" : "НЕАКТИВНА"}
                </span>
              )}
            </div>

            <div className="mt-2 text-sm font-semibold text-white/95">
              {link.name || "Без названия"}
            </div>

            {link.description && (
              <div className="mt-1 text-xs text-white/60 line-clamp-2">{link.description}</div>
            )}

            {/* UTM tags */}
            {(link.utm_source || link.utm_campaign) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {link.utm_source && (
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/60">
                    utm_source: {link.utm_source}
                  </span>
                )}
                {link.utm_medium && (
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/60">
                    utm_medium: {link.utm_medium}
                  </span>
                )}
                {link.utm_campaign && (
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/60">
                    utm_campaign: {link.utm_campaign}
                  </span>
                )}
              </div>
            )}

            {/* Stats */}
            <div className="mt-4 grid grid-cols-4 gap-2">
              <div className="rounded-xl border border-stroke bg-white/3 p-2.5 text-center">
                <div className="text-[10px] text-white/50">Клики</div>
                <div className="mt-0.5 text-sm font-semibold text-white/90">{link.clicks}</div>
              </div>
              <div className="rounded-xl border border-stroke bg-white/3 p-2.5 text-center">
                <div className="text-[10px] text-white/50">Конверсии</div>
                <div className="mt-0.5 text-sm font-semibold text-white/90">{link.conversions}</div>
              </div>
              <div className="rounded-xl border border-stroke bg-white/3 p-2.5 text-center">
                <div className="text-[10px] text-white/50">Доход</div>
                <div className="mt-0.5 text-sm font-semibold text-white/90">{rub(link.total_revenue_rub)}</div>
              </div>
              <div className="rounded-xl border border-stroke bg-white/3 p-2.5 text-center">
                <div className="text-[10px] text-white/50">Заработано</div>
                <div className="mt-0.5 text-sm font-semibold text-neonBlue/90">{rub(link.total_earnings_rub)}</div>
              </div>
            </div>

            {/* Link URL */}
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-stroke bg-white/4 p-2">
              <Link size={14} className="shrink-0 text-white/40" />
              <div className="min-w-0 flex-1 truncate text-xs text-white/70">{link.url}</div>
            </div>

            {/* Actions */}
            <div className="mt-3 flex gap-2">
              <Button size="sm" className="flex-1" onClick={copyLink} disabled={isDisabled}>
                <Copy size={14} />
                Копировать
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
                <Edit2 size={14} />
              </Button>
              <Button size="sm" variant="secondary" onClick={toggleStatus}>
                {isDisabled ? "Включить" : "Выключить"}
              </Button>
              <Button size="sm" variant="secondary" onClick={handleDelete}>
                <Trash2 size={14} />
              </Button>
            </div>

            {/* Expiry info */}
            {(link.expires_at || link.max_uses) && (
              <div className="mt-2 text-[11px] text-white/50">
                {link.expires_at && (
                  <span>
                    Действует до {formatDate(link.expires_at)}
                    {link.max_uses && " • "}
                  </span>
                )}
                {link.max_uses && (
                  <span>
                    {link.current_uses}/{link.max_uses} использований
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Редактировать ссылку">
        <EditLinkForm
          link={link}
          onSave={(updated) => {
            onUpdate(updated);
            setEditOpen(false);
          }}
          onCancel={() => setEditOpen(false)}
        />
      </Modal>
    </>
  );
}

function EditLinkForm({
  link,
  onSave,
  onCancel,
}: {
  link: ReferralLink;
  onSave: (link: ReferralLink) => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const [name, setName] = React.useState(link.name || "");
  const [description, setDescription] = React.useState(link.description || "");
  const [utmSource, setUtmSource] = React.useState(link.utm_source || "");
  const [utmCampaign, setUtmCampaign] = React.useState(link.utm_campaign || "");
  const [busy, setBusy] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const updated = await updateReferralLink(link.id, {
        name: name || null,
        description: description || null,
        utmSource: utmSource || null,
        utmCampaign: utmCampaign || null,
      });
      onSave(updated);
      toast.push({ title: "Сохранено", variant: "success" });
    } catch {
      toast.push({ title: "Ошибка сохранения", variant: "danger" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs text-white/60">Название</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
          placeholder="Например: Пост в Telegram"
        />
      </div>

      <div>
        <label className="text-xs text-white/60">Описание</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 w-full rounded-xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
          rows={2}
          placeholder="Где будете размещать ссылку"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-white/60">utm_source</label>
          <input
            value={utmSource}
            onChange={(e) => setUtmSource(e.target.value)}
            className="mt-1 w-full rounded-xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
            placeholder="telegram, vk..."
          />
        </div>
        <div>
          <label className="text-xs text-white/60">utm_campaign</label>
          <input
            value={utmCampaign}
            onChange={(e) => setUtmCampaign(e.target.value)}
            className="mt-1 w-full rounded-xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
            placeholder="black_friday..."
          />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit" className="flex-1" disabled={busy}>
          Сохранить
        </Button>
      </div>
    </form>
  );
}

export function ReferralLinksManager() {
  const toast = useToast();
  const [links, setLinks] = React.useState<ReferralLink[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [filter, setFilter] = React.useState<"all" | "client" | "team">("all");

  React.useEffect(() => {
    loadLinks();
  }, []);

  const loadLinks = async () => {
    try {
      setLoading(true);
      const data = await getReferralLinks();
      setLinks(data);
    } catch (err) {
      toast.push({
        title: "Ошибка загрузки",
        description: err instanceof Error ? err.message : "Не удалось загрузить ссылки",
        variant: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = (newLink: ReferralLink) => {
    setLinks((prev) => [newLink, ...prev]);
    toast.push({ title: "Ссылка создана", variant: "success" });
  };

  const handleUpdate = (updated: ReferralLink) => {
    setLinks((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  };

  const handleDelete = (deleted: ReferralLink) => {
    setLinks((prev) => prev.filter((l) => l.id !== deleted.id));
  };

  const filteredLinks = links.filter((l) => {
    if (filter === "all") return true;
    return l.kind === filter;
  });

  const stats = React.useMemo(() => {
    return {
      total: links.length,
      client: links.filter((l) => l.kind === "client").length,
      team: links.filter((l) => l.kind === "team").length,
      totalClicks: links.reduce((sum, l) => sum + l.clicks, 0),
      totalConversions: links.reduce((sum, l) => sum + l.conversions, 0),
      totalEarnings: links.reduce((sum, l) => sum + l.total_earnings_rub, 0),
    };
  }, [links]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white/90">Реферальные ссылки</div>
          <div className="mt-1 text-xs text-white/60">
            Создавайте ссылки для разных каналов продвижения
          </div>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus size={16} />
          Создать ссылку
        </Button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Card className="p-3">
          <div className="flex items-center gap-2 text-xs text-white/60">
            <Link size={14} />
            Всего ссылок
          </div>
          <div className="mt-1 text-lg font-semibold text-white/90">{stats.total}</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-xs text-white/60">
            <TrendingUp size={14} />
            Клики
          </div>
          <div className="mt-1 text-lg font-semibold text-white/90">{stats.totalClicks}</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-xs text-white/60">
            <Users size={14} />
            Конверсии
          </div>
          <div className="mt-1 text-lg font-semibold text-white/90">{stats.totalConversions}</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-xs text-white/60">
            <DollarSign size={14} />
            Заработано
          </div>
          <div className="mt-1 text-lg font-semibold text-neonBlue/90">{rub(stats.totalEarnings)}</div>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        <button
          className={cn(
            "rounded-xl border px-3 py-1.5 text-xs font-semibold transition",
            filter === "all"
              ? "border-neonBlue/45 bg-neonBlue/12 text-white/90"
              : "border-stroke bg-white/4 text-white/60 hover:text-white/80"
          )}
          onClick={() => setFilter("all")}
        >
          Все ({stats.total})
        </button>
        <button
          className={cn(
            "rounded-xl border px-3 py-1.5 text-xs font-semibold transition",
            filter === "client"
              ? "border-neonBlue/45 bg-neonBlue/12 text-white/90"
              : "border-stroke bg-white/4 text-white/60 hover:text-white/80"
          )}
          onClick={() => setFilter("client")}
        >
          Для клиентов ({stats.client})
        </button>
        <button
          className={cn(
            "rounded-xl border px-3 py-1.5 text-xs font-semibold transition",
            filter === "team"
              ? "border-neonViolet/45 bg-neonViolet/12 text-white/90"
              : "border-stroke bg-white/4 text-white/60 hover:text-white/80"
          )}
          onClick={() => setFilter("team")}
        >
          Для партнёров ({stats.team})
        </button>
      </div>

      {/* Links List */}
      {loading ? (
        <Card className="p-8 text-center text-sm text-white/60">Загрузка...</Card>
      ) : filteredLinks.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="text-sm text-white/60">
            {filter === "all" ? "Нет созданных ссылок" : "Нет ссылок в этой категории"}
          </div>
          <Button className="mt-3" size="sm" variant="secondary" onClick={() => setCreateOpen(true)}>
            <Plus size={14} />
            Создать первую ссылку
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredLinks.map((link) => (
            <LinkCard
              key={link.id}
              link={link}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Новая реферальная ссылка">
        <CreateLinkForm
          onCreate={handleCreate}
          onCancel={() => setCreateOpen(false)}
        />
      </Modal>
    </div>
  );
}

function CreateLinkForm({
  onCreate,
  onCancel,
}: {
  onCreate: (link: ReferralLink) => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const [kind, setKind] = React.useState<"client" | "team">("client");
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [utmSource, setUtmSource] = React.useState("");
  const [utmMedium, setUtmMedium] = React.useState("");
  const [utmCampaign, setUtmCampaign] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const newLink = await createReferralLink({
        kind,
        name: name || undefined,
        description: description || undefined,
        utmSource: utmSource || undefined,
        utmMedium: utmMedium || undefined,
        utmCampaign: utmCampaign || undefined,
      });
      onCreate(newLink);
    } catch (err) {
      toast.push({
        title: "Ошибка создания",
        description: err instanceof Error ? err.message : "Не удалось создать ссылку",
        variant: "danger",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Link Type */}
      <div>
        <label className="text-xs text-white/60">Тип ссылки</label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            className={cn(
              "rounded-xl border p-3 text-left transition",
              kind === "client"
                ? "border-neonBlue/45 bg-neonBlue/12"
                : "border-stroke bg-white/4 hover:bg-white/6"
            )}
            onClick={() => setKind("client")}
          >
            <div className="text-sm font-semibold text-white/90">Для клиентов</div>
            <div className="mt-1 text-xs text-white/60">Приводит клиентов в фотосессию</div>
          </button>
          <button
            type="button"
            className={cn(
              "rounded-xl border p-3 text-left transition",
              kind === "team"
                ? "border-neonViolet/45 bg-neonViolet/12"
                : "border-stroke bg-white/4 hover:bg-white/6"
            )}
            onClick={() => setKind("team")}
          >
            <div className="text-sm font-semibold text-white/90">Для партнёров</div>
            <div className="mt-1 text-xs text-white/60">Приглашает партнёров в команду</div>
          </button>
        </div>
      </div>

      <div>
        <label className="text-xs text-white/60">Название (опционально)</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
          placeholder="Например: Пост в Telegram"
        />
      </div>

      <div>
        <label className="text-xs text-white/60">Описание (опционально)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 w-full rounded-xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
          rows={2}
          placeholder="Где будете размещать ссылку"
        />
      </div>

      <div className="rounded-2xl border border-stroke bg-white/3 p-3">
        <div className="text-xs font-semibold text-white/85">UTM-метки (опционально)</div>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-white/60">utm_source</label>
            <input
              value={utmSource}
              onChange={(e) => setUtmSource(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stroke bg-white/4 px-2 py-1.5 text-xs text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
              placeholder="telegram, vk..."
            />
          </div>
          <div>
            <label className="text-[11px] text-white/60">utm_medium</label>
            <input
              value={utmMedium}
              onChange={(e) => setUtmMedium(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stroke bg-white/4 px-2 py-1.5 text-xs text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
              placeholder="cpc, cpm..."
            />
          </div>
          <div className="col-span-2">
            <label className="text-[11px] text-white/60">utm_campaign</label>
            <input
              value={utmCampaign}
              onChange={(e) => setUtmCampaign(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stroke bg-white/4 px-2 py-1.5 text-xs text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
              placeholder="black_friday, new_year..."
            />
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit" className="flex-1" disabled={busy}>
          <Plus size={16} />
          Создать
        </Button>
      </div>
    </form>
  );
}
