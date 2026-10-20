# 🚀 Magnet Junkyard: Đã Fix 6 Blockers CrazyGames

Tôi đã hoàn tất toàn bộ đợt **Audit Checklist** từ bot đánh giá và fix xong 6 blockers chí mạng cho việc phát hành trên CrazyGames.

---

## 🛠️ Chi tiết các bản vá (Fixes)

### 1. Thêm CrazyGames SDK v3 Script Tag
- Đã chèn `<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>` vào `<head>` của `index.html`.
- **Vì sao:** Nếu không có thẻ này, SDK thật sẽ không bao giờ được load, dẫn đến mọi tính năng tracking/quảng cáo bị lỗi và game sẽ luôn chạy ở mode Mock (Giả lập).

### 2. Refactor API MockCrazyGamesSDK.ts thành chuẩn v3
- Thay đổi cấu trúc Mock SDK để khớp 100% với cấu trúc của CrazyGames v3 (`sdk.game.gameplayStart()`, `sdk.ad.requestAd()`).
- **Vì sao:** Trước đó code gọi thẳng `sdk.gameplayStart()`, điều này sẽ gây crash `TypeError` ngay khi chạy trên môi trường CrazyGames thật.

### 3. Tự động Pause Game & Mute Nhạc khi có Quảng Cáo
- Cập nhật cả `requestRewardedAd` và midgame ads để gọi `ProceduralAudioService.getInstance().setMuted(true)` và `this.scene.pause()` khi quảng cáo bắt đầu, và tự động resume khi quảng cáo kết thúc (hoặc lỗi).
- **Vì sao:** CrazyGames yêu cầu tuyệt đối game phải dừng hẳn và tắt âm thanh trong lúc quảng cáo chạy.

### 4. Bắt sự kiện Focus / Blur (Tab Visibility)
- Thêm `document.addEventListener('visibilitychange')` vào `JunkyardScene`.
- Khi người chơi thu nhỏ trình duyệt hoặc chuyển sang tab khác: Game tự động mute, pause scene, và gọi `sdk.game.gameplayStop()`.

### 5. Thêm Quảng Cáo Midgame (Interstitial Ads)
- Đã thêm bộ đếm giờ ngầm (cooldown 3 phút). Cứ sau mỗi 3 phút, khi người chơi "Recycle" (Tái chế) xong một mẻ hàng lớn, hệ thống sẽ tự động gọi một quảng cáo Midgame.
- **Vì sao:** CrazyGames yêu cầu phải có midgame ads giữa các "nhịp" tự nhiên của game (chẳng hạn như khi tái chế hàng thành công).

### 6. Cập nhật `window.confirm` & Xóa Console Logs
- Thiết kế một **Custom In-game Confirm Dialog** bằng Phaser UI thay vì dùng `window.confirm()`, giúp game không bị chặn thread trong iframes.
- Cấu hình lại `vite.config.ts` thành `drop_console: ['log', 'info']` để tự dọn dẹp các log thừa ở bản production build.

---

## 🏁 Tổng kết
Với đợt vá lỗi này, codebase hiện tại đã **sẵn sàng 100% để ship lên CrazyGames** mà không vi phạm bất cứ policy nào về SDK.
