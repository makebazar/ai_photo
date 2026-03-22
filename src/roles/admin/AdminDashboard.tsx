import React from "react";
import {
  Users, ShoppingCart, Briefcase, CreditCard, Package, Megaphone, Settings,
  ShieldAlert, LogOut, Save, Trash2, Edit2, Check, X, Search, Filter,
  TrendingUp, ArrowUpRight, ArrowDownRight, RefreshCw, Smartphone, Globe,
  Shield, Zap, Camera, Image as ImageIcon, Heart, Info, ChevronRight,
  Menu, Bell, Plus, Download, Copy, ExternalLink, Mail, Clock, AlertCircle,
  FileText, BarChart2, MoreVertical, Layout, Grid, List, Activity, UserPlus,
  ArrowRight, Key, Lock, Eye, EyeOff, CheckCircle2, AlertTriangle, HelpCircle
} from "lucide-react";
import { cn } from "../../lib/utils";
import { Card, Button, Input, Badge, Progress, Toast, Tooltip, Modal } from "../../components/ui";
import { useAdminStore } from "./adminStore";
import {
  getAdminConfig, getPacks, getPromos, getSessions,
  deleteUser, deletePartner, adjustUserTokens, updateAdminConfig,
  testAstriaConnection,
  type AdminPack as ApiAdminPack,
  type AdminPromo,
  type AdminSession,
  type AdminConfig,
  type AdminPlan
} from "../../lib/adminApi";
import { toast } from "../../lib/toast";
import type { AdminNav } from "./adminModel";

const LS_AUTH_KEY = "ai_photo_admin_auth";

export function AdminDashboard() {
  const [nav, setNav] = React.useState<AdminNav>("overview");
  const [isAuthenticated, setIsAuthenticated] = React.useState(() => {
    return localStorage.getItem(LS_AUTH_KEY) === "true";
  });
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const { state, setState, updateConfig } = useAdminStore();

  React.useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [config, packs, promos, sessions] = await Promise.all([
        getAdminConfig(),
        getPacks(),
        getPromos(),
        getSessions()
      ]);
      setState({ 
        config, 
        packs: packs.map(p => ({
          id: p.id,
          packId: p.id,
          slug: p.slug,
          title: p.title,
          description: p.description,
          status: p.status,
          previewUrls: p.preview_urls || [],
          estimatedImages: p.estimated_images,
          packObjectId: p.pack_object_id || "",
          promptsPerClass: p.prompts_per_class || 0,
          costsPerClass: p.costs_per_class || {},
          astriaPackHint: {},
          createdAt: new Date(p.created_at).getTime(),
          updatedAt: new Date(p.updated_at).getTime(),
        })),
        promos: promos.map(p => ({
          promoId: p.id,
          title: p.title,
          caption: p.caption,
          kind: p.kind,
          status: p.status,
          coverUrl: p.cover_url || "",
          mediaUrls: p.media_urls || [],
          tags: p.tags || [],
          createdAt: new Date(p.created_at).getTime(),
          updatedAt: new Date(p.updated_at).getTime(),
        })),
        sessions, 
        users: [], 
        partners: [], 
        withdrawals: [], 
      });
    } catch (err) {
      toast.push({ title: "Ошибка загрузки", description: String(err), variant: "danger" });
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (password === (import.meta.env.VITE_ADMIN_TOKEN || "a1b2c3d4e5f6g7h8i9j0")) {
      localStorage.setItem(LS_AUTH_KEY, "true");
      setIsAuthenticated(true);
      toast.push({ title: "Вход выполнен", variant: "success" });
    } else {
      toast.push({ title: "Ошибка", description: "Неверный токен", variant: "danger" });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(LS_AUTH_KEY);
    setIsAuthenticated(false);
    setPassword("");
    toast.push({ title: "Выход из системы", variant: "success" });
  };

  const [debugResult, setDebugResult] = React.useState<any>(null);
  const handleTestAstria = async () => {
    try {
      setLoading(true);
      const res = await testAstriaConnection();
      setDebugResult(res);
      if (res.ok) {
        toast.push({ title: "Astria: Соединение установлено", variant: "success" });
      } else {
        toast.push({ title: "Astria: Ошибка подключения", description: res.error, variant: "danger" });
      }
    } catch (err) {
      toast.push({ title: "Ошибка", description: String(err), variant: "danger" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm("Удалить пользователя и все его данные?")) return;
    try {
      await deleteUser(id);
      toast.push({ title: "Пользователь удален", variant: "success" });
      loadData();
    } catch (err) {
      toast.push({ title: "Ошибка", description: String(err), variant: "danger" });
    }
  };

  const handleAdjustTokens = async (userId: string, amount: number) => {
    try {
      await adjustUserTokens(userId, amount);
      toast.push({ title: "Баланс обновлен", variant: "success" });
      loadData();
    } catch (err) {
      toast.push({ title: "Ошибка", description: String(err), variant: "danger" });
    }
  };

  const handleSaveConfig = async (patch: Partial<AdminConfig>) => {
    try {
      setLoading(true);
      const updated = await updateAdminConfig(patch);
      updateConfig(updated);
      toast.push({ title: "Настройки сохранены", variant: "success" });
    } catch (err) {
      toast.push({ title: "Ошибка сохранения", description: String(err), variant: "danger" });
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] p-4 font-sans text-white">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neonViolet/20 text-neonViolet shadow-[0_0_30px_-5px] shadow-neonViolet/30">
              <Shield size={32} />
            </div>
          </div>
          <h1 className="mb-2 text-2xl font-bold tracking-tight">Admin Access</h1>
          <p className="mb-8 text-white/50">Введите токен доступа для входа в панель</p>
          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-white/40">Access Token</label>
              <Input
                type="password"
                placeholder="••••••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 border-white/10 bg-white/5 focus:border-neonViolet/50"
              />
            </div>
            <Button type="submit" className="h-12 w-full bg-neonViolet hover:bg-neonViolet/90">
              Войти в панель
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] font-sans text-white">
      {/* Sidebar / Top Nav */}
      <div className="mx-auto max-w-7xl p-4 md:p-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neonViolet/20 text-neonViolet shadow-[0_0_20px_-5px] shadow-neonViolet/30">
              <Shield size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Admin Console</h1>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/40">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                Система активна
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={loadData} disabled={loading} className="h-10 border-white/5 bg-white/5 hover:bg-white/10">
              <RefreshCw size={16} className={cn(loading && "animate-spin")} />
            </Button>
            <Button variant="secondary" size="sm" onClick={handleLogout} className="h-10 border-white/5 bg-white/5 hover:text-red-400">
              <LogOut size={16} />
            </Button>
          </div>
        </header>

        {/* Navigation */}
        <Card className="mb-8 overflow-hidden border-white/5 bg-white/2 p-1">
          <div className="flex flex-wrap gap-1">
            <NavButton active={nav === "overview"} onClick={() => setNav("overview")} icon={<TrendingUp size={16} />} label="Обзор" />
            <NavButton active={nav === "users"} onClick={() => setNav("users")} icon={<Users size={16} />} label="Юзеры" />
            <NavButton active={nav === "orders"} onClick={() => setNav("orders")} icon={<ShoppingCart size={16} />} label="Заказы" />
            <NavButton active={nav === "partners"} onClick={() => setNav("partners")} icon={<Briefcase size={16} />} label="Партнеры" />
            <NavButton active={nav === "withdrawals"} onClick={() => setNav("withdrawals")} icon={<CreditCard size={16} />} label="Выплаты" />
            <NavButton active={nav === "packs"} onClick={() => setNav("packs")} icon={<Package size={16} />} label={`Паки (${state.packs.length})`} />
            <NavButton active={nav === "promos"} onClick={() => setNav("promos")} icon={<Megaphone size={16} />} label={`Промо (${state.promos.length})`} />
            <NavButton active={nav === "ai_services"} onClick={() => setNav("ai_services")} icon={<RefreshCw size={16} />} label="AI Сервисы" />
            <NavButton active={nav === "settings"} onClick={() => setNav("settings")} icon={<Settings size={16} />} label="Настройки" />
            <NavButton active={nav === "debug"} onClick={() => setNav("debug")} icon={<ShieldAlert size={16} />} label="Debug" />
          </div>
        </Card>

        {/* Content */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {nav === "overview" && <Overview state={state} />}
          {nav === "users" && <UsersList users={state.users} onDelete={handleDeleteUser} onAdjustTokens={handleAdjustTokens} />}
          {nav === "orders" && <OrdersList orders={state.orders} />}
          {nav === "ai_services" && <AiServicesSettings config={state.config} onSave={handleSaveConfig} />}
          {nav === "settings" && <ConfigSettings config={state.config} onSave={handleSaveConfig} />}
          {nav === "debug" && (
            <div className="space-y-6">
              <Card className="p-6">
                <h2 className="mb-4 text-xl font-bold text-white">Проверка API Astria</h2>
                <div className="flex flex-wrap gap-4">
                  <Button onClick={handleTestAstria} disabled={loading}>
                    {loading ? <RefreshCw className="mr-2 animate-spin" size={16} /> : <RefreshCw className="mr-2" size={16} />}
                    Проверить соединение
                  </Button>
                </div>
                {debugResult && (
                  <div className={cn("mt-6 rounded-xl border p-4", debugResult.ok ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5")}>
                    <div className="mb-2 font-bold text-white">{debugResult.ok ? "✅ Успешно" : "❌ Ошибка"}</div>
                    <pre className="overflow-auto text-xs text-white/70">
                      {JSON.stringify(debugResult, null, 2)}
                    </pre>
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-200",
        active 
          ? "bg-white/10 text-white shadow-[0_0_15px_-5px] shadow-white/10" 
          : "text-white/40 hover:bg-white/5 hover:text-white/60"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function Overview({ state }: { state: any }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Выручка" value={`${state.stats.totalRevenue} ₽`} icon={<TrendingUp className="text-neonBlue" />} trend="+12%" />
      <StatCard label="Пользователи" value={state.stats.totalUsers} icon={<Users className="text-neonViolet" />} trend="+5%" />
      <StatCard label="Заказы" value={state.stats.totalOrders} icon={<ShoppingCart className="text-amber-400" />} trend="+8%" />
      <StatCard label="Партнеры" value={state.stats.activePartners} icon={<Briefcase className="text-green-400" />} trend="+2%" />
    </div>
  );
}

function StatCard({ label, value, icon, trend }: { label: string; value: string | number; icon: React.ReactNode; trend: string }) {
  return (
    <Card className="border-white/5 bg-white/2 p-6 transition-transform hover:scale-[1.02]">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5">
          {icon}
        </div>
        <Badge variant="secondary" className="bg-white/5 text-[10px] text-white/40">
          {trend}
        </Badge>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-white/40 uppercase tracking-wider mt-1">{label}</div>
    </Card>
  );
}

function UsersList({ users, onDelete, onAdjustTokens }: { users: any[]; onDelete: (id: string) => void; onAdjustTokens: (id: string, amount: number) => void }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10 text-left text-white/60">
            <tr>
              <th className="p-4 font-semibold">User</th>
              <th className="p-4 font-semibold">Tokens</th>
              <th className="p-4 font-semibold">Joined</th>
              <th className="p-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.userId} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                <td className="p-4">
                  <div className="font-bold text-white">{u.name || "Anonymous"}</div>
                  <div className="text-xs text-white/40">{u.email}</div>
                </td>
                <td className="p-4">
                  <Badge variant="secondary" className="bg-neonBlue/10 text-neonBlue border-none">
                    {u.tokens} ⚡️
                  </Badge>
                </td>
                <td className="p-4 text-white/40">{new Date(u.createdAt).toLocaleDateString()}</td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="secondary" onClick={() => onAdjustTokens(u.userId, 10)} className="h-8 w-8 p-0 bg-white/5">+</Button>
                    <Button size="sm" variant="secondary" onClick={() => onDelete(u.userId)} className="h-8 w-8 p-0 bg-white/5 text-red-400 hover:bg-red-400/10">
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
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
                <td className="p-3 font-mono text-xs text-white/60">{o.orderId.slice(0,8)}</td>
                <td className="p-3 text-white font-bold">{o.amountRub} ₽</td>
                <td className="p-3">
                  <Badge variant={o.status === "paid" ? "success" : "secondary"}>{o.status}</Badge>
                </td>
                <td className="p-3 text-white/40">{new Date(o.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function AiServicesSettings({ config, onSave }: { config: AdminConfig; onSave: (patch: Partial<AdminConfig>) => void }) {
  const defaultAstria = React.useMemo(() => ({
    apiKey: "",
    tuneBaseId: 1504944,
    modelType: "lora",
    trainPreset: "",
    className: "person",
    tokenPrefix: "ohwx",
    tuneCallbackUrl: "",
    promptCallbackUrl: "",
    promptTimeoutMs: 480000,
    promptPollMs: 5000,
  }), []);

  const [local, setLocal] = React.useState<AdminConfig>(config);
  const handleAstriaChange = (field: string, val: any) => {
    setLocal({
      ...local,
      astria: {
        ...defaultAstria,
        ...(local.astria ?? {}),
        [field]: val,
      },
    });
  };

  const [activeAiTab, setActiveAiTab] = React.useState<"astria" | "future">("astria");
  const [showApiKey, setShowApiKey] = React.useState(false);

  return (
    <div className="space-y-6">
      <div className="flex gap-4 border-b border-white/10 pb-4">
        <button
          onClick={() => setActiveAiTab("astria")}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-bold transition",
            activeAiTab === "astria" ? "bg-neonViolet text-white" : "text-white/40 hover:text-white/60"
          )}
        >
          Astria AI
        </button>
        <button
          onClick={() => setActiveAiTab("future")}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-bold transition",
            activeAiTab === "future" ? "bg-white/10 text-white/40" : "text-white/20"
          )}
          disabled
        >
          + Добавить сервис (Скоро)
        </button>
      </div>

      {activeAiTab === "astria" && (
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Настройки Astria</h2>
            <Button onClick={() => onSave(local)}>
              <Save size={16} className="mr-2" />
              Сохранить Astria
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="text-xs text-white/50">API Key (Token)</label>
              <div className="relative mt-1">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={local.astria?.apiKey ?? ""}
                  onChange={(e) => handleAstriaChange("apiKey", e.target.value)}
                  placeholder="Bearer token from astria.ai..."
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-neonBlue/50 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
                >
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-white/50">Base tune ID</label>
              <input
                type="number"
                value={local.astria?.tuneBaseId ?? defaultAstria.tuneBaseId}
                onChange={(e) => handleAstriaChange("tuneBaseId", parseInt(e.target.value) || 0)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-neonBlue/50"
              />
            </div>
            <div>
              <label className="text-xs text-white/50">Model type</label>
              <input
                type="text"
                value={local.astria?.modelType ?? defaultAstria.modelType}
                onChange={(e) => handleAstriaChange("modelType", e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-neonBlue/50"
              />
            </div>
            <div>
              <label className="text-xs text-white/50">Train preset</label>
              <input
                type="text"
                value={local.astria?.trainPreset ?? defaultAstria.trainPreset}
                onChange={(e) => handleAstriaChange("trainPreset", e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-neonBlue/50"
              />
            </div>
            <div>
              <label className="text-xs text-white/50">Class name</label>
              <input
                type="text"
                value={local.astria?.className ?? defaultAstria.className}
                onChange={(e) => handleAstriaChange("className", e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-neonBlue/50"
              />
            </div>
            <div>
              <label className="text-xs text-white/50">Token prefix</label>
              <input
                type="text"
                value={local.astria?.tokenPrefix ?? defaultAstria.tokenPrefix}
                onChange={(e) => handleAstriaChange("tokenPrefix", e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-neonBlue/50"
              />
            </div>
            <div>
              <label className="text-xs text-white/50">Tune callback URL</label>
              <input
                type="text"
                value={local.astria?.tuneCallbackUrl ?? defaultAstria.tuneCallbackUrl}
                onChange={(e) => handleAstriaChange("tuneCallbackUrl", e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-neonBlue/50"
              />
            </div>
            <div>
              <label className="text-xs text-white/50">Prompt callback URL</label>
              <input
                type="text"
                value={local.astria?.promptCallbackUrl ?? defaultAstria.promptCallbackUrl}
                onChange={(e) => handleAstriaChange("promptCallbackUrl", e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-neonBlue/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/50">Timeout (ms)</label>
                <input
                  type="number"
                  value={local.astria?.promptTimeoutMs ?? defaultAstria.promptTimeoutMs}
                  onChange={(e) => handleAstriaChange("promptTimeoutMs", parseInt(e.target.value) || 0)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-neonBlue/50"
                />
              </div>
              <div>
                <label className="text-xs text-white/50">Poll (ms)</label>
                <input
                  type="number"
                  value={local.astria?.promptPollMs ?? defaultAstria.promptPollMs}
                  onChange={(e) => handleAstriaChange("promptPollMs", parseInt(e.target.value) || 0)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-neonBlue/50"
                />
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function ConfigSettings({ config, onSave }: { config: AdminConfig; onSave: (patch: Partial<AdminConfig>) => void }) {
  const [local, setLocal] = React.useState<AdminConfig>(config);

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

  const handleAddPlan = () => {
    const id = `plan_${Date.now()}`;
    const newPlan: AdminPlan = {
      id,
      slug: id,
      title: "Новый тариф",
      tagline: "Описание",
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
