import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Crown,
  Image as ImageIcon,
  Loader2,
  Lock,
  Sparkles,
  Trash2,
  UploadCloud,
  UserCheck,
  UserX,
} from "lucide-react";
import * as React from "react";
import { Badge } from "../../components/ui/Badge";
import { BottomSheet } from "../../components/ui/BottomSheet";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PhoneShell } from "../../components/ui/PhoneShell";
import { Progress } from "../../components/ui/Progress";
import { SmartImage } from "../../components/ui/SmartImage";
import { useToast } from "../../components/ui/Toast";
import { cn } from "../../lib/cn";
import { usePublicConfig } from "../../lib/publicConfig";
import { readLocalStorage, writeLocalStorage } from "../../lib/storage";
import { useTelegramAuth } from "../../lib/useTelegramAuth";
import { Lightbox } from "./Lightbox";
import {
  clientReducer,
  initialClientState,
  photosPerPlan,
  type ClientView,
  type PhotoSession,
  type PromptAspectRatio,
  type MockPhoto,
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

// Placeholder for showcase photos (will be loaded from API)
const SHOWCASE_PHOTOS: Array<{ id: string; url: string; label: string }> = [];

const LS_KEY = "ai_photo_client_state_v3";

function clampIndex(i: number, len: number) {
  if (len <= 0) return 0;
  return ((i % len) + len) % len;
}

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
    <div className="flex items-end justify-between gap-3">
      <div className="text-sm font-semibold text-white/90">{title}</div>
      {right ? <div className="text-xs text-white/60">{right}</div> : null}
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
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px]",
        tone === "neutral" && "border-stroke bg-white/4 text-white/70",
        tone === "good" && "border-neonBlue/30 bg-neonBlue/10 text-white/85",
        tone === "brand" && "border-neonViolet/30 bg-neonViolet/10 text-white/85",
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
    // Migration: previously maxAllowed was 12; bump to current config (30).
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

  const [busy, setBusy] = React.useState<null | "pay" | "upload" | "train" | "gen">(null);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(null);
  const [uploadTarget, setUploadTarget] = React.useState<number>(20);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [picked, setPicked] = React.useState<Array<{ name: string; url: string }>>([]);
  const [packs, setPacks] = React.useState<StylePack[]>([]);
  const [packsLoading, setPacksLoading] = React.useState(true);
  const [aspectSheetOpen, setAspectSheetOpen] = React.useState(false);

  // Telegram auth
  const { isAuthenticated, user, isLoading: authLoading } = useTelegramAuth();

  const fetchProfile = React.useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const profile = await getProfile();
      dispatch({ type: "set_profile", tokensBalance: profile.user.tokensBalance });
    } catch (err) {
      console.error("[Client] Failed to fetch profile:", err);
    }
  }, [isAuthenticated]);

  React.useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

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
    dispatch({ type: "nav", view: "home" });
  }, [dispatch, state.generating.status, state.view, toast]);

  const resumeView = React.useMemo<ClientView>(() => {
    if (state.order?.status === "paid" && state.pendingStyleId) return "style_confirm";
    if (state.order?.status === "paid" && state.avatar.status === "ready") return "style_list";
    if (state.training.status !== "idle") return "training";
    if (state.order?.status === "paid") return "upload";
    return "pay";
  }, [state.avatar.status, state.order?.status, state.pendingStyleId, state.training.status]);

  const resumeLabel = React.useMemo(() => {
    if (state.order?.status === "paid" && state.pendingStyleId) return "Продолжить";
    if (state.avatar.status === "ready") return "Выбрать стиль";
    if (state.training.status !== "idle") return "Продолжить";
    if (state.dataset.uploaded > 0 && state.dataset.uploaded < state.dataset.minRequired)
      return "Продолжить загрузку";
    if (state.dataset.uploaded >= state.dataset.minRequired && state.training.status === "idle")
      return "Перейти к подготовке";
    return "Продолжить";
  }, [
    state.avatar.status,
    state.dataset.minRequired,
    state.dataset.uploaded,
    state.order?.status,
    state.pendingStyleId,
    state.training.status,
  ]);

  function startNewPhotosession() {
    dispatch({ type: "nav", view: "pay" });
  }

  // Upload simulation
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
    // Ensure simulation target follows current limits.
    if (uploadTarget > state.dataset.maxAllowed) setUploadTarget(state.dataset.maxAllowed);
    const uploaded = Math.min(
      uploadTarget,
      Math.max(0, Math.round((uploadProgress / 100) * uploadTarget)),
    );
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
      toast.push({
        title: "Селфи загружены",
        description: "Фото приняты. Дальше — подготовка аватара.",
        variant: "success",
      });
    }, 450);
    return () => window.clearTimeout(t);
  }, [busy, uploadProgress, toast]);

  // Training simulation
  React.useEffect(() => {
    if (state.training.status === "ready") return;
    if (state.training.status === "idle") return;
    const id = window.setInterval(() => {
      const next = Math.min(100, state.training.progress + Math.max(1.5, 8 - state.training.progress / 16));
      const left = Math.max(0, Math.round((100 - next) / 10));
      dispatch({ type: "training_progress", progress: next, etaMinutes: left });
      if (next >= 100) {
        dispatch({ type: "training_ready" });
        toast.push({
          title: "Аватар готов",
          description: "Можно переходить к выбору стиля.",
          variant: "success",
        });
      }
    }, 520);
    return () => window.clearInterval(id);
  }, [dispatch, state.training.progress, state.training.status, toast]);

  // Generation simulation (progress + then fetch photos)
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
      if (state.view !== "generating") return;
      if (state.generating.status !== "generating") return;
      if (state.generating.progress < 100) return;
      if (busy) return;

      setBusy("gen");
      const activePlan = plans.find(p => p.id === state.plan) || plans[0];
      const photos: MockPhoto[] = Array.from({ length: activePlan?.photosCount || 20 }).map((_, i) => ({
        id: `photo_${Date.now()}_${i}`,
        url: `https://via.placeholder.com/512x512?text=Photo+${i + 1}`,
        label: `Photo ${i + 1}`,
      }));
      const session: PhotoSession = {
        id: `sess_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        plan: state.plan,
        styleId: state.pendingStyleId ?? "pack",
        styleTitle:
          state.pendingStyleId === "custom"
            ? "Свой стиль"
            : pendingPack?.title ?? "Пакет",
        styleMode: state.pendingStyleId === "custom" ? "custom" : "pack",
        prompt: state.pendingStyleId === "custom" ? state.pendingCustomPrompt : undefined,
        settings:
          state.pendingStyleId === "custom"
            ? {
                count: state.pendingCustomCount,
                negative: state.pendingCustomNegative || undefined,
                aspectRatio: state.pendingCustomAspect,
                enhance: state.pendingEnhance,
                cfgScale: state.pendingCustomCfgScale,
                steps: state.pendingCustomSteps,
                faceFix: state.pendingCustomFaceFix,
              }
            : {
                count: state.plan === "pro" ? 30 : 20,
                enhance: state.pendingEnhance,
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
  }, [
    busy,
    pendingPack,
    state.generating.progress,
    state.generating.status,
    state.pendingCustomAspect,
    state.pendingCustomCount,
    state.pendingCustomCfgScale,
    state.pendingCustomFaceFix,
    state.pendingCustomNegative,
    state.pendingCustomPrompt,
    state.pendingCustomSteps,
    state.pendingEnhance,
    state.pendingStyleId,
    state.plan,
    state.view,
  ]);

  async function payFlow() {
    try {
      setBusy("pay");
      const order = await createOrder(state.plan);
      const orderForDispatch = { 
        ...order, 
        plan: order.plan_id, 
        amountRub: order.amount_rub, 
        createdAt: Date.parse(order.created_at), 
        paidAt: order.paid_at ? Date.parse(order.paid_at) : undefined 
      };
      dispatch({ type: "order_created", order: orderForDispatch });
      
      // Simulate payment delay
      await new Promise(r => setTimeout(r, 1500));
      
      const { paidAt } = await payOrder(order.id);
      dispatch({ type: "order_paid", paidAt: Date.parse(paidAt) });
      
      // Refresh profile to get new tokens and partner status
      await fetchProfile();
      
      setBusy(null);
      toast.push({
        title: "Оплата прошла",
        description: `Заказ: ${order.id}. Вам начислены токены!`,
        variant: "success",
      });
      if (state.avatar.status === "ready") {
        go("style_list");
      } else {
        go("upload");
      }
    } catch (err) {
      setBusy(null);
      toast.push({ title: "Оплата не удалась", description: String(err), variant: "danger" });
    }
  }

  async function startTraining() {
    if (state.dataset.uploaded < state.dataset.minRequired) {
      toast.push({
        title: "Не хватает фото",
        description: `Загрузите минимум ${state.dataset.minRequired} фото (можно до ${state.dataset.maxAllowed}).`,
      });
      return;
    }
    if (busy) return;
    setBusy("train");
    // Mock training start - in production use real API
    const astriaModelId = `model_${Date.now()}`;
    const jobId = `job_${Date.now()}`;
    dispatch({ type: "training_queued", astriaModelId, jobId });
    setBusy(null);
    go("training");
    toast.push({
      title: "Обучение запущено",
      description: "Готовим ваш аватар. Это займет несколько минут.",
      variant: "success",
    });
  }

  function startUpload() {
    if (busy) return;
    dispatch({ type: "upload_start" });
    setUploadProgress(0);
    setBusy("upload");
  }

  React.useEffect(() => {
    return () => {
      picked.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [picked]);

  function openPicker() {
    fileInputRef.current?.click();
  }

  function onFilesPicked(files: FileList | null) {
    if (!files || files.length === 0) return;

    picked.forEach((p) => URL.revokeObjectURL(p.url));
    const next = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, state.dataset.maxAllowed)
      .map((f) => ({ name: f.name, url: URL.createObjectURL(f) }));

    setPicked(next);
    setUploadProgress(100);
    dispatch({ type: "upload_progress", uploaded: next.length });
    dispatch({ type: "upload_ready" });
    toast.push({
      title: "Фото выбраны",
      description: `Вы выбрали ${next.length} фото.`,
      variant: next.length >= state.dataset.minRequired ? "success" : "default",
    });
  }

  function openSession(sessionId: string) {
    dispatch({ type: "open_session", sessionId });
  }

  function startGeneratingConfirmedStyle() {
    if (!state.pendingStyleId) {
      toast.push({ title: "Стиль не выбран", description: "Вернитесь и выберите стиль." });
      go("style_list");
      return;
    }
    if (state.pendingStyleId === "custom" && !state.pendingCustomPrompt.trim()) {
      toast.push({ title: "Введите описание", description: "Для своего стиля нужен текстовый запрос." });
      go("style_list");
      return;
    }
    dispatch({ type: "generating_start" });
    go("generating");
  }

  const galleryPhotos: any[] = activeSession?.photos ?? [];

  return (
    <PhoneShell
      title="AI-фотосессия"
      subtitle="Telegram Mini App"
      hideHeader
    >
      {/* Auth Indicator */}
      <div className="fixed right-4 top-4 z-50 flex items-center gap-2">
        {isAuthenticated && (
          <Badge className="bg-neonViolet/20 text-neonViolet border-neonViolet/30">
            <Sparkles size={12} className="mr-1" />
            {state.tokensBalance}
          </Badge>
        )}
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

      <AnimatePresence mode="wait">
        {state.view === "examples" ? (
          <ExamplesScreen onBack={() => go("home")} />
        ) : null}

        {state.view === "home" ? (
          <motion.div
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="space-y-5"
          >
            <div>
              <div className="text-xl font-semibold leading-tight">
                Создай свою <span className="text-neonBlue">цифровую копию</span>
              </div>
              <div className="mt-2 text-sm text-white/65">
                Премиальные портреты без студии и фотографа: один раз создайте аватар — дальше запускайте фотосессии в любых стилях за минуты.
              </div>
            </div>

            <Card className="relative overflow-hidden p-4">
              <div className="pointer-events-none absolute inset-0 bg-sheen opacity-60" />
              <div className="flex items-start justify-between gap-3">
                <div className="relative min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-white/95">Твой аватар</div>
                    {state.avatar.status === "ready" ? (
                      <Pill tone="good">
                        <CheckCircle2 size={12} />
                        Готов
                      </Pill>
                    ) : (
                      <Pill>
                        <Lock size={12} />
                        Нет аватара
                      </Pill>
                    )}
                  </div>
                <div className="mt-2 text-xs text-white/60">
                  {state.avatar.status === "ready"
                    ? "Аватар готов — выбирай стиль и запускай новые фотосессии."
                      : state.order?.status === "paid"
                        ? "Оплата прошла. Загрузите фото, чтобы мы подготовили аватар."
                        : "Создайте аватар один раз — и затем делайте фотосессии в разных стилях."}
                </div>
              </div>
            </div>
                  <div className="mt-4 flex gap-2">
                {state.order?.status === "paid" ? (
                  <>
                    <Button className="flex-1" onClick={() => go(resumeView)}>
                      <UploadCloud size={16} />
                      {resumeLabel}
                    </Button>
                  </>
                ) : state.avatar.status !== "ready" ? (
                  <Button className="flex-1" onClick={startNewPhotosession}>
                    <UploadCloud size={16} />
                    Создать аватар
                  </Button>
                ) : (
                  <>
                    <Button className="flex-1" onClick={startNewPhotosession}>
                      <Sparkles size={16} />
                      Новая фотосессия
                    </Button>
                    <Button
                      className="flex-1"
                      variant="secondary"
                      onClick={() => {
                        dispatch({ type: "delete_avatar" });
                        toast.push({
                          title: "Аватар удален",
                          description: "Чтобы сделать новый, нужно будет снова загрузить фото.",
                        });
                      }}
                    >
                      <Trash2 size={16} />
                      Пересоздать
                    </Button>
                  </>
                )}
              </div>
            </Card>

            {state.avatar.status !== "ready" ? (
              <Card className="p-4">
                <SectionHeader title="Тарифы" right={<span>Выберите перед оплатой</span>} />
                <div className="mt-3 grid gap-2">
                  {plans.map((p) => (
                    <button
                      key={p.id}
                      className={cn(
                        "relative overflow-hidden text-left rounded-2xl border border-stroke bg-white/4 p-4 transition hover:bg-white/6",
                        state.plan === p.id && (p.featured ? "shadow-pro ring-1 ring-neonViolet/30 bg-white/6" : "shadow-neon ring-1 ring-neonBlue/30 bg-white/6"),
                      )}
                      onClick={() => dispatch({ type: "select_plan", plan: p.id as PlanId })}
                      aria-pressed={state.plan === p.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="truncate text-sm font-semibold text-white/95">{p.title}</div>
                            {p.badge ? (
                              <Badge className={cn("shrink-0", p.featured ? "border-neonViolet/30 bg-neonViolet/12 text-white" : "border-neonBlue/30 bg-neonBlue/12 text-white")}>
                                {p.featured && <Crown size={14} />}
                                {p.badge}
                              </Badge>
                            ) : null}
                          </div>
                          <div className="mt-1 text-xs text-white/65">{p.photosCount} фото • {p.tokens} токенов</div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
                          <div className="text-sm font-semibold text-white/90">{rub(p.priceRub)}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </Card>
            ) : null}

            <Card className="p-4">
              <SectionHeader title="Примеры" />
              <div className="mt-3 grid grid-cols-3 gap-2">
                {SHOWCASE_PHOTOS.slice(0, 3).map((p, idx) => (
                  <SmartImage
                    key={p.id}
                    src={p.url}
                    alt={p.label}
                    fallbackSeed={idx}
                    className="h-24 w-full rounded-2xl"
                  />
                ))}
              </div>
              <div className="mt-4">
                <Button className="w-full" onClick={() => go("examples")}>
                  <ImageIcon size={16} />
                  Смотреть примеры
                  <ArrowRight size={16} />
                </Button>
              </div>
            </Card>

            <div className="space-y-3">
              <SectionHeader
                title="История фотосессий"
                right={<span>Сессий: {state.sessions.length}</span>}
              />

              {state.sessions.length === 0 ? (
                <Card className="relative overflow-hidden p-4">
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-neonBlue/10 via-neonViolet/8 to-transparent" />
                  <div className="relative">
                    <div className="text-sm font-semibold text-white/90">Пока пусто</div>
                    <div className="mt-1 text-xs text-white/60">
                      Запусти первую фотосессию — тут появится история и быстрый доступ к галереям.
                    </div>
                    <div className="mt-4 grid grid-cols-4 gap-2 text-[11px] text-white/70">
                      <Pill>Оплата</Pill>
                      <Pill>Аватар</Pill>
                      <Pill>Стиль</Pill>
                      <Pill tone="good">Галерея</Pill>
                    </div>
                  </div>
                </Card>
              ) : (
                <div className="grid gap-3">
                  {state.sessions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => openSession(s.id)}
                      className="text-left"
                    >
                      <Card className="p-4 transition hover:bg-white/4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-white/95">
                              {s.styleTitle}
                            </div>
                            <div className="mt-1 text-xs text-white/60">
                              {formatDate(s.createdAt)} • {s.photos.length} фото
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-white/55">
                            <span className="hidden sm:inline">Открыть</span>
                            <ArrowRight size={16} />
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          {s.photos.slice(0, 3).map((p, idx) => (
                            <SmartImage
                              key={p.id}
                              src={p.url}
                              alt={p.label}
                              fallbackSeed={idx}
                              className="h-16 w-full rounded-2xl"
                            />
                          ))}
                        </div>
                      </Card>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ) : null}

        {state.view === "pay" ? (
          <motion.div
            key="pay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="space-y-5"
          >
	            <div className="flex items-start justify-between gap-3">
	              <div>
	                <div className="text-base font-semibold text-white/95">Оплата фотосессии</div>
	                <div className="mt-1 text-xs text-white/60">
	                  {state.avatar.status === "ready"
	                    ? "После оплаты выберите стиль — и получите готовую подборку в галерее. Все результаты сохраняются в истории."
	                    : `После оплаты вы загрузите ${state.dataset.minRequired}–${state.dataset.maxAllowed} фото — мы подготовим ваш аватар. Затем выберете стиль и получите результат в галерее.`}
	                </div>
	              </div>
	              <Button
	                variant="secondary"
	                size="sm"
	                className="shrink-0 whitespace-nowrap"
	                onClick={goHome}
	              >
	                <ArrowLeft size={16} />
	                Меню
	              </Button>
	            </div>

            <div className="grid gap-3">
              <div className="text-sm font-semibold text-white/90">Тарифы</div>
              <div className="grid gap-3">
                {plans.map((p) => (
                  <button
                    key={p.id}
                    className={cn(
                      "relative overflow-hidden text-left rounded-2xl border border-stroke bg-white/4 p-4 transition hover:bg-white/6",
                      state.plan === p.id && (p.featured ? "shadow-pro ring-1 ring-neonViolet/30 bg-white/6" : "shadow-neon ring-1 ring-neonBlue/30 bg-white/6"),
                    )}
                    onClick={() => dispatch({ type: "select_plan", plan: p.id as any })}
                    aria-pressed={state.plan === p.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="truncate text-sm font-semibold text-white/95">{p.title}</div>
                          {p.badge ? (
                            <Badge className={cn("shrink-0", p.featured ? "border-neonViolet/30 bg-neonViolet/12 text-white" : "border-neonBlue/30 bg-neonBlue/12 text-white")}>
                              {p.featured && <Crown size={14} />}
                              {p.badge}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="mt-1 text-xs text-white/65">{p.photosCount} фото • {p.tokens} токенов</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
                        <div className="text-sm font-semibold text-white/90">{rub(p.priceRub)}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white/90">К оплате</div>
                  <div className="mt-1 text-xs text-white/60">
                    В проде здесь будет Telegram invoice / провайдер (пока не выбран).
                  </div>
                </div>
                <Badge className="bg-white/5">
                  <Lock size={14} />
                  Pay
                </Badge>
              </div>
	              <div className="mt-4 flex gap-2">
	                <Button
	                  className="flex-1 whitespace-nowrap"
	                  onClick={payFlow}
	                  disabled={busy === "pay"}
	                >
	                  {busy === "pay" ? (
	                    <>
	                      <Loader2 className="animate-spin" size={16} />
	                      Оплачиваю…
	                    </>
	                  ) : (
	                    <>
	                      Оплатить {rub(plans.find(p => p.id === state.plan)?.priceRub || 0)}
	                    </>
	                  )}
	                </Button>
	                <Button variant="secondary" className="flex-1" onClick={goHome}>
	                  Отмена
	                </Button>
	              </div>
            </Card>
          </motion.div>
        ) : null}

        {state.view === "upload" ? (
          <motion.div
            key="upload"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="space-y-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
	                <div className="text-base font-semibold text-white/95">Создание аватара</div>
	                <div className="mt-1 text-xs text-white/60">
	                  Загрузите {state.dataset.minRequired}–{state.dataset.maxAllowed} фото — мы сделаем аватар и будем использовать его для будущих фотосессий.
	                </div>
	              </div>
              <Button
                variant="secondary"
                size="sm"
                className="shrink-0 whitespace-nowrap"
                onClick={goHome}
              >
                Меню
              </Button>
            </div>

            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white/90">Загрузка фото</div>
                  <div className="mt-1 text-xs text-white/60">
                    Минимум {state.dataset.minRequired} фото, максимум {state.dataset.maxAllowed}. Чем больше и разнообразнее — тем лучше.
                  </div>
                </div>
                <Badge className={cn(state.dataset.status === "ready" ? "bg-neonBlue/12 border-neonBlue/30" : "bg-white/5")}>
                  {state.dataset.status === "ready" ? <CheckCircle2 size={14} /> : <UploadCloud size={14} />}
                  {state.dataset.status === "ready"
                    ? `${state.dataset.uploaded}/${state.dataset.maxAllowed}`
                    : `${state.dataset.uploaded}/${state.dataset.maxAllowed}`}
                </Badge>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => onFilesPicked(e.target.files)}
              />

              <div className="mt-4 flex gap-2">
                <Button className="flex-1" onClick={openPicker}>
                  <UploadCloud size={16} />
                  Выбрать фото
                </Button>
                {picked.length ? (
                  <Button
                    className="flex-1"
                    variant="secondary"
                    onClick={() => {
                      picked.forEach((p) => URL.revokeObjectURL(p.url));
                      setPicked([]);
                      setUploadProgress(0);
                      dispatch({ type: "upload_progress", uploaded: 0 });
                      toast.push({ title: "Список очищен" });
                    }}
                  >
                    Очистить
                  </Button>
                ) : null}
              </div>

              {picked.length ? (
                <div className="mt-4">
                  <div className="text-xs text-white/55">Выбрано: {picked.length}</div>
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {picked.slice(0, 8).map((p, idx) => (
                      <SmartImage
                        key={`${p.name}_${idx}`}
                        src={p.url}
                        alt={p.name}
                        fallbackSeed={idx}
                        className="h-16 w-full rounded-2xl"
                      />
                    ))}
                  </div>
                  {picked.length > 8 ? (
                    <div className="mt-2 text-xs text-white/55">
                      и еще {picked.length - 8}…
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-white/55">Симуляция:</span>
                {[4, 20, 30].map((n) => (
                  <button
                    key={n}
                    onClick={() => setUploadTarget(n)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] transition",
                      uploadTarget === n
                        ? "border-neonBlue/30 bg-neonBlue/10 text-white/90"
                        : "border-stroke bg-white/4 text-white/70 hover:bg-white/6",
                    )}
                  >
                    {n} фото
                  </button>
                ))}
              </div>

              <div className="mt-3">
                <Progress value={uploadProgress} />
                <div className="mt-2 flex items-center justify-between text-xs text-white/55">
                  <span>{busy === "upload" ? "Загрузка..." : state.dataset.status === "ready" ? "Готово" : "Ожидание"}</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={startUpload} disabled={busy === "upload"}>
                  {busy === "upload" ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Загружаю…
                    </>
                  ) : (
                    <>
                      <UploadCloud size={16} />
                      Симулировать загрузку
                    </>
                  )}
                </Button>
                <Button
                  className="flex-1"
                  onClick={startTraining}
                  disabled={state.dataset.uploaded < state.dataset.minRequired || busy === "train"}
                >
                  {busy === "train" ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Запускаю…
                    </>
                  ) : (
                    <>
                      Запустить обучение
                      <ArrowRight size={16} />
                    </>
                  )}
                </Button>
              </div>
            </Card>

            <Card className="p-4">
              <SectionHeader title="Какие фото подойдут" right={<span>чтобы результат был лучше</span>} />
              <div className="mt-3 grid gap-3">
                <div className="rounded-2xl border border-stroke bg-white/3 p-3">
                  <div className="text-xs font-semibold text-white/85">Подойдут</div>
                  <ul className="mt-2 space-y-1 text-xs text-white/65">
                    <li>— Лицо хорошо видно, без масок/солнцезащитных очков</li>
                    <li>— Разные ракурсы: прямо, 3/4, профиль</li>
                    <li>— Разное освещение: дневной свет, мягкий комнатный</li>
                    <li>— Нормальное качество: не размыто, без сильных фильтров</li>
                    <li>— Оставляйте немного “воздуха” вокруг лица (не обрезайте слишком близко)</li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-stroke bg-white/3 p-3">
                  <div className="text-xs font-semibold text-white/85">Лучше не загружать</div>
                  <ul className="mt-2 space-y-1 text-xs text-white/65">
                    <li>— Групповые фото, где несколько лиц</li>
                    <li>— Сильные фильтры, “мыльные” селфи, низкое разрешение</li>
                    <li>— Один и тот же ракурс на всех кадрах</li>
                    <li>— Сильно обрезанные кадры без лба/подбородка</li>
                  </ul>
                </div>
              </div>
              <div className="mt-3 text-xs text-white/55">
                Минимум {state.dataset.minRequired} фото, максимум {state.dataset.maxAllowed}. Для хорошего результата обычно достаточно 10–20 фото.
                Формат JPG/PNG, лучше без сильного сжатия (примерно до 3 МБ на фото) и размером от 512×512.
              </div>
            </Card>
          </motion.div>
        ) : null}

        {state.view === "training" ? (
          <motion.div
            key="training"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="space-y-4"
          >
            <Card className="relative overflow-hidden p-5">
              <div className="relative">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-white/95">
                      Готовим ваш аватар{" "}
                      <span className="text-white/70">(осталось ~{state.training.etaMinutes} мин)</span>
                    </div>
                    <div className="mt-1 text-sm text-white/65">
                      Можно закрыть приложение — процесс продолжится.
                    </div>
                  </div>
                  <div className="h-12 w-12 rounded-2xl border border-stroke bg-white/5 p-3">
                    <Loader2 className="h-6 w-6 animate-spin text-neonBlue" />
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <Progress value={state.training.progress} />
                  <div className="flex items-center justify-between text-xs text-white/55">
                    <span>{state.training.status === "queued" ? "В очереди…" : "Обучение и валидация…"}</span>
                    <span>{Math.round(state.training.progress)}%</span>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <Button variant="secondary" className="flex-1" onClick={goHome}>
                    В меню
                  </Button>
	                  <Button
	                    className="flex-1"
	                    onClick={() => go("style_list")}
	                    disabled={state.training.status !== "ready"}
	                  >
	                    {state.training.status === "ready" ? "Продолжить" : "Ждем готовность…"}
	                    <ArrowRight size={16} />
	                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        ) : null}

        {state.view === "style_list" ? (
          <motion.div
            key="style_list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-white/95">Выбор стиля</div>
                <div className="mt-1 text-xs text-white/60">
                  Выберите стиль, посмотрите примеры и подтвердите — затем начнется генерация фотосессии.
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="shrink-0 whitespace-nowrap"
                onClick={goHome}
              >
                Меню
              </Button>
            </div>

            <Card className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-white/65">
                  Аватар:{" "}
                  <span className="text-white/85">
                    {state.avatar.status === "ready" ? "готов" : "нет аватара"}
                  </span>
                </div>
              </div>
              <div className="mt-4 grid gap-2">
                <button
                  onClick={() => go("style_custom")}
                  className="flex items-start gap-3 rounded-2xl border border-neonBlue/30 bg-neonBlue/10 p-3 text-left transition hover:bg-neonBlue/12"
                >
                  <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl border border-neonBlue/30 bg-black/10">
                    <Sparkles size={18} className="text-neonBlue" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-sm font-semibold text-white/95">Создать свой стиль</div>
                      <Pill tone="good">Гибко</Pill>
                    </div>
                    <div className="mt-1 text-xs text-white/70">
                      Задайте свой текст, формат кадра и количество — и получите фотосессию под вашу идею.
                    </div>
                  </div>
                </button>

                {packsLoading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 rounded-2xl border border-stroke bg-white/3 p-3"
                      >
                        <div className="h-16 w-16 rounded-2xl border border-stroke bg-white/5" />
                        <div className="min-w-0 flex-1">
                          <div className="h-4 w-40 rounded bg-white/10" />
                          <div className="mt-2 h-3 w-56 rounded bg-white/10" />
                        </div>
                      </div>
                    ))
                  : packs.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      dispatch({ type: "style_picked", styleId: String(p.id) });
                      go("style_confirm");
                    }}
                    className="flex items-start gap-3 rounded-2xl border border-stroke bg-white/4 p-3 text-left transition hover:bg-white/6"
                  >
                    <SmartImage
                      alt={p.title}
                      src={p.coverUrl}
                      fallbackSeed={p.id}
                      className="h-16 w-16 rounded-2xl"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-sm font-semibold text-white/95">{p.title}</div>
                        <Pill tone="neutral">{p.estimatedImages} фото</Pill>
                      </div>
                      <div className="mt-1 text-xs text-white/60">{p.vibe}</div>
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          </motion.div>
        ) : null}

        {state.view === "style_custom" ? (
          <motion.div
            key="style_custom"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="h-full"
          >
            <div className="flex h-full flex-col">
              <div className="flex-1 space-y-3 pb-24">
                <div>
                  <div className="text-base font-semibold text-white/95">Свой стиль</div>
                  <div className="mt-1 text-xs text-white/60">
                    Опишите, какую фотосессию хотите получить. Мы сохраним лицо и сделаем серию кадров в выбранном
                    образе.
                  </div>
                </div>

                <Card className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-white/85">Как это работает</div>
                    <Pill tone="brand">Гибкая настройка</Pill>
                  </div>
                  <div className="mt-2 space-y-2 text-xs text-white/65">
                    <div>
                      <span className="text-white/80">Описание</span> — что вы хотите увидеть: свет, локация, одежда,
                      настроение.
                    </div>
                    <div>
                      <span className="text-white/80">Не добавлять</span> — что точно не должно попасть в кадр (например:
                      текст, логотипы, очки, борода).
                    </div>
                    <div>
                      <span className="text-white/80">Формат</span> — под аватарку, сторис или обложку.
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="text-xs font-semibold text-white/85">Настройки</div>
                  <div className="mt-3 grid gap-2">
                    <label className="text-xs text-white/60">
                      Описание
                      <textarea
                        value={state.pendingCustomPrompt}
                        onChange={(e) =>
                          dispatch({
                            type: "custom_update",
                            prompt: e.target.value,
                            negative: state.pendingCustomNegative,
                            count: state.pendingCustomCount,
                            aspect: state.pendingCustomAspect,
                            enhance: state.pendingEnhance,
                          })
                        }
                        rows={4}
                        className="mt-2 w-full resize-none rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
                        placeholder="Пример: стильный портрет в реальной городской локации, золотой час, мягкий киношный свет, естественная кожа, лёгкая улыбка, casual‑одежда, аккуратный фон, 35mm, realistic, high detail"
                      />
                    </label>
                    <label className="text-xs text-white/60">
                      Не добавлять (по желанию)
                      <input
                        value={state.pendingCustomNegative}
                        onChange={(e) =>
                          dispatch({
                            type: "custom_update",
                            prompt: state.pendingCustomPrompt,
                            negative: e.target.value,
                            count: state.pendingCustomCount,
                            aspect: state.pendingCustomAspect,
                            enhance: state.pendingEnhance,
                          })
                        }
                        className="mt-2 w-full rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-neonBlue/30"
                        placeholder="Пример: текст, логотип, водяной знак, очки, борода, шапка"
                      />
                    </label>

                    <div>
                      <div className="text-xs text-white/60">Формат фото</div>
                      <button
                        type="button"
                        onClick={() => setAspectSheetOpen(true)}
                        className="mt-2 flex w-full items-center justify-between rounded-2xl border border-stroke bg-white/4 px-3 py-2 text-left text-sm text-white/90 outline-none transition hover:bg-white/6 focus:ring-2 focus:ring-neonBlue/30"
                        aria-label="Выбрать формат фото"
                      >
                        <div className="min-w-0">
                          <div className="truncate">
                            {ASPECT_OPTIONS.find((o) => o.value === state.pendingCustomAspect)?.title ?? "Формат"}
                            <span className="text-white/55"> • {state.pendingCustomAspect}</span>
                          </div>
                          <div className="mt-0.5 truncate text-[11px] text-white/55">
                            {ASPECT_OPTIONS.find((o) => o.value === state.pendingCustomAspect)?.desc ?? ""}
                          </div>
                        </div>
                        <ArrowRight size={16} className="shrink-0 text-white/60" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs text-white/60">Количество фото</div>
                      <Pill tone="neutral">{photosPerPlan(state.plan)} по тарифу</Pill>
                    </div>

                    <details className="rounded-2xl border border-stroke bg-white/3 p-3">
                      <summary className="cursor-pointer select-none text-xs font-semibold text-white/85">
                        Дополнительно (если хочется точнее)
                      </summary>
                      <div className="mt-3 grid gap-3">
                        <div>
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-xs text-white/70">Насколько слушаться описания</div>
                            <Pill tone="neutral">{Math.round(state.pendingCustomCfgScale * 10) / 10}</Pill>
                          </div>
                          <input
                            type="range"
                            min={3}
                            max={11}
                            step={0.5}
                            value={state.pendingCustomCfgScale}
                            onChange={(e) => dispatch({ type: "custom_cfg", cfgScale: Number(e.target.value) })}
                            className="mt-2 w-full accent-neonBlue"
                            aria-label="Строгость описания"
                          />
                          <div className="mt-1 flex items-center justify-between text-[11px] text-white/55">
                            <span>Можно фантазировать</span>
                            <span>Как в описании</span>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-xs text-white/70">Скорость / детализация</div>
                            <Pill tone="neutral">{state.pendingCustomSteps} шагов</Pill>
                          </div>
                          <div className="mt-2 grid grid-cols-3 gap-2">
                            {[
                              { title: "Быстро", steps: 20 },
                              { title: "Баланс", steps: 28 },
                              { title: "Максимум", steps: 40 },
                            ].map((p) => {
                              const active = state.pendingCustomSteps === p.steps;
                              return (
                                <button
                                  key={p.steps}
                                  type="button"
                                  onClick={() => dispatch({ type: "custom_steps", steps: p.steps })}
                                  className={cn(
                                    "rounded-2xl border px-3 py-2 text-sm transition",
                                    active
                                      ? "border-neonBlue/50 bg-neonBlue/10 text-white/90"
                                      : "border-stroke bg-white/4 text-white/80 hover:bg-white/6",
                                  )}
                                >
                                  {p.title}
                                </button>
                              );
                            })}
                          </div>
                          <div className="mt-1 text-[11px] text-white/55">
                            Чем “Максимум”, тем дольше, но обычно аккуратнее детали.
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => dispatch({ type: "custom_facefix", on: !state.pendingCustomFaceFix })}
                          className={cn(
                            "flex items-center justify-between rounded-2xl border px-3 py-2 text-left text-sm transition",
                            state.pendingCustomFaceFix
                              ? "border-neonBlue/40 bg-neonBlue/10 text-white/90"
                              : "border-stroke bg-white/4 text-white/80 hover:bg-white/6",
                          )}
                        >
                          <div>
                            <div className="text-xs font-semibold">Улучшать лицо</div>
                            <div className="mt-0.5 text-[11px] text-white/60">
                              Помогает, если глаза/черты иногда “плывут”
                            </div>
                          </div>
                          <div
                            className={cn(
                              "h-6 w-10 rounded-full border p-0.5",
                              state.pendingCustomFaceFix
                                ? "border-neonBlue/50 bg-neonBlue/20"
                                : "border-stroke bg-white/5",
                            )}
                            aria-hidden
                          >
                            <div
                              className={cn(
                                "h-5 w-5 rounded-full transition",
                                state.pendingCustomFaceFix ? "translate-x-4 bg-neonBlue" : "translate-x-0 bg-white/35",
                              )}
                            />
                          </div>
                        </button>
                      </div>
                    </details>
                  </div>
                </Card>
              </div>

              <div className="sticky bottom-0 -mx-5 -mb-5 border-t border-stroke bg-graphite/85 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
                <div className="flex gap-2">
                  <Button variant="secondary" className="flex-1" onClick={() => go("style_list")}>
                    <ArrowLeft size={16} />
                    Назад
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => {
                      if (!state.pendingCustomPrompt.trim()) return;
                      dispatch({ type: "style_picked", styleId: "custom" });
                      go("style_confirm");
                    }}
                    disabled={!state.pendingCustomPrompt.trim()}
                  >
                    Продолжить
                    <ArrowRight size={16} />
                  </Button>
                </div>
              </div>

              <BottomSheet open={aspectSheetOpen} onClose={() => setAspectSheetOpen(false)} title="Формат фото">
                <div className="grid gap-2">
                  {ASPECT_OPTIONS.map((o) => {
                    const active = o.value === state.pendingCustomAspect;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => {
                          dispatch({
                            type: "custom_update",
                            prompt: state.pendingCustomPrompt,
                            negative: state.pendingCustomNegative,
                            count: state.pendingCustomCount,
                            aspect: o.value,
                            enhance: state.pendingEnhance,
                          });
                          setAspectSheetOpen(false);
                        }}
                        className={cn(
                          "rounded-2xl border p-3 text-left transition",
                          active
                            ? "border-neonBlue/50 bg-neonBlue/10"
                            : "border-stroke bg-white/4 hover:bg-white/6",
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-white/90">{o.title}</div>
                          <Pill tone={active ? "good" : "neutral"}>{o.value}</Pill>
                        </div>
                        <div className="mt-1 text-xs text-white/60">{o.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </BottomSheet>
            </div>
          </motion.div>
        ) : null}

        {state.view === "style_confirm" ? (
          <motion.div
            key="style_confirm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="h-full"
          >
            <div className="flex h-full flex-col">
              <div className="flex-1 space-y-4 pb-28">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-white/95">Примеры стиля</div>
                    <div className="mt-1 text-xs text-white/60">Посмотрите примеры и подтвердите стиль.</div>
                  </div>
                </div>

                <Card className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white/90">
                        {state.pendingStyleId === "custom" ? "Свой стиль" : pendingPack?.title ?? "—"}
                      </div>
                      <div className="mt-1 text-xs text-white/60">
                        {state.pendingStyleId === "custom"
                          ? state.pendingCustomPrompt.trim()
                          : pendingPack?.description ?? pendingPack?.vibe ?? ""}
                      </div>
                    </div>
                  <Pill tone="neutral">{photosPerPlan(state.plan)} фото</Pill>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <SmartImage
                      alt={state.pendingStyleId === "custom" ? "Custom style" : pendingPack?.title ?? "Pack"}
                      src={state.pendingStyleId === "custom" ? undefined : pendingPack?.coverUrl}
                      fallbackSeed={(pendingPack?.id ?? 0) + 40}
                      className="col-span-3 h-40 w-full rounded-2xl"
                    />
                    {(state.pendingStyleId === "custom"
                      ? SHOWCASE_PHOTOS.slice(0, 3).map((p) => p.url)
                      : pendingPack?.previewUrls?.slice(0, 3) ?? [])
                      .slice(0, 3)
                      .map((src, idx) => (
                        <SmartImage
                          key={`${src}_${idx}`}
                          src={src}
                          alt="Preview"
                          fallbackSeed={idx + 20}
                          className="h-20 w-full rounded-2xl"
                        />
                      ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "enhance_toggle", on: !state.pendingEnhance })}
                    className={cn(
                      "mt-3 w-full flex items-center justify-between rounded-2xl border px-3 py-2 text-left text-sm transition",
                      state.pendingEnhance
                        ? "border-neonBlue/40 bg-neonBlue/10 text-white/90"
                        : "border-stroke bg-white/4 text-white/80 hover:bg-white/6",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold">Улучшенное качество</div>
                      <div className="mt-0.5 truncate text-[11px] text-white/60">
                        Дольше, но аккуратнее детали и лицо
                      </div>
                    </div>
                    <div
                      className={cn(
                        "h-6 w-10 shrink-0 rounded-full border p-0.5",
                        state.pendingEnhance ? "border-neonBlue/50 bg-neonBlue/20" : "border-stroke bg-white/5",
                      )}
                      aria-hidden
                    >
                      <div
                        className={cn(
                          "h-5 w-5 rounded-full transition",
                          state.pendingEnhance ? "translate-x-4 bg-neonBlue" : "translate-x-0 bg-white/35",
                        )}
                      />
                    </div>
                  </button>
                </Card>
              </div>

              <div className="sticky bottom-0 -mx-5 -mb-5 border-t border-stroke bg-graphite/85 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
                <div className="flex gap-2">
                  <Button variant="secondary" className="flex-1 whitespace-nowrap" onClick={() => go("style_list")}>
                    <ArrowLeft size={16} />
                    Другой стиль
                  </Button>
                  <Button className="flex-1 whitespace-nowrap" onClick={startGeneratingConfirmedStyle}>
                    Генерировать
                    <ArrowRight size={16} />
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}

        {state.view === "generating" ? (
          <motion.div
            key="generating"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="space-y-4"
          >
            <Card className="relative overflow-hidden p-5">
              <div className="relative">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-white/95">
                      Фото генерируются{" "}
                      <span className="text-white/70">(осталось ~{state.generating.etaSeconds} сек)</span>
                    </div>
                    <div className="mt-1 text-sm text-white/65">
                      Стиль:{" "}
                      <span className="text-white/85">
                        {state.pendingStyleId === "custom"
                          ? "Свой стиль"
                          : pendingPack?.title ?? "—"}
                      </span>
                    </div>
                  </div>
                  <div className="h-12 w-12 rounded-2xl border border-stroke bg-white/5 p-3">
                    <Loader2 className="h-6 w-6 animate-spin text-neonBlue" />
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <Progress value={state.generating.progress} />
                  <div className="flex items-center justify-between text-xs text-white/55">
                    <span>Рендер сцен • композиция • пост‑процесс</span>
                    <span>{Math.round(state.generating.progress)}%</span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="shimmer-surface h-20 w-full rounded-2xl border border-stroke bg-white/4"
                    />
                  ))}
                </div>

                <div className="mt-4 flex gap-2">
                  <Button variant="secondary" className="flex-1" onClick={goHome}>
                    В меню
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        ) : null}

        {state.view === "gallery" ? (
          <motion.div
            key="gallery"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="h-full"
          >
            <div className="flex h-full flex-col">
              <div className="flex-1 space-y-4 pb-24">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-white/95">Галерея</div>
                    <div className="mt-1 text-xs text-white/60">
                      {activeSession ? `${activeSession.styleTitle} • ${formatDate(activeSession.createdAt)}` : "—"}
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="shrink-0 whitespace-nowrap"
                    onClick={goHome}
                  >
                    Меню
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {galleryPhotos.map((p, idx) => (
                    <button key={p.id} className="group relative" onClick={() => setLightboxIndex(idx)}>
                      <SmartImage src={p.url} alt={p.label} fallbackSeed={idx} className="h-28 w-full" />
                      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-t from-black/65 via-black/10 to-transparent opacity-0 transition group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="sticky bottom-0 z-10 -mx-5 -mb-5 border-t border-stroke bg-graphite px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_30px_rgba(0,0,0,0.55)]">
                <div className="flex gap-2">
                  <Button className="flex-1 whitespace-nowrap" onClick={goHome}>
                    В меню
                  </Button>
                  <Button variant="secondary" className="flex-1 whitespace-nowrap" onClick={startNewPhotosession}>
                    Новая фотосессия
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Lightbox
        open={lightboxIndex !== null}
        index={lightboxIndex ?? 0}
        onChangeIndex={(next) => setLightboxIndex(next)}
        onClose={() => setLightboxIndex(null)}
        photos={galleryPhotos}
      />
    </PhoneShell>
  );
}

function ExamplesScreen({ onBack }: { onBack: () => void }) {
  const photos = SHOWCASE_PHOTOS;
  const [index, setIndex] = React.useState(0);
  const safeIndex = clampIndex(index, photos.length);
  const active = photos[safeIndex];

  return (
    <motion.div
      key="examples"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
      className="-m-5 h-full min-h-[calc(100vh-4rem)]"
    >
      <div className="relative h-full min-h-[calc(100vh-4rem)] overflow-hidden bg-black/20">
        <motion.div
          key={active.id}
          initial={{ opacity: 0.75 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.12 }}
          className="flex h-full items-center justify-center bg-black/30"
        >
          <SmartImage
            src={active.url}
            alt={active.label}
            fallbackSeed={safeIndex}
            fit="contain"
            frame={false}
            className="h-full w-full"
          />
        </motion.div>

        <motion.div
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.25}
          onDragEnd={(_, info) => {
            const threshold = 70;
            if (info.offset.x > threshold) setIndex((i) => i - 1);
            if (info.offset.x < -threshold) setIndex((i) => i + 1);
          }}
          aria-label="Swipe area"
        />

        <div className="absolute left-3 top-3">
          <button
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-stroke bg-graphite/55 text-white/85 backdrop-blur hover:bg-white/8"
            onClick={onBack}
            aria-label="Back"
          >
            <ArrowLeft size={18} />
          </button>
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <div className="rounded-full border border-stroke bg-graphite/55 px-3 py-2 backdrop-blur">
            <div className="flex items-center gap-1.5">
              {photos.map((_, i) => (
                <button
                  key={i}
                  className={cn(
                    "h-2 w-2 rounded-full transition",
                    i === safeIndex ? "bg-neonBlue/90" : "bg-white/20 hover:bg-white/35",
                  )}
                  onClick={() => setIndex(i)}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
