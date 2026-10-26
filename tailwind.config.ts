import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#14162B',
        paper: '#EEF0F6',
        mute: '#4D5270',
        rule: '#C4C9DC',
        sidea: '#2433E0',
        sideb: '#C81E4B',
        night: '#0b0f1f',
        gx: '#6978f5',
      },
      fontFamily: {
        sans: ['var(--font-poppins)', '"Avenir Next"', '"Helvetica Neue"', 'Helvetica', 'Arial', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
