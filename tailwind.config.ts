import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#07070C",
        graphite: "#0E0F16",
        panel: "#101225",
        stroke: "rgba(255,255,255,0.08)",
        neonBlue: "#38BDF8",
        neonViolet: "#A78BFA",
        neonPink: "#F472B6"
      },
      boxShadow: {
        neon: "0 0 0 1px rgba(56,189,248,0.15), 0 0 30px rgba(167,139,250,0.18)",
        pro: "0 0 0 1px rgba(167,139,250,0.25), 0 0 50px rgba(167,139,250,0.22), 0 0 18px rgba(56,189,248,0.18)"
      },
      backgroundImage: {
        aurora:
          "radial-gradient(900px circle at 10% 10%, rgba(56,189,248,0.18), transparent 45%), radial-gradient(700px circle at 90% 20%, rgba(167,139,250,0.16), transparent 50%), radial-gradient(900px circle at 50% 105%, rgba(244,114,182,0.10), transparent 55%)",
        sheen:
          "linear-gradient(120deg, rgba(255,255,255,0.04), rgba(255,255,255,0.00), rgba(255,255,255,0.03))"
      }
    }
  },
  plugins: []
} satisfies Config;

