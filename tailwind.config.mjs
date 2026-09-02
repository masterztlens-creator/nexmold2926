/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      // 如果需要扩展颜色可以在这里写，但我们目前直接用方括号写法 bg-[#0B1221]
    },
  },
  plugins: [],
};