/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        kengen: {
          green: "#00693E",
          navy: "#003865",
          amber: "#C77700",
          red: "#B3261E",
          blue: "#0B5FA5",
        },
        neutral: {
          900: "#1A1D1F",
          700: "#4A4F54",
          400: "#8C9196",
          100: "#F2F3F4",
        },
      },
      fontFamily: {
        sans: ["InspireTWDC", "Segoe UI", "system-ui", "sans-serif"],
      },
      fontSize: {
        body: ["13px", { lineHeight: "1.4" }],
        meta: ["11px", { lineHeight: "1.3" }],
      },
    },
  },
  plugins: [],
};
