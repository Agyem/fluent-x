/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#2B2D2F",
        bg: "#F8F7F6",
        surface: "#FFFFFF",
        surface muted: "#F2F1EF",
        surface muted 2: "#E9E8E5",
        border: "#E6E4E1",
        border strong: "#D3D1CD",
        primary: "#F2720E",
        primary dark: "#D35F09",
        primary light: "#FDEADB",
        accent: "#55585B",
        accent dark: "#3F4143",
        accent light: "#E9E9EA",
        success: "#1FAA6D",
        success light: "#E3F5EC",
        warning: "#F5A623",
        warning light: "#FDF1DC",
        danger: "#E5484D",
        danger light: "#FCEAEA",
        text: "#232326",
        text secondary: "#6B6B6E",
        text muted: "#9B9B9E",
      },
      borderRadius: {
        md: "14px",
        sm: "9px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(43,45,47,0.05)",
        pop: "0 12px 32px rgba(43,45,47,0.18)",
      },
    },
    fontFamily: {
      sans: ["Inter", "sans-serif"],
      serif: ["Space Grotesk", "sans-serif"],
      mono: ["IBM Plex Mono", "monospace"],
    },
  },
  plugins: [],
}

