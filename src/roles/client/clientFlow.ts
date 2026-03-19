import { loadPublicConfig } from "../../lib/publicConfig";

export type PlanId = "standard" | "pro";

export type MockPhoto = {
  id: string;
  url: string;
  label: string;
};

export function photosPerPlan(plan: PlanId) {
  const cfg = loadPublicConfig();
  return plan === "pro" ? 30 : 20;
}

export type Order = {
  id: string;
  plan: PlanId;
  amountRub: number;
  status: "unpaid" | "paid";
  createdAt: number;
  paidAt?: number;
};

export type Dataset = {
  minRequired: number;
  maxAllowed: number;
  uploaded: number;
  status: "idle" | "uploading" | "ready";
};

export type AvatarModel = {
  status: "none" | "training" | "ready";
  astriaModelId?: string;
  lastTrainedAt?: number;
};

export type Training = {
  status: "idle" | "queued" | "training" | "ready";
  etaMinutes: number;
  progress: number; // 0..100
  jobId?: string;
};

export type Generating = {
  status: "idle" | "generating";
  progress: number; // 0..100
  etaSeconds: number;
};

export type PromptAspectRatio = "1:1" | "2:3" | "3:2" | "9:16" | "16:9";

export type PhotoSessionSettings = {
  count: number;
  negative?: string;
  aspectRatio?: PromptAspectRatio;
  enhance?: boolean;
  cfgScale?: number;
  steps?: number;
  faceFix?: boolean;
};

export type PhotoSession = {
  id: string;
  plan: PlanId;
  styleId: string;
  styleTitle: string;
  styleMode: "pack" | "custom";
  prompt?: string;
  settings?: PhotoSessionSettings;
  createdAt: number;
  photos: MockPhoto[];
};

export type ClientView =
  | "home"
  | "examples"
  | "pay"
  | "upload"
  | "training"
  | "style_list"
  | "style_custom"
  | "style_confirm"
  | "generating"
  | "gallery";

export type ClientState = {
  view: ClientView;
  plan: PlanId;
  avatar: AvatarModel;
  order: Order | null;
  dataset: Dataset;
  training: Training;
  pendingStyleId: string | null; // packId as string OR "custom"
  pendingCustomPrompt: string;
  pendingCustomNegative: string;
  pendingCustomCount: number;
  pendingCustomAspect: PromptAspectRatio;
  pendingEnhance: boolean;
  pendingCustomCfgScale: number;
  pendingCustomSteps: number;
  pendingCustomFaceFix: boolean;
  generating: Generating;
  sessions: PhotoSession[];
  activeSessionId: string | null;
};

export const initialClientState: ClientState = {
  view: "home",
  plan: "pro",
  avatar: { status: "none" },
  order: null,
  dataset: { minRequired: 4, maxAllowed: 30, uploaded: 0, status: "idle" },
  training: { status: "idle", etaMinutes: 10, progress: 0 },
  pendingStyleId: null,
  pendingCustomPrompt: "",
  pendingCustomNegative: "",
  pendingCustomCount: photosPerPlan("pro"),
  pendingCustomAspect: "2:3",
  pendingEnhance: true,
  pendingCustomCfgScale: 6.5,
  pendingCustomSteps: 28,
  pendingCustomFaceFix: true,
  generating: { status: "idle", progress: 0, etaSeconds: 0 },
  sessions: [],
  activeSessionId: null,
};

export type ClientAction =
  | { type: "nav"; view: ClientView }
  | { type: "select_plan"; plan: PlanId }
  | { type: "order_created"; order: Order }
  | { type: "order_paid"; paidAt: number }
  | { type: "cancel_photosession" }
  | { type: "upload_start" }
  | { type: "upload_progress"; uploaded: number }
  | { type: "upload_ready" }
  | { type: "training_queued"; jobId: string; astriaModelId: string }
  | { type: "training_progress"; progress: number; etaMinutes: number }
  | { type: "training_ready" }
  | { type: "style_picked"; styleId: string }
  | {
      type: "custom_update";
      prompt: string;
      negative: string;
      count: number;
      aspect: PromptAspectRatio;
      enhance: boolean;
    }
  | { type: "custom_cfg"; cfgScale: number }
  | { type: "custom_steps"; steps: number }
  | { type: "custom_facefix"; on: boolean }
  | { type: "enhance_toggle"; on: boolean }
  | { type: "generating_start" }
  | { type: "generating_progress"; progress: number; etaSeconds: number }
  | { type: "generating_done" }
  | { type: "session_created"; session: PhotoSession }
  | { type: "open_session"; sessionId: string }
  | { type: "delete_avatar" }
  | { type: "reset_all" };

export function clientReducer(state: ClientState, action: ClientAction): ClientState {
  switch (action.type) {
    case "nav":
      return { ...state, view: action.view };
    case "select_plan":
      return {
        ...state,
        plan: action.plan,
        pendingCustomCount: photosPerPlan(action.plan),
      };
    case "order_created":
      return { ...state, order: action.order };
    case "order_paid":
      if (!state.order) return state;
      return {
        ...state,
        order: { ...state.order, status: "paid", paidAt: action.paidAt },
      };
    case "cancel_photosession":
      return {
        ...state,
        view: "home",
        order: null,
        pendingStyleId: null,
        pendingCustomPrompt: "",
        pendingCustomNegative: "",
        pendingCustomCount: photosPerPlan(state.plan),
        pendingCustomAspect: "2:3",
        pendingEnhance: true,
        pendingCustomCfgScale: 6.5,
        pendingCustomSteps: 28,
        pendingCustomFaceFix: true,
        generating: { status: "idle", progress: 0, etaSeconds: 0 },
      };
    case "upload_start":
      return {
        ...state,
        dataset: { ...state.dataset, status: "uploading", uploaded: 0 },
      };
    case "upload_progress":
      return {
        ...state,
        dataset: {
          ...state.dataset,
          status: "uploading",
          uploaded: Math.min(state.dataset.maxAllowed, Math.max(0, action.uploaded)),
        },
      };
    case "upload_ready":
      return {
        ...state,
        dataset: {
          ...state.dataset,
          status: state.dataset.uploaded >= state.dataset.minRequired ? "ready" : "idle",
          uploaded: state.dataset.uploaded,
        },
      };
    case "training_queued":
      return {
        ...state,
        avatar: { status: "training", astriaModelId: action.astriaModelId },
        training: {
          status: "queued",
          etaMinutes: 10,
          progress: 0,
          jobId: action.jobId,
        },
      };
    case "training_progress":
      return {
        ...state,
        training: {
          ...state.training,
          status: "training",
          progress: Math.max(0, Math.min(100, action.progress)),
          etaMinutes: Math.max(0, action.etaMinutes),
        },
      };
    case "training_ready":
      return {
        ...state,
        avatar: { ...state.avatar, status: "ready", lastTrainedAt: Date.now() },
        training: { ...state.training, status: "ready", progress: 100, etaMinutes: 0 },
      };
    case "style_picked":
      return { ...state, pendingStyleId: action.styleId };
    case "custom_update":
      return {
        ...state,
        pendingStyleId: "custom",
        pendingCustomPrompt: action.prompt,
        pendingCustomNegative: action.negative,
        // Count is locked by the chosen tariff.
        pendingCustomCount: photosPerPlan(state.plan),
        pendingCustomAspect: action.aspect,
        pendingEnhance: action.enhance,
      };
    case "custom_cfg":
      return {
        ...state,
        pendingCustomCfgScale: Math.max(1, Math.min(14, action.cfgScale)),
      };
    case "custom_steps":
      return {
        ...state,
        pendingCustomSteps: Math.max(10, Math.min(60, Math.round(action.steps))),
      };
    case "custom_facefix":
      return { ...state, pendingCustomFaceFix: action.on };
    case "enhance_toggle":
      return { ...state, pendingEnhance: action.on };
    case "generating_start":
      return {
        ...state,
        generating: { status: "generating", progress: 0, etaSeconds: 30 },
      };
    case "generating_progress":
      return {
        ...state,
        generating: {
          status: "generating",
          progress: Math.max(0, Math.min(100, action.progress)),
          etaSeconds: Math.max(0, action.etaSeconds),
        },
      };
    case "generating_done":
      return {
        ...state,
        generating: { status: "idle", progress: 100, etaSeconds: 0 },
      };
    case "session_created":
      return {
        ...state,
        order: null,
        sessions: [action.session, ...state.sessions].slice(0, 20),
        activeSessionId: action.session.id,
        pendingStyleId: null,
      };
    case "open_session":
      return { ...state, activeSessionId: action.sessionId, view: "gallery" };
    case "delete_avatar":
      return {
        ...state,
        avatar: { status: "none" },
        dataset: { minRequired: 4, maxAllowed: 30, uploaded: 0, status: "idle" },
        training: { status: "idle", etaMinutes: 10, progress: 0 },
      };
    case "reset_all":
      return initialClientState;
    default:
      return state;
  }
}
