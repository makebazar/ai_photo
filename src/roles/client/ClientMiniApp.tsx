import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CloudOff,
  RefreshCcw,
  Crown,
  Image as ImageIcon,
  Loader2,
  Lock,
  Sparkles,
  Trash2,
  UploadCloud,
  UserCheck,
  UserX,
  Save,
  Clock,
  TrendingUp,
  Copy,
  Link,
} from "lucide-react";
import * as React from "react";
import { Badge } from "../../components/ui/Badge";
import { BottomSheet } from "../../components/ui/BottomSheet";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PhoneShell } from "../../components/ui/PhoneShell";

const API_BASE = import.meta.env.VITE_API_BASE || "";

/**
 * Helper to get auth headers for Telegram
 */
function getAuthHeaders(includeContentType = true) {
  const initData = (window as any).Telegram?.WebApp?.initData || "";
  return {
    ...(includeContentType ? { "Content-Type": "application/json" } : {}),
    ...(initData ? { "X-Telegram-Init-Data": initData } : {}),
  };
}
import { Progress } from "../../components/ui/Progress";
import { SmartImage } from "../../components/ui/SmartImage";
import { useToast } from "../../components/ui/Toast";
import { cn } from "../../lib/cn";
import { usePublicConfig, fetchPublicConfig } from "../../lib/publicConfig";
import { readLocalStorage, writeLocalStorage } from "../../lib/storage";
import { useTelegramAuth } from "../../lib/useTelegramAuth";
import { getStartParam } from "../../lib/tg";
import { trackReferralClick } from "../../lib/referralApi";
import { Lightbox } from "./Lightbox";

import {
  clientReducer,
  initialClientState,
  photosPerPlan,
  type ClientView,
  type PhotoSession,
  type PromptAspectRatio,
  type MockPhoto,
  type PlanId,
} from "./clientFlow";
import {
  createOrder,
  listPacks,
  payOrder,
  getProfile,
  type StylePack,
} from "../../lib/clientApi";

function rub(n: number) {
  return `${n.toLocaleString("ru-RU")} ₽`;
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

// Placeholder for showcase photos
const SHOWCASE_PHOTOS: Array<{ id: string; url: string; label: string }> = [];

const LS_KEY = "ai_photo_client_state_v3";

const ASPECT_OPTIONS: Array<{
  value: PromptAspectRatio;
  title: string;
  desc: string;
}> = [
  { value: "1:1", title: "Аватарка", desc: "Квадрат — идеально для профиля" },
  { value: "2:3", title: "Портрет", desc: "Классический вертикальный кадр" },
  { value: "3:2", title: "Фотоальбом", desc: "Чуть шире — как фото с камеры" },
  { value: "9:16", title: "Сторис / Reels", desc: "Во весь экран телефона" },
  { value: "16:9", title: "Обложка", desc: "Широкий кадр для баннера/видео" },
];

function SectionHeader({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-sm font-bold text-white/90 uppercase tracking-tight">{title}</div>
      {right ? <div className="text-[10px] font-medium text-white/40 uppercase tracking-wider">{right}</div> : null}
    </div>
  );
}

function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "brand";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        tone === "neutral" && "border-white/10 bg-white/5 text-white/60",
        tone === "good" && "border-neonBlue/30 bg-neonBlue/10 text-neonBlue",
        tone === "brand" && "border-neonViolet/30 bg-neonViolet/10 text-neonViolet",
      )}
    >
      {children}
    </span>
  );
}

export function ClientMiniApp() {
  const toast = useToast();
  const cfg = usePublicConfig();
  const plans = cfg.plans || [];
  
  const hydratedInitial = React.useMemo(() => {
    const persisted = readLocalStorage<{
      plan?: typeof initialClientState.plan;
      avatar?: typeof initialClientState.avatar;
      order?: typeof initialClientState.order;
      dataset?: typeof initialClientState.dataset;
      training?: typeof initialClientState.training;
      sessions?: PhotoSession[];
    }>(LS_KEY, {});

    const dataset = {
      ...initialClientState.dataset,
      ...(persisted.dataset ?? {}),
    };
    if (dataset.maxAllowed < initialClientState.dataset.maxAllowed) {
      dataset.maxAllowed = initialClientState.dataset.maxAllowed;
    }
    dataset.uploaded = Math.min(dataset.uploaded, dataset.maxAllowed);
    if (dataset.status === "ready" && dataset.uploaded < dataset.minRequired) {
      dataset.status = "idle";
    }

    return {
      ...initialClientState,
      plan: persisted.plan ?? initialClientState.plan,
      avatar: persisted.avatar ?? initialClientState.avatar,
      order: persisted.order ?? initialClientState.order,
      dataset,
      training: persisted.training ?? initialClientState.training,
      sessions: Array.isArray(persisted.sessions) ? persisted.sessions : [],
      view: "home" as const,
    };
  }, []);

  const [state, dispatch] = React.useReducer(clientReducer, hydratedInitial);

  React.useEffect(() => {
    writeLocalStorage(LS_KEY, {
      plan: state.plan,
      avatar: state.avatar,
      order: state.order,
      dataset: state.dataset,
      training: state.training,
      sessions: state.sessions,
    });
  }, [state.avatar, state.dataset, state.order, state.plan, state.sessions, state.training]);

  const [busy, setBusy] = React.useState<null | "pay" | "upload" | "train" | "gen" | "unlock">(null);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(null);
  const [uploadTarget, setUploadTarget] = React.useState<number>(20);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [picked, setPicked] = React.useState<Array<{ name: string; url: string }>>([]);
  const [packs, setPacks] = React.useState<StylePack[]>([]);
  const [packsLoading, setPacksLoading] = React.useState(true);
  const [aspectSheetOpen, setAspectSheetOpen] = React.useState(false);

  const { isAuthenticated, user, isLoading: authLoading } = useTelegramAuth();

  // Track referral click on mount if start_param exists
  React.useEffect(() => {
    const startParam = getStartParam();
    if (startParam) {
      trackReferralClick({ code: startParam }).catch((err: any) => {
        console.error("[Referral] Failed to track click:", err);
      });
    }

  }, []);

  const fetchProfile = React.useCallback(async () => {

    try {
      await fetchPublicConfig();
    } catch (err) {
      console.error("[Client] Failed to fetch public config:", err);
    }

    if (!isAuthenticated) return;
    try {
      const profile = await getProfile();
        dispatch({ 
          type: "set_profile", 
          tokensBalance: profile.user.tokensBalance,
          avatarAccessExpiresAt: profile.user.avatarAccessExpiresAt || null,
          astriaStatus: profile.user.astriaStatus || "none",
          isPartner: !!profile.partner,
          partnerPublicId: profile.partner?.publicId || null,
          missedProfitRub: profile.missedProfit || 0,
          refCode: profile.user.refCode || null,
          refLink: profile.user.refLink || null,
        });



    } catch (err) {
      console.error("[Client] Failed to fetch profile:", err);
    }
  }, [isAuthenticated]);

  React.useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const isAvatarActive = React.useMemo(() => {
    if (!state.avatarAccessExpiresAt) return false;
    return new Date(state.avatarAccessExpiresAt) > new Date();
  }, [state.avatarAccessExpiresAt]);

  const activeModel = React.useMemo(() => {
    const models = cfg.costs?.models || [];
    return models.find(m => m.id === state.pendingModelId) || models.find(m => m.isDefault) || models[0];
  }, [cfg.costs?.models, state.pendingModelId]);

  const costPerPhoto = activeModel?.costPerPhoto || 1;

  const activeSession = React.useMemo(() => {
    if (!state.activeSessionId) return null;
    return state.sessions.find((s) => s.id === state.activeSessionId) ?? null;
  }, [state.activeSessionId, state.sessions]);

  const pendingPack = packs.find((p) => String(p.id) === state.pendingStyleId) ?? null;

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setPacksLoading(true);
        const list = await listPacks();
        if (!alive) return;
        setPacks(list);
      } finally {
        if (alive) setPacksLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const go = React.useCallback((view: ClientView) => {
    dispatch({ type: "nav", view });
  }, [dispatch]);

  const goHome = React.useCallback(() => {
    if (state.generating.status === "generating" || state.view === "generating") {
      dispatch({ type: "cancel_photosession" });
      toast.push({
        title: "Фотосессия отменена",
        description: "Можно запустить заново из меню.",
      });
      return;
    }
    go("home");
  }, [dispatch, state.generating.status, state.view, toast, go]);

  function startNewPhotosession() {
    go("style_list");
  }

  async function createAvatarFlow() {
    if (isAvatarActive) {
      go("upload");
      return;
    }

    if (state.tokensBalance < cfg.costs.avatarTokens) {
      toast.push({
        title: "Недостаточно токенов",
        description: `Для создания аватара нужно ${cfg.costs.avatarTokens} токенов. Пожалуйста, пополните баланс.`,
        variant: "danger",
      });
      go("pay");
      return;
    }

    try {
      setBusy("unlock");
      const res = await fetch(`${API_BASE}/api/client/unlock-avatar`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(await res.text());
      
      toast.push({ title: "Доступ разблокирован!", variant: "success" });
      await fetchProfile();
      go("upload");
    } catch (err) {
      toast.push({ title: "Ошибка", description: String(err), variant: "danger" });
    } finally {
      setBusy(null);
    }
  }

  // Simulations
  React.useEffect(() => {
    if (busy !== "upload") return;
    if (uploadProgress >= 100) return;
    const id = window.setInterval(() => {
      setUploadProgress((p) => Math.min(100, p + Math.max(2, Math.round(12 - p / 14))));
    }, 220);
    return () => window.clearInterval(id);
  }, [busy, uploadProgress]);

  React.useEffect(() => {
    if (busy !== "upload") return;
    if (uploadTarget > state.dataset.maxAllowed) setUploadTarget(state.dataset.maxAllowed);
    const uploaded = Math.min(uploadTarget, Math.max(0, Math.round((uploadProgress / 100) * uploadTarget)));
    dispatch({ type: "upload_progress", uploaded });
    if (uploaded >= state.dataset.minRequired && state.dataset.status !== "ready") {
      dispatch({ type: "upload_ready" });
    }
  }, [busy, state.dataset.minRequired, state.dataset.status, uploadProgress, uploadTarget]);

  React.useEffect(() => {
    if (busy !== "upload") return;
    if (uploadProgress < 100) return;
    const t = window.setTimeout(() => {
      dispatch({ type: "upload_ready" });
      setBusy(null);
      toast.push({ title: "Селфи загружены", variant: "success" });
    }, 450);
    return () => window.clearTimeout(t);
  }, [busy, uploadProgress, toast]);

  React.useEffect(() => {
    if (state.training.status === "ready") return;
    if (state.training.status === "idle") return;
    const id = window.setInterval(() => {
      const next = Math.min(100, state.training.progress + Math.max(1.5, 8 - state.training.progress / 16));
      const left = Math.max(0, Math.round((100 - next) / 10));
      dispatch({ type: "training_progress", progress: next, etaMinutes: left });
      if (next >= 100) {
        dispatch({ type: "training_ready" });
        toast.push({ title: "Аватар готов", variant: "success" });
      }
    }, 520);
    return () => window.clearInterval(id);
  }, [dispatch, state.training.progress, state.training.status, toast]);

  React.useEffect(() => {
    if (state.view !== "generating") return;
    if (state.generating.status !== "generating") return;
    const id = window.setInterval(() => {
      const next = Math.min(100, state.generating.progress + Math.max(2, Math.round(14 - state.generating.progress / 10)));
      const eta = Math.max(0, Math.round((100 - next) / 4));
      dispatch({ type: "generating_progress", progress: next, etaSeconds: eta });
    }, 240);
    return () => window.clearInterval(id);
  }, [state.generating.progress, state.generating.status, state.view]);

  React.useEffect(() => {
    async function maybeFinish() {
      if (state.view !== "generating" || state.generating.status !== "generating" || state.generating.progress < 100 || busy) return;
      setBusy("gen");
      const photos: MockPhoto[] = Array.from({ length: state.pendingCustomCount }).map((_, i) => ({
        id: `photo_${Date.now()}_${i}`,
        url: `https://via.placeholder.com/512x512?text=Photo+${i + 1}`,
        label: `Photo ${i + 1}`,
      }));
      const session: PhotoSession = {
        id: `sess_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        plan: state.plan,
        styleId: state.pendingStyleId ?? "pack",
        styleTitle: state.pendingStyleId === "custom" ? "Свой стиль" : pendingPack?.title ?? "Пакет",
        styleMode: state.pendingStyleId === "custom" ? "custom" : "pack",
        prompt: state.pendingStyleId === "custom" ? state.pendingCustomPrompt : undefined,
        settings: {
          count: state.pendingCustomCount,
          aspectRatio: state.pendingStyleId === "custom" ? state.pendingCustomAspect : undefined,
          enhance: state.pendingEnhance,
          steps: state.pendingStyleId === "custom" ? state.pendingCustomSteps : undefined,
          faceFix: state.pendingStyleId === "custom" ? state.pendingCustomFaceFix : undefined,
        },
        createdAt: Date.now(),
        photos,
      };
      dispatch({ type: "generating_done" });
      dispatch({ type: "session_created", session });
      setBusy(null);
      go("gallery");
    }
    void maybeFinish();
  }, [busy, pendingPack, state.generating.progress, state.generating.status, state.view]);

  async function generateFlow() {
    if (!isAvatarActive) {
      toast.push({ title: "Аватар не активен", description: `Разблокируйте доступ за ${cfg.costs.avatarTokens} т.`, variant: "danger" });
      return;
    }
    const totalCost = state.pendingCustomCount * costPerPhoto;
    if (state.tokensBalance < totalCost) {
      toast.push({ title: "Недостаточно токенов", variant: "danger" });
      return;
    }
    try {
      setBusy("gen");
      const res = await fetch(`${API_BASE}/api/client/generate`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ 
          styleId: state.pendingStyleId, 
          modelId: state.pendingModelId, 
          count: state.pendingCustomCount,
          prompt: state.pendingStyleId === "custom" ? state.pendingCustomPrompt : undefined,
          negative: state.pendingStyleId === "custom" ? state.pendingCustomNegative : undefined,
          aspectRatio: state.pendingStyleId === "custom" ? state.pendingCustomAspect : undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      dispatch({ 
        type: "set_profile", 
        tokensBalance: state.tokensBalance - data.spent, 
        avatarAccessExpiresAt: state.avatarAccessExpiresAt, 
        astriaStatus: state.astriaStatus,
        isPartner: state.isPartner,
        partnerPublicId: state.partnerPublicId,
        missedProfitRub: state.missedProfitRub,
        refCode: state.refCode,
        refLink: state.refLink,
      });

      dispatch({ type: "generating_start" });

      go("generating");
    } catch (err) {
      toast.push({ title: "Ошибка", description: String(err), variant: "danger" });
    } finally {
      setBusy(null);
    }
  }

  async function payFlow() {
    try {
      setBusy("pay");
      const order = await createOrder(state.plan);
      const orderForDispatch = { ...order, plan: order.plan_id, amountRub: order.amount_rub, createdAt: Date.parse(order.created_at), paidAt: order.paid_at ? Date.parse(order.paid_at) : undefined };
      dispatch({ type: "order_created", order: orderForDispatch });
      await new Promise(r => setTimeout(r, 1500));
      const { paidAt } = await payOrder(order.id);
      dispatch({ type: "order_paid", paidAt: Date.parse(paidAt) });
      await fetchProfile();
      setBusy(null);
      toast.push({ title: "Оплата прошла", variant: "success" });
      go(state.avatar.status === "ready" ? "style_list" : "upload");
    } catch (err) {
      setBusy(null);
      toast.push({ title: "Оплата не удалась", description: String(err), variant: "danger" });
    }
  }

  async function unlockAvatar() {
    try {
      setBusy("unlock");
      const res = await fetch(`${API_BASE}/api/client/unlock-avatar`, { method: "POST", headers: getAuthHeaders(), body: JSON.stringify({}) });
      if (!res.ok) throw new Error(await res.text());
      toast.push({ title: "Аватар разблокирован!", variant: "success" });
      await fetchProfile();
    } catch (err) {
      toast.push({ title: "Ошибка", description: String(err), variant: "danger" });
    } finally {
      setBusy(null);
    }
  }

  async function startTraining() {
    if (state.dataset.uploaded < state.dataset.minRequired) return;
    if (busy) return;
    setBusy("train");
    dispatch({ type: "training_queued", astriaModelId: `m_${Date.now()}`, jobId: `j_${Date.now()}` });
    setBusy(null);
    go("training");
  }

  function openPicker() { fileInputRef.current?.click(); }

  function startUpload() {
    if (picked.length === 0) return;
    setBusy("upload");
    setUploadProgress(0);
    // Simulation logic is already in useEffect triggered by busy === "upload"
  }

  function onFilesPicked(files: FileList | null) {
    if (!files || files.length === 0) return;
    const next = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, state.dataset.maxAllowed).map((f) => ({ name: f.name, url: URL.createObjectURL(f) }));
    setPicked(next);
    setUploadProgress(100);
    dispatch({ type: "upload_progress", uploaded: next.length });
    dispatch({ type: "upload_ready" });
  }

  function openSession(sessionId: string) { dispatch({ type: "open_session", sessionId }); }

  return (
    <PhoneShell title="AI-фотосессия" subtitle="Telegram Mini App" hideHeader>
      {/* Header Auth & Balance */}
      <div className="fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between border-b border-white/5 bg-graphite/60 px-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 border border-white/10 overflow-hidden">
                {user?.photo_url ? (
                  <img src={user.photo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <UserCheck size={16} className="text-white/40" />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-black text-white leading-none max-w-[80px] truncate">{user?.first_name || "Пользователь"}</span>
                <span className="text-[9px] font-medium text-white/40 mt-0.5 uppercase tracking-wider">Профиль</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 opacity-50">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 border border-white/10">
                <UserX size={16} className="text-white/40" />
              </div>
              <span className="text-[11px] font-black text-white uppercase tracking-wider leading-none">Гость</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {isAuthenticated && (
            <div className="flex items-center gap-2">
              {state.isPartner && (
                <button 
                  onClick={() => {
                    const botName = import.meta.env.VITE_PARTNER_BOT_NAME || "ai_photo_testast_partner_bot";
                    const appName = import.meta.env.VITE_TELEGRAM_APP_NAME;
                    const url = appName 
                      ? `https://t.me/${botName}/${appName}`
                      : `https://t.me/${botName}`;
                    (window as any).Telegram?.WebApp?.openTelegramLink(url);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-neonBlue/30 bg-neonBlue/10 text-neonBlue shadow-[0_0_15px_rgba(56,189,248,0.15)] transition-all active:scale-95 hover:border-neonBlue/50"
                  title="Партнерский кабинет"
                >
                  <Crown size={16} />
                </button>
              )}
              <button 
                onClick={() => go("pay")}
                className="group flex items-center gap-2 rounded-full border border-neonViolet/30 bg-neonViolet/10 py-1 pl-1 pr-3 shadow-[0_0_20px_rgba(139,92,246,0.15)] transition-all active:scale-95 hover:border-neonViolet/50"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-neonViolet/20 text-neonViolet shadow-inner">
                  <Sparkles size={12} className="group-hover:animate-pulse" />
                </div>
                <div className="flex flex-col items-start leading-none">
                  <span className="text-[11px] font-black text-white tracking-tight">{state.tokensBalance}</span>
                  <span className="text-[7px] font-bold text-neonViolet uppercase tracking-tighter">токенов</span>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="relative pt-16 pb-10 px-4 min-h-full">
        {/* Background Decorative Elements */}
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-30">
          <div className="absolute -left-[10%] top-[10%] h-[400px] w-[400px] rounded-full bg-neonBlue/20 blur-[100px]" />
          <div className="absolute -right-[10%] top-[40%] h-[300px] w-[300px] rounded-full bg-neonViolet/20 blur-[80px]" />
        </div>

        <AnimatePresence mode="wait">
          {state.view === "examples" && <ExamplesScreen onBack={() => go("home")} />}

          {state.view === "home" && (
            <motion.div key="home" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-neonBlue/10 text-neonBlue border-neonBlue/20 text-[10px] py-0 h-5 px-2 font-bold uppercase tracking-wider">TMA v3.0</Badge>
                  <Badge className="bg-white/5 text-white/40 border-white/10 text-[10px] py-0 h-5 px-2 font-bold uppercase tracking-wider">Beta</Badge>
                </div>
                <h1 className="text-3xl font-black leading-[1.1] tracking-tight text-white">
                  Ваш персональный <br />
                  <span className="bg-gradient-to-r from-neonBlue via-neonViolet to-neonPink bg-clip-text text-transparent">AI-фотограф</span>
                </h1>
                <p className="mt-3 text-sm text-white/50 leading-relaxed max-w-[280px]">
                  Создавайте профессиональные портреты в одно касание.
                </p>
              </div>

              {state.missedProfitRub > 0 && !state.isPartner && (
                <Card className="relative overflow-hidden p-4 border-orange-500/30 bg-orange-500/10 shadow-lg shadow-orange-500/5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/20 text-orange-500">
                      <TrendingUp size={20} />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-black text-orange-500 uppercase tracking-tight">Упущенная прибыль</div>
                      <div className="text-lg font-black text-white">{rub(state.missedProfitRub)}</div>
                    </div>
                    <Button 
                      size="sm" 
                      className="bg-orange-500 hover:bg-orange-600 text-white font-bold h-8 px-3 text-[10px] uppercase tracking-wider"
                      onClick={() => {
                        const botName = import.meta.env.VITE_PARTNER_BOT_NAME || "ai_photo_testast_partner_bot";
                        const appName = import.meta.env.VITE_TELEGRAM_APP_NAME;
                        const url = appName ? `https://t.me/${botName}/${appName}` : `https://t.me/${botName}`;
                        (window as any).Telegram?.WebApp?.openTelegramLink(url);
                      }}
                    >
                      Забрать
                    </Button>
                  </div>
                  <p className="mt-2 text-[10px] text-white/50 leading-tight">
                    Вы пригласили клиентов, но не купили пакет «Партнер». Ваши комиссионные уходят вышестоящему партнеру.
                  </p>
                </Card>
              )}

              {state.refLink && (
                <Card className="relative overflow-hidden p-4 border-white/5 bg-white/5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="text-[10px] font-black text-white/40 uppercase tracking-wider mb-1">Ваша ссылка</div>
                      <div className="flex items-center gap-2">
                        <Link size={14} className="text-neonBlue" />
                        <div className="text-xs font-medium text-white/80 truncate max-w-[180px]">
                          {state.refLink.replace(/^https?:\/\//, '')}
                        </div>
                      </div>

                    </div>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-9 w-9 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white"
                      onClick={() => {
                        const url = state.refLink!;
                        navigator.clipboard.writeText(url);
                        if ((window as any).Telegram?.WebApp?.showAlert) {
                          (window as any).Telegram.WebApp.showAlert("Ссылка скопирована!");
                        } else {
                          alert("Ссылка скопирована!");
                        }
                      }}
                    >
                      <Copy size={16} />
                    </Button>
                  </div>
                  <p className="mt-2 text-[9px] text-white/30 leading-tight">
                    Делитесь ссылкой с друзьями. Если они купят пакет, а вы станете партнером — вы получите комиссию.
                  </p>
                </Card>
              )}




              <Card className="relative overflow-hidden p-6 border-white/10 bg-white/5 shadow-2xl">
                <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-neonBlue/10 blur-3xl" />
                <div className="pointer-events-none absolute -left-12 -bottom-12 h-40 w-40 rounded-full bg-neonViolet/10 blur-3xl" />
                
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-2xl border transition-all duration-500",
                      state.avatar.status === "ready" 
                        ? "border-neonBlue/30 bg-neonBlue/10 text-neonBlue shadow-[0_0_15px_rgba(56,189,248,0.2)]" 
                        : isAvatarActive 
                          ? "border-neonViolet/30 bg-neonViolet/10 text-neonViolet shadow-[0_0_15px_rgba(139,92,246,0.2)]"
                          : "border-white/10 bg-white/5 text-white/30"
                    )}>
                      {state.avatar.status === "ready" ? <UserCheck size={24} /> : isAvatarActive ? <Sparkles size={24} /> : <Lock size={24} />}
                    </div>
                    <div>
                      <div className="text-sm font-black text-white uppercase tracking-tight">Ваш Аватар</div>
                      <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mt-0.5">
                        {state.avatar.status === "ready" ? "Готов к работе" : isAvatarActive ? "Доступ оплачен" : "Требуется активация"}
                      </div>
                    </div>
                  </div>
                  {state.avatar.status === "ready" && (
                    <Pill tone="good"><CheckCircle2 size={10} />Активен</Pill>
                  )}
                </div>

                <p className="text-xs text-white/60 mb-6 leading-relaxed">
                  {state.avatar.status === "ready"
                    ? "Ваша цифровая копия готова. Вы можете генерировать фотографии в любых доступных стилях."
                    : isAvatarActive
                      ? "Доступ открыт! Загрузите от 4 до 20 своих селфи, чтобы нейросеть выучила вашу внешность."
                      : "Чтобы начать пользоваться сервисом, необходимо разово разблокировать создание аватара."}
                </p>

                <div className="flex gap-3">
                  {state.avatar.status !== "ready" ? (
                    <Button 
                      className={cn(
                        "flex-1 h-12 text-sm font-bold shadow-neon transition-all active:scale-[0.98]",
                        isAvatarActive ? "bg-neonViolet hover:bg-neonViolet/90" : "bg-neonBlue hover:bg-neonBlue/90"
                      )} 
                      onClick={createAvatarFlow} 
                      disabled={busy === "unlock"}
                    >
                      {busy === "unlock" ? <Loader2 className="animate-spin" size={18} /> : isAvatarActive ? <UploadCloud size={18} className="mr-2" /> : <Crown size={18} className="mr-2" />}
                      {isAvatarActive ? "Загрузить фото" : `Разблокировать (${cfg.costs.avatarTokens} т.)`}
                    </Button>
                  ) : (
                    <>
                      <Button className="flex-1 h-12 text-sm font-bold shadow-neon bg-neonBlue hover:bg-neonBlue/90 transition-all active:scale-[0.98]" onClick={startNewPhotosession}>
                        <Sparkles size={18} className="mr-2" />Новая съемка
                      </Button>
                      <Button variant="secondary" className="h-12 w-12 shrink-0 border-white/5 bg-white/5 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-500 transition-all" onClick={async () => {
                        if (!confirm("Вы уверены, что хотите удалить аватар? Все данные обучения будут стерты.")) return;
                        try {
                          await fetch(`${API_BASE}/api/client/delete-avatar`, { method: "POST", headers: getAuthHeaders(), body: JSON.stringify({}) });
                          dispatch({ type: "delete_avatar" });
                          await fetchProfile();
                          toast.push({ title: "Аватар удален", variant: "success" });
                        } catch (err) { toast.push({ title: "Ошибка", variant: "danger" }); }
                      }}>
                        <Trash2 size={18} />
                      </Button>
                    </>
                  )}
                </div>
              </Card>

              <div className="space-y-4">
                <SectionHeader title="Пополнить баланс" right="Выгодные наборы" />
                <div className="grid gap-3">
                  {plans.map((p) => (
                    <button 
                      key={p.id} 
                      className={cn(
                        "group relative overflow-hidden rounded-2xl border p-4 transition-all duration-300 active:scale-[0.98]",
                        state.plan === p.id 
                          ? (p.featured ? "border-neonViolet bg-neonViolet/10 shadow-pro" : "border-neonBlue bg-neonBlue/10 shadow-neon") 
                          : "border-white/5 bg-white/2 hover:bg-white/5 hover:border-white/10"
                      )} 
                      onClick={() => { dispatch({ type: "select_plan", plan: p.id as PlanId }); go("pay"); }}
                    >
                      {p.featured && (
                        <div className="absolute -right-8 -top-8 h-16 w-16 rotate-45 bg-neonViolet/20 blur-xl transition-all group-hover:bg-neonViolet/30" />
                      )}
                      <div className="flex justify-between items-center relative z-10">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-xl border transition-colors",
                            state.plan === p.id 
                              ? (p.featured ? "border-neonViolet/30 bg-neonViolet/20 text-neonViolet" : "border-neonBlue/30 bg-neonBlue/20 text-neonBlue")
                              : "border-white/10 bg-white/5 text-white/40"
                          )}>
                            <Sparkles size={18} />
                          </div>
                          <div className="text-left">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-black text-white">{p.title}</span>
                              {p.badge && <Badge className="text-[8px] h-3.5 px-1 bg-neonViolet/20 text-neonViolet border-neonViolet/30 font-black uppercase leading-none">{p.badge}</Badge>}
                            </div>
                            <div className="text-[9px] font-medium text-white/40 mt-1 line-clamp-1 max-w-[150px]">{p.tagline}</div>
                            <div className="text-[10px] font-bold text-white/20 uppercase tracking-widest mt-0.5">{p.tokens} токенов</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-black text-white">{rub(p.priceRub)}</div>
                          {p.id === "pro" && <div className="text-[9px] font-bold text-neonViolet uppercase tracking-tighter">-20% выгода</div>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {state.sessions.length > 0 && (
                <div className="space-y-4">
                  <SectionHeader title="Ваша галерея" right={`${state.sessions.length} сессий`} />
                  <div className="grid gap-3">
                    {state.sessions.map((s) => (
                      <button key={s.id} onClick={() => openSession(s.id)} className="text-left group active:scale-[0.98] transition-transform">
                        <Card className="p-4 border-white/5 bg-white/2 hover:bg-white/5 hover:border-white/10 transition-all overflow-hidden relative">
                          <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-1.5 rounded-full bg-neonBlue shadow-[0_0_5px_#38BDF8]" />
                              <span className="text-[11px] font-black text-white uppercase tracking-tight">{s.styleTitle}</span>
                            </div>
                            <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">{formatDate(s.createdAt)}</span>
                          </div>
                          <div className="grid grid-cols-4 gap-2 relative z-10">
                            {s.photos.slice(0, 4).map((p, idx) => (
                              <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden border border-white/5">
                                <SmartImage src={p.url} alt="" fallbackSeed={idx} className="h-full w-full object-cover transition-transform group-hover:scale-110" />
                              </div>
                            ))}
                            {s.photos.length > 4 && (
                              <div className="absolute right-0 bottom-0 h-6 w-10 bg-graphite/80 backdrop-blur-sm rounded-tl-lg rounded-br-lg flex items-center justify-center border-l border-t border-white/10">
                                <span className="text-[9px] font-black text-white/60">+{s.photos.length - 4}</span>
                              </div>
                            )}
                          </div>
                        </Card>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {state.view === "pay" && (
            <motion.div key="pay" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-white">Оплата</h2>
                <Button variant="secondary" size="sm" onClick={goHome}><ArrowLeft size={14} className="mr-1" />Назад</Button>
              </div>
              <div className="grid gap-4">
                {plans.map((p) => (
                  <button key={p.id} className={cn("relative overflow-hidden text-left rounded-3xl border p-6 transition-all", state.plan === p.id ? (p.featured ? "border-neonViolet bg-neonViolet/10 shadow-pro" : "border-neonBlue bg-neonBlue/10 shadow-neon") : "border-white/5 bg-white/3")} onClick={() => dispatch({ type: "select_plan", plan: p.id as any })}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="text-lg font-bold text-white">{p.title}</div>
                        </div>
                        <div className="text-sm font-medium text-neonBlue mb-4">{p.tokens} токенов</div>
                        <div className="text-xs text-white/40 leading-relaxed">{p.tagline}</div>
                      </div>
                      <div className="text-xl font-black text-white">{rub(p.priceRub)}</div>
                    </div>
                  </button>
                ))}
              </div>
              <Card className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center text-white/30"><Lock size={24} /></div>
                  <div>
                    <div className="text-sm font-bold text-white">Безопасный платеж</div>
                    <div className="text-xs text-white/40">Через Telegram Payment</div>
                  </div>
                </div>
                <Button className="w-full py-7 text-lg font-bold shadow-neon" onClick={payFlow} disabled={busy === "pay" || !state.plan}>
                  {busy === "pay" ? <Loader2 className="animate-spin mr-2" /> : <Save size={20} className="mr-2" />}
                  Оплатить {rub(plans.find(p => p.id === state.plan)?.priceRub || 0)}
                </Button>
              </Card>
            </motion.div>
          )}

          {state.view === "upload" && (
            <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-white">Загрузка фото</h2>
                  <p className="text-xs text-white/40 mt-1">{state.dataset.uploaded}/{state.dataset.maxAllowed} фотографий</p>
                </div>
                <Button variant="secondary" size="sm" onClick={goHome}><ArrowLeft size={14} className="mr-1" />Меню</Button>
              </div>

              <Card className="p-6">
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFilesPicked(e.target.files)} />
                <Button className="w-full py-8 border-2 border-dashed border-white/10 bg-white/2 hover:bg-white/5 transition-all text-white/80" onClick={openPicker} disabled={busy === "upload"}>
                  <UploadCloud size={24} className="mb-2" />
                  Выбрать фотографии
                </Button>

                {picked.length > 0 && (
                  <div className="mt-6">
                    <div className="grid grid-cols-4 gap-2 mb-4">
                      {picked.slice(0, 8).map((p, idx) => (
                        <SmartImage key={idx} src={p.url} alt="" className="aspect-square rounded-xl" />
                      ))}
                      {picked.length > 8 && <div className="aspect-square rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[10px] text-white/40">+{picked.length - 8}</div>}
                    </div>
                    <Button variant="secondary" className="w-full h-9 text-xs" onClick={() => setPicked([])}>Очистить список</Button>
                  </div>
                )}

                <div className="mt-8 pt-8 border-t border-white/5">
                  <div className="flex justify-between text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">
                    <span>Прогресс загрузки</span>
                    <span className="text-neonBlue">{Math.round(uploadProgress)}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-1.5" />
                  <div className="mt-4 flex gap-2">
                    <Button variant="secondary" size="sm" className="flex-1 h-10 text-[11px]" onClick={startUpload} disabled={busy === "upload" || picked.length === 0}>Начать загрузку</Button>
                    <div className="flex gap-1">
                      {[4, 20].map(n => (
                        <button key={n} onClick={() => setUploadTarget(n)} className={cn("w-10 h-10 rounded-xl border text-[10px] font-bold transition", uploadTarget === n ? "border-neonBlue bg-neonBlue/10 text-neonBlue" : "border-white/5 bg-white/5 text-white/30")}>{n}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <Button className="w-full py-6 shadow-neon" onClick={startTraining} disabled={state.dataset.uploaded < state.dataset.minRequired || busy === "train" || !isAvatarActive}>
                    {busy === "train" ? <Loader2 className="animate-spin mr-2" /> : <ArrowRight size={20} className="mr-2" />}
                    Запустить обучение
                  </Button>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-2 text-neonBlue mb-4 font-bold text-sm uppercase tracking-tight">
                  <Sparkles size={18} /> Советы
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { t: "Свет", d: "Яркое освещение" },
                    { t: "Ракурсы", d: "Прямо и профиль" },
                    { t: "Лицо", d: "Без очков и масок" },
                    { t: "Качество", d: "Четкие селфи" },
                  ].map((it, i) => (
                    <div key={i} className="bg-white/2 rounded-2xl p-3 border border-white/5">
                      <div className="text-[11px] font-bold text-white/90">{it.t}</div>
                      <div className="text-[10px] text-white/40 mt-0.5">{it.d}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}

          {state.view === "training" && (
            <motion.div key="training" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center min-h-[70vh] py-10 text-center space-y-10">
              <div className="relative">
                <div className="absolute inset-0 bg-neonBlue/20 blur-[60px] animate-pulse" />
                <div className="relative h-40 w-40 rounded-[3rem] border-2 border-neonBlue/30 bg-graphite/40 backdrop-blur-xl flex items-center justify-center text-neonBlue shadow-neon">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                  >
                    <Loader2 size={64} className="opacity-50" />
                  </motion.div>
                  <motion.div
                    className="absolute"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Sparkles size={48} />
                  </motion.div>
                </div>
              </div>

              <div className="space-y-4 max-w-[280px]">
                <h2 className="text-3xl font-black text-white tracking-tight">Обучаем модель</h2>
                <p className="text-sm text-white/50 leading-relaxed">
                  Мы создаем вашу цифровую копию. Это займет около <span className="text-neonBlue font-bold">{state.training.etaMinutes} минут</span>.
                </p>
              </div>

              <div className="w-full max-w-[280px] space-y-4">
                <div className="flex justify-between items-end">
                  <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">Прогресс обучения</div>
                  <div className="text-sm font-black text-neonBlue">{Math.round(state.training.progress)}%</div>
                </div>
                <Progress value={state.training.progress} className="h-3 shadow-[0_0_15px_rgba(56,189,248,0.1)]" />
              </div>

              <Button variant="secondary" onClick={goHome} className="border-white/5 bg-white/5 text-white/40 hover:text-white/60">
                Вернуться в меню
              </Button>
            </motion.div>
          )}

          {state.view === "style_list" && (
            <motion.div key="style_list" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-white leading-tight">Выберите стиль</h2>
                  <p className="text-xs text-white/40 mt-1 uppercase tracking-widest font-bold">Доступно {packs.length} вариантов</p>
                </div>
                <Button variant="secondary" size="sm" onClick={goHome} className="h-9 px-3 border-white/5 bg-white/5"><ArrowLeft size={16} className="mr-1" />Назад</Button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => go("style_custom")} 
                  className="group text-left active:scale-[0.98] transition-transform"
                >
                  <div className="relative aspect-[3/4] rounded-3xl overflow-hidden border border-dashed border-neonViolet/40 bg-neonViolet/5 group-hover:border-neonViolet transition-all shadow-lg group-hover:shadow-pro/20 flex flex-col items-center justify-center p-6 text-center">
                    <div className="h-14 w-14 rounded-2xl bg-neonViolet/10 border border-neonViolet/20 flex items-center justify-center text-neonViolet mb-4 group-hover:scale-110 transition-transform">
                      <Sparkles size={32} />
                    </div>
                    <div className="text-sm font-black text-white leading-tight">Свой стиль</div>
                    <div className="text-[10px] font-bold text-white/40 mt-2 uppercase tracking-tighter">Напишите промт сами</div>
                    <div className="absolute top-3 right-3 h-7 w-7 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                      <ArrowRight size={14} className="text-white" />
                    </div>
                  </div>
                </button>

                {packs.map(p => (
                  <button 
                    key={p.id} 
                    onClick={() => {
                      dispatch({ type: "style_picked", styleId: String(p.id) });
                      go("style_confirm");
                    }} 
                    className="group text-left active:scale-[0.98] transition-transform"
                  >
                    <div className="relative aspect-[3/4] rounded-3xl overflow-hidden border border-white/10 bg-white/5 group-hover:border-neonBlue transition-all shadow-lg group-hover:shadow-neon/20">
                      {p.preview_urls?.[0] ? (
                        <SmartImage src={p.preview_urls[0]} alt={p.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-white/5"><ImageIcon size={48} /></div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute bottom-4 left-4 right-4">
                        <div className="text-sm font-black text-white leading-tight group-hover:text-neonBlue transition-colors">{p.title}</div>
                        <div className="text-[10px] font-bold text-white/50 mt-1 uppercase tracking-tighter line-clamp-1">{p.description}</div>
                      </div>
                      <div className="absolute top-3 right-3 h-7 w-7 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                        <ArrowRight size={14} className="text-white" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {state.view === "style_custom" && (
            <motion.div key="style_custom" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-white leading-tight">Свой стиль</h2>
                  <p className="text-xs text-white/40 mt-1 uppercase tracking-widest font-bold">Опишите желаемое фото</p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => go("style_list")} className="h-9 px-3 border-white/5 bg-white/5"><ArrowLeft size={16} className="mr-1" />Назад</Button>
              </div>

              <Card className="p-6 space-y-6">
                <div className="space-y-4">
                  <SectionHeader title="Промт (Описание)" right="Что на фото?" />
                  <textarea 
                    className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder:text-white/20 focus:border-neonViolet transition-colors outline-none resize-none"
                    placeholder="Пример: мужчина в деловом костюме, на фоне современного офиса, профессиональное освещение, 8k..."
                    value={state.pendingCustomPrompt}
                    onChange={(e) => dispatch({ type: "custom_update", prompt: e.target.value, negative: state.pendingCustomNegative, aspect: state.pendingCustomAspect, enhance: state.pendingEnhance })}
                  />
                </div>

                <div className="space-y-4">
                  <SectionHeader title="Отрицательный промт" right="Чего быть не должно?" />
                  <textarea 
                    className="w-full h-20 bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder:text-white/20 focus:border-neonViolet transition-colors outline-none resize-none"
                    placeholder="Пример: очки, борода, головной убор..."
                    value={state.pendingCustomNegative}
                    onChange={(e) => dispatch({ type: "custom_update", prompt: state.pendingCustomPrompt, negative: e.target.value, aspect: state.pendingCustomAspect, enhance: state.pendingEnhance })}
                  />
                </div>

                <div className="space-y-4">
                  <SectionHeader title="Формат фото" />
                  <div className="grid grid-cols-3 gap-2">
                    {ASPECT_OPTIONS.map(opt => (
                      <button 
                        key={opt.value} 
                        onClick={() => dispatch({ type: "custom_update", prompt: state.pendingCustomPrompt, negative: state.pendingCustomNegative, aspect: opt.value, enhance: state.pendingEnhance })}
                        className={cn(
                          "py-3 rounded-xl border text-[10px] font-black uppercase tracking-tighter transition-all",
                          state.pendingCustomAspect === opt.value ? "border-neonViolet bg-neonViolet/10 text-neonViolet" : "border-white/5 bg-white/3 text-white/40"
                        )}
                      >
                        {opt.value}
                      </button>
                    ))}
                  </div>
                </div>

                <Button 
                  className="w-full py-6 text-lg font-black shadow-pro bg-neonViolet hover:bg-neonViolet/90 transition-all active:scale-[0.98]" 
                  onClick={() => {
                    if (!state.pendingCustomPrompt.trim()) {
                      toast.push({ title: "Введите промт", variant: "danger" });
                      return;
                    }
                    go("style_confirm");
                  }}
                >
                  Продолжить <ArrowRight size={20} className="ml-2" />
                </Button>
              </Card>
            </motion.div>
          )}

          {state.view === "style_confirm" && (
            <motion.div key="style_confirm" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-white">Настройка съемки</h2>
                <Button variant="secondary" size="sm" onClick={() => go("style_list")} className="h-9 px-3 border-white/5 bg-white/5"><ArrowLeft size={16} className="mr-1" />Стили</Button>
              </div>
              
              <Card className="p-0 overflow-hidden border-white/10 bg-white/5 shadow-2xl">
                <div className="relative aspect-[4/3] w-full overflow-hidden">
                  {pendingPack?.preview_urls?.[0] ? (
                    <SmartImage src={pendingPack.preview_urls[0]} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-white/5 flex items-center justify-center text-white/5"><ImageIcon size={64} /></div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-graphite via-transparent to-transparent" />
                  <div className="absolute bottom-6 left-6 right-6">
                    <h3 className="text-2xl font-black text-white tracking-tight">{pendingPack?.title || "Свой стиль"}</h3>
                    <p className="text-sm text-white/60 mt-2 leading-relaxed">{pendingPack?.description}</p>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  <div className="space-y-4">
                    <SectionHeader title="Выбор AI-модели" right="Качество генерации" />
                    <div className="grid grid-cols-2 gap-3">
                      {(cfg.costs?.models || []).map(m => {
                        const active = (state.pendingModelId === m.id) || (!state.pendingModelId && m.isDefault);
                        return (
                          <button 
                            key={m.id} 
                            onClick={() => dispatch({ type: "select_model", modelId: m.id })} 
                            className={cn(
                              "relative p-4 rounded-2xl border transition-all active:scale-[0.98]",
                              active 
                                ? "border-neonBlue bg-neonBlue/10 shadow-[0_0_15px_rgba(56,189,248,0.1)]" 
                                : "border-white/5 bg-white/3 hover:bg-white/5 hover:border-white/10"
                            )}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div className={cn("text-xs font-black uppercase tracking-tight", active ? "text-neonBlue" : "text-white/60")}>{m.title}</div>
                              {active && <CheckCircle2 size={12} className="text-neonBlue" />}
                            </div>
                            <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{m.costPerPhoto} т. / фото</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <SectionHeader title="Количество фото" right="Выберите пакет" />
                    <div className="grid grid-cols-3 gap-3">
                      {[8, 20, 50].map(count => (
                        <button 
                          key={count} 
                          onClick={() => dispatch({ type: "select_count", count })} 
                          className={cn(
                            "py-3 rounded-2xl border transition-all active:scale-[0.98] flex flex-col items-center justify-center",
                            state.pendingCustomCount === count 
                              ? "border-neonViolet bg-neonViolet/10 text-neonViolet shadow-[0_0_15px_rgba(139,92,246,0.1)]" 
                              : "border-white/5 bg-white/3 hover:bg-white/5 hover:border-white/10"
                          )}
                        >
                          <div className="text-sm font-black tracking-tight">{count}</div>
                          <div className="text-[8px] font-bold text-white/30 uppercase tracking-widest">фото</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white/3 rounded-2xl p-4 border border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-neonViolet/10 border border-neonViolet/20 flex items-center justify-center text-neonViolet">
                        <Sparkles size={20} />
                      </div>
                      <div>
                        <div className="text-[11px] font-black text-white uppercase tracking-tight">Итоговая стоимость</div>
                        <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest mt-0.5">{state.pendingCustomCount} фотографий</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-white">{state.pendingCustomCount * costPerPhoto} <span className="text-[10px] text-white/40 ml-0.5 font-bold uppercase">токенов</span></div>
                    </div>
                  </div>

                  <Button className="w-full py-7 text-lg font-black shadow-neon bg-gradient-to-r from-neonBlue to-neonViolet hover:opacity-90 transition-all active:scale-[0.98]" onClick={generateFlow} disabled={busy === "gen"}>
                    {busy === "gen" ? <Loader2 className="animate-spin mr-2" /> : <Sparkles size={20} className="mr-2" />}
                    Запустить генерацию
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {state.view === "generating" && (
            <motion.div key="generating" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center min-h-[70vh] py-10 text-center space-y-10">
              <div className="relative">
                <div className="absolute inset-0 bg-neonViolet/20 blur-[60px] animate-pulse" />
                <div className="relative h-40 w-40 rounded-full border-2 border-neonViolet/30 bg-graphite/40 backdrop-blur-xl flex items-center justify-center text-neonViolet shadow-[0_0_30px_rgba(167,139,250,0.3)]">
                  <motion.div
                    animate={{ rotate: -360 }}
                    transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                  >
                    <Sparkles size={64} className="opacity-50" />
                  </motion.div>
                  <motion.div
                    className="absolute"
                    animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  >
                    <div className="h-24 w-24 rounded-full border-4 border-dashed border-neonViolet/20" />
                  </motion.div>
                </div>
              </div>

              <div className="space-y-4 max-w-[280px]">
                <h2 className="text-3xl font-black text-white tracking-tight">Создаем шедевр</h2>
                <p className="text-sm text-white/50 leading-relaxed">
                  Генерируем {state.pendingCustomCount} уникальных портретов в выбранном стиле. Осталось около <span className="text-neonViolet font-bold">{state.generating.etaSeconds} сек.</span>
                </p>
              </div>

              <div className="w-full max-w-[280px] space-y-4">
                <div className="flex justify-between items-end">
                  <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">Магия в процессе</div>
                  <div className="text-sm font-black text-neonViolet">{Math.round(state.generating.progress)}%</div>
                </div>
                <Progress value={state.generating.progress} className="h-3 shadow-[0_0_15px_rgba(167,139,250,0.1)]" />
              </div>

              <Button variant="secondary" onClick={goHome} className="border-white/5 bg-white/5 text-white/40 hover:text-white/60">
                Отменить
              </Button>
            </motion.div>
          )}

          {state.view === "gallery" && activeSession && (
            <motion.div key="gallery" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-2 w-2 rounded-full bg-neonBlue animate-pulse shadow-[0_0_8px_#38BDF8]" />
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">{formatDate(activeSession.createdAt)}</span>
                  </div>
                  <h2 className="text-2xl font-black text-white truncate leading-tight">{activeSession.styleTitle}</h2>
                </div>
                <Button variant="secondary" size="sm" onClick={goHome} className="h-10 px-4 border-white/5 bg-white/5"><ArrowLeft size={16} className="mr-2" />В меню</Button>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                {activeSession.photos.map((p, idx) => (
                  <motion.button 
                    key={p.id} 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => setLightboxIndex(idx)} 
                    className="relative aspect-[3/4] rounded-[2rem] overflow-hidden border border-white/10 bg-white/5 hover:border-neonBlue transition-all group shadow-xl active:scale-[0.98]"
                  >
                    <SmartImage src={p.url} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-50 group-hover:scale-100">
                      <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-md border border-white/20 flex items-center justify-center">
                        <ImageIcon size={20} className="text-white" />
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>

              <div className="pt-4 pb-10">
                <Button variant="secondary" className="w-full py-6 border-dashed border-white/10 text-white/40 hover:text-white/60 hover:border-white/20 transition-all" onClick={goHome}>
                  Вернуться к списку сессий
                </Button>
              </div>

              <Lightbox 
                open={lightboxIndex !== null}
                photos={activeSession.photos} 
                index={lightboxIndex ?? 0} 
                onChangeIndex={(idx) => setLightboxIndex(idx)}
                onClose={() => setLightboxIndex(null)} 
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PhoneShell>
  );
}

function ExamplesScreen({ onBack }: { onBack: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-white">Примеры</h2>
        <Button variant="secondary" size="sm" onClick={onBack}><ArrowLeft size={14} className="mr-1" />Назад</Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="aspect-[3/4] rounded-3xl bg-white/5 border border-white/5 animate-pulse" />
        ))}
      </div>
    </motion.div>
  );
}
