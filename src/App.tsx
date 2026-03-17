import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import * as React from "react";
import { ToastProvider } from "./components/ui/Toast";
import { getInitialEffectsMode } from "./lib/effects";
import { readLocalStorage, writeLocalStorage } from "./lib/storage";
import { navigate, roleToRoute, routeToRole, usePathname } from "./lib/pathRouter";
import { AdminDashboard } from "./roles/admin/AdminDashboard";
import { ClientMiniApp } from "./roles/client/ClientMiniApp";
import { PartnerMiniApp } from "./roles/partner/PartnerMiniApp";
import type { Role } from "./roles/types";

const LS_LAST_ROLE_KEY = "ai_photo_last_role_v1";

export default function App() {
  const reduceMotion = useReducedMotion();
  const pathname = usePathname();
  const [role, setRoleState] = React.useState<Role>("client");
  const effects = React.useMemo(() => getInitialEffectsMode(), []);

  React.useEffect(() => {
    const derived = routeToRole(pathname);
    if (derived) {
      setRoleState(derived);
      writeLocalStorage(LS_LAST_ROLE_KEY, derived);
      return;
    }

    // Redirect root/unknown paths to the last selected role.
    const last = readLocalStorage<Role>(LS_LAST_ROLE_KEY, "client");
    navigate(roleToRoute(last), { replace: true });
  }, [pathname]);

  return (
    <ToastProvider>
      <div className="min-h-full bg-aurora" data-effects={effects}>
        <div className="min-h-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={role}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.18 }}
              className="min-h-full"
            >
              {role === "client" ? <ClientMiniApp /> : null}
              {role === "partner" ? <PartnerMiniApp /> : null}
              {role === "admin" ? <AdminDashboard /> : null}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </ToastProvider>
  );
}
