/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14152B",
        primary: "#5B5FEF",
        accent: "#FF6B4A",
      },
    },
  },
  plugins: [],
}

