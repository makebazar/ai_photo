import { motion } from "framer-motion";
import {
  Crown,
  LayoutDashboard,
  Package,
  Megaphone,
  ShieldAlert,
  ShoppingBag,
  Users,
  RefreshCw,
} from "lucide-react";
import * as React from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { useToast } from "../../components/ui/Toast";
import { cn } from "../../lib/cn";
import { useAdminStore, type AdminAction } from "./adminStore";
import { 
  getUsers, getOrders, getPartners, getWithdrawals, 
  getAdminConfig, getPacks, getPromos, getSessions,
  type AdminPack as ApiAdminPack,
  type AdminPromo as ApiAdminPromo,
} from "../../lib/adminApi";

export function AdminDashboard() {
  const toast = useToast();
  const { state, dispatch } = useAdminStore();
  const [loading, setLoading] = React.useState(false);
  const [nav, setNav] = React.useState<"overview" | "users" | "orders" | "partners" | "withdrawals" | "packs" | "promos">("overview");

  const refreshData = async () => {
    try {
      setLoading(true);
      const [users, orders, partners, withdrawals, packs, promos, config] = await Promise.all([
        getUsers().catch(() => []),
        getOrders().catch(() => []),
        getPartners().catch(() => []),
        getWithdrawals().catch(() => []),
        getPacks().catch(() => []),
        getPromos().catch(() => []),
        getAdminConfig().catch(() => null),
      ]);
      
      dispatch({
        type: "load_data",
        data: {
          users: users.map((u) => ({
            userId: u.id,
            username: u.username || "",
            telegramId: u.tg_id || 0,
            plan: "Стандарт" as const,
            createdAt: Date.now(),
            lastSeenAt: u.last_seen_at ? Date.parse(u.last_seen_at) : Date.now(),
            modelStatus: (u.avatar_status || "none") as any,
            astriaModelId: u.astria_model_id || "",
            sessions: [],
            spentRub: 0,
            ordersCount: 0,
          })),
          orders: orders.map((o) => ({
            orderId: o.id,
            userId: "",
            username: o.username || "",
            planId: o.plan_id,
            packId: 0,
            packTitle: "",
            amountRub: o.amount_rub,
            status: o.status === "paid" ? "Оплачен" : "Не оплачен",
            createdAt: Date.now(),
            paidAt: o.paid_at ? Date.parse(o.paid_at) : undefined,
            partnerPublicId: o.partner_public_id || "",
            attributionKind: o.attribution_kind || "",
            imagesPlanned: 20,
            updatedAt: Date.now(),
            flags: [],
          })),
          partners: partners.map((p) => ({
            partnerId: p.public_id,
            userId: p.id,
            username: p.username || "",
            telegramId: p.tg_id || 0,
            status: p.status as any,
            clientCode: p.client_code,
            teamCode: p.team_code,
            parentPartnerId: p.parent_partner_id || "",
            joinedAt: Date.parse(p.created_at),
            lastActivityAt: Date.now(),
            balances: {
              availableRub: p.available_rub,
              lockedRub: p.locked_rub,
              paidOutRub: p.paid_out_rub,
            },
            stats: { clicks: 0, signups: 0, paid: 0, earningsRub: p.available_rub, turnoverRub: 0, teamL1: 10, teamL2: 5 },
            links: { client: "", team: "" },
            riskFlags: [],
          })),
          withdrawals: withdrawals.map((w) => ({
            requestId: w.id,
            partnerId: w.partner_id,
            partnerUsername: w.partner_username || "",
            amountRub: w.amount_rub,
            status: w.status === "pending" ? "Ожидает" : w.status === "approved" ? "Одобрено" : "Отклонено",
            createdAt: Date.parse(w.created_at),
            reviewedAt: w.reviewed_at ? Date.parse(w.reviewed_at) : undefined,
            clients: 0,
            paid: 0,
            risk: [],
            signals: [],
            note: w.note || "",
          })),
          packs: packs.map((p) => ({
            packId: p.id,
            slug: p.slug,
            title: p.title,
            description: p.description,
            status: p.status as any,
            previewUrls: p.preview_urls,
            estimatedImages: p.estimated_images,
            packObjectId: p.pack_object_id || "",
            promptsPerClass: p.prompts_per_class || 0,
            costsPerClass: p.costs_per_class,
            astriaPackHint: {},
            createdAt: Date.parse(p.created_at),
            updatedAt: Date.parse(p.updated_at),
          })),
          promos: promos.map((p) => ({
            promoId: p.id,
            title: p.title,
            caption: p.caption,
            kind: p.kind as any,
            status: p.status as any,
            coverUrl: p.cover_url || "",
            mediaUrls: p.media_urls,
            tags: p.tags,
            createdAt: Date.parse(p.created_at),
            updatedAt: Date.parse(p.updated_at),
          })),
          config: config || state.config,
        },
      });
      toast.push({ title: "Данные обновлены", variant: "success" });
    } catch (err) {
      toast.push({ title: "Ошибка: " + (err instanceof Error ? err.message : String(err)), variant: "danger" });
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    refreshData();
  }, []);

  return (
    <div className="min-h-full bg-gradient-to-b from-white/5 to-transparent">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Crown className="text-neonViolet" size={24} />
            <div>
              <h1 className="text-xl font-bold text-white">Admin Dashboard</h1>
              <p className="text-sm text-white/60">Управление пользователями, заказами и контентом</p>
            </div>
          </div>
          <Button variant="secondary" onClick={refreshData} disabled={loading}>
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            <span className="ml-2">{loading ? "Загрузка..." : "Обновить"}</span>
          </Button>
        </div>

        {/* Navigation */}
        <Card className="mb-6 p-2">
          <div className="flex flex-wrap gap-2">
            <NavButton active={nav === "overview"} onClick={() => setNav("overview")} icon={<LayoutDashboard size={16} />} label="Обзор" />
            <NavButton active={nav === "users"} onClick={() => setNav("users")} icon={<Users size={16} />} label={`Пользователи (${state.users.length})`} />
            <NavButton active={nav === "orders"} onClick={() => setNav("orders")} icon={<ShoppingBag size={16} />} label={`Заказы (${state.orders.length})`} />
            <NavButton active={nav === "partners"} onClick={() => setNav("partners")} icon={<Users size={16} />} label={`Партнёры (${state.partners.length})`} />
            <NavButton active={nav === "withdrawals"} onClick={() => setNav("withdrawals")} icon={<ShieldAlert size={16} />} label={`Вывод (${state.withdrawals.length})`} />
            <NavButton active={nav === "packs"} onClick={() => setNav("packs")} icon={<Package size={16} />} label={`Паки (${state.packs.length})`} />
            <NavButton active={nav === "promos"} onClick={() => setNav("promos")} icon={<Megaphone size={16} />} label={`Промо (${state.promos.length})`} />
          </div>
        </Card>

        {/* Content */}
        {nav === "overview" && <Overview state={state} />}
        {nav === "users" && <UsersList users={state.users} />}
        {nav === "orders" && <OrdersList orders={state.orders} />}
        {nav === "partners" && <PartnersList partners={state.partners} />}
        {nav === "withdrawals" && <WithdrawalsList withdrawals={state.withdrawals} />}
        {nav === "packs" && <PacksList packs={state.packs} />}
        {nav === "promos" && <PromosList promos={state.promos} />}
      </div>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition",
        active ? "bg-neonViolet/20 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function Overview({ state }: { state: any }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard title="Пользователи" value={state.users.length} />
      <StatCard title="Заказы" value={state.orders.length} />
      <StatCard title="Партнёры" value={state.partners.length} />
      <StatCard title="Заявки на вывод" value={state.withdrawals.length} />
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <Card className="p-6">
      <div className="text-sm text-white/60">{title}</div>
      <div className="mt-2 text-3xl font-bold text-white">{value}</div>
    </Card>
  );
}

function UsersList({ users }: { users: any[] }) {
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10 text-left text-white/60">
            <tr>
              <th className="p-3">ID</th>
              <th className="p-3">Username</th>
              <th className="p-3">Telegram ID</th>
              <th className="p-3">Статус</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.userId} className="border-b border-white/5">
                <td className="p-3 font-mono text-white/60">{u.userId.slice(0, 8)}</td>
                <td className="p-3 text-white">{u.username || "—"}</td>
                <td className="p-3 text-white/60">{u.telegramId || "—"}</td>
                <td className="p-3">
                  <span className={cn("rounded-full px-2 py-1 text-xs", u.modelStatus === "ready" ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/60")}>
                    {u.modelStatus}
                  </span>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-white/60">
                  Нет пользователей
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function OrdersList({ orders }: { orders: any[] }) {
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10 text-left text-white/60">
            <tr>
              <th className="p-3">ID</th>
              <th className="p-3">Сумма</th>
              <th className="p-3">Статус</th>
              <th className="p-3">Дата</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.orderId} className="border-b border-white/5">
                <td className="p-3 font-mono text-white/60">{o.orderId.slice(0, 8)}</td>
                <td className="p-3 text-white">{o.amountRub} ₽</td>
                <td className="p-3">
                  <span className={cn("rounded-full px-2 py-1 text-xs", o.status === "Оплачен" ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400")}>
                    {o.status}
                  </span>
                </td>
                <td className="p-3 text-white/60">{new Date(o.createdAt).toLocaleDateString("ru-RU")}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-white/60">
                  Нет заказов
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function PartnersList({ partners }: { partners: any[] }) {
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10 text-left text-white/60">
            <tr>
              <th className="p-3">ID</th>
              <th className="p-3">Username</th>
              <th className="p-3">Баланс</th>
              <th className="p-3">Статус</th>
            </tr>
          </thead>
          <tbody>
            {partners.map((p) => (
              <tr key={p.partnerId} className="border-b border-white/5">
                <td className="p-3 font-mono text-white/60">{p.partnerId}</td>
                <td className="p-3 text-white">{p.username || "—"}</td>
                <td className="p-3 text-white">{p.balances.availableRub} ₽</td>
                <td className="p-3">
                  <span className={cn("rounded-full px-2 py-1 text-xs", p.status === "active" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400")}>
                    {p.status}
                  </span>
                </td>
              </tr>
            ))}
            {partners.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-white/60">
                  Нет партнёров
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function WithdrawalsList({ withdrawals }: { withdrawals: any[] }) {
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10 text-left text-white/60">
            <tr>
              <th className="p-3">ID</th>
              <th className="p-3">Партнёр</th>
              <th className="p-3">Сумма</th>
              <th className="p-3">Статус</th>
            </tr>
          </thead>
          <tbody>
            {withdrawals.map((w) => (
              <tr key={w.requestId} className="border-b border-white/5">
                <td className="p-3 font-mono text-white/60">{w.requestId.slice(0, 8)}</td>
                <td className="p-3 text-white">{w.partnerUsername || "—"}</td>
                <td className="p-3 text-white">{w.amountRub} ₽</td>
                <td className="p-3">
                  <span className={cn("rounded-full px-2 py-1 text-xs", w.status === "Одобрено" ? "bg-green-500/20 text-green-400" : w.status === "Ожидает" ? "bg-yellow-500/20 text-yellow-400" : "bg-red-500/20 text-red-400")}>
                    {w.status}
                  </span>
                </td>
              </tr>
            ))}
            {withdrawals.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-white/60">
                  Нет заявок на вывод
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function PacksList({ packs }: { packs: any[] }) {
  return (
    <Card>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {packs.map((p) => (
          <div key={p.packId} className="rounded-xl border border-white/10 p-4">
            <div className="text-sm font-semibold text-white">{p.title}</div>
            <div className="mt-1 text-xs text-white/60">{p.description}</div>
            <div className="mt-3 flex items-center justify-between">
              <span className={cn("rounded-full px-2 py-1 text-xs", p.status === "active" ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/60")}>
                {p.status}
              </span>
              <span className="text-xs text-white/60">{p.estimatedImages} фото</span>
            </div>
          </div>
        ))}
        {packs.length === 0 && (
          <div className="p-8 text-center text-white/60">Нет паков</div>
        )}
      </div>
    </Card>
  );
}

function PromosList({ promos }: { promos: any[] }) {
  return (
    <Card>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {promos.map((p) => (
          <div key={p.promoId} className="rounded-xl border border-white/10 p-4">
            <div className="text-sm font-semibold text-white">{p.title}</div>
            <div className="mt-1 line-clamp-2 text-xs text-white/60">{p.caption}</div>
            <div className="mt-3 flex items-center justify-between">
              <span className={cn("rounded-full px-2 py-1 text-xs", p.status === "active" ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/60")}>
                {p.status}
              </span>
              <span className="text-xs text-white/60">{p.kind}</span>
            </div>
          </div>
        ))}
        {promos.length === 0 && (
          <div className="p-8 text-center text-white/60">Нет промо материалов</div>
        )}
      </div>
    </Card>
  );
}
