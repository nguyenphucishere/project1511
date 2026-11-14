# Cảnh "ba phi hành gia nhìn nhau": ảnh khung + prompt

Khung hình dựng sẵn từ game (`/dev/crew?mood=...`) nằm trong `frames/` (1920x1080, 16:9). Ba người ngồi
đúng vị trí Apollo 11: **Armstrong bên trái, Collins ở giữa, Aldrin bên phải**, đội mũ, kính che mặt.

Quy trình: ảnh khối → ChatGPT (làm thành ảnh điện ảnh, giữ nguyên bố cục) → Seedance (ảnh thành video).

## Thời lượng

| Tình huống | Ảnh khối | Thời lượng video | Ghi chú |
|---|---|---|---|
| Max Q (gãy kết cấu) | `structural-blockout.png` | **6 s** | kết thúc bằng loé trắng để nối sang cảnh nổ |
| Cạn nhiên liệu | `fuel-depleted-blockout.png` | **8 s** | cảnh lặng, nhịp chậm nhất |
| Quá nặng | `slow-climb-blockout.png` | **6 s** | |
| Gió cắt | `wind-shear-blockout.png` | **5 s** | camera nghiêng, rung mạnh |
| Sét | `lightning-blockout.png` | **5 s** | kết thúc bằng loé trắng rồi tối |

Nếu Seedance chỉ cho 5 s hoặc 10 s: chọn **5 s** cho cả năm cái (game sẽ nối bằng cắt cảnh, không cần đúng giây).
Cài đặt: tỉ lệ **16:9**, **1080p** (720p cũng được), **tắt âm thanh** (game tự lồng tiếng tim đập, báo động,
thở và thoại), camera **gần như cố định, chỉ đẩy nhẹ vào**.

## Bước 1: ChatGPT, từ ảnh khối thành ảnh điện ảnh

Gửi ảnh khối kèm prompt chung này (đổi dòng `MOOD` theo từng tình huống ở dưới):

```
Turn this 3D blockout into a photoreal cinematic still. KEEP THE EXACT COMPOSITION: three astronauts in
a row inside a 1960s Apollo command module, seen from the instrument panel, shoulders and helmets only.
Left: the commander, centre: the command module pilot, right: the lunar module pilot. Their helmets are
turned slightly toward each other. Authentic Apollo A7L white pressure suits with orange hoses and
chest connectors, round fishbowl helmets with gold-tinted reflective visors; faces are only faintly
visible behind the glass (dim eyes, no clear facial features). The visors reflect the cabin lights.
Cramped metal cabin, toggle switches, wires, worn paint, a small round hatch window behind them.
Shot on 35mm anamorphic, shallow depth of field, film grain, 16:9, no text, no logos, no watermark.
MOOD: <see below>
```

**MOOD, theo tình huống:**

- Max Q: `Emergency. Red alarm lights flooding the cabin, harsh red reflections on the visors, orange glow of fire through the window, tension, the crew exchanging frightened glances.`
- Cạn nhiên liệu: `Eerie silence. Cold blue moonlit tones, only a few amber warning lights, Earth's curve glowing through the window, stillness, the crew looking at each other in quiet dread.`
- Quá nặng: `Struggling ascent. Amber warning lights, low sunset-orange light through the window, a sense of strain and dread, the crew looking at each other with growing alarm.`
- Gió cắt: `The capsule is violently tilted (about 12 degree dutch angle), cold white-blue light, red caution lights flickering, loose dust and small objects floating, panic.`
- Sét: `Blinding white lightning flash through the window overexposing everything, hard shadows, red warning lights, silhouettes of helmets, shock.`

Kiểm tra ảnh trước khi sang Seedance: vẫn thấy rõ ba mũ theo đúng thứ tự trái giữa phải, kính che mặt tối,
bố cục khung 16:9. Nếu ChatGPT lộ mặt rõ ràng thì nhắc lại "faces hidden behind dark reflective visors".

## Bước 2: Seedance, dùng ảnh ở bước 1 làm khung đầu (image to video)

Prompt chung đầu mọi prompt: `Locked-off camera with a very slow push-in. Keep the three astronauts' positions and suits identical. No text, no subtitles, no music.`

### Max Q, 6 s

```
Locked-off camera, very slow push-in. 0-2s: the cabin shakes with growing vibration, red alarm lights
pulse across the visors, the astronauts' helmets turn slowly to look at each other. 2-4s: violent
shaking, sparks and dust fly, the commander's helmet turns to the pilot beside him, a long frightened
glance, visors reflecting flashing red light. 4-5.5s: panels flicker and fail, orange fire glow floods the
window, everything shakes harder. 5.5-6s: blinding white flash fills the frame.
```

### Cạn nhiên liệu, 8 s

```
Locked-off camera, extremely slow push-in. 0-2s: the violent shaking stops abruptly, sudden silence,
dust and a loose glove begin to float in the cabin, the red lights go out one by one leaving a few
amber ones. 2-5s: the three helmets turn slowly toward each other, each pausing on the next, soft cold
blue light on the visors, tiny breath fog appears and fades inside the glass. 5-8s: the commander's
helmet holds still looking at the others, the amber lights dim, the Earth's glow through the window
tilts slowly as the capsule begins to fall, then the frame fades to black.
```

### Quá nặng, 6 s

```
Locked-off camera, slow push-in. 0-2s: the cabin rumbles heavily but weakly, amber lights blinking, the
astronauts check gauges, a warning light turns red. 2-4s: the helmets turn to each other, quick worried
glances, the window light shifts from orange to dark as the capsule stalls and tilts. 4-6s: the rumble
dies down, silence and a final glance between the commander and the pilot, a small floating object
drifts upward as gravity fades, then cut to black.
```

### Gió cắt, 5 s

```
Camera held at a 12 degree dutch angle, subtle handheld shake. 0-1.5s: the whole cabin lurches
sideways, dust and loose straps swing, caution lights flicker red. 1.5-3.5s: violent side to side
shaking, the helmets are thrown and then turn toward each other, visors reflecting flashing red and cold
white light. 3.5-5s: a huge jolt, the lights cut out for a moment, the faint outlines of helmets in
darkness, then a hard cut.
```

### Sét, 5 s

```
Locked-off camera. 0-1s: dim cabin, red warning lights, the helmets turn slowly toward each other.
1-1.4s: a blinding white lightning flash through the window overexposes the frame, the helmets become
black silhouettes. 1.4-3s: every light dies, near total darkness, only the faint outline of visors,
a spark crawls across a panel. 3-4.5s: emergency lights flicker back on in red, the astronauts look at
each other in shock. 4.5-5s: a second blinding white flash fills the frame.
```

## Đặt file vào game

Xuất video mp4 (H.264, 1080p, tắt âm), đặt tên theo tình huống, bỏ vào `apps/web/public/assets/video/failure/`:

```
structural.mp4   fuel-depleted.mp4   slow-climb.mp4   wind-shear.mp4   lightning.mp4
```

Việc gắn video vào game (chuyển cảnh sang video ở khoảnh khắc nhìn nhau, trước cú nổ, có phương án dự phòng nếu chưa có file) sẽ làm sau khi có video.
