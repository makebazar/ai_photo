export type PackPromptTemplate = {
  text: string;
  negative?: string;
  previewUrl?: string;
};

// "Pack" in the product sense: a curated style that can generate a batch of prompts.
// In Astria terminology, this maps closely to the Pack object (prompts_per_class, costs_per_class, etc.).
export type StylePack = {
  id: number;
  slug: string;
  title: string;
  description: string;
  coverUrl?: string;
  previewUrls: string[];
  estimatedImages: number;
  vibe: string;
  promptTemplates?: PackPromptTemplate[];
  // Optional: future mapping to real Astria pack fields.
  costsPerClass?: Record<string, number>;
};

export const mockPacks: StylePack[] = [
  {
    id: 260,
    slug: "corporate-headshots",
    title: "Corporate Headshots",
    description: "Деловая фотосессия: чистый свет, аккуратный кадр, уверенный образ.",
    coverUrl: "https://sdbooth2-production.s3.amazonaws.com/2bcwnrw4tlwbk8nao4yy8lx1s9h3",
    previewUrls: [
      "https://sdbooth2-production.s3.amazonaws.com/2bcwnrw4tlwbk8nao4yy8lx1s9h3",
      "https://sdbooth2-production.s3.amazonaws.com/5c5m4j1x1a2j5r5u1dg7wzj3kq8p",
      "https://sdbooth2-production.s3.amazonaws.com/3bpnm5d0v1n2w4k2p4c3y2m1x4z9",
    ],
    estimatedImages: 28,
    vibe: "Чисто, дорого, как для LinkedIn/сайта",
    promptTemplates: [
      { text: "профессиональный портрет, мягкий студийный свет, нейтральный фон, 85mm, реализм" },
      { text: "деловой портрет, аккуратная композиция, чистые цвета, естественная кожа" },
    ],
    costsPerClass: { person: 1 },
  },
  {
    id: 9991,
    slug: "cinematic-neon",
    title: "Cinematic Neon",
    description: "Ночной неон и киношный свет: атмосферно, контрастно, как кадр из фильма.",
    coverUrl: "https://sdbooth2-production.s3.amazonaws.com/mqqy8pkso90o8nab2g9j78mxkdsz",
    previewUrls: [
      "https://sdbooth2-production.s3.amazonaws.com/mqqy8pkso90o8nab2g9j78mxkdsz",
      "https://sdbooth2-production.s3.amazonaws.com/pg6yksj8n6j8z8e7p4k1y3b2a9v0",
      "https://sdbooth2-production.s3.amazonaws.com/jh9xk2q7m1d8n6v4t3c1b8a2p5z0",
    ],
    estimatedImages: 30,
    vibe: "Ночной город, неон, киношный свет",
    promptTemplates: [
      { text: "киношный портрет, неоновые огни, дождь, боке, 35mm, cinematic, high contrast" },
      { text: "ночной город, неоновая вывеска, драматичный свет, реализм" },
    ],
    costsPerClass: { person: 1 },
  },
  {
    id: 9992,
    slug: "neutral-muse",
    title: "Neutral Muse",
    description: "Редакционный минимализм: мягкий свет, спокойные тона, модный журнал.",
    coverUrl: "https://sdbooth2-production.s3.amazonaws.com/xgsoxkb3sh27ypt9ils82dbn5yf7",
    previewUrls: [
      "https://sdbooth2-production.s3.amazonaws.com/xgsoxkb3sh27ypt9ils82dbn5yf7",
      "https://sdbooth2-production.s3.amazonaws.com/uz0v1x2c3b4n5m6a7s8d9f0g1h2j",
      "https://sdbooth2-production.s3.amazonaws.com/ab1c2d3e4f5g6h7i8j9k0l1m2n3o",
    ],
    estimatedImages: 40,
    vibe: "Минимализм, soft‑light, editorial",
    promptTemplates: [
      { text: "editorial портрет, мягкий дневной свет, минималистичный фон, fashion magazine" },
      { text: "портрет, soft light, нейтральная палитра, clean look, realistic" },
    ],
    costsPerClass: { person: 1 },
  },
  {
    id: 9993,
    slug: "film-noir",
    title: "Film Noir",
    description: "Черно‑белая драма: контраст, тени, характер и настроение.",
    coverUrl: "https://sdbooth2-production.s3.amazonaws.com/xmcfwg94lozsd4ysyeotx12p7ugm",
    previewUrls: [
      "https://sdbooth2-production.s3.amazonaws.com/xmcfwg94lozsd4ysyeotx12p7ugm",
      "https://sdbooth2-production.s3.amazonaws.com/zz1yy2xx3ww4vv5uu6tt7ss8rr9q",
      "https://sdbooth2-production.s3.amazonaws.com/qq1ww2ee3rr4tt5yy6uu7ii8oo9p",
    ],
    estimatedImages: 24,
    vibe: "Контраст, тени, драматичный кадр",
    promptTemplates: [
      { text: "film noir портрет, черно-белое фото, жесткий свет, глубокие тени, 50mm" },
      { text: "монохромный портрет, высокая контрастность, кинематографичный кадр" },
    ],
    costsPerClass: { person: 1 },
  },
];
