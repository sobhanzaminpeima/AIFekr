export const CREDIT_COSTS = {
  chat: 1,
  image_standard: 5,
  image_hd: 10,
  video_5s: 20,
  video_10s: 35,
  video_30s: 80,
  music_30s: 10,
  music_60s: 18,
  music_120s: 30,
  tool: 2,
} as const;

export const PLAN_LIMITS = {
  FREE: {
    dailyChats: 20,
    monthlyImages: 5,
    monthlyVideos: 0,
    monthlyMusics: 0,
    initialCredits: 100,
  },
  BASIC: {
    dailyChats: -1,
    monthlyImages: 50,
    monthlyVideos: 5,
    monthlyMusics: 10,
    initialCredits: 500,
  },
  PRO: {
    dailyChats: -1,
    monthlyImages: -1,
    monthlyVideos: -1,
    monthlyMusics: -1,
    initialCredits: 2000,
  },
  TEAM: {
    dailyChats: -1,
    monthlyImages: -1,
    monthlyVideos: -1,
    monthlyMusics: -1,
    initialCredits: 5000,
  },
} as const;

export const PLAN_PRICES = {
  FREE: 0,
  BASIC: 150000,
  PRO: 350000,
  TEAM: 800000,
} as const;

export const PLAN_NAMES_FA = {
  FREE: "رایگان",
  BASIC: "پایه",
  PRO: "حرفه‌ای",
  TEAM: "تیمی",
} as const;
