import { Banknote, Copy, Link, TrendingUp, Wallet, UserCheck, UserX, Loader2 } from "lucide-react";
import * as React from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Modal } from "../../components/ui/Modal";
import { PhoneShell } from "../../components/ui/PhoneShell";
import { SmartImage } from "../../components/ui/SmartImage";
import { useToast } from "../../components/ui/Toast";
import { cn } from "../../lib/cn";
import { usePublicConfig } from "../../lib/publicConfig";
import { ReferralLinksManager } from "../../components/ReferralLinksManager";
import { getPartnerStats, getDownline, getClients, type PartnerStats, type DownlinePartner, type ClientItem } from "../../lib/referralApi";
import { MediaViewer, type MediaItem } from "./MediaViewer";
import { useTelegramAuth } from "../../lib/useTelegramAuth";

function rub(n: number) {
  return `${n.toLocaleString("ru-RU")} ₽`;
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
  const [view, setView] = React.useState<"dashboard" | "team" | "ref">("dashboard");
  const [withdrawOpen, setWithdrawOpen] = React.useState(false);
  const [viewerOpen, setViewerOpen] = React.useState(false);
  const [viewerIndex, setViewerIndex] = React.useState(0);
  const [viewerItems, setViewerItems] = React.useState<MediaItem[]>([]);

  // Telegram auth
  const { isAuthenticated, user, partner, isLoading: authLoading, login } = useTelegramAuth();

  // Real data state
  const [stats, setStats] = React.useState<PartnerStats | null>(null);
  const [statsLoading, setStatsLoading] = React.useState(true);
  const [clients, setClients] = React.useState<ClientItem[]>([]);
  const [downline, setDownline] = React.useState<{ level1: DownlinePartner[] } | null>(null);
  const [isRegistering, setIsRegistering] = React.useState(false);

  const handleRegister = async () => {
    try {
      setIsRegistering(true);
      await login(true, "partner");
      toast.push({ title: "Вы успешно зарегистрированы!", variant: "success" });
    } catch (err) {
      toast.push({ title: "Ошибка регистрации", description: String(err), variant: "danger" });
    } finally {
      setIsRegistering(false);
    }
  };

  // Load stats on mount
  React.useEffect(() => {
    if (!partner) {
      setStatsLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      try {
        setStatsLoading(true);
        const [statsData, clientsData, downlineData] = await Promise.all([
          getPartnerStats().catch(() => null),
          getClients().catch(() => []),
          getDownline().catch(() => ({ level1: [] })),
        ]);
        if (!alive) return;
        setStats(statsData);
        setClients(clientsData);
        setDownline(downlineData);
      } catch {
        // Ignore errors, use empty state
      } finally {
        if (alive) setStatsLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [partner]);

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
    if (!downline) return { directClients: 0, level2Clients: 0, paidClients: 0, earningsRub: 0 };
    const l1 = downline.level1 || [];
    const l2 = l1.flatMap(p => p.children || []);
    const totalEarnings = l1.reduce((sum, p) => sum + (p.revenue_rub || 0), 0);
    return {
      directClients: l1.reduce((sum, p) => sum + (p.clients_count || 0), 0),
      level2Clients: l2.reduce((sum, p) => sum + (p.clients_count || 0), 0),
      paidClients: clients.filter(c => c.orders_count > 0).length,
      earningsRub: totalEarnings,
    };
  }, [downline, clients]);

  return (
    <PhoneShell title="Партнерский кабинет" hideHeader>
      {/* Auth Indicator */}
      <div className="fixed right-4 top-4 z-50">
        {authLoading ? (
          <Badge className="bg-white/10 text-white/60">
            <Loader2 size={12} className="mr-1 animate-spin" />
            Вход...
          </Badge>
        ) : isAuthenticated ? (
          <Badge className="bg-neonBlue/20 text-neonBlue border-neonBlue/30">
            <UserCheck size={12} className="mr-1" />
            {user?.username || `ID: ${user?.tgId}`}
          </Badge>
        ) : (
          <Badge className="bg-white/10 text-white/60">
            <UserX size={12} className="mr-1" />
            Гость
          </Badge>
        )}
      </div>

      {/* Not a partner view */}
      {isAuthenticated && !partner && !authLoading ? (
        <div className="flex h-[80vh] flex-col items-center justify-center p-6 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-neonBlue/10 text-neonBlue">
            <TrendingUp size={40} />
          </div>
          <h2 className="mb-2 text-2xl font-bold text-white">Станьте партнером</h2>
          <p className="mb-8 text-white/60">
            Зарабатывайте на рекомендациях нашего сервиса. Получайте до {payoutPolicy.clientDirectPct}% с каждого заказа ваших клиентов и до {payoutPolicy.teamLevel1Pct}% с заказов их команд.
          </p>
          <Button 
            className="w-full" 
            size="lg" 
            onClick={handleRegister}
            disabled={isRegistering}
          >
            {isRegistering ? (
              <>
                <Loader2 className="mr-2 animate-spin" size={18} />
                Регистрация...
              </>
            ) : (
              "Зарегистрироваться как партнер"
            )}
          </Button>
        </div>
      ) : view === "dashboard" ? (
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
                {rub(stats?.available_balance_rub || 0)}
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
                {stats?.direct_clients || 0}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-white/60">Регистраций</div>
              <div className="mt-1 text-lg font-semibold text-white/95">
                {teamSummary.directClients}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-white/60">Оплат</div>
              <div className="mt-1 text-lg font-semibold text-white/95">
                {teamSummary.paidClients}
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

          {/* Navigation to Ref Links */}
          <Card className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white/90">Реферальные ссылки</div>
                <div className="mt-1 text-xs text-white/60">
                  Создавайте ссылки с UTM-метками для разных каналов
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="shrink-0 whitespace-nowrap"
                onClick={() => setView("ref")}
              >
                <Link size={16} />
                Открыть
              </Button>
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
                    setViewerItems(urls.map((u: string, i: number) => ({ id: `${p.id}_${i}`, url: u, label: p.title })));
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
      ) : view === "ref" ? (
        <div className="space-y-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-xl font-semibold leading-tight text-white/95">Реферальные ссылки</div>
              <div className="mt-1 text-sm text-white/65">
                Управляйте ссылками, отслеживайте клики и конверсии.
              </div>
            </div>
            <Button variant="secondary" size="sm" className="shrink-0 whitespace-nowrap" onClick={() => setView("dashboard")}>
              Назад
            </Button>
          </div>
          <ReferralLinksManager />
        </div>
      ) : (
        <PartnerTeamScreen
          onBack={() => setView("dashboard")}
          clients={clients}
          downline={downline}
        />
      )}

      <Modal
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        title="Запрос на вывод"
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-stroke bg-white/3 p-4 text-sm text-white/75">
            Вы собираетесь запросить вывод <span className="text-white/95 font-semibold">{rub(stats?.available_balance_rub || 0)}</span>.
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
  downline,
}: {
  onBack: () => void;
  clients: ClientItem[];
  downline: { level1: DownlinePartner[] } | null;
}) {
  const [tab, setTab] = React.useState<"clients" | "partners">("clients");
  const [q, setQ] = React.useState("");

  const filteredClients = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    const list = clients
      .slice()
      .sort((a, b) => new Date(b.referred_at).getTime() - new Date(a.referred_at).getTime());
    if (!query) return list;
    return list.filter((c) => `${c.username || ''} ${c.id}`.toLowerCase().includes(query));
  }, [clients, q]);

  const filteredPartners = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    const list = (downline?.level1 || [])
      .slice()
      .sort((a, b) => (b.revenue_rub || 0) - (a.revenue_rub || 0));
    if (!query) return list;
    return list.filter((p) => `${p.username || ''} ${p.id}`.toLowerCase().includes(query));
  }, [downline, q]);

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
                    <div className="truncate text-sm font-semibold text-white/95">{c.username || `ID: ${c.id.slice(0, 8)}`}</div>
                    <div className="mt-1 text-xs text-white/60">
                      {c.orders_count > 0 ? "Оплатил" : "Зарегистрировался"} • {formatDate(c.referred_at)}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2.5 py-1 text-[11px]",
                      c.orders_count > 0
                        ? "border-neonBlue/30 bg-neonBlue/10 text-white/85"
                        : "border-stroke bg-white/4 text-white/70",
                    )}
                  >
                    {c.orders_count > 0 ? "CLIENT" : "NEW"}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-stroke bg-white/3 p-3">
                    <div className="text-[11px] text-white/55">Заказы</div>
                    <div className="mt-1 text-sm font-semibold text-white/95">{c.orders_count}</div>
                  </div>
                  <div className="rounded-2xl border border-stroke bg-white/3 p-3">
                    <div className="text-[11px] text-white/55">Оборот</div>
                    <div className="mt-1 text-sm font-semibold text-white/95">{rub(c.total_spent_rub)}</div>
                  </div>
                  <div className="rounded-2xl border border-stroke bg-white/3 p-3">
                    <div className="text-[11px] text-white/55">Последний вход</div>
                    <div className="mt-1 text-xs text-white/70 truncate">{c.last_seen_at ? formatDate(c.last_seen_at) : "—"}</div>
                  </div>
                </div>
              </Card>
            ))
          : filteredPartners.map((p) => (
              <Card key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white/95">{p.username || `ID: ${p.id.slice(0, 8)}`}</div>
                    <div className="mt-1 text-xs text-white/60">
                      Партнёр • {formatDate(p.created_at)}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full border border-stroke bg-white/4 px-2.5 py-1 text-[11px] text-white/75">
                    {rub(p.revenue_rub)}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-stroke bg-white/3 p-3">
                    <div className="text-[11px] text-white/55">Клиенты</div>
                    <div className="mt-1 text-sm font-semibold text-white/95">{p.clients_count}</div>
                  </div>
                  <div className="rounded-2xl border border-stroke bg-white/3 p-3">
                    <div className="text-[11px] text-white/55">Оборот</div>
                    <div className="mt-1 text-sm font-semibold text-white/95">{rub(p.revenue_rub)}</div>
                  </div>
                  <div className="rounded-2xl border border-stroke bg-white/3 p-3">
                    <div className="text-[11px] text-white/55">Детей</div>
                    <div className="mt-1 text-sm font-semibold text-white/95">{(p.children || []).length}</div>
                  </div>
                </div>
              </Card>
            ))}
      </div>
    </div>
  );
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
