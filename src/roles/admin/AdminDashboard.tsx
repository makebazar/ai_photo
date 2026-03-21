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
  LogOut,
  Lock,
  Trash2,
  Settings,
  Save,
  ArrowRight,
  Wallet,
  User,
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
  deleteUser, adjustUserTokens, updateAdminConfig,
  type AdminPack as ApiAdminPack,
  type AdminPromo as ApiAdminPromo,
  type AdminConfig,
  type AdminPlan,
} from "../../lib/adminApi";

const ADMIN_PASSWORD = "admin123"; // Простой пароль для прототипа
const LS_AUTH_KEY = "ai_photo_admin_auth_v1";

function MlmSettings({ config, partners, onSave }: { config: AdminConfig; partners: any[]; onSave: (patch: Partial<AdminConfig>) => void }) {
  const [local, setLocal] = React.useState(config);

  React.useEffect(() => {
    // Basic UUID validation for loaded config
    const isUuid = (str: any) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    if (config.mlm?.ownerPartnerId && !isUuid(config.mlm.ownerPartnerId)) {
      setLocal({ ...config, mlm: { ...config.mlm, ownerPartnerId: null } });
    } else {
      setLocal(config);
    }
  }, [config]);

  const totalCommission = (local.commissionsPct?.partner || 0) + (local.commissionsPct?.parent || 0);
  const platformShare = 100 - totalCommission;

  return (
    <Card className="overflow-hidden border-neonViolet/20 bg-neonViolet/5 p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Настройки выплат и Money Flow</h2>
          <p className="text-sm text-white/50">Управление распределением прибыли и главным аккаунтом</p>
        </div>
        <Button onClick={() => onSave(local)}>
          <Save size={16} className="mr-2" />
          Сохранить настройки
        </Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Left: Inputs */}
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/5 bg-white/5 p-4 transition-colors hover:border-white/10">
              <label className="mb-2 block text-xs font-medium text-white/40 uppercase tracking-wider">Доля партнёра (L0)</label>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neonBlue/20 text-neonBlue">
                  <User size={20} />
                </div>
                <div className="relative flex-1">
                  <input
                    type="number"
                    value={local.commissionsPct?.partner}
                    onChange={(e) => setLocal({ ...local, commissionsPct: { ...local.commissionsPct, partner: parseFloat(e.target.value) || 0 } })}
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-4 pr-8 text-lg font-bold text-white outline-none focus:border-neonBlue/50"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-white/30">%</span>
                </div>
              </div>
              <p className="mt-2 text-[10px] text-white/30 leading-tight">Тот, кто непосредственно пригласил клиента по ссылке.</p>
            </div>

            <div className="rounded-2xl border border-white/5 bg-white/5 p-4 transition-colors hover:border-white/10">
              <label className="mb-2 block text-xs font-medium text-white/40 uppercase tracking-wider">Доля аплайна (L1)</label>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neonViolet/20 text-neonViolet">
                  <ArrowRight size={20} />
                </div>
                <div className="relative flex-1">
                  <input
                    type="number"
                    value={local.commissionsPct?.parent}
                    onChange={(e) => setLocal({ ...local, commissionsPct: { ...local.commissionsPct, parent: parseFloat(e.target.value) || 0 } })}
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-4 pr-8 text-lg font-bold text-white outline-none focus:border-neonViolet/50"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-white/30">%</span>
                </div>
              </div>
              <p className="mt-2 text-[10px] text-white/30 leading-tight">Тот, кто пригласил этого партнёра в команду.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/5 bg-white/5 p-4 transition-colors hover:border-white/10">
            <label className="mb-3 block text-xs font-medium text-white/40 uppercase tracking-wider">Главный аккаунт (Владелец)</label>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-500/20 text-yellow-500">
                <Crown size={20} />
              </div>
              <select
                value={local.mlm?.ownerPartnerId || ""}
                onChange={(e) => setLocal({ ...local, mlm: { ...local.mlm!, ownerPartnerId: e.target.value || null } })}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-yellow-500/50 appearance-none"
              >
                <option value="">Не выбран (деньги остаются в системе)</option>
                {partners.map(p => (
                  <option key={p.userId} value={p.userId}>
                    {p.username ? `@${p.username}` : `ID: ${p.partnerId}`} (Владелец)
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-3 text-[11px] text-white/40 leading-relaxed">
              <span className="text-yellow-500/80 font-semibold">Важно:</span> На этот аккаунт будут стекаться все {local.commissionsPct?.parent}% аплайн-комиссий, если у партнёра нет своего пригласителя. Это ваш основной доходный кошелёк.
            </p>
          </div>
        </div>

        {/* Right: Visual Flow */}
        <div className="relative flex flex-col items-center justify-center rounded-3xl border border-white/5 bg-black/20 p-8">
          <div className="mb-12 flex flex-col items-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-white shadow-lg ring-1 ring-white/20">
              <ShoppingBag size={32} />
            </div>
            <div className="mt-2 text-center">
              <div className="text-sm font-bold text-white uppercase">Заказ клиента</div>
              <div className="text-xs text-white/40">100% (например, 1000₽)</div>
            </div>
          </div>

          <div className="grid w-full grid-cols-3 gap-4">
            <div className="flex flex-col items-center text-center">
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-neonBlue/20 text-neonBlue ring-1 ring-neonBlue/30">
                <User size={24} />
              </div>
              <div className="text-[10px] font-bold text-white uppercase">Партнёр</div>
              <div className="text-lg font-black text-neonBlue leading-none">{local.commissionsPct?.partner}%</div>
              <div className="text-[9px] text-white/30 mt-1">Прямая продажа</div>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-neonViolet/20 text-neonViolet ring-1 ring-neonViolet/30">
                <Crown size={24} />
              </div>
              <div className="text-[10px] font-bold text-white uppercase tracking-tighter">Владелец</div>
              <div className="text-lg font-black text-neonViolet leading-none">{local.commissionsPct?.parent}%</div>
              <div className="text-[9px] text-white/30 mt-1">Аплайн / Owner</div>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20 text-green-500 ring-1 ring-green-500/30">
                <Wallet size={24} />
              </div>
              <div className="text-[10px] font-bold text-white uppercase">Система</div>
              <div className="text-lg font-black text-green-500 leading-none">{platformShare}%</div>
              <div className="text-[9px] text-white/30 mt-1">Чистая прибыль</div>
            </div>
          </div>

          {/* Connectors (SVG) */}
          <svg className="absolute inset-0 -z-10 h-full w-full opacity-20" preserveAspectRatio="none">
            <path d="M 50% 100 L 16% 250" stroke="white" strokeWidth="1" fill="none" strokeDasharray="4 4" />
            <path d="M 50% 100 L 50% 250" stroke="white" strokeWidth="1" fill="none" strokeDasharray="4 4" />
            <path d="M 50% 100 L 84% 250" stroke="white" strokeWidth="1" fill="none" strokeDasharray="4 4" />
          </svg>
        </div>
      </div>
    </Card>
  );
}

export function AdminDashboard() {
  const toast = useToast();
  const { state, dispatch } = useAdminStore();
  const [loading, setLoading] = React.useState(false);
  const [nav, setNav] = React.useState<"overview" | "users" | "orders" | "partners" | "withdrawals" | "packs" | "promos" | "settings">("overview");
  const [isAuthenticated, setIsAuthenticated] = React.useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(LS_AUTH_KEY) === "1";
  });
  const [password, setPassword] = React.useState("");
  const [authError, setAuthError] = React.useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      localStorage.setItem(LS_AUTH_KEY, "1");
      setIsAuthenticated(true);
      setAuthError("");
      toast.push({ title: "Вход выполнен", variant: "success" });
    } else {
      setAuthError("Неверный пароль");
      toast.push({ title: "Ошибка входа", description: "Неверный пароль", variant: "danger" });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(LS_AUTH_KEY);
    setIsAuthenticated(false);
    setPassword("");
    toast.push({ title: "Выход из системы", variant: "success" });
  };

  const handleAdjustTokens = async (userId: string, delta: number) => {
    try {
      setLoading(true);
      await adjustUserTokens(userId, delta);
      toast.push({ title: "Баланс токенов обновлен", variant: "success" });
      await refreshData();
    } catch (err) {
      toast.push({ title: "Ошибка", description: String(err), variant: "danger" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Вы уверены, что хотите удалить этого пользователя? Все связанные данные (аватары, заказы) будут также удалены.")) return;
    
    try {
      setLoading(true);
      await deleteUser(userId);
      toast.push({ title: "Пользователь удален", variant: "success" });
      await refreshData();
    } catch (err) {
      toast.push({ title: "Ошибка при удалении", description: String(err), variant: "danger" });
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    try {
      setLoading(true);
      const [users, orders, partners, withdrawals, packs, promos, config] = await Promise.all([
        getUsers().catch((err) => {
          console.error("[Admin] Error loading users:", err);
          return [];
        }),
        getOrders().catch((err) => {
          console.error("[Admin] Error loading orders:", err);
          return [];
        }),
        getPartners().catch((err) => {
          console.error("[Admin] Error loading partners:", err);
          return [];
        }),
        getWithdrawals().catch((err) => {
          console.error("[Admin] Error loading withdrawals:", err);
          return [];
        }),
        getPacks().catch((err) => {
          console.error("[Admin] Error loading packs:", err);
          return [];
        }),
        getPromos().catch((err) => {
          console.error("[Admin] Error loading promos:", err);
          return [];
        }),
        getAdminConfig().catch((err) => {
          console.error("[Admin] Error loading config:", err);
          return null;
        }),
      ]);

      console.log("[Admin] Loaded data:", {
        usersCount: users.length,
        ordersCount: orders.length,
        partnersCount: partners.length,
        withdrawalsCount: withdrawals.length,
        packsCount: packs.length,
        promosCount: promos.length,
      });
      
      console.log("[Admin] Partners data:", partners);
      
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
            isPartner: !!u.is_partner,
            tokensBalance: u.tokens_balance || 0,
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
            partnerId: String(p.public_id),
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
            stats: {
              clicks: p.clicks_count || 0,
              signups: p.signups_count || 0,
              paid: p.paid_orders_count || 0,
              earningsRub: p.available_rub,
              turnoverRub: p.turnover_rub || 0,
            },
            links: {
              client: `https://t.me/bot?start=${p.client_code}`,
              team: `https://t.me/bot?start=${p.team_code}`,
            },
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
    if (isAuthenticated) {
      refreshData();
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white/5 to-transparent px-4">
        <Card className="w-full max-w-md p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-neonViolet/20">
              <Lock className="text-neonViolet" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
            <p className="mt-2 text-sm text-white/60">Введите пароль для доступа к панели управления</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs text-white/60">Пароль</label>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setAuthError("");
                }}
                className="mt-2 w-full rounded-2xl border border-stroke bg-white/4 px-4 py-3 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
                placeholder="••••••••"
                autoFocus
              />
              {authError && <p className="mt-2 text-sm text-red-400">{authError}</p>}
            </div>
            <Button type="submit" className="w-full">
              <Lock size={16} className="mr-2" />
              Войти
            </Button>
          </form>
        </Card>
      </div>
    );
  }

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
          <div className="flex gap-2">
            <Button variant="secondary" onClick={refreshData} disabled={loading}>
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              <span className="ml-2">{loading ? "Загрузка..." : "Обновить"}</span>
            </Button>
            <Button variant="secondary" onClick={handleLogout}>
              <LogOut size={16} className="mr-2" />
              Выйти
            </Button>
          </div>
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
            <NavButton active={nav === "settings"} onClick={() => setNav("settings")} icon={<Settings size={16} />} label="Настройки" />
          </div>
        </Card>

        {/* Content */}
        {nav === "overview" && <Overview state={state} />}
        {nav === "users" && <UsersList users={state.users} onDelete={handleDeleteUser} onAdjustTokens={handleAdjustTokens} />}
        {nav === "orders" && <OrdersList orders={state.orders} />}
        {nav === "partners" && (
          <div className="space-y-6">
            <MlmSettings config={state.config} partners={state.partners} onSave={(patch) => {
              setLoading(true);
              updateAdminConfig(patch)
                .then((newConfig) => {
                  dispatch({ type: "config_update", patch: newConfig });
                  toast.push({ title: "Настройки MLM сохранены", variant: "success" });
                })
                .catch((err) => {
                  toast.push({ title: "Ошибка", description: String(err), variant: "danger" });
                })
                .finally(() => setLoading(false));
            }} />
            <PartnersList partners={state.partners} />
          </div>
        )}
        {nav === "withdrawals" && <WithdrawalsList withdrawals={state.withdrawals} />}
        {nav === "packs" && <PacksList packs={state.packs} />}
        {nav === "promos" && <PromosList promos={state.promos} />}
        {nav === "settings" && <ConfigSettings config={state.config} onSave={(patch) => {
          setLoading(true);
          updateAdminConfig(patch)
            .then((newConfig) => {
              dispatch({ type: "config_update", patch: newConfig });
              toast.push({ title: "Настройки сохранены", variant: "success" });
            })
            .catch((err) => {
              toast.push({ title: "Ошибка", description: String(err), variant: "danger" });
            })
            .finally(() => setLoading(false));
        }} />}
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

function UsersList({ users, onDelete, onAdjustTokens }: { users: any[]; onDelete: (userId: string) => void; onAdjustTokens: (userId: string, delta: number) => void }) {
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10 text-left text-white/60">
            <tr>
              <th className="p-3">ID</th>
              <th className="p-3">Username</th>
              <th className="p-3">Telegram ID</th>
              <th className="p-3">Токены</th>
              <th className="p-3">Статус</th>
              <th className="p-3 text-right">Действия</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.userId} className="border-b border-white/5">
                <td className="p-3 font-mono text-white/60">{u.userId.slice(0, 8)}</td>
                <td className="p-3 text-white">{u.username || "—"}</td>
                <td className="p-3 text-white/60">{u.telegramId || "—"}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-neonBlue">{u.tokensBalance}</span>
                    <div className="flex flex-col gap-1">
                      <button 
                        onClick={() => onAdjustTokens(u.userId, 10)}
                        className="rounded bg-white/5 px-1 text-[10px] hover:bg-white/10"
                      >
                        +10
                      </button>
                      <button 
                        onClick={() => onAdjustTokens(u.userId, -10)}
                        className="rounded bg-white/5 px-1 text-[10px] hover:bg-white/10"
                      >
                        -10
                      </button>
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <span className={cn("rounded-full px-2 py-1 text-xs", u.modelStatus === "ready" ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/60")}>
                    {u.modelStatus}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <button
                    onClick={() => onDelete(u.userId)}
                    className="rounded-lg p-2 text-white/40 transition hover:bg-red-500/10 hover:text-red-400"
                    title="Удалить пользователя"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-white/60">
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

function ConfigSettings({ config, onSave }: { config: AdminConfig; onSave: (patch: Partial<AdminConfig>) => void }) {
  const [local, setLocal] = React.useState<AdminConfig>(config);

  React.useEffect(() => {
    setLocal(config);
  }, [config]);

  const handleAddPlan = () => {
    const id = `plan_${Date.now()}`;
    const newPlan: AdminPlan = {
      id,
      slug: id,
      title: "Новый тариф",
      tagline: "Описание тарифа",
      priceRub: 1000,
      tokens: 50,
      grantsPartner: false,
    };
    setLocal({
      ...local,
      plans: [...local.plans, newPlan]
    });
  };

  const handleDeletePlan = (id: string) => {
    setLocal({
      ...local,
      plans: local.plans.filter(p => p.id !== id)
    });
  };

  const handlePlanChange = (id: string, field: keyof AdminPlan, val: any) => {
    setLocal({
      ...local,
      plans: local.plans.map(p => {
        if (p.id !== id) return p;
        return { ...p, [field]: val };
      })
    });
  };

  const handlePayoutChange = (field: string, val: any) => {
    setLocal({
      ...local,
      payout: { ...local.payout, [field as any]: field === "minWithdrawRub" ? parseInt(val) || 0 : val }
    });
  };

  const handleCostChange = (field: string, val: string) => {
    const num = parseInt(val) || 0;
    setLocal({
      ...local,
      costs: { ...local.costs, [field as any]: num }
    });
  };

  const handleAddModel = () => {
    const id = `model_${Date.now()}`;
    const newModel = { id, title: "Новая модель", costPerPhoto: 1 };
    setLocal({
      ...local,
      costs: {
        ...local.costs,
        models: [...(local.costs.models || []), newModel]
      }
    });
  };

  const handleDeleteModel = (id: string) => {
    setLocal({
      ...local,
      costs: {
        ...local.costs,
        models: (local.costs.models || []).filter(m => m.id !== id)
      }
    });
  };

  const handleModelChange = (id: string, field: string, val: any) => {
    setLocal({
      ...local,
      costs: {
        ...local.costs,
        models: (local.costs.models || []).map(m => {
          if (m.id !== id) return m;
          const next = { ...m, [field]: val };
          if (field === "isDefault" && val === true) {
            // Unset other defaults
            return next;
          }
          return next;
        }).map(m => {
          if (field === "isDefault" && val === true && m.id !== id) {
            return { ...m, isDefault: false };
          }
          return m;
        })
      }
    });
  };

  return (
    <div className="grid gap-6">
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Тарифы и цены</h2>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleAddPlan}>
              + Добавить тариф
            </Button>
            <Button onClick={() => onSave(local)}>
              <Save size={16} className="mr-2" />
              Сохранить всё
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {local.plans.map((plan) => (
            <div key={plan.id} className="relative space-y-4 rounded-xl border border-white/5 bg-white/2 p-4">
              <button 
                onClick={() => handleDeletePlan(plan.id)}
                className="absolute right-4 top-4 text-white/20 hover:text-red-400"
              >
                <Trash2 size={16} />
              </button>
              
              <h3 className={cn("text-sm font-semibold", plan.grantsPartner ? "text-neonViolet" : "text-neonBlue")}>
                Тариф: {plan.title}
              </h3>
              
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/50">ID (slug)</label>
                    <input
                      type="text"
                      value={plan.id}
                      onChange={(e) => handlePlanChange(plan.id, "id", e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-neonBlue/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/50">Название в UI</label>
                    <input
                      type="text"
                      value={plan.title}
                      onChange={(e) => handlePlanChange(plan.id, "title", e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-neonBlue/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-white/50">Слоган</label>
                  <input
                    type="text"
                    value={plan.tagline}
                    onChange={(e) => handlePlanChange(plan.id, "tagline", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-neonBlue/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/50">Цена (₽)</label>
                    <input
                      type="number"
                      value={plan.priceRub}
                      onChange={(e) => handlePlanChange(plan.id, "priceRub", parseInt(e.target.value) || 0)}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-neonBlue/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/50">Токены</label>
                    <input
                      type="number"
                      value={plan.tokens}
                      onChange={(e) => handlePlanChange(plan.id, "tokens", parseInt(e.target.value) || 0)}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-neonBlue/50"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={plan.grantsPartner}
                      onChange={(e) => handlePlanChange(plan.id, "grantsPartner", e.target.checked)}
                      className="h-4 w-4 rounded border-white/10 bg-white/5 text-neonViolet focus:ring-neonViolet/30"
                    />
                    <span className="text-xs text-white/70">Доступ к партнерке</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={plan.grantsFreeAvatar}
                      onChange={(e) => handlePlanChange(plan.id, "grantsFreeAvatar", e.target.checked)}
                      className="h-4 w-4 rounded border-white/10 bg-white/5 text-neonViolet focus:ring-neonViolet/30"
                    />
                    <span className="text-xs text-white/70">Бесплатный аватар</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={plan.featured}
                      onChange={(e) => handlePlanChange(plan.id, "featured", e.target.checked)}
                      className="h-4 w-4 rounded border-white/10 bg-white/5 text-neonBlue focus:ring-neonBlue/30"
                    />
                    <span className="text-xs text-white/70">Выделенный</span>
                  </label>
                </div>

                <div>
                  <label className="text-xs text-white/50">Бейдж (например, "Хит")</label>
                  <input
                    type="text"
                    value={plan.badge || ""}
                    onChange={(e) => handlePlanChange(plan.id, "badge", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-neonBlue/50"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Модели генерации</h2>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleAddModel}>
              + Добавить модель
            </Button>
            <Button onClick={() => onSave(local)}>
              <Save size={16} className="mr-2" />
              Сохранить модели
            </Button>
          </div>
        </div>
        <div className="space-y-4">
          {(local.costs?.models || []).map((m: any) => (
            <div key={m.id} className="relative grid gap-4 rounded-xl border border-white/5 bg-white/2 p-4 md:grid-cols-4">
              <button 
                onClick={() => handleDeleteModel(m.id)}
                className="absolute right-2 top-2 text-white/20 hover:text-red-400"
              >
                <Trash2 size={14} />
              </button>
              <div>
                <label className="text-[10px] text-white/50">ID</label>
                <input
                  type="text"
                  value={m.id}
                  onChange={(e) => handleModelChange(m.id, "id", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white outline-none focus:border-neonBlue/50"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/50">Название</label>
                <input
                  type="text"
                  value={m.title}
                  onChange={(e) => handleModelChange(m.id, "title", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white outline-none focus:border-neonBlue/50"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/50">Токенов за фото</label>
                <input
                  type="number"
                  value={m.costPerPhoto}
                  onChange={(e) => handleModelChange(m.id, "costPerPhoto", parseInt(e.target.value) || 0)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white outline-none focus:border-neonBlue/50"
                />
              </div>
              <div className="flex items-end pb-1.5">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!m.isDefault}
                    onChange={(e) => handleModelChange(m.id, "isDefault", e.target.checked)}
                    className="h-3 w-3 rounded border-white/10 bg-white/5 text-neonBlue focus:ring-neonBlue/30"
                  />
                  <span className="text-[10px] text-white/70">По умолчанию</span>
                </label>
              </div>
            </div>
          ))}
          {(local.costs?.models || []).length === 0 && (
            <div className="py-4 text-center text-xs text-white/30 italic">Список моделей пуст</div>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Стоимость в токенах</h2>
          <Button onClick={() => onSave(local)}>
            <Save size={16} className="mr-2" />
            Сохранить стоимость
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs text-white/50">Разблокировка аватара (до удаления)</label>
            <input
              type="number"
              value={local.costs?.avatarTokens || 0}
              onChange={(e) => handleCostChange("avatarTokens", e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-neonBlue/50"
            />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Выплаты</h2>
          <Button onClick={() => onSave(local)}>
            <Save size={16} className="mr-2" />
            Сохранить выплаты
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs text-white/50">Минимум для вывода (₽)</label>
            <input
              type="number"
              value={local.payout.minWithdrawRub}
              onChange={(e) => handlePayoutChange("minWithdrawRub", e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-neonBlue/50"
            />
          </div>
          <div>
            <label className="text-xs text-white/50">Текст о сроках выплаты</label>
            <input
              type="text"
              value={local.payout.slaText}
              onChange={(e) => handlePayoutChange("slaText", e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-neonBlue/50"
            />
          </div>
        </div>
      </Card>
    </div>
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
              <th className="p-3">Баланс (Доступно / Холд)</th>

              <th className="p-3">Статус</th>
            </tr>
          </thead>
          <tbody>
            {partners.map((p) => (
              <tr key={p.partnerId} className="border-b border-white/5">
                <td className="p-3 font-mono text-white/60">{p.partnerId}</td>
                <td className="p-3 text-white">{p.username || "—"}</td>
                <td className="p-3">
                  <div className="flex flex-col">
                    <span className="text-white font-medium">{p.balances.availableRub} ₽</span>
                    {p.balances.lockedRub > 0 && (
                      <span className="text-[10px] text-white/40 italic">Холд: {p.balances.lockedRub} ₽</span>
                    )}
                  </div>
                </td>

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
