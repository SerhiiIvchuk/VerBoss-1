/* global chrome */

// NEW7: Надійна функція, яка гарантує, що Offscreen існує, або створює його
async function ensureOffscreenExists() {
const contexts = await chrome.runtime.getContexts({
contextTypes: ['OFFSCREEN_DOCUMENT']
});

if (contexts.length > 0) {
return; // NEW7: Offscreen вже створено та активно
}

console.log("VerBoss [BG]: Offscreen не знайдено. Створюємо новий контекст...");
await chrome.offscreen.createDocument({
url: chrome.runtime.getURL('offscreen.html'),
reasons: ['USER_MEDIA'],
justification: 'To capture audio for transcription',
});
console.log("✅ VerBoss [BG]: Offscreen успішно створено!");
}

// NEW7: Безпечна відправка повідомлень в Offscreen із захистом від падіння
async function sendMessageToOffscreen(message) {
try {
await ensureOffscreenExists(); // NEW7: Спочатку переконуємось, що є кому слухати
await chrome.runtime.sendMessage(message);
} catch (error) {
console.warn("VerBoss [BG]: Не вдалося надіслати повідомлення в Offscreen:", error.message);
}
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
console.log("Background отримав повідомлення:", message);

if (message.type === "START_TRANSCRIPTION") {
(async () => {
try {
// 1. Перевіряємо активні захоплення
const capturedTabs = await chrome.tabCapture.getCapturedTabs();
const isAlreadyCaptured = capturedTabs.some(
(t) => t.tabId === message.tabId && t.status === 'active'
);

if (isAlreadyCaptured) {
console.log("VerBoss: Вкладка вже захоплена.");
// NEW9: Якщо вкладка вже активна, все одно переконуємося, що накладка відображається
chrome.tabs.sendMessage(message.tabId, { type: "INITIALIZE_OVERLAY" }).catch(() => {});
return sendResponse({ status: "Already active" });
}

// 2. Отримуємо Stream ID
const streamId = await chrome.tabCapture.getMediaStreamId({
targetTabId: message.tabId
});

// NEW7: 3. Викликаємо нашу залізобетонну функцію
await ensureOffscreenExists();

// FIXED: 4. Викликаємо sendMessageToOffscreen замість сирого chrome.runtime.sendMessage
await sendMessageToOffscreen({
type: 'START_CAPTURE',
target: 'offscreen',
data: { streamId, tabId: message.tabId } // NEW9: Передаємо ID вкладки
});

// NEW9: Одразу після запуску аудіо-захоплення даємо команду контент-скрипту вивести панель
chrome.tabs.sendMessage(message.tabId, { type: "INITIALIZE_OVERLAY" }) // NEW9
.catch(err => console.warn("VerBoss [BG]: Не вдалося ініціалізувати Overlay на сторінці:", err.message)); // NEW9
sendResponse({ status: "Success" });
} catch (error) {
console.error("❌ VerBoss: Помилка у фоні:", error);
sendResponse({ status: "Error", message: error.message });
}
})();

return true;
}

// NEW9: Обробка запиту на повну зупинку трансляції та деактивацію віджета з Попапу
if (message.type === "STOP_TRANSCRIPTION") {
sendMessageToOffscreen({
type: "STOP_CAPTURE_STREAM",
target: "offscreen"
});
// NEW9: Відправляємо команду контент-скрипту на видалення накладки з плеєра
chrome.tabs.sendMessage(message.tabId, { type: "REMOVE_OVERLAY" })
.catch(err => console.warn("VerBoss [BG]: Контент-скрипт вкладки недоступний:", err.message));
sendResponse({ status: "Success" });
return true;
}

// NEW7: Безпечна обробка команд паузи та відновлення від контент-скрипта
if (message.type === "PAUSE_CAPTURE" || message.type === "RESUME_CAPTURE") {
sendMessageToOffscreen({
type: message.type,
target: 'offscreen'
});
sendResponse({ status: "Command forwarded safely" });
return true;
}

// NEW10: Ретрансляція синхронізації прогресу субтитрів зі сторінки в активний Попап
if (message.type === "SUBTITLES_STATE_SYNC") {
chrome.runtime.sendMessage(message).catch(() => {});
sendResponse({ status: "Synced with popup" });
return true;
}

// NEW10: Прямий міст для трансляції динамічного оновлення конфігурації субтитрів в Offscreen
if (message.type === "UPDATE_SUBTITLES_CAPTURE_CONFIG" && message.target === "offscreen") {
sendMessageToOffscreen(message);
sendResponse({ status: "Config update forwarded to offscreen" });
return true;
}

// new8 / NEW9 CRITICAL: Ретрансляція динамічних чанків строго за цільовим адресатом (tabId)
if (message.type === "TRANSLATED_AUDIO_CHUNK_READY" && message.target === 'content') {
const targetTabId = (message.meta && message.meta.tabId) ? message.meta.tabId : null;

if (targetTabId) {
chrome.tabs.sendMessage(targetTabId, message)
.catch(err => console.warn(`VerBoss [BG]: Цільова вкладка ${targetTabId} закрита чи не готова:`, err.message));
} else {
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
if (tabs[0] && tabs[0].id) {
chrome.tabs.sendMessage(tabs[0].id, message)
.catch(err => console.warn("VerBoss [BG]: Запасний контент-скрипт не відповів:", err.message));
}
});
}
sendResponse({ status: "Chunk forwarded to content script" });
return true;
}
});