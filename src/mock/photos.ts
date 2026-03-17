export type MockPhoto = {
  id: string;
  url?: string;
  label: string;
};

const unsplash = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=80`;

export const showcasePhotos: MockPhoto[] = [
  { id: "s1", url: unsplash("photo-1520975916090-3105956dac38"), label: "Neon city portrait" },
  { id: "s2", url: unsplash("photo-1520975682033-99c39b983d67"), label: "Studio light" },
  { id: "s3", url: unsplash("photo-1520974735194-6c49ea3d1f5b"), label: "Cinematic frame" },
  { id: "s4", url: unsplash("photo-1520976070912-2d95f7b4b3c6"), label: "Fashion editorial" },
  { id: "s5", url: unsplash("photo-1520975693410-002fd0f86e19"), label: "Soft bokeh" },
  { id: "s6", url: unsplash("photo-1520975867597-0b2a283b9c1d"), label: "Night glow" },
];

export const generatedPhotos: MockPhoto[] = Array.from({ length: 30 }).map((_, i) => ({
  id: `g${i + 1}`,
  url: i % 2 === 0 ? unsplash("photo-1520975890222-44e8c7c7f8ad") : unsplash("photo-1520975916090-3105956dac38"),
  label: `Result ${i + 1}`,
}));

