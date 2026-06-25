/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:'#f0f4ff',100:'#dce8ff',200:'#b9d1ff',300:'#87b4ff',
          400:'#528eff',500:'#2563eb',600:'#1d4ed8',700:'#1e40af',
          800:'#1e3a8a',900:'#1e3270',950:'#172554',
        },
        surface: {
          50:'#f8fafc',100:'#f1f5f9',200:'#e2e8f0',300:'#cbd5e1',
          400:'#94a3b8',500:'#64748b',600:'#475569',700:'#334155',
          800:'#1e293b',900:'#0f172a',950:'#020617',
        },
        accent: {
          wa:'#25D366', tg:'#0088cc', ml:'#EA4335', ol:'#0078d4', ai:'#7c3aed',
        },
      },
      fontFamily: {
        sans: ['Inter','system-ui','sans-serif'],
        mono: ['JetBrains Mono','Fira Code','monospace'],
      },
      animation: {
        'fade-in':'fadeIn 0.2s ease-in-out',
        'slide-up':'slideUp 0.3s ease-out',
        'shimmer':'shimmer 1.5s infinite',
      },
      keyframes: {
        fadeIn:  {'0%':{opacity:'0'},'100%':{opacity:'1'}},
        slideUp: {'0%':{transform:'translateY(10px)',opacity:'0'},'100%':{transform:'translateY(0)',opacity:'1'}},
        shimmer: {'0%':{backgroundPosition:'-200% 0'},'100%':{backgroundPosition:'200% 0'}},
      },
      boxShadow: {
        glass:'0 4px 24px -1px rgba(0,0,0,0.08),0 2px 8px -2px rgba(0,0,0,0.06)',
        glow:'0 0 20px rgba(37,99,235,0.35)',
      },
    },
  },
  plugins: [],
}
