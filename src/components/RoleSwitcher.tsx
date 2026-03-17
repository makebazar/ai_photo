import type { ReactNode } from "react";
import { Eye, Handshake, Crown, Gauge } from "lucide-react";
import { cn } from "../lib/cn";
import { Role } from "../roles/types";
import type { EffectsMode } from "../lib/effects";

export function RoleSwitcher({
  role,
  onChange,
  effects,
  onToggleEffects,
}: {
  role: Role;
  onChange: (role: Role) => void;
  effects: EffectsMode;
  onToggleEffects: () => void;
}) {
  const items: Array<{
    role: Role;
    label: string;
    icon: ReactNode;
  }> = [
    { role: "client", label: "Клиент (TMA)", icon: <Eye size={16} /> },
    { role: "partner", label: "Партнер (TMA)", icon: <Handshake size={16} /> },
    { role: "admin", label: "Админ (Web)", icon: <Crown size={16} /> },
  ];

  return (
    <div className="fixed left-1/2 top-4 z-[70] w-[min(920px,calc(100%-1.5rem))] -translate-x-1/2">
      <div className="rounded-2xl border border-stroke bg-graphite/70 p-1 shadow-neon backdrop-blur">
        <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1">
          {items.map((it) => {
            const active = role === it.role;
            return (
              <button
                key={it.role}
                onClick={() => onChange(it.role)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition",
                  "hover:bg-white/6",
                  active &&
                    "bg-gradient-to-b from-white/12 to-white/6 shadow-[0_0_0_1px_rgba(56,189,248,0.14),0_0_24px_rgba(167,139,250,0.14)]",
                )}
              >
                <span className={cn(active ? "text-white" : "text-white/75")}>
                  {it.icon}
                </span>
                <span className={cn(active ? "text-white" : "text-white/75")}>
                  {it.label}
                </span>
              </button>
            );
          })}

          <button
            onClick={onToggleEffects}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition",
              "hover:bg-white/6",
              effects === "lite" &&
                "bg-white/6 shadow-[0_0_0_1px_rgba(56,189,248,0.12)]",
            )}
            aria-label="Toggle effects mode"
          >
            <Gauge size={16} className={cn(effects === "lite" ? "text-neonBlue" : "text-white/70")} />
            <span className={cn(effects === "lite" ? "text-white" : "text-white/70")}>
              FX: {effects === "lite" ? "Lite" : "Full"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
