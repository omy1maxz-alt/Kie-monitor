/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bgDarkest: '#090D16',
        bgDark: '#0F172A',
        surfaceDark: '#1E293B',
        surfaceLightDark: '#26334D',
        surfaceBorder: '#334155',
        primaryIndigo: '#6366F1',
        primaryIndigoLight: '#818CF8',
        primaryIndigoDark: '#4F46E5',
        accentCyan: '#06B6D4',
        accentSky: '#38BDF8',
        statusOperational: '#10B981',
        statusOperationalBg: '#064E3B',
        statusOperationalText: '#6EE7B7',
        statusDegraded: '#F59E0B',
        statusDegradedBg: '#78350F',
        statusDegradedText: '#FCD34D',
        statusOutage: '#EF4444',
        statusOutageBg: '#7F1D1D',
        statusOutageText: '#FCA5A5',
        statusUntested: '#94A3B8',
        textPrimary: '#F8FAFC',
        textSecondary: '#94A3B8',
        textTertiary: '#64748B'
      }
    },
  },
  plugins: [],
}
