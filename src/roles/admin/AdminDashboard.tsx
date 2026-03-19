import { motion } from "framer-motion";
import {
  Check,
  CircleDollarSign,
  Cog,
  Crown,
  FileSearch,
  Megaphone,
  LayoutDashboard,
  Link as LinkIcon,
  Package,
  RotateCcw,
  ShieldAlert,
  ShoppingBag,
  Trash2,
  Users,
  X,
  RefreshCw,
} from "lucide-react";
import * as React from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Modal } from "../../components/ui/Modal";
import { useToast } from "../../components/ui/Toast";
import { cn } from "../../lib/cn";
import { formatDate, formatDateTime, formatRub, computeFinance, type AdminNav } from "./adminModel";
import { useAdminStore, type AdminAction } from "./adminStore";

export function AdminDashboard() {
  const toast = useToast();
  const { state, dispatch } = useAdminStore();
  const [loading, setLoading] = React.useState(false);

  const [withdrawalOpenId, setWithdrawalOpenId] = React.useState<string | null>(null);
  const [orderOpenId, setOrderOpenId] = React.useState<string | null>(null);
  const [deleteUserId, setDeleteUserId] = React.useState<string | null>(null);
  const [adjustPartnerId, setAdjustPartnerId] = React.useState<string | null>(null);
  const [resetOpen, setResetOpen] = React.useState(false);

  const refreshData = () => {
    // Hard reload from server data
    window.location.reload();
  };

  const openedWithdrawal = React.useMemo(
    () => state.withdrawals.find((w) => w.requestId === withdrawalOpenId) ?? null,
    [state.withdrawals, withdrawalOpenId],
  );
  const deleteUser = React.useMemo(
    () => state.users.find((u) => u.userId === deleteUserId) ?? null,
    [deleteUserId, state.users],
  );
  const adjustPartner = React.useMemo(
    () => state.partners.find((p) => p.partnerId === adjustPartnerId) ?? null,
    [adjustPartnerId, state.partners],
  );
  const openedOrder = React.useMemo(
    () => state.orders.find((o) => o.orderId === orderOpenId) ?? null,
    [orderOpenId, state.orders],
  );

  function act(action: AdminAction) {
    dispatch(action);
  }

  function toastStatus(title: string, description: string, variant: "success" | "danger" | undefined = undefined) {
    toast.push({ title, description, variant });
  }

  return (
    <div className="min-h-full">
      <div className="mx-auto w-[min(1400px,calc(100%-2rem))] py-10">
        <div className="grid grid-cols-12 gap-5">
          <aside className="col-span-12 lg:col-span-3">
            <div className="sticky top-6 space-y-4">
              <Card className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-white/95">
                      <Crown size={16} className="text-neonViolet" />
                      Owner Dashboard
                    </div>
                    <div className="mt-1 text-xs text-white/60">
                      Финансы • Анти‑фрод • Пользователи • Партнёры
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="secondary" onClick={refreshData} disabled={loading}>
                      <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                    </Button>
                    <Badge className="bg-white/5 text-white/80">/admin</Badge>
                  </div>
                </div>
              </Card>

              <Card className="p-2">
                <NavButton
                  active={state.nav === "overview"}
                  onClick={() => act({ type: "nav", nav: "overview" })}
                  icon={<LayoutDashboard size={16} />}
                  label="Сводка"
                />
                <NavButton
                  active={state.nav === "orders"}
                  onClick={() => act({ type: "nav", nav: "orders" })}
                  icon={<ShoppingBag size={16} />}
                  label="Заказы"
                />
                <NavButton
                  active={state.nav === "packs"}
                  onClick={() => act({ type: "nav", nav: "packs" })}
                  icon={<Package size={16} />}
                  label="Стили (Packs)"
                />
                <NavButton
                  active={state.nav === "promos"}
                  onClick={() => act({ type: "nav", nav: "promos" })}
                  icon={<Megaphone size={16} />}
                  label="Промо"
                />
                <NavButton
                  active={state.nav === "withdrawals"}
                  onClick={() => act({ type: "nav", nav: "withdrawals" })}
                  icon={<ShieldAlert size={16} />}
                  label="Заявки на вывод"
                />
                <NavButton
                  active={state.nav === "partners"}
                  onClick={() => act({ type: "nav", nav: "partners" })}
                  icon={<CircleDollarSign size={16} />}
                  label="Партнёры"
                />
                <NavButton
                  active={state.nav === "users"}
                  onClick={() => act({ type: "nav", nav: "users" })}
                  icon={<Users size={16} />}
                  label="Пользователи"
                />
                <NavButton
                  active={state.nav === "settings"}
                  onClick={() => act({ type: "nav", nav: "settings" })}
                  icon={<Cog size={16} />}
                  label="Настройки"
                />
                <NavButton
                  active={state.nav === "audit"}
                  onClick={() => act({ type: "nav", nav: "audit" })}
                  icon={<FileSearch size={16} />}
                  label="Аудит‑лог"
                />
              </Card>

              <div className="rounded-2xl border border-stroke bg-white/3 p-4 text-xs text-white/60">
                Все кнопки меняют mock‑данные локально и сохраняются в <span className="text-white/80">localStorage</span>.
              </div>
            </div>
          </aside>

          <main className="col-span-12 lg:col-span-9">
            {state.nav === "overview" ? (
              <Fade>
                <OverviewScreen
                  state={state}
                  onOpenWithdrawal={(id) => setWithdrawalOpenId(id)}
                  onGo={(nav) => act({ type: "nav", nav })}
                />
              </Fade>
            ) : null}

            {state.nav === "orders" ? (
              <Fade>
                <OrdersScreen
                  state={state}
                  onOpenOrder={(id) => setOrderOpenId(id)}
                  onSetStatus={(orderId, status, note) => {
                    act({ type: "order_status", orderId, status, note });
                    toastStatus("Статус заказа обновлён", `${orderId} → ${status}`, "success");
                  }}
                />
              </Fade>
            ) : null}

            {state.nav === "packs" ? (
              <Fade>
                <PacksScreen
                  state={state}
                  onCreate={(pack) => {
                    act({ type: "pack_create", pack });
                    toastStatus("Стиль создан", `${pack.title}`, "success");
                  }}
                  onUpdate={(packId, patch) => {
                    act({ type: "pack_update", packId, patch });
                    toastStatus("Стиль обновлён", `#${packId}`, "success");
                  }}
                  onToggle={(packId, status) => {
                    act({ type: "pack_toggle", packId, status });
                    toastStatus(status === "active" ? "Стиль включён" : "Стиль скрыт", `#${packId}`, "success");
                  }}
                />
              </Fade>
            ) : null}

            {state.nav === "promos" ? (
              <Fade>
                <PromosScreen
                  state={state}
                  onCreate={(promo) => {
                    act({ type: "promo_create", promo });
                    toastStatus("Промо создано", promo.title, "success");
                  }}
                  onUpdate={(promoId, patch) => {
                    act({ type: "promo_update", promoId, patch });
                    toastStatus("Промо обновлено", promoId, "success");
                  }}
                  onToggle={(promoId, status) => {
                    act({ type: "promo_toggle", promoId, status });
                    toastStatus(status === "active" ? "Промо включено" : "Промо скрыто", promoId, "success");
                  }}
                  onDelete={(promoId) => {
                    act({ type: "promo_delete", promoId });
                    toastStatus("Промо удалено", promoId, "danger");
                  }}
                />
              </Fade>
            ) : null}

            {state.nav === "withdrawals" ? (
              <Fade>
                <WithdrawalsScreen
                  state={state}
                  onOpenWithdrawal={(id) => setWithdrawalOpenId(id)}
                />
              </Fade>
            ) : null}

            {state.nav === "partners" ? (
              <Fade>
                <PartnersScreen
                  state={state}
                  onAdjust={(id) => setAdjustPartnerId(id)}
                  onToggleBlock={(partnerId, blocked) => {
                    act({ type: "partner_block", partnerId, blocked });
                    toastStatus(
                      blocked ? "Партнёр заблокирован" : "Партнёр разблокирован",
                      `#${partnerId}`,
                      blocked ? "danger" : "success",
                    );
                  }}
                />
              </Fade>
            ) : null}

            {state.nav === "users" ? (
              <Fade>
                <UsersScreen
                  state={state}
                  onDelete={(id) => setDeleteUserId(id)}
                  onSetModelStatus={(userId, status) => {
                    act({ type: "user_model_status", userId, status });
                    toastStatus("Статус обновлён", `User #${userId} → ${status}`, "success");
                  }}
                />
              </Fade>
            ) : null}

            {state.nav === "settings" ? (
              <Fade>
                <SettingsScreen
                  state={state}
                  onUpdate={(patch) => {
                    act({ type: "config_update", patch });
                    toastStatus("Настройки сохранены", "Применены к расчётам в сводке.", "success");
                  }}
                  onTurnover={(turnoverRub) => {
                    act({ type: "turnover_set", turnoverRub });
                    toastStatus("Оборот обновлён", formatRub(turnoverRub), "success");
                  }}
                  onReset={() => setResetOpen(true)}
                />
              </Fade>
            ) : null}

            {state.nav === "audit" ? (
              <Fade>
                <AuditScreen state={state} />
              </Fade>
            ) : null}
          </main>
        </div>
      </div>

      <WithdrawalModal
        open={openedWithdrawal !== null}
        withdrawal={openedWithdrawal}
        onClose={() => setWithdrawalOpenId(null)}
        onAction={(status, note) => {
          if (!openedWithdrawal) return;
          act({ type: "withdrawal_status", requestId: openedWithdrawal.requestId, status, note });
          toastStatus(
            status === "Одобрено" ? "Выплата одобрена" : "Выплата отклонена",
            `${openedWithdrawal.partnerUsername} • ${formatRub(openedWithdrawal.amountRub)}`,
            status === "Одобрено" ? "success" : "danger",
          );
          setWithdrawalOpenId(null);
        }}
        minWithdrawRub={state.config.payout.minWithdrawRub}
      />

      <OrderModal
        open={openedOrder !== null}
        order={openedOrder}
        packs={state.packs}
        onClose={() => setOrderOpenId(null)}
        onSetStatus={(status, note) => {
          if (!openedOrder) return;
          act({ type: "order_status", orderId: openedOrder.orderId, status, note });
          setOrderOpenId(null);
        }}
        onRefund={(reason) => {
          if (!openedOrder) return;
          act({ type: "order_refund", orderId: openedOrder.orderId, reason });
          setOrderOpenId(null);
        }}
      />

      <ConfirmModal
        open={deleteUser !== null}
        title="Удалить данные пользователя"
        body={
          deleteUser ? (
            <>
              Удалить данные пользователя{" "}
              <span className="font-semibold text-white/95">{deleteUser.username}</span>{" "}
              (User ID: {deleteUser.userId})?
            </>
          ) : null
        }
        confirmTone="danger"
        confirmLabel="Удалить"
        onClose={() => setDeleteUserId(null)}
        onConfirm={() => {
          if (!deleteUser) return;
          act({ type: "user_delete", userId: deleteUser.userId });
          toastStatus("Данные удалены", deleteUser.username, "danger");
          setDeleteUserId(null);
        }}
      />

      <AdjustBalanceModal
        open={adjustPartner !== null}
        partner={adjustPartner}
        onClose={() => setAdjustPartnerId(null)}
        onApply={(deltaRub, reason) => {
          if (!adjustPartner) return;
          act({ type: "partner_adjust_balance", partnerId: adjustPartner.partnerId, deltaRub, reason });
          toastStatus("Баланс обновлён", `#${adjustPartner.partnerId} • ${deltaRub >= 0 ? "+" : ""}${formatRub(deltaRub)}`, "success");
          setAdjustPartnerId(null);
        }}
      />

      <ConfirmModal
        open={resetOpen}
        title="Сбросить админку"
        body={<>Сбросить все изменения и вернуть mock‑данные по умолчанию?</>}
        confirmTone="danger"
        confirmLabel="Сбросить"
        onClose={() => setResetOpen(false)}
        onConfirm={() => {
          act({ type: "reset_seed" });
          toastStatus("Сброшено", "Mock‑данные восстановлены.", "danger");
          setResetOpen(false);
        }}
      />
    </div>
  );
}

function Fade({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }}>
      {children}
    </motion.div>
  );
}

function Header({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="text-xl font-semibold text-white/95">{title}</div>
        {subtitle ? <div className="mt-1 text-sm text-white/60">{subtitle}</div> : null}
      </div>
      {right ? right : (
        <div className="rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-xs text-white/70">
          Dark neon • Desktop dashboard
        </div>
      )}
    </div>
  );
}

function NavButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
        "hover:bg-white/6",
        active && "bg-white/6 shadow-[0_0_0_1px_rgba(56,189,248,0.14),0_0_20px_rgba(167,139,250,0.10)]",
      )}
    >
      <span className={cn(active ? "text-neonBlue" : "text-white/70")}>{icon}</span>
      <span className={cn("font-medium", active ? "text-white/95" : "text-white/75")}>{label}</span>
    </button>
  );
}

function StatusPill({ status }: { status: "Ожидает" | "Одобрено" | "Отклонено" }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs",
        status === "Ожидает" && "border-stroke bg-white/4 text-white/70",
        status === "Одобрено" && "border-neonBlue/30 bg-neonBlue/10 text-white/90",
        status === "Отклонено" && "border-red-500/30 bg-red-500/10 text-white/90",
      )}
    >
      {status}
    </span>
  );
}

function RiskPill({ risk }: { risk: "low" | "med" | "high" }) {
  const label = risk === "low" ? "LOW" : risk === "med" ? "MED" : "HIGH";
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs",
        risk === "low" && "border-neonBlue/25 bg-neonBlue/10 text-white/85",
        risk === "med" && "border-neonViolet/25 bg-neonViolet/10 text-white/85",
        risk === "high" && "border-red-500/25 bg-red-500/10 text-white/90",
      )}
    >
      {label}
    </span>
  );
}

function PartnerStatusPill({ status }: { status: "active" | "blocked" }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs",
        status === "active" && "border-neonBlue/25 bg-neonBlue/10 text-white/85",
        status === "blocked" && "border-red-500/25 bg-red-500/10 text-white/90",
      )}
    >
      {status === "active" ? "ACTIVE" : "BLOCKED"}
    </span>
  );
}

function OverviewScreen({
  state,
  onOpenWithdrawal,
  onGo,
}: {
  state: ReturnType<typeof useAdminStore>["state"];
  onOpenWithdrawal: (id: string) => void;
  onGo: (nav: AdminNav) => void;
}) {
  const finance = computeFinance(state);
  const pendingCount = state.withdrawals.filter((w) => w.status === "Ожидает").length;

  return (
    <div className="space-y-5">
      <Header
        title="Сводка"
        subtitle="Финансы, риски и оперативные действия"
        right={
          <div className="flex items-center gap-2">
            <Badge className="bg-white/5 text-white/80">Ожидает выводов: {pendingCount}</Badge>
            <Button size="sm" variant="secondary" onClick={() => onGo("settings")}>
              <Cog size={14} />
              Настройки
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard title="Оборот" value={formatRub(finance.turnoverRub)} hint="Грязная выручка" tone="neutral" />
        <MetricCard title="Расходы API" value={`-${formatRub(finance.apiRub)}`} hint="Astria compute/storage" tone="bad" />
        <MetricCard title="Долг партнёрам" value={`-${formatRub(finance.debtRub)}`} hint="Доступно к выводу" tone="bad" />
        <MetricCard title="Чистая прибыль" value={formatRub(finance.profitRub)} hint="После расходов и долга" tone="good" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="border-b border-stroke bg-white/3 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white/90">Заявки на вывод</div>
                <div className="mt-1 text-xs text-white/60">Анти‑фрод + быстрые решения</div>
              </div>
              <Button size="sm" variant="secondary" onClick={() => onGo("withdrawals")}>
                Открыть
              </Button>
            </div>
          </div>
          <div className="divide-y divide-stroke">
            {state.withdrawals
              .filter((w) => w.status === "Ожидает")
              .slice(0, 5)
              .map((w) => (
                <button
                  key={w.requestId}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-white/3"
                  onClick={() => onOpenWithdrawal(w.requestId)}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white/90">
                      {w.partnerUsername} • {formatRub(w.amountRub)}
                    </div>
                    <div className="mt-1 text-xs text-white/60">
                      {formatDateTime(w.createdAt)} • клиенты: {w.clients} • оплат: {w.paid}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <RiskPill risk={w.risk} />
                    <StatusPill status={w.status} />
                  </div>
                </button>
              ))}
            {state.withdrawals.filter((w) => w.status === "Ожидает").length === 0 ? (
              <div className="px-5 py-6 text-sm text-white/60">Нет заявок в ожидании.</div>
            ) : null}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-stroke bg-white/3 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white/90">Модели в обучении</div>
                <div className="mt-1 text-xs text-white/60">Проверьте очереди и “зависшие” статусы</div>
              </div>
              <Button size="sm" variant="secondary" onClick={() => onGo("users")}>
                Пользователи
              </Button>
            </div>
          </div>
          <div className="divide-y divide-stroke">
            {state.users
              .filter((u) => u.modelStatus === "В процессе")
              .slice(0, 6)
              .map((u) => (
                <div key={u.userId} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white/90">{u.username}</div>
                    <div className="mt-1 text-xs text-white/60">User #{u.userId} • {u.modelId ?? "—"}</div>
                  </div>
                  <span className="rounded-full border border-stroke bg-white/4 px-2.5 py-1 text-xs text-white/70">
                    В процессе
                  </span>
                </div>
              ))}
            {state.users.filter((u) => u.modelStatus === "В процессе").length === 0 ? (
              <div className="px-5 py-6 text-sm text-white/60">Нет моделей в процессе.</div>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  hint,
  tone,
}: {
  title: string;
  value: string;
  hint: string;
  tone: "neutral" | "good" | "bad";
}) {
  return (
    <Card className="p-4">
      <div className="text-xs text-white/60">{title}</div>
      <div
        className={cn(
          "mt-1 text-xl font-semibold tracking-tight",
          tone === "good" && "text-neonBlue",
          tone === "bad" && "text-white/90",
          tone === "neutral" && "text-white/95",
        )}
      >
        {value}
      </div>
      <div className="mt-1 text-xs text-white/55">{hint}</div>
    </Card>
  );
}

function WithdrawalsScreen({
  state,
  onOpenWithdrawal,
}: {
  state: ReturnType<typeof useAdminStore>["state"];
  onOpenWithdrawal: (id: string) => void;
}) {
  const [status, setStatus] = React.useState<"all" | "Ожидает" | "Одобрено" | "Отклонено">("all");
  const [risk, setRisk] = React.useState<"all" | "low" | "med" | "high">("all");
  const [q, setQ] = React.useState("");

  const rows = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    return state.withdrawals
      .filter((w) => (status === "all" ? true : w.status === status))
      .filter((w) => (risk === "all" ? true : w.risk === risk))
      .filter((w) => {
        if (!query) return true;
        return `${w.partnerUsername} ${w.partnerId} ${w.requestId}`.toLowerCase().includes(query);
      })
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [q, risk, state.withdrawals, status]);

  return (
    <div className="space-y-5">
      <Header title="Заявки на вывод" subtitle="Анти‑фрод: проверка и решения" />

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <div className="text-xs text-white/60">Поиск</div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
              placeholder="partner, id, request…"
            />
          </div>
          <div>
            <div className="text-xs text-white/60">Статус</div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="mt-2 w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
            >
              <option value="all">Все</option>
              <option value="Ожидает">Ожидает</option>
              <option value="Одобрено">Одобрено</option>
              <option value="Отклонено">Отклонено</option>
            </select>
          </div>
          <div>
            <div className="text-xs text-white/60">Риск</div>
            <select
              value={risk}
              onChange={(e) => setRisk(e.target.value as any)}
              className="mt-2 w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
            >
              <option value="all">Любой</option>
              <option value="low">LOW</option>
              <option value="med">MED</option>
              <option value="high">HIGH</option>
            </select>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-auto no-scrollbar">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/2 text-xs text-white/60">
              <tr>
                <th className="px-5 py-3 font-medium">Заявка</th>
                <th className="px-5 py-3 font-medium">Партнёр</th>
                <th className="px-5 py-3 font-medium">Сумма</th>
                <th className="px-5 py-3 font-medium">Клиенты</th>
                <th className="px-5 py-3 font-medium">Риск</th>
                <th className="px-5 py-3 font-medium">Статус</th>
                <th className="px-5 py-3 font-medium">Детали</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.requestId} className="border-t border-stroke">
                  <td className="px-5 py-4 text-white/80">{w.requestId}</td>
                  <td className="px-5 py-4 text-white/85">{w.partnerUsername}</td>
                  <td className="px-5 py-4 text-white/85">{formatRub(w.amountRub)}</td>
                  <td className="px-5 py-4 text-white/75">
                    {w.paid}/{w.clients}
                  </td>
                  <td className="px-5 py-4">
                    <RiskPill risk={w.risk} />
                  </td>
                  <td className="px-5 py-4">
                    <StatusPill status={w.status} />
                  </td>
                  <td className="px-5 py-4">
                    <Button size="sm" variant="secondary" onClick={() => onOpenWithdrawal(w.requestId)}>
                      Открыть
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className="px-5 py-6 text-sm text-white/60" colSpan={7}>
                    Ничего не найдено.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function OrdersScreen({
  state,
  onOpenOrder,
  onSetStatus,
}: {
  state: ReturnType<typeof useAdminStore>["state"];
  onOpenOrder: (id: string) => void;
  onSetStatus: (orderId: string, status: ReturnType<typeof useAdminStore>["state"]["orders"][number]["status"], note?: string) => void;
}) {
  const [status, setStatus] = React.useState<
    "all" | ReturnType<typeof useAdminStore>["state"]["orders"][number]["status"]
  >("all");
  const [q, setQ] = React.useState("");

  const rows = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    return state.orders
      .filter((o) => (status === "all" ? true : o.status === status))
      .filter((o) => {
        if (!query) return true;
        return `${o.orderId} ${o.userId} ${o.username} ${o.packTitle}`.toLowerCase().includes(query);
      })
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [q, state.orders, status]);

  const counts = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const o of state.orders) map.set(o.status, (map.get(o.status) ?? 0) + 1);
    return map;
  }, [state.orders]);

  return (
    <div className="space-y-5">
      <Header title="Заказы" subtitle="Оплаты → обучение аватара → генерация фотосессии" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <div className="text-xs text-white/60">Всего заказов</div>
          <div className="mt-1 text-2xl font-semibold text-white/95">{state.orders.length}</div>
          <div className="mt-2 text-xs text-white/55">
            Готово: {counts.get("Готово") ?? 0} • Ошибка: {counts.get("Ошибка") ?? 0}
          </div>
        </Card>
        <Card className="p-5 lg:col-span-2">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <div className="text-xs text-white/60">Поиск</div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
                placeholder="order id, user, стиль…"
              />
            </div>
            <div>
              <div className="text-xs text-white/60">Статус</div>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="mt-2 w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
              >
                <option value="all">Все</option>
                <option value="Оплачен">Оплачен</option>
                <option value="Аватар: обучение">Аватар: обучение</option>
                <option value="Фотосессия: генерация">Фотосессия: генерация</option>
                <option value="Готово">Готово</option>
                <option value="Ошибка">Ошибка</option>
                <option value="Возврат">Возврат</option>
              </select>
            </div>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-auto no-scrollbar">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/2 text-xs text-white/60">
              <tr>
                <th className="px-5 py-3 font-medium">Order</th>
                <th className="px-5 py-3 font-medium">User</th>
                <th className="px-5 py-3 font-medium">Тариф</th>
                <th className="px-5 py-3 font-medium">Стиль</th>
                <th className="px-5 py-3 font-medium">Статус</th>
                <th className="px-5 py-3 font-medium">Обновлено</th>
                <th className="px-5 py-3 font-medium">Сумма</th>
                <th className="px-5 py-3 font-medium">Атрибуция</th>
                <th className="px-5 py-3 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.orderId} className="border-t border-stroke">
                  <td className="px-5 py-4 text-white/90">{o.orderId}</td>
                  <td className="px-5 py-4 text-white/80">
                    <div className="text-sm font-semibold text-white/90">{o.username}</div>
                    <div className="mt-1 text-xs text-white/55">#{o.userId}</div>
                  </td>
                  <td className="px-5 py-4 text-white/85">{o.planId === "pro" ? "PRO" : "Стандарт"}</td>
                  <td className="px-5 py-4 text-white/80">{o.packTitle}</td>
                  <td className="px-5 py-4">
                    <OrderStatusPill status={o.status} />
                    {o.flags.length ? (
                      <div className="mt-2 text-xs text-red-200/80">{o.flags.slice(0, 1).join(" • ")}</div>
                    ) : null}
                  </td>
                  <td className="px-5 py-4 text-white/70">{formatDateTime(o.updatedAt)}</td>
                  <td className="px-5 py-4 text-white/85">{formatRub(o.amountRub)}</td>
                  <td className="px-5 py-4 text-white/70">
                    {o.attribution ? (
                      <div className="text-xs">
                        <div className="text-white/80">{o.attribution.partnerUsername}</div>
                        <div className="mt-1 text-white/50">{o.attribution.kind === "client" ? "client link" : "team link"}</div>
                      </div>
                    ) : (
                      <span className="text-xs text-white/50">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => onOpenOrder(o.orderId)}>
                        Открыть
                      </Button>
                      {o.status === "Ошибка" ? (
                        <Button size="sm" onClick={() => onSetStatus(o.orderId, "Фотосессия: генерация", "retry")}>
                          <RotateCcw size={14} />
                          Ретрай
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className="px-5 py-6 text-sm text-white/60" colSpan={9}>
                    Ничего не найдено.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function OrderStatusPill({ status }: { status: ReturnType<typeof useAdminStore>["state"]["orders"][number]["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-xs",
        status === "Оплачен" && "border-stroke bg-white/4 text-white/80",
        status === "Аватар: обучение" && "border-neonViolet/25 bg-neonViolet/10 text-white/90",
        status === "Фотосессия: генерация" && "border-neonBlue/25 bg-neonBlue/10 text-white/90",
        status === "Готово" && "border-neonBlue/25 bg-neonBlue/10 text-white/90",
        status === "Ошибка" && "border-red-500/30 bg-red-500/10 text-white/90",
        status === "Возврат" && "border-red-500/20 bg-red-500/10 text-white/90",
      )}
    >
      {status}
    </span>
  );
}

function PacksScreen({
  state,
  onCreate,
  onUpdate,
  onToggle,
}: {
  state: ReturnType<typeof useAdminStore>["state"];
  onCreate: (pack: ReturnType<typeof useAdminStore>["state"]["packs"][number]) => void;
  onUpdate: (packId: number, patch: Partial<ReturnType<typeof useAdminStore>["state"]["packs"][number]>) => void;
  onToggle: (packId: number, status: ReturnType<typeof useAdminStore>["state"]["packs"][number]["status"]) => void;
}) {
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<"all" | "active" | "hidden">("all");
  const [editId, setEditId] = React.useState<number | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);

  const rows = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    return state.packs
      .filter((p) => (status === "all" ? true : p.status === status))
      .filter((p) => {
        if (!query) return true;
        return `${p.title} ${p.slug} ${p.packId}`.toLowerCase().includes(query);
      })
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [q, state.packs, status]);

  const editing = React.useMemo(() => state.packs.find((p) => p.packId === editId) ?? null, [editId, state.packs]);

  return (
    <div className="space-y-5">
      <Header
        title="Стили (Packs)"
        subtitle="Какие стили доступны клиентам + подсказки по pack object"
        right={
          <Button onClick={() => setCreateOpen(true)}>
            <Package size={16} />
            Новый стиль
          </Button>
        }
      />

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <div className="text-xs text-white/60">Поиск</div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
              placeholder="название, slug, id…"
            />
          </div>
          <div>
            <div className="text-xs text-white/60">Видимость</div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="mt-2 w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
            >
              <option value="all">Все</option>
              <option value="active">Active</option>
              <option value="hidden">Hidden</option>
            </select>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {rows.map((p) => (
          <Card key={p.packId} className="overflow-hidden">
            <div className="flex items-start gap-4 p-5">
              <div className="h-20 w-28 shrink-0 overflow-hidden rounded-2xl border border-stroke bg-white/4">
                {p.previewUrls[0] ? (
                  <img src={p.previewUrls[0]} alt={p.title} className="h-full w-full object-cover" loading="lazy" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white/90">
                      {p.title} <span className="text-xs text-white/50">#{p.packId}</span>
                    </div>
                    <div className="mt-1 max-h-10 overflow-hidden text-xs text-white/60">{p.description}</div>
                  </div>
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs",
                      p.status === "active" ? "border-neonBlue/25 bg-neonBlue/10 text-white/90" : "border-stroke bg-white/4 text-white/70",
                    )}
                  >
                    {p.status}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/60">
                  <span className="rounded-full border border-stroke bg-white/4 px-2.5 py-1">
                    {p.estimatedImages} фото
                  </span>
                  <span className="rounded-full border border-stroke bg-white/4 px-2.5 py-1">
                    {p.astriaPackHint.packObjectId}
                  </span>
                  <span className="rounded-full border border-stroke bg-white/4 px-2.5 py-1">
                    prompts: {p.astriaPackHint.promptsPerClass}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setEditId(p.packId)}>
                    Редактировать
                  </Button>
                  <Button
                    size="sm"
                    variant={p.status === "active" ? "secondary" : "primary"}
                    onClick={() => onToggle(p.packId, p.status === "active" ? "hidden" : "active")}
                  >
                    {p.status === "active" ? "Скрыть" : "Показать"}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-stroke bg-white/3 p-5 text-sm text-white/60">
            Ничего не найдено.
          </div>
        ) : null}
      </div>

      <PackEditorModal
        open={createOpen || editing !== null}
        mode={createOpen ? "create" : "edit"}
        pack={editing}
        onClose={() => {
          setCreateOpen(false);
          setEditId(null);
        }}
        onSubmit={(next) => {
          if (createOpen) {
            onCreate(next);
          } else if (editing) {
            onUpdate(editing.packId, next);
          }
          setCreateOpen(false);
          setEditId(null);
        }}
        packs={state.packs}
      />
    </div>
  );
}

function PromosScreen({
  state,
  onCreate,
  onUpdate,
  onToggle,
  onDelete,
}: {
  state: ReturnType<typeof useAdminStore>["state"];
  onCreate: (promo: ReturnType<typeof useAdminStore>["state"]["promos"][number]) => void;
  onUpdate: (promoId: string, patch: Partial<ReturnType<typeof useAdminStore>["state"]["promos"][number]>) => void;
  onToggle: (promoId: string, status: ReturnType<typeof useAdminStore>["state"]["promos"][number]["status"]) => void;
  onDelete: (promoId: string) => void;
}) {
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<"all" | "active" | "hidden">("all");
  const [kind, setKind] = React.useState<"all" | "text" | "photo" | "video">("all");
  const [editId, setEditId] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  const rows = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    return state.promos
      .filter((p) => (status === "all" ? true : p.status === status))
      .filter((p) => (kind === "all" ? true : p.kind === kind))
      .filter((p) => {
        if (!query) return true;
        return `${p.title} ${p.caption} ${p.tags.join(" ")} ${p.promoId}`.toLowerCase().includes(query);
      })
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [kind, q, state.promos, status]);

  const editing = React.useMemo(() => state.promos.find((p) => p.promoId === editId) ?? null, [editId, state.promos]);
  const deleting = React.useMemo(() => state.promos.find((p) => p.promoId === deleteId) ?? null, [deleteId, state.promos]);

  return (
    <div className="space-y-5">
      <Header
        title="Промо‑материалы"
        subtitle="Тексты и медиа для партнёров (публикации в соцсетях)"
        right={
          <Button onClick={() => setCreateOpen(true)}>
            <Megaphone size={16} />
            Добавить
          </Button>
        }
      />

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="text-xs text-white/60">Поиск</div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
              placeholder="заголовок, теги…"
            />
          </div>
          <div>
            <div className="text-xs text-white/60">Тип</div>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as any)}
              className="mt-2 w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
            >
              <option value="all">Все</option>
              <option value="text">Text</option>
              <option value="photo">Photo</option>
              <option value="video">Video</option>
            </select>
          </div>
          <div>
            <div className="text-xs text-white/60">Видимость</div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="mt-2 w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
            >
              <option value="all">Все</option>
              <option value="active">Active</option>
              <option value="hidden">Hidden</option>
            </select>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-auto no-scrollbar">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/2 text-xs text-white/60">
              <tr>
                <th className="px-5 py-3 font-medium">ID</th>
                <th className="px-5 py-3 font-medium">Контент</th>
                <th className="px-5 py-3 font-medium">Теги</th>
                <th className="px-5 py-3 font-medium">Статус</th>
                <th className="px-5 py-3 font-medium">Обновлено</th>
                <th className="px-5 py-3 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.promoId} className="border-t border-stroke">
                  <td className="px-5 py-4 text-white/75">{p.promoId}</td>
                  <td className="px-5 py-4 text-white/90">
                    <div className="flex items-start gap-3">
                      {p.coverUrl ? (
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-stroke bg-white/4">
                          <img src={p.coverUrl} alt={p.title} className="h-full w-full object-cover" loading="lazy" />
                        </div>
                      ) : (
                        <div className="h-12 w-12 shrink-0 rounded-xl border border-stroke bg-white/4" />
                      )}
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white/90">
                          {p.title} <span className="text-xs text-white/50">({p.kind})</span>
                        </div>
                        <div className="mt-1 max-h-10 overflow-hidden text-xs text-white/60">{p.caption}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      {p.tags.slice(0, 4).map((t) => (
                        <span key={t} className="rounded-full border border-stroke bg-white/4 px-2.5 py-1 text-xs text-white/70">
                          {t}
                        </span>
                      ))}
                      {p.tags.length === 0 ? <span className="text-xs text-white/50">—</span> : null}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs",
                        p.status === "active" ? "border-neonBlue/25 bg-neonBlue/10 text-white/90" : "border-stroke bg-white/4 text-white/70",
                      )}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-white/70">{formatDateTime(p.updatedAt)}</td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setEditId(p.promoId)}>
                        Редактировать
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => onToggle(p.promoId, p.status === "active" ? "hidden" : "active")}>
                        {p.status === "active" ? "Скрыть" : "Показать"}
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setDeleteId(p.promoId)}>
                        Удалить
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className="px-5 py-6 text-sm text-white/60" colSpan={6}>
                    Ничего не найдено.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <PromoEditorModal
        open={createOpen || editing !== null}
        mode={createOpen ? "create" : "edit"}
        promo={editing}
        promos={state.promos}
        onClose={() => {
          setCreateOpen(false);
          setEditId(null);
        }}
        onSubmit={(next) => {
          if (createOpen) onCreate(next);
          else if (editing) onUpdate(editing.promoId, next);
          setCreateOpen(false);
          setEditId(null);
        }}
      />

      <ConfirmModal
        open={deleting !== null}
        title="Удалить промо"
        body={deleting ? <>Удалить “{deleting.title}” ({deleting.promoId})?</> : null}
        confirmTone="danger"
        confirmLabel="Удалить"
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (!deleting) return;
          onDelete(deleting.promoId);
          setDeleteId(null);
        }}
      />
    </div>
  );
}

function PartnersScreen({
  state,
  onAdjust,
  onToggleBlock,
}: {
  state: ReturnType<typeof useAdminStore>["state"];
  onAdjust: (partnerId: string) => void;
  onToggleBlock: (partnerId: string, blocked: boolean) => void;
}) {
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<"all" | "active" | "blocked">("all");

  const rows = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    return state.partners
      .filter((p) => (status === "all" ? true : p.status === status))
      .filter((p) => {
        if (!query) return true;
        return `${p.username} ${p.partnerId}`.toLowerCase().includes(query);
      })
      .slice()
      .sort((a, b) => b.stats.turnoverRub - a.stats.turnoverRub);
  }, [q, state.partners, status]);

  return (
    <div className="space-y-5">
      <Header title="Партнёры" subtitle="Баланс, ссылки, блокировки, риски" />

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <div className="text-xs text-white/60">Поиск</div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
              placeholder="@username или id…"
            />
          </div>
          <div>
            <div className="text-xs text-white/60">Статус</div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="mt-2 w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
            >
              <option value="all">Все</option>
              <option value="active">Active</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-auto no-scrollbar">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/2 text-xs text-white/60">
              <tr>
                <th className="px-5 py-3 font-medium">ID</th>
                <th className="px-5 py-3 font-medium">Партнёр</th>
                <th className="px-5 py-3 font-medium">Статус</th>
                <th className="px-5 py-3 font-medium">Баланс</th>
                <th className="px-5 py-3 font-medium">Оборот</th>
                <th className="px-5 py-3 font-medium">Команда</th>
                <th className="px-5 py-3 font-medium">Ссылки</th>
                <th className="px-5 py-3 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.partnerId} className="border-t border-stroke">
                  <td className="px-5 py-4 text-white/80">{p.partnerId}</td>
                  <td className="px-5 py-4 text-white/90">{p.username}</td>
                  <td className="px-5 py-4">
                    <PartnerStatusPill status={p.status} />
                  </td>
                  <td className="px-5 py-4 text-white/90">
                    <div className="text-sm">{formatRub(p.balances.availableRub)}</div>
                    <div className="mt-1 text-xs text-white/55">paid out: {formatRub(p.balances.paidOutRub)}</div>
                  </td>
                  <td className="px-5 py-4 text-white/85">{formatRub(p.stats.turnoverRub)}</td>
                  <td className="px-5 py-4 text-white/75">
                    L1 {p.stats.teamL1} • L2 {p.stats.teamL2}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      <CopyChip label="Client" value={p.links.client} />
                      <CopyChip label="Team" value={p.links.team} />
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => onAdjust(p.partnerId)}>
                        Баланс
                      </Button>
                      <Button
                        size="sm"
                        variant={p.status === "blocked" ? "secondary" : "danger"}
                        onClick={() => onToggleBlock(p.partnerId, p.status !== "blocked")}
                      >
                        {p.status === "blocked" ? "Разблок" : "Блок"}
                      </Button>
                    </div>
                    {p.riskFlags.length ? (
                      <div className="mt-2 text-xs text-red-200/80">
                        {p.riskFlags.slice(0, 2).join(" • ")}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className="px-5 py-6 text-sm text-white/60" colSpan={8}>
                    Ничего не найдено.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function CopyChip({ label, value }: { label: string; value: string }) {
  return (
    <button
      className="inline-flex items-center gap-2 rounded-xl border border-stroke bg-white/4 px-3 py-2 text-xs text-white/80 hover:bg-white/6"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          // ignore in prototype
        }
      }}
      title={value}
    >
      <LinkIcon size={14} className="text-white/60" />
      {label}
    </button>
  );
}

function UsersScreen({
  state,
  onDelete,
  onSetModelStatus,
}: {
  state: ReturnType<typeof useAdminStore>["state"];
  onDelete: (userId: string) => void;
  onSetModelStatus: (userId: string, status: "Обучена" | "В процессе" | "Нет модели") => void;
}) {
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<"all" | "Обучена" | "В процессе" | "Нет модели">("all");

  const rows = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    return state.users
      .filter((u) => (status === "all" ? true : u.modelStatus === status))
      .filter((u) => {
        if (!query) return true;
        return `${u.username} ${u.userId} ${u.modelId ?? ""}`.toLowerCase().includes(query);
      })
      .slice()
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  }, [q, state.users, status]);

  return (
    <div className="space-y-5">
      <Header title="Пользователи" subtitle="Модели, статусы, удаление данных" />

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <div className="text-xs text-white/60">Поиск</div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
              placeholder="@username, id, model…"
            />
          </div>
          <div>
            <div className="text-xs text-white/60">Статус модели</div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="mt-2 w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
            >
              <option value="all">Все</option>
              <option value="Обучена">Обучена</option>
              <option value="В процессе">В процессе</option>
              <option value="Нет модели">Нет модели</option>
            </select>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-auto no-scrollbar">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/2 text-xs text-white/60">
              <tr>
                <th className="px-5 py-3 font-medium">User ID</th>
                <th className="px-5 py-3 font-medium">Telegram</th>
                <th className="px-5 py-3 font-medium">Тариф</th>
                <th className="px-5 py-3 font-medium">Модель</th>
                <th className="px-5 py-3 font-medium">Сессий</th>
                <th className="px-5 py-3 font-medium">Оплачено</th>
                <th className="px-5 py-3 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.userId} className="border-t border-stroke">
                  <td className="px-5 py-4 text-white/85">{u.userId}</td>
                  <td className="px-5 py-4 text-white/80">{u.username}</td>
                  <td className="px-5 py-4">
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs",
                        u.plan === "PRO"
                          ? "border-neonViolet/30 bg-neonViolet/10 text-white/90"
                          : "border-stroke bg-white/4 text-white/80",
                      )}
                    >
                      {u.plan}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-white/80">{u.modelId ?? "—"}</span>
                      <select
                        value={u.modelStatus}
                        onChange={(e) => onSetModelStatus(u.userId, e.target.value as any)}
                        className="w-[190px] rounded-xl border border-stroke bg-white/4 px-2 py-1 text-xs text-white/85 outline-none focus:ring-2 focus:ring-neonBlue/30"
                      >
                        <option value="Нет модели">Нет модели</option>
                        <option value="В процессе">В процессе</option>
                        <option value="Обучена">Обучена</option>
                      </select>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-white/85">{u.sessions}</td>
                  <td className="px-5 py-4 text-white/85">{formatRub(u.spentRub)}</td>
                  <td className="px-5 py-4">
                    <Button size="sm" variant="danger" onClick={() => onDelete(u.userId)}>
                      <Trash2 size={14} />
                      Удалить
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className="px-5 py-6 text-sm text-white/60" colSpan={7}>
                    Ничего не найдено.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function SettingsScreen({
  state,
  onUpdate,
  onTurnover,
  onReset,
}: {
  state: ReturnType<typeof useAdminStore>["state"];
  onUpdate: (patch: Partial<typeof state.config>) => void;
  onTurnover: (turnoverRub: number) => void;
  onReset: () => void;
}) {
  const [priceStandard, setPriceStandard] = React.useState(state.config.planPricesRub.standard);
  const [pricePro, setPricePro] = React.useState(state.config.planPricesRub.pro);
  const [standardTitle, setStandardTitle] = React.useState(state.config.planMeta.standard.title);
  const [standardTagline, setStandardTagline] = React.useState(state.config.planMeta.standard.tagline);
  const [standardPhotos, setStandardPhotos] = React.useState(state.config.planMeta.standard.photosCount);
  const [proTitle, setProTitle] = React.useState(state.config.planMeta.pro.title);
  const [proTagline, setProTagline] = React.useState(state.config.planMeta.pro.tagline);
  const [proPhotos, setProPhotos] = React.useState(state.config.planMeta.pro.photosCount);
  const [proBadge, setProBadge] = React.useState(state.config.planMeta.pro.badge ?? "");
  const [direct, setDirect] = React.useState(state.config.commissionsPct.directClient);
  const [l1, setL1] = React.useState(state.config.commissionsPct.teamL1);
  const [l2, setL2] = React.useState(state.config.commissionsPct.teamL2);
  const [minWithdraw, setMinWithdraw] = React.useState(state.config.payout.minWithdrawRub);
  const [slaText, setSlaText] = React.useState(state.config.payout.slaText);
  const [api, setApi] = React.useState(state.config.astriaCostsRub.monthlyApi);
  const [turnover, setTurnover] = React.useState(state.turnoverRub);

  React.useEffect(() => {
    setPriceStandard(state.config.planPricesRub.standard);
    setPricePro(state.config.planPricesRub.pro);
    setStandardTitle(state.config.planMeta.standard.title);
    setStandardTagline(state.config.planMeta.standard.tagline);
    setStandardPhotos(state.config.planMeta.standard.photosCount);
    setProTitle(state.config.planMeta.pro.title);
    setProTagline(state.config.planMeta.pro.tagline);
    setProPhotos(state.config.planMeta.pro.photosCount);
    setProBadge(state.config.planMeta.pro.badge ?? "");
    setDirect(state.config.commissionsPct.directClient);
    setL1(state.config.commissionsPct.teamL1);
    setL2(state.config.commissionsPct.teamL2);
    setMinWithdraw(state.config.payout.minWithdrawRub);
    setSlaText(state.config.payout.slaText);
    setApi(state.config.astriaCostsRub.monthlyApi);
    setTurnover(state.turnoverRub);
  }, [state.config, state.turnoverRub]);

  return (
    <div className="space-y-5">
      <Header
        title="Настройки"
        subtitle="Комиссии, пороги, расходы — всё в одном месте"
        right={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={onReset}>
              <RotateCcw size={14} />
              Сброс
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="text-sm font-semibold text-white/90">Тарифы</div>
          <div className="mt-1 text-xs text-white/60">Название, текст, количество фото и цена</div>

          <div className="mt-4 grid gap-3">
            <div className="rounded-2xl border border-stroke bg-white/3 p-4">
              <div className="text-xs font-semibold text-white/85">STANDARD</div>
              <div className="mt-3 grid gap-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="grid gap-2 text-xs text-white/60">
                    Название
                    <input
                      value={standardTitle}
                      onChange={(e) => setStandardTitle(e.target.value)}
                      className="w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
                      placeholder="Стандарт"
                    />
                  </label>
                  <NumberField label="Цена" value={priceStandard} onChange={setPriceStandard} suffix="₽" />
                </div>
                <label className="grid gap-2 text-xs text-white/60">
                  Короткий текст
                  <input
                    value={standardTagline}
                    onChange={(e) => setStandardTagline(e.target.value)}
                    className="w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
                    placeholder="Быстро и красиво…"
                  />
                </label>
                <NumberField label="Фото в пакете" value={standardPhotos} onChange={setStandardPhotos} suffix="шт" />
              </div>
            </div>

            <div className="rounded-2xl border border-stroke bg-white/3 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold text-white/85">PRO</div>
                <span className="rounded-full border border-neonViolet/25 bg-neonViolet/10 px-2.5 py-1 text-xs text-white/85">
                  выделяемый тариф
                </span>
              </div>
              <div className="mt-3 grid gap-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="grid gap-2 text-xs text-white/60">
                    Название
                    <input
                      value={proTitle}
                      onChange={(e) => setProTitle(e.target.value)}
                      className="w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
                      placeholder="PRO / Кинематографичный"
                    />
                  </label>
                  <NumberField label="Цена" value={pricePro} onChange={setPricePro} suffix="₽" />
                </div>
                <label className="grid gap-2 text-xs text-white/60">
                  Короткий текст
                  <input
                    value={proTagline}
                    onChange={(e) => setProTagline(e.target.value)}
                    className="w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
                    placeholder="Максимум деталей…"
                  />
                </label>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <NumberField label="Фото в пакете" value={proPhotos} onChange={setProPhotos} suffix="шт" />
                  <label className="grid gap-2 text-xs text-white/60">
                    Бейдж (опц.)
                    <input
                      value={proBadge}
                      onChange={(e) => setProBadge(e.target.value)}
                      className="w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
                      placeholder="Хит"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-sm font-semibold text-white/90">Комиссии партнёрам</div>
          <div className="mt-1 text-xs text-white/60">Проценты считаются от суммы оплаты</div>

          <div className="mt-4 grid gap-3">
            <NumberField label="Прямой клиент (partner)" value={direct} onChange={setDirect} suffix="%" />
            <NumberField label="Команда: уровень 1 (upline)" value={l1} onChange={setL1} suffix="%" />
            <NumberField label="Команда: уровень 2 (upline)" value={l2} onChange={setL2} suffix="%" />
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-sm font-semibold text-white/90">Выплаты и расходы</div>
          <div className="mt-1 text-xs text-white/60">Используется в сводке и анти‑фроде</div>

          <div className="mt-4 grid gap-3">
            <NumberField label="Минимум для вывода" value={minWithdraw} onChange={setMinWithdraw} suffix="₽" />
            <NumberField label="Расходы Astria (месяц)" value={api} onChange={setApi} suffix="₽" />
            <NumberField label="Оборот (для сводки)" value={turnover} onChange={setTurnover} suffix="₽" />
          </div>

          <label className="mt-4 grid gap-2 text-xs text-white/60">
            SLA по выплатам (текст)
            <input
              value={slaText}
              onChange={(e) => setSlaText(e.target.value)}
              className="w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
              placeholder="Обычно 1–6 часов (анти‑фрод)"
            />
          </label>
        </Card>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            setPriceStandard(state.config.planPricesRub.standard);
            setPricePro(state.config.planPricesRub.pro);
            setStandardTitle(state.config.planMeta.standard.title);
            setStandardTagline(state.config.planMeta.standard.tagline);
            setStandardPhotos(state.config.planMeta.standard.photosCount);
            setProTitle(state.config.planMeta.pro.title);
            setProTagline(state.config.planMeta.pro.tagline);
            setProPhotos(state.config.planMeta.pro.photosCount);
            setProBadge(state.config.planMeta.pro.badge ?? "");
            setDirect(state.config.commissionsPct.directClient);
            setL1(state.config.commissionsPct.teamL1);
            setL2(state.config.commissionsPct.teamL2);
            setMinWithdraw(state.config.payout.minWithdrawRub);
            setSlaText(state.config.payout.slaText);
            setApi(state.config.astriaCostsRub.monthlyApi);
            setTurnover(state.turnoverRub);
          }}
        >
          Сбросить изменения
        </Button>
        <Button
          onClick={() => {
            onUpdate({
              planPricesRub: { standard: priceStandard, pro: pricePro },
              planMeta: {
                standard: {
                  ...state.config.planMeta.standard,
                  title: standardTitle.trim() || state.config.planMeta.standard.title,
                  tagline: standardTagline.trim() || state.config.planMeta.standard.tagline,
                  photosCount: Math.max(1, Math.round(standardPhotos || state.config.planMeta.standard.photosCount)),
                },
                pro: {
                  ...state.config.planMeta.pro,
                  title: proTitle.trim() || state.config.planMeta.pro.title,
                  tagline: proTagline.trim() || state.config.planMeta.pro.tagline,
                  photosCount: Math.max(1, Math.round(proPhotos || state.config.planMeta.pro.photosCount)),
                  badge: proBadge.trim() || undefined,
                  featured: true,
                },
              },
              commissionsPct: { directClient: direct, teamL1: l1, teamL2: l2 },
              astriaCostsRub: { monthlyApi: api },
              payout: { ...state.config.payout, minWithdrawRub: minWithdraw, slaText: slaText.trim() || state.config.payout.slaText },
            });
            onTurnover(turnover);
          }}
        >
          Сохранить
        </Button>
      </div>

      <div className="rounded-2xl border border-stroke bg-white/3 p-4 text-xs text-white/60">
        Все изменения сохраняются локально (localStorage) — удобно для демонстрации без бэкенда.
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  suffix: string;
}) {
  return (
    <label className="grid gap-2 text-xs text-white/60">
      <div className="flex items-center justify-between gap-3">
        <span>{label}</span>
        <span className="text-white/70">
          {value} {suffix}
        </span>
      </div>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value || 0))}
        className="w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
      />
    </label>
  );
}

function AuditScreen({ state }: { state: ReturnType<typeof useAdminStore>["state"] }) {
  const rows = state.audit.slice().sort((a, b) => b.at - a.at).slice(0, 50);
  return (
    <div className="space-y-5">
      <Header title="Аудит‑лог" subtitle="Кто что делал (в прототипе: owner)" />
      <Card className="overflow-hidden">
        <div className="divide-y divide-stroke">
          {rows.map((e) => (
            <div key={e.id} className="flex items-start justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white/90">{e.action}</div>
                <div className="mt-1 text-xs text-white/60">{formatDateTime(e.at)}</div>
              </div>
              <Badge className="bg-white/5 text-white/80">{e.actor}</Badge>
            </div>
          ))}
          {rows.length === 0 ? (
            <div className="px-5 py-6 text-sm text-white/60">Пока пусто.</div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

function OrderModal({
  open,
  order,
  packs,
  onClose,
  onSetStatus,
  onRefund,
}: {
  open: boolean;
  order: ReturnType<typeof useAdminStore>["state"]["orders"][number] | null;
  packs: ReturnType<typeof useAdminStore>["state"]["packs"];
  onClose: () => void;
  onSetStatus: (status: ReturnType<typeof useAdminStore>["state"]["orders"][number]["status"], note?: string) => void;
  onRefund: (reason: string) => void;
}) {
  const [status, setStatus] = React.useState<
    ReturnType<typeof useAdminStore>["state"]["orders"][number]["status"]
  >("Оплачен");
  const [note, setNote] = React.useState("");
  const [refundReason, setRefundReason] = React.useState("");

  React.useEffect(() => {
    if (!order) return;
    setStatus(order.status);
    setNote("");
    setRefundReason("");
  }, [order?.orderId]);

  const pack = React.useMemo(() => {
    if (!order) return null;
    return packs.find((p) => p.packId === order.packId) ?? null;
  }, [order, packs]);

  return (
    <Modal open={open} onClose={onClose} title="Карточка заказа" className="max-w-3xl">
      {order ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <InfoTile label="Order" value={order.orderId} />
            <InfoTile label="User" value={`${order.username} (#${order.userId})`} />
            <InfoTile label="Сумма" value={formatRub(order.amountRub)} />
            <InfoTile label="Статус" value={order.status} />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-stroke bg-white/3 p-4">
              <div className="text-xs font-semibold text-white/85">Стиль</div>
              <div className="mt-2 flex items-start gap-3">
                {pack?.previewUrls?.[0] ? (
                  <div className="h-14 w-20 overflow-hidden rounded-2xl border border-stroke bg-white/4">
                    <img src={pack.previewUrls[0]} alt={pack.title} className="h-full w-full object-cover" loading="lazy" />
                  </div>
                ) : (
                  <div className="h-14 w-20 rounded-2xl border border-stroke bg-white/4" />
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white/90">{order.packTitle}</div>
                  <div className="mt-1 text-xs text-white/60">pack id: {order.packId}</div>
                  <div className="mt-1 text-xs text-white/60">план: {order.planId === "pro" ? "PRO" : "Стандарт"} • {order.imagesPlanned} фото</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-stroke bg-white/3 p-4">
              <div className="text-xs font-semibold text-white/85">Время</div>
              <div className="mt-2 grid gap-1 text-xs text-white/70">
                <div className="flex items-center justify-between">
                  <span>Создан</span>
                  <span className="text-white/85">{formatDateTime(order.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Обновлён</span>
                  <span className="text-white/85">{formatDateTime(order.updatedAt)}</span>
                </div>
              </div>
              {order.attribution ? (
                <div className="mt-3 rounded-2xl border border-stroke bg-white/3 p-3 text-xs text-white/70">
                  Атрибуция: <span className="text-white/85">{order.attribution.partnerUsername}</span> •{" "}
                  {order.attribution.kind === "client" ? "client link" : "team link"}
                </div>
              ) : null}
            </div>
          </div>

          {order.flags.length ? (
            <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-white/80">
              <div className="text-xs font-semibold text-white/90">Флаги</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {order.flags.map((f, idx) => (
                  <span key={idx} className="rounded-full border border-red-500/25 bg-white/5 px-2.5 py-1 text-xs text-white/85">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-stroke bg-white/3 p-4">
              <div className="text-xs font-semibold text-white/85">Изменить статус</div>
              <div className="mt-3 grid gap-3">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
                >
                  <option value="Оплачен">Оплачен</option>
                  <option value="Аватар: обучение">Аватар: обучение</option>
                  <option value="Фотосессия: генерация">Фотосессия: генерация</option>
                  <option value="Готово">Готово</option>
                  <option value="Ошибка">Ошибка</option>
                  <option value="Возврат">Возврат</option>
                </select>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
                  placeholder="Примечание (например: requeue / manual fix)…"
                />
                <Button onClick={() => onSetStatus(status, note.trim() || undefined)}>
                  <Check size={16} />
                  Применить
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-stroke bg-white/3 p-4">
              <div className="text-xs font-semibold text-white/85">Возврат</div>
              <div className="mt-2 text-xs text-white/60">
                Для прототипа: помечаем заказ как “Возврат” (в реальном продукте — запись в платежной системе).
              </div>
              <div className="mt-3 grid gap-3">
                <input
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
                  placeholder="Причина (обязательно)…"
                />
                <Button
                  variant="danger"
                  disabled={refundReason.trim().length < 3}
                  onClick={() => onRefund(refundReason.trim())}
                >
                  <X size={16} />
                  Оформить возврат
                </Button>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={onClose}>
              Закрыть
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function PackEditorModal({
  open,
  mode,
  pack,
  packs,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  pack: ReturnType<typeof useAdminStore>["state"]["packs"][number] | null;
  packs: ReturnType<typeof useAdminStore>["state"]["packs"];
  onClose: () => void;
  onSubmit: (payload: any) => void;
}) {
  const nextId = React.useMemo(() => {
    const max = packs.reduce((m, p) => Math.max(m, p.packId), 0);
    return max + 1;
  }, [packs]);

  const [title, setTitle] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [estimated, setEstimated] = React.useState(20);
  const [status, setStatus] = React.useState<"active" | "hidden">("active");
  const [previewUrls, setPreviewUrls] = React.useState("");
  const [packObjectId, setPackObjectId] = React.useState("");
  const [promptsPerClass, setPromptsPerClass] = React.useState(20);
  const [costs, setCosts] = React.useState("person:1");

  React.useEffect(() => {
    if (!open) return;
    const base =
      pack ??
      ({
        packId: nextId,
        slug: "new-style",
        title: "Новый стиль",
        description: "Коротко и понятно: что получится на фото.",
        previewUrls: [],
        estimatedImages: 20,
        status: "active",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        astriaPackHint: { packObjectId: `pack_${nextId}`, promptsPerClass: 20, costsPerClass: { person: 1 } },
      } as any);

    setTitle(base.title);
    setSlug(base.slug);
    setDesc(base.description);
    setEstimated(base.estimatedImages);
    setStatus(base.status);
    setPreviewUrls((base.previewUrls ?? []).join("\n"));
    setPackObjectId(base.astriaPackHint.packObjectId);
    setPromptsPerClass(base.astriaPackHint.promptsPerClass);
    setCosts(Object.entries(base.astriaPackHint.costsPerClass ?? { person: 1 }).map(([k, v]) => `${k}:${v}`).join(","));
  }, [open, mode, pack?.packId, nextId]);

  function parseCosts(input: string) {
    const out: Record<string, number> = {};
    input
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .forEach((pair) => {
        const [k, v] = pair.split(":").map((x) => x.trim());
        const n = Number(v);
        if (!k) return;
        out[k] = Number.isFinite(n) ? n : 0;
      });
    return Object.keys(out).length ? out : { person: 1 };
  }

  const disabled = title.trim().length < 2 || slug.trim().length < 2 || desc.trim().length < 10;

  return (
    <Modal open={open} onClose={onClose} title={mode === "create" ? "Новый стиль" : "Редактировать стиль"} className="max-w-3xl">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="grid gap-2 text-xs text-white/60">
            Название
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
              placeholder="Напр.: Cinematic Neon"
            />
          </label>
          <label className="grid gap-2 text-xs text-white/60">
            Slug
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value.replace(/\s+/g, "-").toLowerCase())}
              className="w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
              placeholder="cinematic-neon"
            />
          </label>
        </div>

        <label className="grid gap-2 text-xs text-white/60">
          Описание (то, что увидит клиент)
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="min-h-[90px] w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
            placeholder="В 1–2 предложениях: какой результат и настроение."
          />
        </label>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="grid gap-2 text-xs text-white/60">
            Фото в паке (примерно)
            <input
              type="number"
              value={estimated}
              onChange={(e) => setEstimated(Number(e.target.value || 0))}
              className="w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
            />
          </label>
          <label className="grid gap-2 text-xs text-white/60">
            Видимость
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
            >
              <option value="active">active</option>
              <option value="hidden">hidden</option>
            </select>
          </label>
          <div className="rounded-2xl border border-stroke bg-white/3 p-3 text-xs text-white/60">
            ID: <span className="text-white/80 font-semibold">{pack?.packId ?? nextId}</span>
          </div>
        </div>

        <label className="grid gap-2 text-xs text-white/60">
          Превью (по 1 URL на строку)
          <textarea
            value={previewUrls}
            onChange={(e) => setPreviewUrls(e.target.value)}
            className="min-h-[90px] w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
            placeholder="https://…\nhttps://…"
          />
        </label>

        <div className="rounded-2xl border border-stroke bg-white/3 p-4">
          <div className="text-xs font-semibold text-white/85">Подсказка для pack object</div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="grid gap-2 text-xs text-white/60">
              packObjectId
              <input
                value={packObjectId}
                onChange={(e) => setPackObjectId(e.target.value)}
                className="w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
                placeholder="pack_9991"
              />
            </label>
            <label className="grid gap-2 text-xs text-white/60">
              promptsPerClass
              <input
                type="number"
                value={promptsPerClass}
                onChange={(e) => setPromptsPerClass(Number(e.target.value || 0))}
                className="w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
              />
            </label>
            <label className="grid gap-2 text-xs text-white/60">
              costsPerClass (csv `key:value`)
              <input
                value={costs}
                onChange={(e) => setCosts(e.target.value)}
                className="w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
                placeholder="person:1,style:0"
              />
            </label>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Отмена
          </Button>
          <Button
            className="flex-1"
            disabled={disabled}
            onClick={() => {
              const urls = previewUrls
                .split("\n")
                .map((x) => x.trim())
                .filter(Boolean);
              const payload = {
                ...(mode === "create"
                  ? {
                      packId: nextId,
                      createdAt: Date.now(),
                      updatedAt: Date.now(),
                    }
                  : null),
                slug: slug.trim(),
                title: title.trim(),
                description: desc.trim(),
                estimatedImages: Math.max(0, Math.round(estimated || 0)),
                status,
                previewUrls: urls,
                astriaPackHint: {
                  packObjectId: packObjectId.trim() || `pack_${mode === "create" ? nextId : pack?.packId ?? nextId}`,
                  promptsPerClass: Math.max(0, Math.round(promptsPerClass || 0)),
                  costsPerClass: parseCosts(costs),
                },
              };
              onSubmit(payload);
            }}
          >
            Сохранить
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function PromoEditorModal({
  open,
  mode,
  promo,
  promos,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  promo: ReturnType<typeof useAdminStore>["state"]["promos"][number] | null;
  promos: ReturnType<typeof useAdminStore>["state"]["promos"];
  onClose: () => void;
  onSubmit: (payload: any) => void;
}) {
  const nextId = React.useMemo(() => {
    const base = Math.max(
      1000,
      ...promos
        .map((p) => Number(String(p.promoId).replace(/[^\d]/g, "")))
        .filter((n) => Number.isFinite(n)),
    );
    return `promo_${base + 1}`;
  }, [promos]);

  const [title, setTitle] = React.useState("");
  const [caption, setCaption] = React.useState("");
  const [kind, setKind] = React.useState<"text" | "photo" | "video">("text");
  const [status, setStatus] = React.useState<"active" | "hidden">("active");
  const [tags, setTags] = React.useState("");
  const [coverUrl, setCoverUrl] = React.useState("");
  const [mediaUrls, setMediaUrls] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    const base =
      promo ??
      ({
        promoId: nextId,
        title: "Новый промо‑материал",
        caption: "Короткое описание/текст для публикации.",
        kind: "text",
        status: "active",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: [],
      } as any);
    setTitle(base.title);
    setCaption(base.caption);
    setKind(base.kind);
    setStatus(base.status);
    setTags((base.tags ?? []).join(", "));
    setCoverUrl(base.coverUrl ?? "");
    setMediaUrls((base.mediaUrls ?? []).join("\n"));
  }, [open, mode, promo?.promoId, nextId]);

  const disabled = title.trim().length < 2 || caption.trim().length < 10;

  return (
    <Modal open={open} onClose={onClose} title={mode === "create" ? "Новое промо" : "Редактировать промо"} className="max-w-3xl">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="grid gap-2 text-xs text-white/60">
            Заголовок
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-2 text-xs text-white/60">
              Тип
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as any)}
                className="w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
              >
                <option value="text">text</option>
                <option value="photo">photo</option>
                <option value="video">video</option>
              </select>
            </label>
            <label className="grid gap-2 text-xs text-white/60">
              Видимость
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
              >
                <option value="active">active</option>
                <option value="hidden">hidden</option>
              </select>
            </label>
          </div>
        </div>

        <label className="grid gap-2 text-xs text-white/60">
          Текст/описание
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="min-h-[90px] w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
          />
        </label>

        <label className="grid gap-2 text-xs text-white/60">
          Теги (через запятую)
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
            placeholder="instagram, reels, text"
          />
        </label>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="grid gap-2 text-xs text-white/60">
            Cover URL (опционально)
            <input
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              className="w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
              placeholder="https://…"
            />
          </label>
          <label className="grid gap-2 text-xs text-white/60">
            Media URLs (по 1 на строку)
            <textarea
              value={mediaUrls}
              onChange={(e) => setMediaUrls(e.target.value)}
              className="min-h-[90px] w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
              placeholder="https://…\nhttps://…"
            />
          </label>
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Отмена
          </Button>
          <Button
            className="flex-1"
            disabled={disabled}
            onClick={() => {
              const payload = {
                ...(mode === "create"
                  ? {
                      promoId: nextId,
                      createdAt: Date.now(),
                      updatedAt: Date.now(),
                    }
                  : null),
                title: title.trim(),
                caption: caption.trim(),
                kind,
                status,
                tags: tags
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
                coverUrl: coverUrl.trim() || undefined,
                mediaUrls: mediaUrls
                  .split("\n")
                  .map((x) => x.trim())
                  .filter(Boolean),
              };
              onSubmit(payload);
            }}
          >
            Сохранить
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function WithdrawalModal({
  open,
  withdrawal,
  onClose,
  onAction,
  minWithdrawRub,
}: {
  open: boolean;
  withdrawal: ReturnType<typeof useAdminStore>["state"]["withdrawals"][number] | null;
  onClose: () => void;
  onAction: (status: "Одобрено" | "Отклонено", note?: string) => void;
  minWithdrawRub: number;
}) {
  const [note, setNote] = React.useState("");

  React.useEffect(() => {
    setNote(withdrawal?.note ?? "");
  }, [withdrawal?.note, withdrawal?.requestId]);

  return (
    <Modal open={open} onClose={onClose} title="Заявка на вывод" className="max-w-2xl">
      {withdrawal ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <InfoTile label="Партнёр" value={withdrawal.partnerUsername} />
            <InfoTile label="Сумма" value={formatRub(withdrawal.amountRub)} />
            <InfoTile label="Создано" value={formatDateTime(withdrawal.createdAt)} />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <InfoTile label="Клиенты" value={`${withdrawal.paid}/${withdrawal.clients}`} />
            <InfoTile label="Риск" value={withdrawal.risk.toUpperCase()} />
            <InfoTile label="Статус" value={withdrawal.status} />
          </div>

          <div className="rounded-2xl border border-stroke bg-white/3 p-4">
            <div className="text-xs font-semibold text-white/85">Сигналы анти‑фрода</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {withdrawal.signals.map((s, idx) => (
                <span key={idx} className="rounded-full border border-stroke bg-white/4 px-2.5 py-1 text-xs text-white/75">
                  {s}
                </span>
              ))}
              {withdrawal.signals.length === 0 ? (
                <span className="text-xs text-white/60">Нет сигналов.</span>
              ) : null}
            </div>
            <div className="mt-3 text-xs text-white/55">
              Минимальная сумма вывода: {formatRub(minWithdrawRub)}.
            </div>
          </div>

          <label className="grid gap-2 text-xs text-white/60">
            Примечание (видно в аудит‑логе)
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
              placeholder="Напр.: попросить KYC / проверить источники / отклонить из-за мультиаккаунтов…"
            />
          </label>

          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={onClose}>
              Закрыть
            </Button>
            <Button
              className="flex-1"
              disabled={withdrawal.status !== "Ожидает"}
              onClick={() => onAction("Одобрено", note.trim() || undefined)}
            >
              <Check size={16} />
              Одобрить
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              disabled={withdrawal.status !== "Ожидает"}
              onClick={() => onAction("Отклонено", note.trim() || undefined)}
            >
              <X size={16} />
              Отклонить
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-stroke bg-white/3 p-3">
      <div className="text-[11px] text-white/55">{label}</div>
      <div className="mt-1 text-sm font-semibold text-white/90">{value}</div>
    </div>
  );
}

function ConfirmModal({
  open,
  title,
  body,
  confirmTone,
  confirmLabel,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmTone: "danger" | "primary";
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div className="rounded-2xl border border-stroke bg-white/3 p-4 text-sm text-white/75">{body}</div>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Отмена
          </Button>
          <Button variant={confirmTone === "danger" ? "danger" : "primary"} className="flex-1" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function AdjustBalanceModal({
  open,
  partner,
  onClose,
  onApply,
}: {
  open: boolean;
  partner: ReturnType<typeof useAdminStore>["state"]["partners"][number] | null;
  onClose: () => void;
  onApply: (deltaRub: number, reason: string) => void;
}) {
  const [delta, setDelta] = React.useState("0");
  const [reason, setReason] = React.useState("");

  React.useEffect(() => {
    setDelta("0");
    setReason("");
  }, [partner?.partnerId]);

  const deltaRub = Number(delta || 0);
  const disabled = !Number.isFinite(deltaRub) || deltaRub === 0 || reason.trim().length < 3;

  return (
    <Modal open={open} onClose={onClose} title="Коррекция баланса" className="max-w-xl">
      {partner ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-stroke bg-white/3 p-4 text-sm text-white/75">
            Партнёр: <span className="text-white/90 font-semibold">{partner.username}</span> (#{partner.partnerId})
            <div className="mt-2 text-xs text-white/60">
              Доступно сейчас: <span className="text-white/80">{formatRub(partner.balances.availableRub)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="grid gap-2 text-xs text-white/60">
              Изменение (₽)
              <input
                value={delta}
                onChange={(e) => setDelta(e.target.value)}
                className="w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
                placeholder="Напр.: 500 или -200"
              />
            </label>
            <label className="grid gap-2 text-xs text-white/60">
              Причина
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
                placeholder="Напр.: ручная корректировка"
              />
            </label>
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={onClose}>
              Отмена
            </Button>
            <Button className="flex-1" disabled={disabled} onClick={() => onApply(deltaRub, reason.trim())}>
              Применить
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
