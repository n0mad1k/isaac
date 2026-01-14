/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // Use data-theme attribute for dark mode switching
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        /* ============================================
           SEMANTIC COLORS - Reference CSS Variables
           These allow Tailwind classes to use our token system
           ============================================ */

        // Background colors
        surface: {
          app: 'var(--color-bg-app)',
          DEFAULT: 'var(--color-bg-surface)',
          soft: 'var(--color-bg-surface-soft)',
          muted: 'var(--color-bg-surface-muted)',
          hover: 'var(--color-bg-surface-hover)',
          active: 'var(--color-bg-surface-active)',
        },

        // Border colors
        border: {
          subtle: 'var(--color-border-subtle)',
          DEFAULT: 'var(--color-border-default)',
          strong: 'var(--color-border-strong)',
          focus: 'var(--color-border-focus)',
        },

        // Text colors
        content: {
          DEFAULT: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
          disabled: 'var(--color-text-disabled)',
          inverse: 'var(--color-text-inverse)',
          link: 'var(--color-text-link)',
        },

        // Primary green ramp
        primary: {
          900: 'var(--color-green-900)',
          800: 'var(--color-green-800)',
          700: 'var(--color-green-700)',
          600: 'var(--color-green-600)',
          500: 'var(--color-green-500)',
          400: 'var(--color-green-400)',
          300: 'var(--color-green-300)',
          200: 'var(--color-green-200)',
          100: 'var(--color-green-100)',
          DEFAULT: 'var(--color-green-600)',
        },

        // Gold accent ramp
        gold: {
          800: 'var(--color-gold-800)',
          700: 'var(--color-gold-700)',
          600: 'var(--color-gold-600)',
          500: 'var(--color-gold-500)',
          400: 'var(--color-gold-400)',
          300: 'var(--color-gold-300)',
          200: 'var(--color-gold-200)',
          100: 'var(--color-gold-100)',
          DEFAULT: 'var(--color-gold-500)',
        },

        // Teal accent ramp
        teal: {
          800: 'var(--color-teal-800)',
          700: 'var(--color-teal-700)',
          600: 'var(--color-teal-600)',
          500: 'var(--color-teal-500)',
          400: 'var(--color-teal-400)',
          300: 'var(--color-teal-300)',
          200: 'var(--color-teal-200)',
          100: 'var(--color-teal-100)',
          DEFAULT: 'var(--color-teal-500)',
        },

        // Status colors
        success: {
          700: 'var(--color-success-700)',
          600: 'var(--color-success-600)',
          500: 'var(--color-success-500)',
          400: 'var(--color-success-400)',
          bg: 'var(--color-success-bg)',
          border: 'var(--color-success-border)',
          DEFAULT: 'var(--color-success-500)',
        },

        warning: {
          700: 'var(--color-warning-700)',
          600: 'var(--color-warning-600)',
          500: 'var(--color-warning-500)',
          400: 'var(--color-warning-400)',
          bg: 'var(--color-warning-bg)',
          border: 'var(--color-warning-border)',
          DEFAULT: 'var(--color-warning-500)',
        },

        error: {
          700: 'var(--color-error-700)',
          600: 'var(--color-error-600)',
          500: 'var(--color-error-500)',
          400: 'var(--color-error-400)',
          bg: 'var(--color-error-bg)',
          border: 'var(--color-error-border)',
          DEFAULT: 'var(--color-error-500)',
        },

        info: {
          700: 'var(--color-info-700)',
          600: 'var(--color-info-600)',
          500: 'var(--color-info-500)',
          400: 'var(--color-info-400)',
          bg: 'var(--color-info-bg)',
          border: 'var(--color-info-border)',
          DEFAULT: 'var(--color-info-500)',
        },

        // Button colors
        btn: {
          'primary': 'var(--color-btn-primary-bg)',
          'primary-hover': 'var(--color-btn-primary-bg-hover)',
          'primary-active': 'var(--color-btn-primary-bg-active)',
          'secondary': 'var(--color-btn-secondary-bg)',
          'secondary-hover': 'var(--color-btn-secondary-bg-hover)',
          'danger': 'var(--color-btn-danger-bg)',
          'danger-hover': 'var(--color-btn-danger-bg-hover)',
        },

        // Input colors
        input: {
          bg: 'var(--color-input-bg)',
          'bg-hover': 'var(--color-input-bg-hover)',
          'bg-focus': 'var(--color-input-bg-focus)',
          border: 'var(--color-input-border)',
          'border-hover': 'var(--color-input-border-hover)',
          'border-focus': 'var(--color-input-border-focus)',
        },

        // Navigation
        nav: {
          bg: 'var(--color-nav-bg)',
          text: 'var(--color-nav-item-text)',
          'text-hover': 'var(--color-nav-item-text-hover)',
          'text-active': 'var(--color-nav-item-text-active)',
          'bg-hover': 'var(--color-nav-item-bg-hover)',
          'bg-active': 'var(--color-nav-item-bg-active)',
        },

        // Badge colors
        badge: {
          success: 'var(--color-badge-success-bg)',
          warning: 'var(--color-badge-warning-bg)',
          error: 'var(--color-badge-error-bg)',
          info: 'var(--color-badge-info-bg)',
          neutral: 'var(--color-badge-neutral-bg)',
          green: 'var(--color-badge-green-bg)',
          purple: 'var(--color-badge-purple-bg)',
          cyan: 'var(--color-badge-cyan-bg)',
          amber: 'var(--color-badge-amber-bg)',
          red: 'var(--color-badge-red-bg)',
          pink: 'var(--color-badge-pink-bg)',
          lime: 'var(--color-badge-lime-bg)',
          blue: 'var(--color-badge-blue-bg)',
          orange: 'var(--color-badge-orange-bg)',
          teal: 'var(--color-badge-teal-bg)',
        },

        // Chart colors
        chart: {
          1: 'var(--color-chart-1)',
          2: 'var(--color-chart-2)',
          3: 'var(--color-chart-3)',
          4: 'var(--color-chart-4)',
          5: 'var(--color-chart-5)',
          6: 'var(--color-chart-6)',
          grid: 'var(--color-chart-grid)',
          axis: 'var(--color-chart-axis)',
        },

        // Legacy aliases for backward compatibility during migration
        'farm-green': 'var(--color-green-600)',
        'farm-green-light': 'var(--color-green-400)',
        'farm-gold': 'var(--color-gold-500)',
      },

      // Text colors using semantic tokens
      textColor: {
        DEFAULT: 'var(--color-text-primary)',
        primary: 'var(--color-text-primary)',
        secondary: 'var(--color-text-secondary)',
        muted: 'var(--color-text-muted)',
        disabled: 'var(--color-text-disabled)',
        inverse: 'var(--color-text-inverse)',
        link: 'var(--color-text-link)',
        'link-hover': 'var(--color-text-link-hover)',
      },

      // Background colors
      backgroundColor: {
        app: 'var(--color-bg-app)',
        surface: 'var(--color-bg-surface)',
        'surface-soft': 'var(--color-bg-surface-soft)',
        'surface-muted': 'var(--color-bg-surface-muted)',
        'surface-hover': 'var(--color-bg-surface-hover)',
        'surface-active': 'var(--color-bg-surface-active)',
        overlay: 'var(--color-bg-overlay)',
      },

      // Border colors
      borderColor: {
        DEFAULT: 'var(--color-border-default)',
        subtle: 'var(--color-border-subtle)',
        strong: 'var(--color-border-strong)',
        focus: 'var(--color-border-focus)',
      },

      // Box shadows
      boxShadow: {
        'sm': 'var(--shadow-sm)',
        'md': 'var(--shadow-md)',
        'lg': 'var(--shadow-lg)',
        'xl': 'var(--shadow-xl)',
        'glow': 'var(--shadow-glow)',
        'glow-error': 'var(--shadow-glow-error)',
      },

      // Border radius
      borderRadius: {
        'sm': 'var(--radius-sm)',
        'md': 'var(--radius-md)',
        'lg': 'var(--radius-lg)',
        'xl': 'var(--radius-xl)',
        'full': 'var(--radius-full)',
      },

      // Font family
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },

      // Transitions
      transitionDuration: {
        'fast': '150ms',
        'normal': '250ms',
        'slow': '350ms',
      },
    },
  },
  plugins: [],
}
