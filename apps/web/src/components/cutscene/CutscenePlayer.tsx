"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SkipForward, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useT } from "@/i18n/useT";
import { getVideo, type VideoId } from "@/lib/assets";
import { ParallaxCanvas, type StarfieldMode } from "./ParallaxCanvas";

export interface CutscenePlayerProps {
  video: VideoId;
  onComplete: () => void;
}

/**
 * Plays a cutscene from the asset manifest. Until the video editor delivers the file
 * (status "placeholder"), or if playback fails, a labelled placeholder runs instead.
 * Video starts muted (browsers block audible autoplay); the player can turn sound on.
 */
export function CutscenePlayer({ video, onComplete }: CutscenePlayerProps) {
  const asset = getVideo(video);
  const [failed, setFailed] = useState(false);
  const onFailed = useCallback(() => setFailed(true), []);

  if (asset.status === "placeholder") {
    return <CutscenePlaceholder video={video} onComplete={onComplete} />;
  }
  return <VideoCutscene video={video} failed={failed} onFailed={onFailed} onComplete={onComplete} />;
}

function SkipButton({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <Button variant="secondary" onClick={onClick} className="bg-space-deep/80">
      <SkipForward className="h-4 w-4" aria-hidden />
      {t.cutscene.skip}
    </Button>
  );
}

function VideoCutscene({
  video,
  failed,
  onFailed,
  onComplete,
}: {
  video: VideoId;
  failed: boolean;
  onFailed: () => void;
  onComplete: () => void;
}) {
  const t = useT();
  const asset = getVideo(video);
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    // Autoplay can be refused even when muted; fall back to the failure message with Skip.
    ref.current?.play().catch(onFailed);
  }, [onFailed]);

  return (
    <section className="relative h-dvh w-full bg-space-deep">
      {failed ? (
        <div className="flex h-full items-center justify-center px-4">
          <p role="alert" className="max-w-prose text-center text-lg">
            {t.cutscene.failed}
          </p>
        </div>
      ) : (
        <video
          ref={ref}
          className="h-full w-full object-contain"
          playsInline
          muted={muted}
          preload="auto"
          poster={asset.poster ?? undefined}
          onEnded={onComplete}
          onError={onFailed}
        >
          {asset.webm && <source src={asset.webm} type="video/webm" />}
          <source src={asset.mp4} type="video/mp4" />
          {asset.captions && <track kind="captions" src={asset.captions} default />}
        </video>
      )}
      <div className="absolute bottom-4 right-4 flex gap-2 sm:bottom-8 sm:right-8">
        {!failed && (
          <Button
            variant="secondary"
            size="icon"
            className="bg-space-deep/80"
            aria-label={muted ? t.cutscene.unmute : t.cutscene.mute}
            aria-pressed={!muted}
            onClick={() => setMuted((m) => !m)}
          >
            {muted ? <VolumeX className="h-4 w-4" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />}
          </Button>
        )}
        <SkipButton onClick={onComplete} />
      </div>
    </section>
  );
}

const PLACEHOLDER_MS = 6000;
const MOTION: Record<VideoId, { mode: StarfieldMode; horizon: boolean }> = {
  intro: { mode: "drift", horizon: false },
  launch: { mode: "rise", horizon: false },
  flagPlanting: { mode: "still", horizon: true },
};

/** Stand-in for an undelivered video: shows what goes here, where the file belongs, and how long it runs. */
function CutscenePlaceholder({ video, onComplete }: { video: VideoId; onComplete: () => void }) {
  const t = useT();
  const asset = getVideo(video);
  const [elapsed, setElapsed] = useState(0);
  const doneRef = useRef(onComplete);
  doneRef.current = onComplete;

  useEffect(() => {
    const start = performance.now();
    const id = window.setInterval(() => {
      const ms = performance.now() - start;
      setElapsed(ms);
      if (ms >= PLACEHOLDER_MS) {
        window.clearInterval(id);
        doneRef.current();
      }
    }, 100);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section className="relative h-dvh w-full overflow-hidden" aria-label={t.cutscene.videos[video]}>
      <ParallaxCanvas mode={MOTION[video].mode} horizon={MOTION[video].horizon} className="absolute inset-0" />
      <div className="absolute inset-0 flex items-center justify-center px-4">
        <div className="bezel flex w-full max-w-md flex-col gap-3 bg-space-deep/90 p-6">
          <StatusBadge status="pending" className="w-fit">
            {t.cutscene.videoSlot}
          </StatusBadge>
          <p className="text-xl font-semibold">{t.cutscene.videos[video]}</p>
          <p className="break-all font-mono text-xs text-foreground/65">{asset.mp4}</p>
          <Progress value={Math.min(elapsed, PLACEHOLDER_MS)} max={PLACEHOLDER_MS} aria-label={t.cutscene.videoSlot} className="mt-1 h-2" />
        </div>
      </div>
      <div className="absolute bottom-4 right-4 sm:bottom-8 sm:right-8">
        <SkipButton onClick={onComplete} />
      </div>
    </section>
  );
}
