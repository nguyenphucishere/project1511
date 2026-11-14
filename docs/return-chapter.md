# Chương 7 "Trở về Trái Đất": phân tích kịch bản và đề xuất

Tài liệu này đánh giá chương trở về hiện có, kiểm tra nó với số liệu thật của Apollo 11, rồi đề xuất cách làm cho nó **hay hơn** và **chính xác hơn**. Phần cuối nói rõ đã làm gì trong code và việc nào cần bạn quyết định trước.

Chú thích độ tin cậy dùng xuyên suốt:
- ✅ đã đối chiếu với nguồn của NASA hoặc tài liệu của chính dự án (liệt kê ở mục 9);
- ⚠️ nguồn chưa thống nhất, hoặc mình nhớ nhưng chưa tìm được nguồn: **cần kiểm lại trước khi đưa lên màn hình hay giọng đọc**;
- ❌ đang sai so với lịch sử.

---

## 1. Tóm tắt

1. Chương này hiện là **một đoạn phim 32 giây chỉ để xem**: đốt về nhà, vào khí quyển, dù, hạ cánh. Người chơi không làm gì, và nó nằm sau một màn "cắm cờ" rất hoành tráng.
2. **Nó đang dùng số liệu của Apollo 8, không phải Apollo 11**: đồng hồ nhiệm vụ chạy từ 89:15 tới 147:00 (Apollo 8), trong khi Apollo 11 đốt về nhà ở 135:23:42 và hạ cánh ở 195:18:35. Mục này **đã sửa trong code**.
3. **Thiếu đúng đoạn nguy hiểm nhất của chuyến về**: cất cánh khỏi Mặt Trăng (động cơ không có dự phòng), hẹn gặp trên quỹ đạo, ghép nối với Columbia. Chính văn bản kết thúc số 1 của game đã hứa điều này ("chuẩn bị cho chuyến bay lên kết nối với Collins").
4. **Thiếu hẳn nửa sau cảm xúc**: biển, thợ lặn, tàu Hornet, bộ đồ cách ly, cửa sổ xe cách ly, 21 ngày cách ly.
5. **Michael Collins vắng mặt** trong cả chương, dù câu chuyện của ông (một mình phía sau Mặt Trăng) là chất liệu kịch tốt nhất của chuyến về.
6. Một con số đang được **đọc thành tiếng** là hơi lệch: phụ đề "bốn phút mất liên lạc" (thực tế khoảng 3,5 phút).

Đề xuất: mở rộng từ 32 giây thành khoảng 5 phút gồm 8 nhịp, trong đó 2–3 nhịp có người chơi tham gia (mục 5). Chi phí tập trung ở **lời thoại mới (khoảng 28 câu, tầm 2.300 ký tự mỗi ngôn ngữ)** và hai cảnh mới (cất cánh và hẹn gặp).

---

## 2. Hiện trạng (đã đọc code)

| Phần | Nội dung | Nơi trong code |
|---|---|---|
| Luồng | `epilogue` (2 câu) → `return-briefing` (2 câu) → `return-scene` → `end` | `game/flow.ts` |
| Briefing | "Cờ đã cắm, mẫu đã cất. Đến lúc về nhà." / "Động cơ phải nổ thêm một lần nữa, sau lưng Mặt Trăng… Nếu nó hỏng, sẽ không ai tới đón." Mục tiêu duy nhất: "Bay về nhà". | `game/script.ts` |
| Phim | `ReturnScene` = phần phim từ giây 140 đến 172 (32 s): đốt TEI (140–150), vào khí quyển và plasma (150–158), dù và biển (158–172). Có nút Skip. | `scenes/translunar/` |
| Giọng đọc | Ba phụ đề giai đoạn ("Đốt về nhà", "Vào khí quyển: bốn phút mất liên lạc", "Hạ xuống Thái Bình Dương") do người dẫn chuyện đọc, và đoạn chốt "Welcome home" | `story.ts`, `translunar.returnDoneBody` |
| Kết thúc | Hộp thoại "Welcome home" rồi sang màn kết thúc (ending 1: "Căn cứ Yên Bình") | `TranslunarScene.tsx`, `game/endings.ts` |

Điểm tốt đã có: câu "Nếu nó hỏng, sẽ không ai tới đón" là một câu mở rất đúng tinh thần (động cơ TEI là một điểm hỏng duy nhất ✅); hiệu ứng plasma, dù và cảnh biển đã có mô hình 3D.

---

## 3. Kiểm tra độ chính xác

| # | Chi tiết | Game | Thực tế Apollo 11 | Kết luận |
|---|---|---|---|---|
| 1 | Đồng hồ nhiệm vụ lúc về | 89:15 → 146:40 → 147:00 | TEI **135:23:42**, hạ cánh **195:18:35** | ❌ (số của Apollo 8) → **đã sửa** |
| 2 | Cất cánh khỏi Mặt Trăng | không có | Eagle cất cánh **124:22**, động cơ chạy **435 s**, vào quỹ đạo khoảng 11 × 55 dặm | ❌ thiếu |
| 3 | Hẹn gặp, ghép nối | không có | Ghép với Columbia ở vòng quay thứ 27, **128:03:00** | ❌ thiếu |
| 4 | Thả Eagle | không có | Phi hành đoàn chuyển mẫu và thiết bị, rồi bỏ lại tầng cất cánh (thời điểm chính xác ⚠️) | ❌ thiếu |
| 5 | Đốt TEI | sau lưng Mặt Trăng, "nếu hỏng không ai tới đón" | Đốt ở 135:23:42, kéo dài khoảng **151 s**, Δv ≈ **1.000 m/s** (3.279 ft/s) | ✅ đúng tinh thần; **đã thêm số liệu** |
| 6 | Mất liên lạc khi vào khí quyển | "bốn phút" (đang được đọc thành tiếng) | **195:03:25 → 195:06:56**, tức khoảng **3,5 phút** | ⚠️ nên là "ba phút rưỡi" (phải ghi âm lại) |
| 7 | Vào khí quyển | chỉ hình | Chạm khí quyển ở 400.000 ft (**121,9 km**), **36.194 ft/s** (11,03 km/s), góc −6,5°. Tải đỉnh dự kiến 6,1 g, tái dựng sau chuyến bay khoảng 6,7 g; đỉnh thứ hai khoảng 6 g ở 12.390 ft/s | ✅ **đã thêm bảng số liệu** (đỉnh hiển thị ≈6,5 g) |
| 8 | Dù | chỉ hình | Dù hãm **195:12:04**, dù chính **195:12:52** (bản ghi NASA). Độ cao mở dù hãm: các nguồn mâu thuẫn (khoảng 24–25 nghìn ft so với khoảng 16 nghìn ft) | ✅ giờ; ⚠️ độ cao (game hiển thị tròn 7 km và 3 km) |
| 9 | Hạ cánh | "biển lặng, trời rộng" | **195:18:35** (16:50:35 UTC), mục tiêu 13°19′N 169°10′W, cách tàu Hornet khoảng **13 hải lý (24 km)** (nguồn lệch 12–15). Khoang **rơi úp** (Stable 2, đỉnh xuống) rồi được **bóng hơi lật lại** sau vài phút (5–8 phút tuỳ nguồn) | ✅; ⚠️ khoảng cách và thời gian lật |
| 10 | Sau hạ cánh | không có | Thợ lặn, phao nổi, bộ đồ cách ly (BIG), xe cách ly di động (Airstream) trên tàu Hornet, cách ly khoảng 3 tuần (21 ngày, mốc tính khác nhau giữa các nguồn) | ❌ thiếu; ⚠️ mốc tính 21 ngày |
| 11 | Collins | không có | Một mình trên quỹ đạo khoảng 28 giờ (từ lúc Eagle tách tới lúc ghép lại, ⚠️ giờ tách ≈100:12 nhớ chứ chưa tìm được nguồn). Mỗi vòng, khoảng 45–47 phút mất liên lạc phía sau Mặt Trăng ✅ (catalog của dự án) | ❌ thiếu |
| 12 | Phần đi (ngoài phạm vi chương này) | phụ đề "Christmas Eve, 1968" và đoạn đọc Sáng thế ký | Đó là Apollo 8. Apollo 11 diễn ra tháng 7 năm 1969 | ⚠️ lẫn hai chuyến bay: nên đổi hoặc chú thích |
| 13 | Tổng thời gian | — | **8,14 ngày**; trên bề mặt 21 giờ 36 phút, một lần đi bộ 2 giờ 31 phút ✅ (catalog của dự án) | dùng cho thẻ cuối |

Ngoài ra, hai chi tiết "có thật nhưng mình chưa kiểm được nguồn": lá cờ bị khí thải động cơ cất cánh thổi đổ (theo lời Aldrin) ⚠️, và câu Nixon nói ở cửa sổ xe cách ly (⚠️ **đừng trích dẫn** cho tới khi có nguồn: một câu thường được trích dẫn về "tuần lễ vĩ đại nhất kể từ Sáng thế" mình tìm không ra nguồn).

---

## 4. Phân tích kịch bản và nhịp

**Điểm mạnh**
- Một câu mở tốt (động cơ nổ khi không ai nghe thấy). Nó lập tức đặt người chơi vào trạng thái "một lần duy nhất".
- Cấu trúc ba cảnh (đốt, plasma, biển) có hình ảnh và nhịp rõ ràng.

**Vấn đề**
1. **Bị động.** Cả chương không có quyết định hay thao tác nào, trong khi các chương trước (hạ cánh thủ công, các quyết định) đã dạy người chơi rằng mình có thể ảnh hưởng.
2. **Nhảy cóc.** Từ "cắm cờ" thẳng tới "đốt về nhà" bỏ qua lần cất cánh: lần duy nhất trong cả sứ mệnh mà **động cơ cất cánh không có dự phòng**. Game còn có sẵn "bản nháp thảm họa" của Safire (ending 2 và trang debrief) để làm đối trọng: nó là lý do khiến lần cất cánh có sức nặng.
3. **Thiếu một nhân vật.** Collins là người duy nhất không được ở trong khung hình, dù ông phải chờ trong im lặng và là người mở cửa đón hai bạn.
4. **Kết thúc hụt hơi.** Sau 32 giây là một hộp thoại. Không có nghi thức trở về (thợ lặn, Hornet, cửa sổ xe cách ly) và cũng không có "cái giá" nào được nhắc tới (cách ly 21 ngày).
5. **Số liệu bị đọc sai và đồng hồ sai** (mục 3).

---

## 5. Cấu trúc đề xuất: 8 nhịp, khoảng 5 phút

| Nhịp | Thời lượng | POV | Nội dung | Người chơi làm gì | Số liệu thật (✅/⚠️) |
|---|---|---|---|---|---|
| 0. Tranquility Base, lần cuối | 45 s | Armstrong | Danh sách kiểm tra cuối. Cất cánh: tầng đáp bị bỏ lại làm bệ phóng. Lá cờ đổ (⚠️ theo Aldrin). | Bấm đúng lúc để **kích hoạt động cơ cất cánh** (một điểm hỏng duy nhất): bấm trong cửa sổ thời gian thì thành công, còn trượt kích hoạt nhánh kết thúc (xem 5.1). | Cất cánh 124:22; động cơ 435 s; quỹ đạo ≈ 11 × 55 dặm ✅ |
| 1. Hẹn gặp trên quỹ đạo | 60 s | **Collins** | Collins một mình phía sau Mặt Trăng, 45–47 phút im lặng mỗi vòng. Eagle xuất hiện như một đốm sáng. | Căn chỉnh và ghép nối (tái dùng toán học trong `docking.ts`, hoặc chế độ "dẫn tay" đơn giản). | Ghép 128:03:00 ✅ |
| 2. Mẫu vật và cánh cửa | 20 s | Cả ba | Chuyển 21,55 kg mẫu qua cửa hầm; bỏ Eagle lại. Câu "Tạm biệt, Eagle." | — | 21,55 kg ✅ (catalog) |
| 3. Sau lưng Mặt Trăng | 25 s | Armstrong/Collins | Đốt TEI. Giữ câu hiện có "Nếu nó hỏng…". Khi tàu ló ra, Houston gọi lại. | Xác nhận lệnh đốt. | 135:23:42; 151 s; ≈1.000 m/s ✅ |
| 4. Hai ngày rưỡi | 15 s | Collins | Dựng đoạn gấp: Trái Đất lớn dần từ đồng xu thành chiếc đĩa; hiệu chỉnh giữa chặng; chương trình truyền hình từ tàu. | — | Chặng về ≈ 59:55 ✅ |
| 5. Hành lang vào khí quyển | 30 s + 3,5 phút nén | Armstrong | Góc vào −6,5°: quá dốc thì tải g vọt lên, quá nông thì khoang nảy khỏi khí quyển. Lái bằng nghiêng khoang để giữ tải g trong khoảng an toàn (dùng lại cần điều khiển đã làm cho màn hạ cánh). Mất liên lạc: cắt về phòng điều khiển im lặng, Houston chờ. | **Giữ tải g** trong dải (có thể là chế độ tuỳ chọn, mặc định phim). | EI 121,9 km; 11,03 km/s; −6,5°; mất liên lạc 195:03:25 → 195:06:56 ✅ |
| 6. Dù và biển | 30 s | Armstrong | Dù hãm, dù chính, chạm biển, khoang úp, bóng hơi lật lại. | — | 195:12:04, 195:12:52, 195:18:35 ✅; ⚠️ khoảng cách Hornet |
| 7. Về nhà | 45 s | Nhiều | Thợ lặn mở cửa, bộ đồ cách ly, trực thăng, Hornet; cửa sổ xe cách ly (không trích Nixon); thẻ cuối với số liệu cả chuyến. | — | 8,14 ngày; 21 giờ 36 phút trên bề mặt; ⚠️ 21 ngày cách ly |

### 5.1 Các nhánh có thể mở rộng
- **Cất cánh trượt** (nhịp 0): dùng lại bản nháp của Safire đã có trong game như lời kết, nhưng nhớ rằng đây là hư cấu dựa trên tài liệu thật ("In Event of Moon Disaster", 1969).
- **Hành lang vào khí quyển** (nhịp 5): hai kết thúc xấu (quá dốc, quá nông) theo mẫu 5 cảnh bay hỏng mới làm, với số liệu g và đồng hồ riêng.
- **Mang theo hậu quả từ chương trước**: nhiên liệu còn lại sau hạ cánh (ending 1 ghi 5,6%, dự phòng 25 s) và cấu hình phóng ở chương 3 quyết định biên an toàn của TEI. Engine đã có sẵn hàm ngân sách Δv trong `sim-core/mission_design.rs`.

---

## 6. Kịch bản đề xuất (song ngữ, mỗi câu ≤ 2,5 giây khi đọc)

> Đây là **lời thoại của game, không phải bản ghi thật** (trừ khi có chú thích). Mỗi câu ngắn để vừa với quy tắc "câu nói nằm trọn trong cảnh" đã áp dụng cho các cảnh bay hỏng. Cần ghi âm trước khi dùng (xem mục 8).

| Nhịp | Vai | Tiếng Anh | Tiếng Việt |
|---|---|---|---|
| 0 | Armstrong | Ascent engine armed. | Động cơ cất cánh đã sẵn sàng. |
| 0 | Houston | Eagle, Houston. You are go. | Eagle, Houston đây. Các bạn được phép. |
| 0 | Armstrong | Ignition. Eagle is climbing. | Đã nổ máy. Eagle đang lên. |
| 0 | Aldrin | The flag went over, Neil. | Lá cờ đổ rồi, Neil. *(⚠️ theo lời Aldrin, kiểm lại)* |
| 1 | Collins | Forty-seven minutes of silence. | Bốn mươi bảy phút im lặng. *(catalog: 45,5–47,5)* |
| 1 | Collins | Eagle, Columbia. Do you read? | Eagle, Columbia đây. Có nghe không? |
| 1 | Armstrong | Columbia, Eagle. We see you. | Columbia, Eagle đây. Chúng tôi thấy anh. |
| 1 | Collins | Easy. Come on in. | Cứ từ từ. Vào đi nào. |
| 1 | Người dẫn | Docked. | Đã ghép nối. |
| 2 | Aldrin | Samples aboard. Twenty-one kilos of Moon. | Mẫu đã lên tàu. Hai mươi mốt ký Mặt Trăng. |
| 2 | Armstrong | Goodbye, Eagle. | Tạm biệt, Eagle. |
| 3 | Houston | Columbia, you are go for TEI. | Columbia, các bạn được phép đốt về nhà. |
| 3 | Collins | See you on the other side. | Hẹn gặp ở phía bên kia. |
| 3 | Người dẫn | No backup engine. One burn. | Không có động cơ dự phòng. Chỉ một lần đốt. |
| 3 | Armstrong | Burn complete. We are going home. | Đốt xong. Chúng ta về nhà. |
| 4 | Người dẫn | Two and a half days. | Hai ngày rưỡi. |
| 4 | Collins | A small nudge. Midcourse. | Một cú hích nhỏ. Hiệu chỉnh giữa chặng. |
| 5 | Houston | Columbia, entry corridor looks good. | Columbia, hành lang vào khí quyển ổn. |
| 5 | Armstrong | Holding six and a half degrees. | Giữ góc sáu phẩy năm độ. |
| 5 | Người dẫn | Three and a half minutes of silence. | Ba phút rưỡi im lặng. |
| 5 | Houston | Apollo 11, Houston. Standing by. | Apollo 11, Houston. Đang chờ. |
| 5 | Houston | Columbia, we have you. | Columbia, chúng tôi bắt được tín hiệu rồi. |
| 6 | Người dẫn | Drogues. Mains. | Dù hãm. Dù chính. |
| 6 | Armstrong | We are upside down. Bags inflating. | Chúng tôi đang úp. Bóng hơi đang phồng. |
| 6 | Thợ lặn | Hornet, we have the spacecraft. | Hornet, chúng tôi đã tới khoang tàu. |
| 7 | Người dẫn | Twenty-one days of quarantine. | Hai mươi mốt ngày cách ly. |
| 7 | Người dẫn | Then the whole world. | Rồi cả thế giới. |

Thay thế đề xuất cho câu đang có: "Reentry: four minutes of radio blackout" → "**three and a half** minutes of radio blackout" (⚠️ cần ghi âm lại; hiện đang phát bản "bốn phút").

---

## 7. Gợi ý bổ sung để hay hơn

**Âm thanh**
- Dùng **im lặng làm công cụ**: ba phút rưỡi mất liên lạc là khoảnh khắc mạnh nhất của chuyến về. Tắt nhạc, chỉ để tiếng nhiễu radio và nhịp tim (đã có `startHeartbeat`).
- Bộ lọc radio cho giọng Houston (đã có), và **không có bộ lọc** cho giọng trong khoang để phân biệt hai thế giới.
- Một nền âm riêng cho mỗi nhịp, như đã làm với 5 cảnh bay hỏng (động cơ, nhiễu, gió).

**Hình ảnh**
- Giữ bảng số liệu và nhật ký vừa làm; thêm **vệt plasma đổi màu theo tải g**.
- Tăng dần kích thước Trái Đất trong nhịp 4 (từ đồng xu thành chiếc đĩa): ghi chú lên màn hình thay cho lời thoại.
- Thẻ cuối: một dòng thời gian cả chuyến đi (8,14 ngày) có đánh dấu những mốc người chơi đã tự tay làm.

**Cấu trúc**
- Cho Collins hai cảnh để tạo nhịp "người ở lại".
- Đừng ép tất cả vào một lượt: mỗi nhịp là một bước trong `flow.ts` để chơi lại từng đoạn (nhảy chương đã có sẵn).

**Chất lượng**
- Áp dụng cho chương này bộ kiểm thử đã dùng cho các cảnh bay hỏng: câu thoại nằm trọn trong cảnh, không chồng nhau, các nhịp khác nhau.
- Ghi nguồn cho mọi con số hiển thị (mục 9) và đánh dấu ≈ cho những số ước lượng (đã làm với "tải đỉnh").

---

## 8. Đã làm trong code lần này, và việc còn lại

**Đã làm (không cần ghi âm thêm, vì chữ mới chỉ hiện trên màn hình)**
- Đồng hồ nhiệm vụ lúc về theo Apollo 11: 135:23:42 (lúc động cơ nổ) → 195:03:25 (vào khí quyển) → 195:18:35 (chạm biển); đoạn "hai ngày rưỡi sau" nhảy trong một giây kèm dòng chữ báo. (`scenes/translunar/flight.ts`)
- **Bảng số liệu lúc vào khí quyển**: độ cao, tốc độ và tải g theo các mốc thật (đỉnh ≈6,5 g, đỉnh thứ hai ≈6 g ở 3,8 km/s).
- **Nhật ký nhiệm vụ** với mốc giờ thật (8 sự kiện: đốt TEI, vào khí quyển, mất và có lại liên lạc, dù, chạm biển). Mốc tải đỉnh đánh dấu ≈ vì là ước lượng.
- Hiển thị **lý do mất liên lạc**: "Sau lưng Mặt Trăng, động cơ nổ mà không ai nghe thấy" khi đốt TEI, và "Mất liên lạc do plasma ≈ ba phút rưỡi" khi vào khí quyển (độ dài tính từ chính đồng hồ, nên đúng 211 giây).
- Bài kiểm thử cho các mục trên (7 bài mới).

**Chưa làm, cần bạn chọn**
1. **Nhịp 0–2 (cất cánh, hẹn gặp, thả Eagle) và Collins**: cảnh mới, cần mô hình tàu cất cánh (3D), một cảnh ghép nối và lời thoại mới.
2. **Hành lang vào khí quyển có thao tác** (nhịp 5), kèm hai kết thúc xấu.
3. **Ghi âm lời thoại mới** (khoảng 28 câu × 2 ngôn ngữ, khoảng 2.300 ký tự mỗi ngôn ngữ) và ghi âm lại câu "bốn phút". Việc này dùng khoá API AIMAX của dự án, **nên cần bạn đồng ý trước**.
4. Sửa phụ đề phần đi ("Christmas Eve 1968") nếu bạn muốn nhất quán với Apollo 11.

---

## 9. Nguồn

- NASA Apollo Flight Journal, đốt TEI (135:23:42, PAD 3.283,6 ft/s, 2 phút 28 giây): <https://www.nasa.gov/history/afj/ap11fj/video/21day6-tei.html>
- NASA SP-4029, pha về Trái Đất (ngắt động cơ 135:26:13.69; 151,41 s; Δv 3.279,0 ft/s): <https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_11h_Transearth_Phase.htm>
- NASA Apollo Flight Journal, ghép nối: <https://www.nasa.gov/history/afj/ap11fj/19day6-rendezvs-dock.html> và tổng quan nhiệm vụ <https://www.nasa.gov/missions/apollo/apollo-11/apollo-11-mission-overview/>
- NASA Apollo Flight Journal, vào khí quyển (36.194 ft/s, −6,5°, mất liên lạc 195:03:25 → 195:06:56, dù 195:12:04 và 195:12:52): <https://www.nasa.gov/history/afj/ap11fj/27day9-entry.html>
- NASA Apollo Flight Journal, hạ cánh và hồi phục (195:18:35): <https://www.nasa.gov/history/afj/ap11fj/26day9-reentry.html>
- Hải quân Mỹ, báo cáo thu hồi Apollo 11 (mục tiêu 13°19′N 169°10′W, tàu Hornet): <https://history.navy.mil/research/archives/digital-exhibits-highlights/apollo-11/reports/tf-130-apollo-11.html>
- Tài liệu của dự án: `apollo_program_technical_research_simulation_telemetry_catalog.md` (thời lượng pha, mất liên lạc phía sau Mặt Trăng 45,5–47,5 phút, thời gian trên bề mặt).
- Về cách ly: Space.com <https://www.space.com/apollo-11-astronauts-quarantined-after-splashdown.html> và NASA SP-4214 <https://www.nasa.gov/wp-content/uploads/static/history/SP-4214/ch9-7.html> (mốc 21 ngày tính khác nhau giữa các nguồn).
