/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bgDarkest: "#0B0F19",
        bgDark: "#111827",
        bgCard: "#182234",
        bgCardHover: "#1E2C42",
        brandBlue: "#3B82F6",
        brandCyan: "#06B6D4",
        statusGreen: "#10B981",
        statusYellow: "#F59E0B",
        statusRed: "#EF4444",
      }
    },
  },
  plugins: [],
}
