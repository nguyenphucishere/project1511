"use client";

import type { ReactNode } from "react";
import type { LocalizedText } from "@/i18n";
import { useLocalized } from "@/i18n/useT";
import type { EndingDefinition } from "@/game/endings";

type EndingKey = EndingDefinition["normalizedId"];

/** Caption shown under each dedicated ending vignette (bilingual). */
const SCENE_CAPTION: Record<EndingKey, LocalizedText> = {
  "ending-1": {
    en: "Tranquility Base — Eagle on the Sea of Tranquility, Earth rising over the horizon",
    vi: "Căn cứ Yên Bình — Eagle trên Biển Yên Bình, Trái Đất lơ lửng phía chân trời",
  },
  "ending-2": {
    en: "Ascent Stage climbing to a 15 × 111 km orbit, descent stage falling away",
    vi: "Tầng bay lên vươn tới quỹ đạo 15 × 111 km, tầng đáp rơi lại phía sau",
  },
  "ending-3": {
    en: "Eagle tipped onto its side on the West Crater slope — ascent engine crushed",
    vi: "Eagle lật nghiêng trên triền dốc West Crater — động cơ bay lên bị bẹp",
  },
  "ending-4": {
    en: "Abort Stage at 40 ft — ascent stage lifting clear of the dust and the crater rim",
    vi: "Abort Stage ở độ cao 12 m — tầng bay lên thoát khỏi bụi và vành hố",
  },
  "ending-5": {
    en: "AS-506 breaking apart at Max-Q, T+83 s, 13.4 km altitude",
    vi: "AS-506 vỡ vụn tại Max-Q, giây thứ 83, độ cao 13,4 km",
  },
};

interface DiagnosticLine {
  code: string;
  text: LocalizedText;
}

/** Failure / anomaly diagnostics for every non-nominal ending. */
const DIAGNOSTICS: Partial<Record<EndingKey, { heading: LocalizedText; lines: DiagnosticLine[] }>> = {
  "ending-2": {
    heading: { en: "ABORT DIAGNOSTICS", vi: "CHẨN ĐOÁN HỦY NHIỆM VỤ" },
    lines: [
      { code: "AGC-1202", text: { en: "Executive overflow during braking phase; no landing radar priority recovery.", vi: "Tràn bộ điều phối trong pha hãm; không phục hồi được ưu tiên radar hạ cánh." } },
      { code: "ABORT-STG", text: { en: "Pyro bolts fired, descent stage jettisoned, APS ignition nominal.", vi: "Bu-lông nổ kích hoạt, tầng đáp bị loại bỏ, động cơ APS điểm hoả bình thường." } },
      { code: "RNDZ-OK", text: { en: "Co-elliptic rendezvous with Columbia completed. Crew recovered.", vi: "Hoàn thành ghép nối đồng elip với Columbia. Phi hành đoàn an toàn." } },
    ],
  },
  "ending-3": {
    heading: { en: "STRUCTURAL FAILURE DIAGNOSTICS", vi: "CHẨN ĐOÁN HỎNG KẾT CẤU" },
    lines: [
      { code: "VX>1.22", text: { en: "Lateral velocity exceeded the 1.22 m/s landing gear limit.", vi: "Vận tốc ngang vượt giới hạn 1,22 m/s của chân đế." } },
      { code: "VZ>3.05", text: { en: "Sink rate exceeded the 3.05 m/s strut crush limit.", vi: "Tốc độ chìm vượt giới hạn 3,05 m/s của chân đế." } },
      { code: "TILT>12", text: { en: "Surface tilt beyond the 12° tip-over limit; starboard strut sheared.", vi: "Độ nghiêng bề mặt vượt giới hạn lật 12°; chân đế mạn phải gãy." } },
      { code: "APS-DEAD", text: { en: "Ascent engine nozzle crushed. No return propulsion available.", vi: "Loa phụt động cơ bay lên bị bẹp. Không còn lực đẩy quay về." } },
    ],
  },
  "ending-4": {
    heading: { en: "BINGO FUEL DIAGNOSTICS", vi: "CHẨN ĐOÁN BINGO FUEL" },
    lines: [
      { code: "BINGO", text: { en: "Hover margin reached 0 s while searching for terrain past West Crater.", vi: "Dự trữ lơ lửng về 0 giây khi tìm bãi đáp vượt qua West Crater." } },
      { code: "ABORT-40", text: { en: "Abort Stage commanded at 40 ft AGL, 2 s before propellant exhaustion.", vi: "Abort Stage ở độ cao 12 m, 2 giây trước khi cạn nhiên liệu." } },
      { code: "RNDZ-4H", text: { en: "Collins rendezvoused with Eagle about 4 hours later.", vi: "Collins ghép nối với Eagle khoảng 4 giờ sau đó." } },
    ],
  },
  "ending-5": {
    heading: { en: "LAUNCH VEHICLE LOSS DIAGNOSTICS", vi: "CHẨN ĐOÁN MẤT TÊN LỬA" },
    lines: [
      { code: "WIND>40", text: { en: "Launched into surface winds above 40 km/h; Max-Q shear exceeded gimbal margin.", vi: "Phóng khi gió mặt đất trên 40 km/h; lực cắt Max-Q vượt biên độ gimbal." } },
      { code: "QMAX", text: { en: "34.3 kPa dynamic pressure at Mach 1.7, 13.4 km altitude.", vi: "Áp suất động 34,3 kPa ở Mach 1,7, độ cao 13,4 km." } },
      { code: "S-IC-1", text: { en: "Cryogenic pressure loss on S-IC engine 1; interstage skirt failure.", vi: "Mất áp suất đông lạnh động cơ S-IC số 1; hỏng vành nối tầng." } },
      { code: "LOV", text: { en: "Loss of vehicle. Telemetry archived for accident review.", vi: "Mất tên lửa. Dữ liệu viễn trắc được lưu để điều tra." } },
    ],
  },
};

const STYLES = `
@keyframes es-rise { from { transform: translateY(0); } to { transform: translateY(-90px); } }
@keyframes es-fall { from { transform: translateY(0); } to { transform: translateY(70px); } }
@keyframes es-flicker { 0%,100% { opacity: .95; } 50% { opacity: .55; } }
@keyframes es-spin { to { transform: rotate(360deg); } }
@keyframes es-debris { from { transform: translate(0,0) rotate(0); opacity: 1; } to { transform: translate(var(--dx), var(--dy)) rotate(var(--dr)); opacity: .15; } }
@keyframes es-dust { from { transform: scale(.4); opacity: .8; } to { transform: scale(1.6); opacity: 0; } }
@keyframes es-twinkle { 0%,100% { opacity: .3; } 50% { opacity: 1; } }
.es-origin { transform-box: fill-box; transform-origin: center; }
`;

const GROUND = "#2a3547";
const GROUND_LIGHT = "#3c4a62";
const HULL = "#d8c27a";
const HULL_DARK = "#8f7b3d";
const FLAME = "#ffb03a";
const FLAME_HOT = "#fff1b0";

function Stars() {
  const pts = [
    [20, 18], [64, 52], [112, 12], [150, 70], [198, 30], [244, 60], [288, 16], [330, 44], [372, 22], [410, 66],
    [452, 14], [496, 50], [540, 28], [584, 62], [40, 96], [180, 110], [320, 98], [470, 104], [560, 96],
  ];
  return (
    <g fill="#e8ecf4">
      {pts.map(([x, y], i) => (
        <rect
          key={i}
          x={x}
          y={y}
          width={i % 4 === 0 ? 2 : 1}
          height={i % 4 === 0 ? 2 : 1}
          style={{ animation: `es-twinkle ${2 + (i % 5)}s ease-in-out ${(i % 7) * 0.3}s infinite` }}
        />
      ))}
    </g>
  );
}

/** The Moon photo, faded at the rim so its black backdrop vanishes against the night sky. */
function Earth({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const id = `moon-fade-${cx}-${cy}`;
  const d = r * 2.9;
  return (
    <g style={{ mixBlendMode: "screen" }}>
      <defs>
        <radialGradient id={id}>
          <stop offset="58%" stopColor="#fff" />
          <stop offset="72%" stopColor="#000" />
        </radialGradient>
        <mask id={`${id}-m`}>
          <circle cx={cx} cy={cy} r={d / 2} fill={`url(#${id})`} />
        </mask>
      </defs>
      <image href="/assets/env/moon.jpg" x={cx - d / 2} y={cy - d / 2} width={d} height={d} mask={`url(#${id}-m)`} />
    </g>
  );
}

/** Lunar Module stack: descent stage + ascent stage. `tilt` rotates the whole craft. */
function Eagle({ x, y, tilt = 0, ascentOnly = false }: { x: number; y: number; tilt?: number; ascentOnly?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${tilt})`}>
      {!ascentOnly && (
        <g>
          <polygon points="-26,0 26,0 20,-18 -20,-18" fill="#b9962f" />
          <line x1={-24} y1={0} x2={-44} y2={20} stroke={HULL_DARK} strokeWidth={3} />
          <line x1={24} y1={0} x2={44} y2={20} stroke={HULL_DARK} strokeWidth={3} />
          <rect x={-50} y={19} width={12} height={3} fill={HULL_DARK} />
          <rect x={38} y={19} width={12} height={3} fill={HULL_DARK} />
        </g>
      )}
      <g transform={`translate(0 ${ascentOnly ? 0 : -18})`}>
        <polygon points="-16,0 16,0 14,-22 6,-30 -6,-30 -14,-22" fill={HULL} />
        <rect x={-6} y={-24} width={12} height={7} fill="#1a2233" />
      </g>
    </g>
  );
}

/** One short exhaust plume under a point. */
function Plume({ x, y, h = 26 }: { x: number; y: number; h?: number }) {
  return (
    <g style={{ animation: "es-flicker .18s linear infinite" }}>
      <polygon points={`${x - 7},${y} ${x + 7},${y} ${x},${y + h}`} fill={FLAME} />
      <polygon points={`${x - 3},${y} ${x + 3},${y} ${x},${y + h * 0.55}`} fill={FLAME_HOT} />
    </g>
  );
}

function Scene1() {
  return (
    <>
      <Stars />
      <Earth cx={470} cy={52} r={26} />
      <path d="M0 150 L0 126 Q120 118 220 130 T420 124 T600 132 L600 180 L0 180Z" fill={GROUND} />
      <path d="M0 150 Q150 142 300 150 T600 148 L600 180 L0 180Z" fill={GROUND_LIGHT} />
      <ellipse cx={120} cy={164} rx={34} ry={6} fill="#1c2535" />
      <ellipse cx={470} cy={160} rx={22} ry={4} fill="#1c2535" />
      <Eagle x={290} y={136} />
      {/* US flag */}
      <g transform="translate(365 148)">
        <rect x={0} y={-52} width={2} height={54} fill="#cfd5e0" />
        <rect x={2} y={-52} width={30} height={20} fill="#f2f2f2" />
        <rect x={2} y={-52} width={13} height={10} fill="#2d4a8a" />
        <rect x={15} y={-48} width={17} height={2} fill="#c0392b" />
        <rect x={15} y={-42} width={17} height={2} fill="#c0392b" />
        <rect x={2} y={-36} width={30} height={2} fill="#c0392b" />
      </g>
      {/* Footprints */}
      <g fill="#1c2535">
        <rect x={236} y={158} width={6} height={3} />
        <rect x={222} y={162} width={6} height={3} />
        <rect x={208} y={158} width={6} height={3} />
      </g>
    </>
  );
}

function Scene2() {
  return (
    <>
      <Stars />
      {/* Moon limb */}
      <ellipse cx={300} cy={330} rx={420} ry={190} fill={GROUND} />
      <ellipse cx={300} cy={334} rx={420} ry={190} fill="none" stroke={GROUND_LIGHT} strokeWidth={2} />
      {/* Orbit track with Columbia */}
      <ellipse cx={300} cy={118} rx={210} ry={26} fill="none" stroke="#6f86a8" strokeDasharray="4 5" />
      <g transform="translate(468 108)">
        <rect x={-10} y={-5} width={20} height={10} fill="#cfd5e0" />
        <polygon points="10,-5 10,5 20,0" fill="#9aa6bc" />
      </g>
      {/* Ascent stage climbing */}
      <g className="es-origin" style={{ animation: "es-rise 6s ease-in-out infinite alternate" }}>
        <Eagle x={260} y={130} ascentOnly />
        <Plume x={260} y={130} h={30} />
      </g>
      {/* Discarded descent stage */}
      <g style={{ animation: "es-fall 6s ease-in infinite alternate" }}>
        <g transform="translate(340 96)">
          <polygon points="-26,0 26,0 20,-18 -20,-18" fill="#b9962f" opacity={0.85} />
          <line x1={-24} y1={0} x2={-40} y2={16} stroke={HULL_DARK} strokeWidth={3} />
          <line x1={24} y1={0} x2={40} y2={16} stroke={HULL_DARK} strokeWidth={3} />
        </g>
      </g>
    </>
  );
}

function Scene3() {
  return (
    <>
      <Stars />
      <Earth cx={500} cy={46} r={22} />
      {/* Boulder slope */}
      <path d="M0 140 L0 116 L150 126 L260 150 L420 140 L600 150 L600 180 L0 180Z" fill={GROUND} />
      <polygon points="60,160 96,128 130,160" fill={GROUND_LIGHT} />
      <polygon points="430,160 470,122 520,160" fill={GROUND_LIGHT} />
      <polygon points="330,164 352,140 380,164" fill="#4a5a76" />
      {/* Tipped Eagle on its side */}
      <Eagle x={250} y={142} tilt={-72} />
      {/* Sheared strut */}
      <g transform="translate(300 156) rotate(25)">
        <rect x={0} y={0} width={30} height={3} fill={HULL_DARK} />
      </g>
      {/* Venting + sparks */}
      <g fill="#cfd5e0" opacity={0.7}>
        <circle className="es-origin" cx={222} cy={104} r={6} style={{ animation: "es-dust 3s ease-out infinite" }} />
        <circle className="es-origin" cx={232} cy={96} r={5} style={{ animation: "es-dust 3s ease-out 1s infinite" }} />
      </g>
      {/* Memorial star */}
      <g>
        <rect x={458} y={78} width={2} height={14} fill="#f6d36b" />
        <rect x={452} y={84} width={14} height={2} fill="#f6d36b" />
      </g>
    </>
  );
}

function Scene4() {
  return (
    <>
      <Stars />
      <Earth cx={80} cy={50} r={22} />
      <path d="M0 150 L0 132 L180 140 L300 128 L460 142 L600 134 L600 180 L0 180Z" fill={GROUND} />
      <polygon points="410,150 470,118 560,150" fill={GROUND_LIGHT} />
      {/* Blown dust ring */}
      <g fill="#8b97ac" opacity={0.6}>
        <ellipse className="es-origin" cx={250} cy={156} rx={50} ry={6} style={{ animation: "es-dust 2.4s ease-out infinite" }} />
        <ellipse className="es-origin" cx={250} cy={156} rx={50} ry={6} style={{ animation: "es-dust 2.4s ease-out 1.2s infinite" }} />
      </g>
      {/* Spent descent stage left behind */}
      <g transform="translate(250 154)">
        <polygon points="-26,0 26,0 20,-14 -20,-14" fill="#b9962f" opacity={0.8} />
      </g>
      {/* Ascent stage lifting off */}
      <g style={{ animation: "es-rise 4s ease-in infinite alternate" }}>
        <Eagle x={250} y={120} ascentOnly />
        <Plume x={250} y={120} h={34} />
      </g>
      {/* Empty fuel gauge */}
      <g transform="translate(500 16)">
        <rect x={0} y={0} width={70} height={14} fill="none" stroke="#e8ecf4" />
        <rect x={2} y={2} width={3} height={10} fill="#e0524a" />
        <text x={0} y={28} fontSize={9} fill="#e0524a" fontFamily="monospace">BINGO 0.0s</text>
      </g>
    </>
  );
}

function Scene5() {
  const debris: { x: number; y: number; dx: number; dy: number; dr: number; w: number; h: number }[] = [
    { x: 290, y: 70, dx: -120, dy: 70, dr: 220, w: 16, h: 6 },
    { x: 300, y: 80, dx: 130, dy: 60, dr: -180, w: 12, h: 8 },
    { x: 296, y: 60, dx: -60, dy: 100, dr: 340, w: 10, h: 10 },
    { x: 306, y: 66, dx: 90, dy: 105, dr: -260, w: 14, h: 5 },
    { x: 292, y: 90, dx: -170, dy: 40, dr: 120, w: 8, h: 8 },
    { x: 304, y: 88, dx: 170, dy: 30, dr: -90, w: 9, h: 6 },
  ];
  return (
    <>
      <Stars />
      <path d="M0 160 L0 150 Q150 142 300 152 T600 148 L600 180 L0 180Z" fill="#1d2a22" />
      {/* Smoke column & fireball */}
      <g fill="#9aa6bc" opacity={0.5}>
        <rect x={270} y={110} width={14} height={50} />
        <rect x={286} y={120} width={12} height={40} />
      </g>
      <circle className="es-origin" cx={298} cy={74} r={34} fill={FLAME} opacity={0.55} style={{ animation: "es-dust 2.6s ease-out infinite" }} />
      <circle className="es-origin" cx={298} cy={74} r={20} fill={FLAME_HOT} style={{ animation: "es-flicker .3s linear infinite" }} />
      {debris.map((d, i) => (
        <rect
          key={i}
          className="es-origin"
          x={d.x}
          y={d.y}
          width={d.w}
          height={d.h}
          fill={i % 2 ? HULL : "#cfd5e0"}
          style={
            {
              "--dx": `${d.dx}px`,
              "--dy": `${d.dy}px`,
              "--dr": `${d.dr}deg`,
              animation: `es-debris 3.2s ease-out ${i * 0.1}s infinite`,
            } as React.CSSProperties
          }
        />
      ))}
      {/* Wind streaks */}
      <g stroke="#6f86a8" strokeWidth={1.5} opacity={0.6}>
        <line x1={20} y1={40} x2={90} y2={40} />
        <line x1={50} y1={60} x2={140} y2={60} />
        <line x1={480} y1={30} x2={570} y2={30} />
        <line x1={510} y1={52} x2={590} y2={52} />
      </g>
    </>
  );
}

const SCENES: Record<EndingKey, () => ReactNode> = {
  "ending-1": Scene1,
  "ending-2": Scene2,
  "ending-3": Scene3,
  "ending-4": Scene4,
  "ending-5": Scene5,
};

/**
 * Dedicated, animated vignette for each of the five endings, drawn as inline SVG so it
 * needs no external art. The text version of the scene is exposed through role="img".
 */
export function EndingScene({ ending }: { ending: EndingDefinition }) {
  const localize = useLocalized();
  const key = ending.normalizedId;
  const Scene = SCENES[key];
  const caption = localize(SCENE_CAPTION[key]);

  return (
    <figure className="w-full" data-ending-scene={key}>
      <style>{STYLES}</style>
      {/* The broadcast on a television set, with the three of them watching it from the sofa. */}
      <div className="mx-auto w-full max-w-xl rounded-2xl border-[6px] border-[#2b2f3a] bg-[#14161d] p-2 shadow-[0_0_40px_rgb(120_160_255/0.25)]">
        <div className="overflow-hidden rounded-lg border border-black/70">
          <svg viewBox="0 0 600 180" role="img" aria-label={caption} className="block h-auto w-full" preserveAspectRatio="xMidYMid slice">
            <rect width={600} height={180} fill="#070b16" />
            <Scene />
          </svg>
        </div>
      </div>
      <div className="mx-auto h-2 w-24 rounded-b bg-[#2b2f3a]" aria-hidden />
      <div className="relative z-[1] mx-auto -mb-1 mt-2 flex max-w-md items-end justify-center gap-2 sm:gap-4" aria-hidden>
        {[
          ["orange", 447 / 600],
          ["navy", 550 / 600],
          ["pink", 505 / 600],
        ].map(([name, aspect]) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={name as string} src={`/assets/characters/viewers/${name}.webp`} alt="" draggable={false} className="h-20 w-auto select-none sm:h-28" style={{ aspectRatio: String(aspect) }} />
        ))}
      </div>
      <figcaption className="mt-1 px-3 py-1.5 text-center font-mono text-[11px] text-foreground/65">{caption}</figcaption>
    </figure>
  );
}

/** Failure / anomaly diagnostics list. Renders nothing for the nominal ending. */
export function EndingDiagnostics({ ending }: { ending: EndingDefinition }) {
  const localize = useLocalized();
  const diag = DIAGNOSTICS[ending.normalizedId];
  if (!diag) return null;

  return (
    <div className="bezel w-full bg-space-deep/90 p-4 text-left sm:p-5" data-ending-diagnostics={ending.normalizedId}>
      <h2 className="mb-3 font-mono text-sm uppercase tracking-wider text-primary">{localize(diag.heading)}</h2>
      {ending.failureReason && (
        <p className="mb-2 font-mono text-xs text-red-300">{ending.failureReason}</p>
      )}
      <ul className="flex flex-col gap-1.5 text-xs">
        {diag.lines.map((l) => (
          <li
            key={l.code}
            className="flex items-start gap-3 rounded border border-space-blue/50 bg-space-blue/30 px-3 py-1.5"
          >
            <span className="shrink-0 font-mono font-semibold text-amber-300">{l.code}</span>
            <span className="text-foreground/85">{localize(l.text)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
