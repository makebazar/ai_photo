// Simple seed data for packs/promos (used for demos).
// Keep it deterministic and safe to re-run (upsert).

export const seedPacks = [
  {
    id: 260,
    slug: "corporate-headshots",
    title: "Corporate Headshots",
    description: "Деловая фотосессия: чистый свет, аккуратный кадр, уверенный образ.",
    status: "active",
    previewUrls: [
      "https://sdbooth2-production.s3.amazonaws.com/2bcwnrw4tlwbk8nao4yy8lx1s9h3",
      "https://sdbooth2-production.s3.amazonaws.com/5c5m4j1x1a2j5r5u1dg7wzj3kq8p",
      "https://sdbooth2-production.s3.amazonaws.com/3bpnm5d0v1n2w4k2p4c3y2m1x4z9",
    ],
    estimatedImages: 28,
    packObjectId: "pack_260",
    promptsPerClass: 28,
    costsPerClass: { person: 1 },
  },
  {
    id: 9991,
    slug: "cinematic-neon",
    title: "Cinematic Neon",
    description: "Ночной неон и киношный свет: атмосферно, контрастно, как кадр из фильма.",
    status: "active",
    previewUrls: [
      "https://sdbooth2-production.s3.amazonaws.com/mqqy8pkso90o8nab2g9j78mxkdsz",
      "https://sdbooth2-production.s3.amazonaws.com/pg6yksj8n6j8z8e7p4k1y3b2a9v0",
      "https://sdbooth2-production.s3.amazonaws.com/jh9xk2q7m1d8n6v4t3c1b8a2p5z0",
    ],
    estimatedImages: 30,
    packObjectId: "pack_9991",
    promptsPerClass: 30,
    costsPerClass: { person: 1 },
  },
  {
    id: 9993,
    slug: "film-noir",
    title: "Film Noir",
    description: "Черно‑белая драма: контраст, тени, характер и настроение.",
    status: "active",
    previewUrls: [
      "https://sdbooth2-production.s3.amazonaws.com/xmcfwg94lozsd4ysyeotx12p7ugm",
      "https://sdbooth2-production.s3.amazonaws.com/zz1yy2xx3ww4vv5uu6tt7ss8rr9q",
      "https://sdbooth2-production.s3.amazonaws.com/qq1ww2ee3rr4tt5yy6uu7ii8oo9p",
    ],
    estimatedImages: 24,
    packObjectId: "pack_9993",
    promptsPerClass: 24,
    costsPerClass: { person: 1 },
  },
];

export const seedPromos = [
  {
    id: "promo_1001",
    title: "Текст для Reels",
    caption:
      "Хочешь фотосессию как в кино без студии? Я сделал(а) ИИ‑сет и получил(а) готовые фото уже сегодня. Лови ссылку 👇",
    kind: "text",
    status: "active",
    tags: ["instagram", "reels", "text"],
    coverUrl: null,
    mediaUrls: [],
  },
  {
    id: "promo_2001",
    title: "Видео‑превью (9:16)",
    caption: "Вертикальное превью под TikTok/Shorts.",
    kind: "video",
    status: "active",
    tags: ["tiktok", "shorts", "video"],
    coverUrl: "https://images.unsplash.com/photo-1520975890222-44e8c7c7f8ad?auto=format&fit=crop&w=1200&q=80",
    mediaUrls: [
      "https://images.unsplash.com/photo-1520975890222-44e8c7c7f8ad?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1520975916090-3105956dac38?auto=format&fit=crop&w=1200&q=80",
    ],
  },
];

export async function ensureSeedData(db) {
  for (const p of seedPacks) {
    await db.query(
      `
      insert into style_packs (id, slug, title, description, status, preview_urls, estimated_images, pack_object_id, prompts_per_class, costs_per_class)
      values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10::jsonb)
      on conflict (id) do update
        set slug = excluded.slug,
            title = excluded.title,
            description = excluded.description,
            status = excluded.status,
            preview_urls = excluded.preview_urls,
            estimated_images = excluded.estimated_images,
            pack_object_id = excluded.pack_object_id,
            prompts_per_class = excluded.prompts_per_class,
            costs_per_class = excluded.costs_per_class,
            updated_at = now()
      `,
      [
        p.id,
        p.slug,
        p.title,
        p.description,
        p.status,
        JSON.stringify(p.previewUrls ?? []),
        p.estimatedImages ?? 20,
        p.packObjectId ?? null,
        p.promptsPerClass ?? null,
        JSON.stringify(p.costsPerClass ?? {}),
      ],
    );
  }

  for (const p of seedPromos) {
    await db.query(
      `
      insert into promos (id, title, caption, kind, status, cover_url, media_urls, tags)
      values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::text[])
      on conflict (id) do update
        set title = excluded.title,
            caption = excluded.caption,
            kind = excluded.kind,
            status = excluded.status,
            cover_url = excluded.cover_url,
            media_urls = excluded.media_urls,
            tags = excluded.tags,
            updated_at = now()
      `,
      [p.id, p.title, p.caption, p.kind, p.status, p.coverUrl, JSON.stringify(p.mediaUrls ?? []), p.tags ?? []],
    );
  }
}

