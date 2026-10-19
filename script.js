const menuToggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navLinks");

menuToggle.addEventListener("click", () => {
  const isOpen = navLinks.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "Đóng menu" : "Mở menu");
});

navLinks.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Mở menu");
  });
});

// QR dùng một mã phiên cố định cho buổi demo này.
const qrPlaceholder = document.getElementById("qrPlaceholder");
const qrStatusText = document.getElementById("qrStatusText"); // optional in older markup
const qrDestinationLabel = document.getElementById("qrDestinationLabel");
const copyScenarioLink = document.getElementById("copyScenarioLink");
const sessionCodeLabel = document.getElementById("sessionCodeLabel");
const mqttControllerStatus = document.getElementById("mqttControllerStatus");
const startRemoteDemo = document.getElementById("startRemoteDemo");
const endRemoteDemo = document.getElementById("endRemoteDemo");
const VICTIM_BASE_URL = "https://peody.github.io/kt-attt-2026/";
const sessionCode = "CQ2026-01";
const topic = `cyberquest/demo/${sessionCode}`;
const victimUrl = new URL(VICTIM_BASE_URL);
victimUrl.searchParams.set("qr", "1");
victimUrl.searchParams.set("sessionCode", sessionCode);
const scenarioUrl = victimUrl.toString();
if (sessionCodeLabel) sessionCodeLabel.textContent = sessionCode;

if (window.location.protocol === "http:" || window.location.protocol === "https:") {
  const qrImage = document.createElement("img");
  qrImage.alt = "Mã QR mở trang tham gia mô phỏng CyberQuest";
  qrImage.loading = "lazy";
  qrImage.style.cssText = "width:100%;height:100%;object-fit:contain;border-radius:8px";
  qrImage.src = "https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=" + encodeURIComponent(scenarioUrl);
  qrImage.addEventListener("load", () => {
    if (qrPlaceholder) {
      qrPlaceholder.replaceChildren(qrImage);
      qrPlaceholder.classList.add("has-qr");
      qrImage.style.cursor = "zoom-in";
      qrImage.addEventListener("click", () => {
        const modal = document.getElementById("qrModal");
        const modalImage = modal?.querySelector("img");
        if (modalImage) modalImage.src = qrImage.src;
        if (modal) modal.style.display = "flex";
      });
    }
    if (qrStatusText) qrStatusText.textContent = "Quét để mở mô phỏng";
    if (qrDestinationLabel) qrDestinationLabel.textContent = "QR ĐÃ SẴN SÀNG";
  });
  qrImage.addEventListener("error", () => {
    if (qrStatusText) qrStatusText.textContent = "Không tải được QR — dùng link bên dưới";
    if (qrDestinationLabel) qrDestinationLabel.textContent = "QR CHƯA TẢI ĐƯỢC";
  });
} else if (qrStatusText) {
  qrStatusText.textContent = "Host website để tạo QR";
}

if (copyScenarioLink) copyScenarioLink.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(scenarioUrl);
    copyScenarioLink.textContent = "Đã sao chép link ✓";
  } catch {
    window.prompt("Sao chép đường dẫn mô phỏng:", scenarioUrl);
  }
});

// MQTT chỉ kết nối khi người điều khiển bấm nút. Broker công cộng chỉ dành cho demo.
let controllerClient = null;
let controllerConnecting = null;
function setControllerStatus(message) {
  if (mqttControllerStatus) mqttControllerStatus.textContent = message;
}
function connectController() {
  if (controllerClient && controllerClient.connected) return Promise.resolve(controllerClient);
  if (controllerConnecting) return controllerConnecting;
  if (!window.mqtt) return Promise.reject(new Error("Không tải được thư viện MQTT."));
  setControllerStatus("Đang kết nối dịch vụ đồng bộ…");
  controllerConnecting = new Promise((resolve, reject) => {
    const client = mqtt.connect("wss://broker.emqx.io:8084/mqtt", {
      clean: true, connectTimeout: 8000, reconnectPeriod: 3000,
      clientId: "cq_ctrl_" + Math.random().toString(16).slice(2, 12)
    });
    controllerClient = client;
    let settled = false;
    client.on("connect", () => {
      setControllerStatus("Đã kết nối. Chỉ thiết bị đã tham gia đúng mã phiên mới nhận tín hiệu.");
      if (!settled) { settled = true; resolve(client); }
    });
    client.on("error", (err) => {
      setControllerStatus("Lỗi MQTT: " + (err?.message || "không xác định"));
      if (!settled) { settled = true; reject(err); }
    });
    client.on("close", () => setControllerStatus("Kết nối đã đóng. Bấm nút để thử lại."));
  }).finally(() => { controllerConnecting = null; });
  return controllerConnecting;
}
async function publishDemoSignal(type) {
  const button = type === "DEMO_ALERT" ? startRemoteDemo : endRemoteDemo;
  if (button) button.disabled = true;
  try {
    const client = await connectController();
    await new Promise((resolve, reject) => client.publish(topic, JSON.stringify({
      type, sessionCode, sentAt: new Date().toISOString(), source: "CyberQuest-safe-demo"
    }), { qos: 0, retain: false }, (err) => err ? reject(err) : resolve()));
    setControllerStatus(type === "DEMO_ALERT" ? "Đã phát lệnh bắt đầu mô phỏng." : "Đã phát lệnh kết thúc mô phỏng.");
  } catch (err) {
    setControllerStatus("Không gửi được tín hiệu. Kiểm tra mạng và thử lại.");
  } finally {
    if (button) button.disabled = false;
  }
}
if (startRemoteDemo) startRemoteDemo.addEventListener("click", () => publishDemoSignal("DEMO_ALERT"));
if (endRemoteDemo) endRemoteDemo.addEventListener("click", () => publishDemoSignal("DEMO_END"));

const simulationOverlay = document.getElementById("simulationOverlay");
const simulationWall = document.getElementById("simulationWall");
const simulationCountdown = document.getElementById("simulationCountdown");
const stopSimulation = document.getElementById("stopSimulation");
const lessonModal = document.getElementById("lessonModal");
const closeLesson = document.getElementById("closeLesson");

const fakeAds = [
  {brand:"SPORT WIN", tag:"QUẢNG CÁO MÔ PHỎNG", title:"Kèo hot hôm nay!", body:"Lời mời cá cược với cam kết thắng lớn — dấu hiệu cần cảnh giác.", action:"XEM ƯU ĐÃI", tone:"red"},
  {brand:"TAI XIU LIVE", tag:"TÀI XỈU ONLINE", title:"Thử vận may ngay?", body:"Hứa hẹn thưởng nhanh, thúc giục quyết định ngay lập tức.", action:"CHƠI NGAY", tone:"purple"},
  {brand:"VAY SIÊU TỐC", tag:"VAY TIỀN GIẢ LẬP", title:"Duyệt vay trong 3 phút", body:"Không minh bạch lãi suất và phí là tín hiệu rủi ro.", action:"NHẬN TIỀN", tone:"orange"},
  {brand:"BONUS 999", tag:"ƯU ĐÃI GIẢ LẬP", title:"Bạn được chọn nhận thưởng!", body:"Không có bằng chứng nhận thưởng nhưng yêu cầu bấm nhanh.", action:"NHẬN THƯỞNG", tone:"blue"},
  {brand:"TÀI CHÍNH 24H", tag:"CẢNH BÁO RỦI RO", title:"Vay ngay không cần hỏi", body:"Lời mời vay nóng, điều khoản mơ hồ có thể dẫn đến nợ nần.", action:"ĐĂNG KÝ", tone:"orange"},
  {brand:"SPORT JACKPOT", tag:"QUẢNG CÁO MÔ PHỎNG", title:"Cơ hội chỉ còn vài phút", body:"Đếm ngược giả tạo tạo áp lực tâm lý để bạn hành động vội.", action:"THỬ NGAY", tone:"red"},
  {brand:"TX CLUB", tag:"TÀI XỈU MÔ PHỎNG", title:"Nạp ít — nhận nhiều?", body:"Lợi nhuận phi thực tế và yêu cầu nạp tiền là dấu hiệu đáng ngờ.", action:"MỞ NGAY", tone:"purple"},
  {brand:"VAY NHANH 0%", tag:"LỜI MỜI TÀI CHÍNH", title:"Không phí? Hãy đọc kỹ!", body:"Luôn kiểm tra tổng chi phí, lãi suất và thông tin đơn vị cho vay.", action:"XEM CHI TIẾT", tone:"blue"}
];

let adTimer = null;
let countdownTimer = null;
let stopAt = 0;
let adCount = 0;
const maxAds = 20;
const simulationDurationMs = 15000;

function createFakeAd(adData, index) {
  const card = document.createElement("article");
  card.className = `fake-ad tone-${adData.tone}`;
  card.style.setProperty("--tilt", `${(index % 5 - 2) * 1.3}deg`);
  card.style.setProperty("--ad-index", String(index));
  card.style.setProperty("--delay", `${(index % 4) * 35}ms`);
  card.innerHTML = `
    <div class="fake-ad-top"><span class="fake-ad-brand">${adData.brand}</span><button type="button" class="fake-ad-close" aria-label="Đóng quảng cáo mô phỏng">×</button></div>
    <span class="fake-ad-tag">${adData.tag}</span>
    <h3>${adData.title}</h3>
    <p>${adData.body}</p>
    <button type="button" class="fake-ad-action" aria-label="Nút quảng cáo giả lập — không điều hướng">${adData.action} ↗</button>
    <small class="fake-ad-disclaimer">NỘI DUNG GIẢ LẬP · KHÔNG PHẢI DỊCH VỤ THẬT</small>`;
  card.querySelector(".fake-ad-close").addEventListener("click", () => card.remove());
  card.querySelector(".fake-ad-action").addEventListener("click", (event) => {
    event.preventDefault();
    card.classList.add("fake-ad-flash");
    setTimeout(() => card.classList.remove("fake-ad-flash"), 250);
  });
  return card;
}

function spawnAd() {
  if (adCount >= maxAds) return;
  const data = fakeAds[adCount % fakeAds.length];
  simulationWall.appendChild(createFakeAd(data, adCount));
  adCount++;
}

function stopAdSimulation(showLesson = true) {
  clearInterval(adTimer);
  clearInterval(countdownTimer);
  adTimer = null;
  countdownTimer = null;
  simulationOverlay.classList.remove("is-active");
  simulationOverlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("simulation-running");
  if (showLesson) lessonModal.hidden = false;
}

function startAdSimulation() {
  if (simulationOverlay.classList.contains("is-active")) return;
  simulationWall.replaceChildren();
  adCount = 0;
  simulationOverlay.classList.add("is-active");
  simulationOverlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("simulation-running");
  stopAt = Date.now() + simulationDurationMs;

  // Hiển thị nhanh nhưng có giới hạn, chỉ bên trong trang web.
  for (let i = 0; i < 8; i++) spawnAd();
  adTimer = setInterval(() => {
    if (adCount >= maxAds) {
      clearInterval(adTimer);
      adTimer = null;
      return;
    }
    spawnAd();
  }, 420);

  countdownTimer = setInterval(() => {
    const seconds = Math.max(0, Math.ceil((stopAt - Date.now()) / 1000));
    simulationCountdown.textContent = `Mô phỏng tự dừng sau ${seconds} giây · ${adCount}/${maxAds} quảng cáo giả lập`;
    if (seconds <= 0) stopAdSimulation(true);
  }, 200);
}

stopSimulation.addEventListener("click", () => stopAdSimulation(true));
closeLesson.addEventListener("click", () => {
  lessonModal.hidden = true;
  window.history.replaceState({}, "", window.location.pathname + window.location.hash);
});

// Mô phỏng quảng cáo cục bộ không tự chạy khi mở trang; khởi động bằng thao tác rõ ràng nếu cần.
