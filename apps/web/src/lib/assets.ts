import { z } from "zod";
import raw from "../../public/assets/manifests/assets.json";

/**
 * Typed access to public/assets/manifests/assets.json. Components ask for an asset by id
 * here instead of hard-coding paths, so delivered files drop in without code changes.
 */
const status = z.enum(["placeholder", "final"]);

const videoSchema = z.object({
  status,
  mp4: z.string().startsWith("/assets/"),
  webm: z.string().startsWith("/assets/").nullable(),
  poster: z.string().startsWith("/assets/").nullable(),
  captions: z.string().startsWith("/assets/").nullable(),
  usage: z.string(),
  credit: z.string(),
});

const portraitSchema = z.object({
  status,
  src: z.string().startsWith("/assets/"),
  displayName: z.string(),
  usage: z.string(),
  credit: z.string(),
});

const manifestSchema = z.object({
  version: z.literal(1),
  notes: z.string(),
  videos: z.object({
    intro: videoSchema,
    launch: videoSchema,
    flagPlanting: videoSchema,
  }),
  portraits: z.record(z.string(), portraitSchema),
});

// Parsed once at module load; a malformed manifest fails loudly in dev and in the build.
export const assetManifest = manifestSchema.parse(raw);

export type VideoId = keyof typeof assetManifest.videos;
export type VideoAsset = z.infer<typeof videoSchema>;
export type PortraitAsset = z.infer<typeof portraitSchema>;

export function getVideo(id: VideoId): VideoAsset {
  return assetManifest.videos[id];
}

export function getPortrait(id: string): PortraitAsset | undefined {
  return assetManifest.portraits[id];
}
