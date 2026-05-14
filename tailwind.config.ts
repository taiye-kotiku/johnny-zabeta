import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#0E0F14",
          surface: "#171923",
          elevated: "#1E2130",
        },
        text: {
          primary: "#F8FAFC",
          muted: "#A1A1AA",
          disabled: "#52525B",
        },
        coral: {
          DEFAULT: "#FF4D6D",
          hover: "#FF2D55",
          subtle: "#FF4D6D1A",
        },
        lime: {
          DEFAULT: "#A3FF12",
          hover: "#8FE00A",
          subtle: "#A3FF121A",
        },
        lavender: {
          DEFAULT: "#A78BFA",
          subtle: "#A78BFA1A",
        },
        border: {
          DEFAULT: "#2A2D3E",
          subtle: "#1E2130",
        },
      },
      fontFamily: {
        sora: ["Sora", "sans-serif"],
        sans: ["DM Sans", "sans-serif"],
        grotesk: ["Space Grotesk", "sans-serif"],
      },
      keyframes: {
        pulse_lime: {
          "0%, 100%": { opacity: "1", boxShadow: "0 0 0 0 #A3FF1260" },
          "50%": { opacity: "0.8", boxShadow: "0 0 0 8px #A3FF1200" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        fade_in: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        count_up: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        pulse_lime: "pulse_lime 2s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
        fade_in: "fade_in 0.3s ease-out",
        count_up: "count_up 0.2s ease-out",
      },
      backgroundImage: {
        "gradient-radial":
          "radial-gradient(ellipse at top right, #A3FF1208 0%, transparent 60%)",
        "gradient-coral":
          "radial-gradient(ellipse at bottom left, #FF4D6D08 0%, transparent 60%)",
      },
    },
  },
  plugins: [],
} satisfies Config;
