/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Notion 스타일 중립 색상 (따뜻한 회색/베이지)
        primary: {
          50: "#FAFAFA",
          100: "#F7F6F3",
          200: "#EDECE9",
          300: "#E3E2DF",
          400: "#D9D8D3",
          500: "#C1BDB7",
          600: "#9B9A97",
          700: "#6E6D6A",
          800: "#49483E",
          900: "#2F3437",
        },

        // Notion의 9가지 강조 색상
        brown: {
          50: "#F4F1EE",
          100: "#E9E5E0",
          200: "#D3C8BC",
          300: "#BDA998",
          400: "#A78974",
          500: "#9F6B53",
          600: "#7F5643",
          700: "#5F4032",
          800: "#3F2B22",
          900: "#1F1511",
        },
        gray: {
          50: "#F7F7F6",
          100: "#EFEEEC",
          200: "#DEDAD6",
          300: "#CEC9C3",
          400: "#BDB8B0",
          500: "#787774",
          600: "#605F5C",
          700: "#484745",
          800: "#30302E",
          900: "#181817",
        },
        orange: {
          50: "#FDF5ED",
          100: "#FBEBD9",
          200: "#F7D7B3",
          300: "#F3C38D",
          400: "#EFAF67",
          500: "#D9730D",
          600: "#AE5C0A",
          700: "#824508",
          800: "#572E05",
          900: "#2B1703",
        },
        yellow: {
          50: "#FDF9ED",
          100: "#FBF3D9",
          200: "#F7E7B3",
          300: "#F3DB8D",
          400: "#EFCF67",
          500: "#CB912F",
          600: "#A27426",
          700: "#7A571C",
          800: "#513A13",
          900: "#291D09",
        },
        green: {
          50: "#EEF5F1",
          100: "#DDEBE3",
          200: "#BBD7C7",
          300: "#99C3AB",
          400: "#77AF8F",
          500: "#448361",
          600: "#36694D",
          700: "#294F3A",
          800: "#1B3427",
          900: "#0E1A13",
        },
        blue: {
          50: "#EEF3F7",
          100: "#DDE7EF",
          200: "#BBCFDF",
          300: "#99B7CF",
          400: "#779FBF",
          500: "#337EA9",
          600: "#296587",
          700: "#1F4C65",
          800: "#143244",
          900: "#0A1922",
        },
        purple: {
          50: "#F4F0F5",
          100: "#E9E1EB",
          200: "#D3C3D7",
          300: "#BDA5C3",
          400: "#A787AF",
          500: "#9065B0",
          600: "#73518D",
          700: "#563D6A",
          800: "#3A2846",
          900: "#1D1423",
        },
        pink: {
          50: "#F9EFF4",
          100: "#F3DFE9",
          200: "#E7BFD3",
          300: "#DB9FBD",
          400: "#CF7FA7",
          500: "#C14C8A",
          600: "#9A3D6E",
          700: "#742E53",
          800: "#4D1E37",
          900: "#270F1C",
        },
        red: {
          50: "#FBEFEE",
          100: "#F7DFDD",
          200: "#EFBFBB",
          300: "#E79F99",
          400: "#DF7F77",
          500: "#D44C47",
          600: "#AA3D39",
          700: "#7F2E2B",
          800: "#551E1C",
          900: "#2A0F0E",
        },

        // 시맨틱 컬러 (Notion 스타일로 재정의)
        accent: "#337EA9", // 메인 강조색 (블루)
        "accent-hover": "#296587",
        "accent-light": "#779FBF",
        ink: "#2F3437", // 텍스트 색상 (다크 그레이)
        muted: "#787774", // 보조 텍스트 (그레이)
        paper: "#FFFFFF", // 배경색 (순수 흰색)
        panel: "#FAFAFA", // 패널 배경 (매우 밝은 회색)
        line: "#E3E2DF", // 테두리 (베이지 그레이)
        chip: "#F7F6F3", // 칩/태그 배경
        highlight: "#EEF3F7", // 하이라이트 (연한 블루)

        // 중립 색상 (Notion 스타일)
        neutral: {
          50: "#FAFAFA",
          100: "#F7F6F3",
          200: "#EDECE9",
          300: "#E3E2DF",
          400: "#C1BDB7",
          500: "#9B9A97",
          600: "#787774",
          700: "#6E6D6A",
          800: "#49483E",
          900: "#2F3437",
        },

        // 상태 색상 (Notion 팔레트 기반)
        success: {
          50: "#EEF5F1",
          100: "#DDEBE3",
          500: "#448361",
          600: "#36694D",
        },
        warning: {
          50: "#FDF9ED",
          100: "#FBF3D9",
          500: "#CB912F",
          600: "#A27426",
        },
        danger: {
          50: "#FBEFEE",
          100: "#F7DFDD",
          500: "#D44C47",
          600: "#AA3D39",
        },
        info: {
          50: "#EEF3F7",
          100: "#DDE7EF",
          500: "#337EA9",
          600: "#296587",
        },

        // 유입경로 브랜드 색상 (Notion 팔레트로 재조정)
        cafe24: {
          50: "#F4F1EE",
          100: "#E9E5E0",
          200: "#D3C8BC",
          300: "#A78974",
          400: "#9F6B53",
          500: "#7F5643",
          600: "#5F4032",
        },
        gpmall: {
          50: "#EEF3F7",
          100: "#DDE7EF",
          200: "#BBCFDF",
          300: "#779FBF",
          400: "#337EA9",
          500: "#296587",
          600: "#1F4C65",
        },

        // 구독 상태 색상 (Notion 팔레트 기반)
        "subscription-active": {
          50: "#EEF5F1",
          100: "#DDEBE3",
          200: "#BBD7C7",
          300: "#99C3AB",
          400: "#77AF8F",
          500: "#448361",
          600: "#36694D",
          700: "#294F3A",
          800: "#1B3427",
          900: "#0E1A13",
        },
        "subscription-pause": {
          50: "#FDF9ED",
          100: "#FBF3D9",
          200: "#F7E7B3",
          300: "#F3DB8D",
          400: "#EFCF67",
          500: "#CB912F",
          600: "#A27426",
          700: "#7A571C",
          800: "#513A13",
          900: "#291D09",
        },
        "subscription-duplicate": {
          50: "#FBEFEE",
          100: "#F7DFDD",
          200: "#EFBFBB",
          300: "#E79F99",
          400: "#DF7F77",
          500: "#D44C47",
          600: "#AA3D39",
          700: "#7F2E2B",
          800: "#551E1C",
          900: "#2A0F0E",
        },
      },

      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Helvetica",
          "Apple Color Emoji",
          "Arial",
          "sans-serif",
          "Segoe UI Emoji",
          "Segoe UI Symbol",
        ],
        serif: [
          "ui-serif",
          "Georgia",
          "Cambria",
          "Times New Roman",
          "Times",
          "serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "SF Mono",
          "Menlo",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
      },

      boxShadow: {
        // Notion은 그림자를 거의 사용하지 않음 (테두리 중심)
        sm: "0 0 0 1px rgba(15, 15, 15, 0.1)",
        DEFAULT: "0 0 0 1px rgba(15, 15, 15, 0.1)",
        md: "0 0 0 1px rgba(15, 15, 15, 0.1)",
        lg: "0 0 0 1px rgba(15, 15, 15, 0.1)",
        xl: "0 0 0 1px rgba(15, 15, 15, 0.1)",
        card: "0 0 0 1px rgba(15, 15, 15, 0.1)",
        btn: "none",
        hover: "0 0 0 1px rgba(15, 15, 15, 0.15)",
        modal: "0 0 0 1px rgba(15, 15, 15, 0.1)",
      },

      borderRadius: {
        none: "0",
        sm: "3px",
        DEFAULT: "4px",
        md: "4px",
        lg: "6px",
        xl: "8px",
        "2xl": "12px",
        "3xl": "16px",
        full: "9999px",
      },

      animation: {
        "fade-in": "fadeIn 0.2s ease-in",
        "slide-up": "slideUp 0.2s ease-out",
        "slide-down": "slideDown 0.2s ease-out",
      },

      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          from: { opacity: "0", transform: "translateY(-4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },

      spacing: {
        18: "4.5rem",
        88: "22rem",
        128: "32rem",
      },

      fontSize: {
        xxs: ["0.625rem", { lineHeight: "0.75rem" }],
      },
    },
  },
  plugins: [],
};
