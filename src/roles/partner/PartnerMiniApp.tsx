import { Banknote, Copy, TrendingUp, Wallet } from "lucide-react";
import * as React from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Modal } from "../../components/ui/Modal";
import { PhoneShell } from "../../components/ui/PhoneShell";
import { SmartImage } from "../../components/ui/SmartImage";
import { useToast } from "../../components/ui/Toast";
import { cn } from "../../lib/cn";
import { usePublicConfig } from "../../lib/publicConfig";
import {
  partnerClients,
  partnerDownline,
  partnerStats,
  type PartnerClient,
  type PartnerNode,
} from "../../mock/partner";
import { MediaViewer, type MediaItem } from "./MediaViewer";

function rub(n: number) {
  return `${n.toLocaleString("ru-RU")} ₽`;
}

function formatShortDate(ts: number) {
  return new Date(ts).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit" });
}

async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
}

export function PartnerMiniApp() {
  const toast = useToast();
  const cfg = usePublicConfig();
  const planPricesRub = cfg.planPricesRub;
  const payoutPolicy = React.useMemo(
    () => ({
      clientDirectPct: cfg.commissionsPct.directClient,
      teamLevel1Pct: cfg.commissionsPct.teamL1,
      teamLevel2Pct: cfg.commissionsPct.teamL2,
      minWithdrawRub: cfg.payout.minWithdrawRub,
      moderationEta: cfg.payout.slaText,
      note: "Начисления считаются после успешной оплаты. При возвратах/фроде выплаты могут быть отменены.",
    }),
    [cfg.commissionsPct.directClient, cfg.commissionsPct.teamL1, cfg.commissionsPct.teamL2, cfg.payout.minWithdrawRub, cfg.payout.slaText],
  );
  const [view, setView] = React.useState<"dashboard" | "team">("dashboard");
  const [withdrawOpen, setWithdrawOpen] = React.useState(false);
  const [viewerOpen, setViewerOpen] = React.useState(false);
  const [viewerIndex, setViewerIndex] = React.useState(0);
  const [viewerItems, setViewerItems] = React.useState<MediaItem[]>([]);
  const [refTab, setRefTab] = React.useState<"clients" | "team">("clients");

  const promoItems = React.useMemo(() => {
    return (cfg.promos ?? [])
      .filter((p) => p.status === "active")
      .map((p) => ({
        id: p.promoId,
        title: p.title,
        caption: p.caption,
        kind: p.kind,
        coverUrl: p.coverUrl,
        mediaUrls: p.mediaUrls,
      }));
  }, [cfg.promos]);

  const textPromos = React.useMemo(() => promoItems.filter((p) => p.kind === "text"), [promoItems]);
  const mediaPromos = React.useMemo(() => promoItems.filter((p) => p.kind !== "text"), [promoItems]);

  const teamSummary = React.useMemo(() => {
    const directClients = partnerClients.filter((c) => c.level === 1);
    const level2Clients = partnerClients.filter((c) => c.level === 2);
    const paidClients = partnerClients.filter((c) => c.status === "paid");
    return {
      directClients: directClients.length,
      level2Clients: level2Clients.length,
      paidClients: paidClients.length,
      earningsRub: partnerClients.reduce((sum, c) => sum + c.yourEarningsRub, 0) + partnerDownline.reduce((s, p) => s + p.yourEarningsRub, 0),
    };
  }, []);

  return (
    <PhoneShell title="Партнерский кабинет" hideHeader>
      {view === "dashboard" ? (
        <div className="space-y-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-xl font-semibold leading-tight text-white/95">Партнер</div>
              <div className="mt-1 text-sm text-white/65">
                Баланс, статистика и готовые материалы для публикаций.
              </div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-xl border border-stroke bg-white/5 px-3 py-2 text-xs font-semibold text-white/80">
              <TrendingUp size={14} />
              Кабинет
            </div>
          </div>

          <Card className="relative overflow-hidden p-5">
            <div className="relative">
              <div className="text-xs text-white/60">Доступно</div>
              <div className="mt-1 text-3xl font-semibold tracking-tight text-white/95">
                {rub(partnerStats.balanceRub)}
              </div>
              <div className="mt-4">
                <Button className="w-full whitespace-nowrap" onClick={() => setWithdrawOpen(true)}>
                  <Wallet size={16} />
                  Вывести средства
                </Button>
                <div className="mt-2 text-xs text-white/55">
                  Выплаты проверяются анти‑фродом. {cfg.payout.slaText}.
                </div>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-3 gap-2">
            <Card className="p-4">
              <div className="text-xs text-white/60">Переходов</div>
              <div className="mt-1 text-lg font-semibold text-white/95">
                {partnerStats.clicks}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-white/60">Регистраций</div>
              <div className="mt-1 text-lg font-semibold text-white/95">
                {partnerStats.signups}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-white/60">Оплат</div>
              <div className="mt-1 text-lg font-semibold text-white/95">
                {partnerStats.paid}
              </div>
            </Card>
          </div>

          <Card className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white/90">Моя команда (MLM)</div>
                <div className="mt-1 text-xs text-white/55">
                  Смотрите, кто пришёл по вашей ссылке и сколько вы заработали.
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="shrink-0 whitespace-nowrap"
                onClick={() => setView("team")}
              >
                Открыть
              </Button>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-stroke bg-white/3 p-3">
                <div className="text-[11px] text-white/55">Клиенты L1</div>
                <div className="mt-1 text-base font-semibold text-white/95">{teamSummary.directClients}</div>
              </div>
              <div className="rounded-2xl border border-stroke bg-white/3 p-3">
                <div className="text-[11px] text-white/55">Клиенты L2</div>
                <div className="mt-1 text-base font-semibold text-white/95">{teamSummary.level2Clients}</div>
              </div>
              <div className="rounded-2xl border border-stroke bg-white/3 p-3">
                <div className="text-[11px] text-white/55">Оплатили</div>
                <div className="mt-1 text-base font-semibold text-white/95">{teamSummary.paidClients}</div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-white/60">
              <span>Ваш доход с команды</span>
              <span className="text-white/85">{rub(teamSummary.earningsRub)}</span>
            </div>
          </Card>

          <details className="rounded-2xl border border-stroke bg-white/3 p-4">
            <summary className="cursor-pointer select-none text-sm font-semibold text-white/90">
              Как начисляются выплаты
            </summary>
            <div className="mt-3 space-y-3 text-sm text-white/75">
              <div className="rounded-2xl border border-stroke bg-white/4 p-3 text-xs text-white/70">
                <div className="text-xs font-semibold text-white/85">Главное правило</div>
                <div className="mt-2">
                  Выплата = <span className="text-white/90 font-semibold">процент × сумма оплаты</span>.
                  Чем дороже тариф — тем больше вы получаете.
                </div>
              </div>

              <div className="rounded-2xl border border-stroke bg-white/4 p-3">
                <div className="text-xs font-semibold text-white/85">1) Ваши клиенты</div>
                <div className="mt-1 text-[11px] text-white/55">
                  Клиент пришёл по ссылке <span className="text-white/75">“Для клиентов”</span> и оплатил.
                </div>
                <div className="mt-2 grid gap-1 text-xs text-white/70">
                  <div className="flex items-center justify-between">
                    <span>STANDARD {planPricesRub.standard} ₽ → вам ({payoutPolicy.clientDirectPct}%)</span>
                    <span className="text-white/85">
                      {rub(Math.round((planPricesRub.standard * payoutPolicy.clientDirectPct) / 100))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>PRO {planPricesRub.pro} ₽ → вам ({payoutPolicy.clientDirectPct}%)</span>
                    <span className="text-white/85">
                      {rub(Math.round((planPricesRub.pro * payoutPolicy.clientDirectPct) / 100))}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-stroke bg-white/4 p-3">
                <div className="text-xs font-semibold text-white/85">2) Клиенты команды (MLM)</div>
                <div className="mt-1 text-[11px] text-white/55">
                  Вы пригласили партнёра по ссылке <span className="text-white/75">“Для команды”</span>. Когда он
                  приводит клиентов и они оплачивают — вы получаете процент сверху.
                </div>
                <div className="mt-2 grid gap-2 text-xs text-white/70">
                  <div className="rounded-2xl border border-stroke bg-white/3 p-3">
                      <div className="flex items-center justify-between">
                        <span>Партнёр 1‑го уровня</span>
                        <span className="text-white/85">{payoutPolicy.teamLevel1Pct}%</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-white/60">
                        <span>PRO {planPricesRub.pro} ₽ → вам</span>
                        <span className="text-white/80">
                          {rub(Math.round((planPricesRub.pro * payoutPolicy.teamLevel1Pct) / 100))}
                        </span>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-stroke bg-white/3 p-3">
                      <div className="flex items-center justify-between">
                        <span>Партнёр 2‑го уровня</span>
                        <span className="text-white/85">{payoutPolicy.teamLevel2Pct}%</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-white/60">
                        <span>PRO {planPricesRub.pro} ₽ → вам</span>
                        <span className="text-white/80">
                          {rub(Math.round((planPricesRub.pro * payoutPolicy.teamLevel2Pct) / 100))}
                        </span>
                      </div>
                    </div>
                </div>
                <div className="mt-2 text-[11px] text-white/55">
                  Партнёр тоже зарабатывает со своих клиентов — это отдельная выплата, а не “минус из вашей”.
                </div>
              </div>

              <div className="rounded-2xl border border-stroke bg-white/4 p-3">
                <div className="text-xs font-semibold text-white/85">Вывод денег</div>
                <div className="mt-2 grid gap-1 text-xs text-white/70">
                  <div className="flex items-center justify-between">
                    <span>Минимум для вывода</span>
                    <span className="text-white/85">{rub(payoutPolicy.minWithdrawRub)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Сколько ждать</span>
                    <span className="text-white/85">{payoutPolicy.moderationEta}</span>
                  </div>
                </div>
                <div className="mt-2 text-[11px] text-white/55">{payoutPolicy.note}</div>
              </div>
            </div>
          </details>

          <Card className="p-4">
            <div className="flex items-end justify-between gap-3">
              <div className="text-sm font-semibold text-white/90">Ссылки</div>
              <div className="inline-flex rounded-2xl border border-stroke bg-white/3 p-1">
              <button
                className={cn(
                  "rounded-xl px-3 py-1.5 text-xs font-semibold transition",
                  refTab === "clients"
                    ? "bg-white/8 text-white/90"
                    : "text-white/60 hover:text-white/80",
                )}
                onClick={() => setRefTab("clients")}
              >
                Для клиентов
              </button>
              <button
                className={cn(
                  "rounded-xl px-3 py-1.5 text-xs font-semibold transition",
                  refTab === "team"
                    ? "bg-white/8 text-white/90"
                    : "text-white/60 hover:text-white/80",
                )}
                onClick={() => setRefTab("team")}
              >
                Для команды
              </button>
            </div>
          </div>

          <div className="mt-2 flex gap-2">
            <div className="flex-1 rounded-xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/85">
              {refTab === "clients" ? partnerStats.clientReferralLink : partnerStats.teamReferralLink}
            </div>
            <Button
              variant="secondary"
              className="whitespace-nowrap"
              onClick={async () => {
                const link = refTab === "clients" ? partnerStats.clientReferralLink : partnerStats.teamReferralLink;
                try {
                  await copyToClipboard(link);
                  toast.push({ title: "Скопировано", description: "Ссылка в буфере обмена.", variant: "success" });
                } catch {
                  toast.push({
                    title: "Не удалось скопировать",
                    description: "Браузер запретил доступ к буферу.",
                    variant: "danger",
                  });
                }
              }}
            >
              <Copy size={16} />
              Скопировать
            </Button>
          </div>
          <div className="mt-2 text-xs text-white/55">
            {refTab === "clients"
              ? "Эта ссылка ведёт в фотосессию. Вы получаете % с оплат."
              : "Эта ссылка приглашает партнёров в вашу команду (MLM). Вы получаете % с их оборота."}
          </div>
        </Card>

        <div className="space-y-3">
          <div className="text-sm font-semibold text-white/90">Промо‑материалы</div>
          <div className="grid gap-2">
            {textPromos.map((p) => (
              <Card key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white/95">{p.title}</div>
                    <div className="mt-1 text-xs text-white/65">{p.caption}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="shrink-0 whitespace-nowrap"
                    onClick={async () => {
                      try {
                        await copyToClipboard(p.caption);
                        toast.push({
                          title: "Текст скопирован",
                          description: "Можно вставлять в пост/сторис.",
                          variant: "success",
                        });
                      } catch {
                        toast.push({ title: "Не удалось скопировать", variant: "danger" });
                      }
                    }}
                  >
                    <Copy size={14} />
                    Копировать
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          <div className="grid gap-3 pt-1">
            {mediaPromos.map((p, idx) => (
              <Card key={p.id} className="overflow-hidden">
                <button
                  className="flex w-full items-start gap-3 p-4 text-left"
                  onClick={() => {
                    const urls = p.mediaUrls ?? (p.coverUrl ? [p.coverUrl] : []);
                    setViewerItems(urls.map((u, i) => ({ id: `${p.id}_${i}`, url: u, label: p.title })));
                    setViewerIndex(0);
                    setViewerOpen(true);
                  }}
                >
                  <div className="w-20 shrink-0">
                    <SmartImage
                      src={p.coverUrl}
                      alt={p.title}
                      fallbackSeed={idx + 10}
                      className={cn("h-20 w-20 rounded-2xl", p.kind === "video" && "ring-1 ring-neonBlue/25")}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="truncate text-sm font-semibold text-white/95">{p.title}</div>
                      <span className="rounded-full border border-stroke bg-white/5 px-2.5 py-1 text-[11px] text-white/70">
                        {p.kind === "video" ? "VIDEO" : "PHOTO"}
                      </span>
                    </div>
                    <div className="mt-1 line-clamp-2 text-xs text-white/65">{p.caption}</div>
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="whitespace-nowrap"
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          try {
                            await copyToClipboard(p.caption);
                            toast.push({ title: "Текст скопирован", variant: "success" });
                          } catch {
                            toast.push({ title: "Не удалось скопировать", variant: "danger" });
                          }
                        }}
                      >
                        <Copy size={14} />
                        Текст
                      </Button>
                      <div className="self-center text-xs text-white/55">Нажмите, чтобы открыть</div>
                    </div>
                  </div>
                </button>
              </Card>
            ))}
          </div>
        </div>
      </div>
      ) : (
        <PartnerTeamScreen
          onBack={() => setView("dashboard")}
          clients={partnerClients}
          partners={partnerDownline}
        />
      )}

      <Modal
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        title="Запрос на вывод"
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-stroke bg-white/3 p-4 text-sm text-white/75">
            Вы собираетесь запросить вывод <span className="text-white/95 font-semibold">{rub(partnerStats.balanceRub)}</span>.
            В прототипе это действие отправит заявку в админ‑панель.
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setWithdrawOpen(false)}>
              Отмена
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                setWithdrawOpen(false);
                toast.push({
                  title: "Заявка отправлена",
                  description: "Статус можно будет отслеживать в истории выплат.",
                  variant: "success",
                });
              }}
            >
              <Banknote size={16} />
              Отправить
            </Button>
          </div>
        </div>
      </Modal>

      <MediaViewer
        open={viewerOpen}
        items={viewerItems}
        index={viewerIndex}
        onChangeIndex={setViewerIndex}
        onClose={() => setViewerOpen(false)}
      />
    </PhoneShell>
  );
}

function PartnerTeamScreen({
  onBack,
  clients,
  partners,
}: {
  onBack: () => void;
  clients: PartnerClient[];
  partners: PartnerNode[];
}) {
  const [tab, setTab] = React.useState<"clients" | "partners">("clients");
  const [q, setQ] = React.useState("");

  const filteredClients = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    const list = clients
      .slice()
      .sort((a, b) => b.lastActivityAt - a.lastActivityAt);
    if (!query) return list;
    return list.filter((c) => `${c.telegramUsername} ${c.id}`.toLowerCase().includes(query));
  }, [clients, q]);

  const filteredPartners = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    const list = partners.slice().sort((a, b) => b.turnoverRub - a.turnoverRub);
    if (!query) return list;
    return list.filter((p) => `${p.telegramUsername} ${p.id}`.toLowerCase().includes(query));
  }, [partners, q]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xl font-semibold leading-tight text-white/95">Команда</div>
          <div className="mt-1 text-sm text-white/65">Клиенты и партнёры вашей структуры.</div>
        </div>
        <Button variant="secondary" size="sm" className="shrink-0 whitespace-nowrap" onClick={onBack}>
          Назад
        </Button>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          className={cn(
            "flex-1 rounded-2xl border px-3 py-2 text-sm font-semibold transition",
            tab === "clients"
              ? "border-neonBlue/45 bg-neonBlue/12 text-white/95"
              : "border-stroke bg-white/4 text-white/70 hover:bg-white/6",
          )}
          onClick={() => setTab("clients")}
        >
          Клиенты
        </button>
        <button
          className={cn(
            "flex-1 rounded-2xl border px-3 py-2 text-sm font-semibold transition",
            tab === "partners"
              ? "border-neonBlue/45 bg-neonBlue/12 text-white/95"
              : "border-stroke bg-white/4 text-white/70 hover:bg-white/6",
          )}
          onClick={() => setTab("partners")}
        >
          Партнёры
        </button>
      </div>

      <div className="mt-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tab === "clients" ? "Поиск по @username или ID" : "Поиск по @username или ID"}
          className="w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
        />
      </div>

      <div className="mt-4 flex-1 space-y-2 overflow-y-auto pb-4">
        {tab === "clients"
          ? filteredClients.map((c) => (
              <Card key={c.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white/95">{c.telegramUsername}</div>
                    <div className="mt-1 text-xs text-white/60">
                      L{c.level} • {c.status === "paid" ? "Оплатил" : "Зарегистрировался"} • {formatShortDate(c.joinedAt)}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2.5 py-1 text-[11px]",
                      c.status === "paid"
                        ? "border-neonBlue/30 bg-neonBlue/10 text-white/85"
                        : "border-stroke bg-white/4 text-white/70",
                    )}
                  >
                    {c.status === "paid" ? (c.plan === "pro" ? "PRO" : "STANDARD") : "NEW"}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-stroke bg-white/3 p-3">
                    <div className="text-[11px] text-white/55">Заказы</div>
                    <div className="mt-1 text-sm font-semibold text-white/95">{c.ordersCount}</div>
                  </div>
                  <div className="rounded-2xl border border-stroke bg-white/3 p-3">
                    <div className="text-[11px] text-white/55">Оборот</div>
                    <div className="mt-1 text-sm font-semibold text-white/95">{rub(c.revenueRub)}</div>
                  </div>
                  <div className="rounded-2xl border border-stroke bg-white/3 p-3">
                    <div className="text-[11px] text-white/55">Ваш доход</div>
                    <div className="mt-1 text-sm font-semibold text-white/95">{rub(c.yourEarningsRub)}</div>
                  </div>
                </div>
              </Card>
            ))
          : filteredPartners.map((p) => (
              <Card key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white/95">{p.telegramUsername}</div>
                    <div className="mt-1 text-xs text-white/60">
                      Партнёр L{p.level} • {formatShortDate(p.joinedAt)}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full border border-stroke bg-white/4 px-2.5 py-1 text-[11px] text-white/75">
                    {rub(p.yourEarningsRub)}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-stroke bg-white/3 p-3">
                    <div className="text-[11px] text-white/55">Клики</div>
                    <div className="mt-1 text-sm font-semibold text-white/95">{p.referrals.clicks}</div>
                  </div>
                  <div className="rounded-2xl border border-stroke bg-white/3 p-3">
                    <div className="text-[11px] text-white/55">Оплаты</div>
                    <div className="mt-1 text-sm font-semibold text-white/95">{p.referrals.paid}</div>
                  </div>
                  <div className="rounded-2xl border border-stroke bg-white/3 p-3">
                    <div className="text-[11px] text-white/55">Оборот</div>
                    <div className="mt-1 text-sm font-semibold text-white/95">{rub(p.turnoverRub)}</div>
                  </div>
                </div>
              </Card>
            ))}
      </div>
    </div>
  );
}
