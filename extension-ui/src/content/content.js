/* global chrome */
import { createApp } from "vue";
import DubOverlay from "../components/DubOverlay.vue";

console.log("VerBoss: Content script завантажено.");

// new8: Довготривалий кеш чанків, де Ключ — абсолютна секунда, Значення — об'єкт Audio
const audioChunksMap = new Map();
// NEW10: Довготривалий кеш англійських субтитрів
const subtitlesMapEN = new Map(); // NEW10
// NEW10: Довготривалий кеш українських субтитрів
const subtitlesMapUK = new Map(); // NEW10
// new8: Поточний активний токен сесії відтворення сторінки
let currentSequenceToken = "initial_session";
// new8: Глобальна змінна для збереження рівня гучності перекладу
let globalTranslatedVolume = 1.0;
// new8: Ідентифікатор таймера для реалізації Debounce на подію перемотування
// NEW10: Глобальні стани керування субтитрами для синхронізації
let globalSubSettings = {
en: { generate: true, visible: false, progress: 0 },
uk: { generate: true, visible: false, progress: 0 }
};
let seekingDebounceTimer = null;
// new8: Тривалість кроку одного чанка за замовчуванням (5 секунд)
const CHUNK_STEP = 5;
let lastTimeUpdateCheck = 0;
let isListenersAttached = false; // NEW9: Прапорець захисту від дублювання лісенерів
let overlayAppInstance = null; // NEW9: Зберігаємо посилання на екземпляр Vue-компонента


// NEW10: Функція підрахунку прогресу завантаження субтитрів
function calculateSubtitlesProgress(video, map) {
if (!video || !video.duration) return 0;
const uniqueSeconds = map.size * CHUNK_STEP;
const percentage = Math.min(100, Math.round((uniqueSeconds / video.duration) * 100)); // NEW10
return percentage;
}

// NEW10: Оновлення реактивних даних у Vue та надсилання повідомлень у Попап
function pushSubtitlesStateToUI(video) {
if (!video) return;
globalSubSettings.en.progress = calculateSubtitlesProgress(video, subtitlesMapEN);
globalSubSettings.uk.progress = calculateSubtitlesProgress(video, subtitlesMapUK);
if (overlayAppInstance && typeof overlayAppInstance.setExternalSubtitlesState === 'function') {
overlayAppInstance.setExternalSubtitlesState(JSON.parse(JSON.stringify(globalSubSettings)));
}
chrome.runtime.sendMessage({
type: "SUBTITLES_STATE_SYNC",
settings: globalSubSettings
}).catch(() => {});
}

const injectOverlayWidget = (video) => {
const videoContainer = video.closest('.html5-video-player') || video.parentNode;
if (videoContainer.querySelector('#ua-dub-shadow-root')) return;

const hostDiv = document.createElement('div');
hostDiv.id = 'ua-dub-shadow-root';
hostDiv.style.position = 'relative';
videoContainer.appendChild(hostDiv);

const shadowRoot = hostDiv.attachShadow({ mode: 'open' });
const appTarget = document.createElement('div');
shadowRoot.appendChild(appTarget);

// NEW11 FIX: Переписуємо ініціалізацію подій з app.on на пропси Vue 3, щоб уникнути падіння TypeError і зникнення панелі
const app = createApp(DubOverlay, {
translatedAudio: {
get volume() { return globalTranslatedVolume; },
set volume(val) { globalTranslatedVolume = val; updateAllChunksVolume(val); }
},
// NEW11 FIX: Перехоплюємо подію зміни гучності з повзунків всередині DubOverlay через пропс
onVolumeChanged: (data) => {
// NEW11: Надсилаємо оновлені рівні гучності в Попап для миттєвої синхронізації...
chrome.runtime.sendMessage({
type: "SUBTITLES_STATE_SYNC",
settings: globalSubSettings,
volOriginal: data.target === 'ORIGINAL' ? data.value : undefined,
volTranslated: data.target === 'TRANSLATED' ? data.value : undefined
}).catch(() => {}); // NEW11: Ігноруємо помилку, якщо Попап закрито
},
// NEW11 FIX: Перехоплюємо подію зміни чекбоксів генерації або відображення екрану в DubOverlay через пропс
onSettingsChanged: (data) => {
// NEW11: Перезаписуємо глобальний об'єкт налаштувань актуальними даними з оверлею
globalSubSettings = data.settings;
// NEW11: Оновлюємо прогрес-бари та синхронізуємо новий стан із відкритим Попапом
if (video) pushSubtitlesStateToUI(video);

// NEW11: Якщо було перемикнуто чекбокс "Генерувати", ініціюємо запуск/зупинку потоку на бекенді
if (data.triggerSyncAudioCapture === true) {
// NEW11: Відправляємо команду оновлення конфігурації захоплення в background/offscreen
chrome.runtime.sendMessage({
type: "UPDATE_SUBTITLES_CAPTURE_CONFIG",
target: "offscreen",
subSettings: globalSubSettings
}).catch(() => {});
}
},
// NEW11 FIX: Перехоплюємо подію кліку на кнопку завантаження .SRT файлу в DubOverlay через пропс
onSrtDownloadRequested: (lang) => {
// NEW11: Викликаємо локальну функцію формування та вивантаження файлу субтитрів у браузер
triggerSRTDownload(lang);
}
});

// app.mount(appTarget);
// NEW9 CRITICAL: Зберігаємо змонтований екземпляр додатка
overlayAppInstance = app.mount(appTarget);
console.log("✅ Панель DubOverlay успішно додано на сторінку.");
// NEW10: Відразу після ініціалізації передаємо початковий стан субтитрів в оверлей
pushSubtitlesStateToUI(video); // NEW10
};

function updateAllChunksVolume(volume) {
audioChunksMap.forEach((audioNode) => {
audioNode.volume = volume;
});
}

function fadeOutAndPause(audioNode, durationMs = 80) {
if (!audioNode || audioNode.paused) return;
const startVolume = audioNode.volume;
const steps = 10;
const stepTime = durationMs / steps;
let currentStep = 0;

// NEW9 CRITICAL: Перериваємо active таймер згасання на цьому чанку, якщо він вже існував
if (audioNode.fadeInterval) clearInterval(audioNode.fadeInterval);

// NEW9 CRITICAL: Записуємо ID інтервалу прямо в об'єкт аудіо-ноди
audioNode.fadeInterval = setInterval(() => {
currentStep++;
audioNode.volume = Math.max(0, startVolume * (1 - currentStep / steps));
if (currentStep >= steps) {
clearInterval(audioNode.fadeInterval);
audioNode.fadeInterval = null; // NEW9 CRITICAL
audioNode.pause();
audioNode.volume = globalTranslatedVolume;
}
}, stepTime);
}

function syncChunksWithVideo(video) {
// NEW9 CRITICAL: Якщо оверлей приховано (захоплення зупинене користувачем), блокуємо програвання звуку
if (!document.querySelector('#ua-dub-shadow-root')) return;

const currentKey = Math.floor(video.currentTime / CHUNK_STEP) * CHUNK_STEP;
const timeInsideChunk = video.currentTime % CHUNK_STEP;
const OVERLAP_SEC = 0.1;

audioChunksMap.forEach((audioNode, key) => {
if (key === currentKey && !video.paused) {
if (Math.abs(audioNode.currentTime - timeInsideChunk) > 0.3) {
audioNode.currentTime = timeInsideChunk;
}
if (audioNode.paused) {
audioNode.volume = globalTranslatedVolume;
audioNode.play().catch(e => console.warn("[new8]: Блокування автоплею чанка браузером:", e));
}
}
else if (key === currentKey - CHUNK_STEP && timeInsideChunk < OVERLAP_SEC && !video.paused) {
// Дозволяємо попередньому чанку плавно дограти мікронахлест
}
else {
if (!audioNode.paused && !audioNode.isFading) {
audioNode.isFading = true;
fadeOutAndPause(audioNode, 100);
setTimeout(() => { audioNode.isFading = false; }, 120);
}
}
});
// NEW10: Робимо вибірку тексту з мап на основі поточного часу та активуємо показ у Vue
if (overlayAppInstance && typeof overlayAppInstance.updateActiveSubtitlesText === 'function') {
const activeEN = globalSubSettings.en.visible ? (subtitlesMapEN.get(currentKey)?.text || "") : "";
const activeUK = globalSubSettings.uk.visible ? (subtitlesMapUK.get(currentKey)?.text || "") : "";
overlayAppInstance.updateActiveSubtitlesText(activeEN, activeUK);
}
}

function handleVideoSeeking(video) {
audioChunksMap.forEach(audioNode => {
// NEW9 CRITICAL: Жорстко чистимо хвости таймерів згасання під час перемотування
if (audioNode.fadeInterval) { clearInterval(audioNode.fadeInterval); audioNode.fadeInterval = null; }
audioNode.pause();
});

if (seekingDebounceTimer) clearTimeout(seekingDebounceTimer);

seekingDebounceTimer = setTimeout(() => {
currentSequenceToken = "session_" + Date.now();
const targetKey = Math.floor(video.currentTime / CHUNK_STEP) * CHUNK_STEP;

console.log(`[new8]: Перемотування зупинено на ${video.currentTime}с. Цільовий ключ: ${targetKey}. Нова сесія: ${currentSequenceToken}`);

if (audioChunksMap.has(targetKey)) {
console.log(`[new8]: УРА! Чанк для ${targetKey}с знайдено в кеші!`);
if (!video.paused) syncChunksWithVideo(video);
} else {
console.log(`[new8]: Кеш порожній для ${targetKey}с. Запит на нову генерацію...`);
chrome.runtime.sendMessage({
type: "REQUEST_NEW_STREAM",
target: "offscreen",
startTime: targetKey,
sequenceToken: currentSequenceToken,
subSettings: globalSubSettings // NEW10
});
}
}, 300);
}

const setupVideoListeners = () => {
const video = document.querySelector('video');
if (!video) {
setTimeout(setupVideoListeners, 1000);
return;
}

// Візуальну накладку інжектуємо ЗАВЖДИ (бо Shadow DOM зноситься при натисканні STOP)
injectOverlayWidget(video);

// NEW9 CRITICAL: Перевіряємо прапорець. Якщо датчики вже висять на відео — не додаємо їх повторно!
if (isListenersAttached) {
console.log("VerBoss [CS]: Датчики стану вже підключені до відео. Пропускаємо дублювання.");
if (!video.paused) syncChunksWithVideo(video);
return;
}

console.log("VerBoss: Відео знайдено, підключаємо датчики стану.");
isListenersAttached = true; // NEW9 CRITICAL: Блокуємо повторний вхід сюди у майбутньому

video.onplay = () => {
console.log("VerBoss: Відео запущено, вмикаємо переклад...");
// chrome.runtime.sendMessage({ type: "RESUME_CAPTURE" });
syncChunksWithVideo(video);
};

video.onpause = () => {
console.log("VerBoss: Пауза, зупиняємо захоплення.");
// chrome.runtime.sendMessage({ type: "PAUSE_CAPTURE" });
audioChunksMap.forEach(audioNode => audioNode.pause());
};

video.onseeking = () => {
console.log("VerBoss: Перемотування...");
// chrome.runtime.sendMessage({ type: "PAUSE_CAPTURE" });
handleVideoSeeking(video);
};

video.ontimeupdate = () => {
// NEW10: Оновлюємо прогрес під час відтворення, оскільки тривалість завантажується асинхронно
pushSubtitlesStateToUI(video);

if (!video.paused) {
const now = Date.now();
if (now - lastTimeUpdateCheck > 500) {
lastTimeUpdateCheck = now;
syncChunksWithVideo(video);
}
}
};
};

// NEW10: Допоміжна функція перетворення мікро-секунд у формат SRT
function formatToSRTTime(secondsTotal) {
const hours = Math.floor(secondsTotal / 3600).toString().padStart(2, '0');
const minutes = Math.floor((secondsTotal % 3600) / 60).toString().padStart(2, '0');
const seconds = Math.floor(secondsTotal % 60).toString().padStart(2, '0');
const milliseconds = Math.floor((secondsTotal % 1) * 1000).toString().padStart(3, '0');
return `${hours}:${minutes}:${seconds},${milliseconds}`;
}

// NEW10: Універсальна генерація і завантаження файлу SRT з фронтенду
function triggerSRTDownload(lang) {
const targetMap = lang === 'en' ? subtitlesMapEN : subtitlesMapUK;
const sortedKeys = Array.from(targetMap.keys()).sort((a, b) => a - b);
if (sortedKeys.length === 0) return;
let srtContent = "";
let counter = 1;
sortedKeys.forEach(start => {
const node = targetMap.get(start);
const srtStart = formatToSRTTime(start);
const srtEnd = formatToSRTTime(node.endTime);
srtContent += `${counter}\n${srtStart} --> ${srtEnd}\n${node.text}\n\n`;
counter++;
});
const blob = new Blob([srtContent], { type: "application/x-subrip;charset=utf-8" });
const url = URL.createObjectURL(blob);
const link = document.createElement("a");
link.href = url;
link.download = `VerBoss_Subtitles_${lang.toUpperCase()}.srt`;
link.click();
URL.revokeObjectURL(url);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
const video = document.querySelector('video');
if (message.type === "INITIALIZE_OVERLAY") {
console.log("VerBoss [CS]: Отримано дозвіл від Попапу. Активуємо накладку плеєра...");
setupVideoListeners();
sendResponse({ status: "Initialized" });
return true;
}

if (message.type === "REMOVE_OVERLAY") {
console.log("VerBoss [CS]: Отримано наказ деактивації. Приховуємо інтерфейс...");
const overlayNode = document.querySelector('#ua-dub-shadow-root');
if (overlayNode) {
overlayNode.remove();
console.log("✅ Панель DubOverlay успешно демонтовано.");
}
// FIXED [NEW10]: Очищаємо довготривалий кеш тексту субтитрів, щоб уникнути витоку даних між різними відео
subtitlesMapEN.clear();
subtitlesMapUK.clear();
// Якщо хочеш повністю скидати й аудіо-кеш чанків при натисканні STOP, розкоментуй рядок нижче:
// audioChunksMap.clear();

audioChunksMap.forEach(audioNode => {
// NEW9 CRITICAL: Рубимо активні інтервали затухання
if (audioNode.fadeInterval) { clearInterval(audioNode.fadeInterval); audioNode.fadeInterval = null; }
audioNode.pause();
});
sendResponse({ status: "Cleaned up successfully, cache preserved" });
return true;
}

if (message.type === "GET_PLAYER_STATE") {
sendResponse({
volOriginal: video ? video.volume : 0.3,
volTranslated: globalTranslatedVolume,
subSettings: globalSubSettings // NEW10: Віддаємо стан субтитрів при відкритии Попапу
});
return true;
}

if (message.type === "PLAYER_ACTION" && video) {
if (message.action === 'PLAY') video.play();
if (message.action === 'PAUSE') video.pause();
if (message.action === 'REWIND') {
video.currentTime = 0;
audioChunksMap.forEach(audioNode => {
// NEW9 CRITICAL: Очищаємо інтервали при скиданні на початок відео
if (audioNode.fadeInterval) { clearInterval(audioNode.fadeInterval); audioNode.fadeInterval = null; }
audioNode.currentTime = 0;
});
}
}

if (message.type === "VOLUME_CHANGE") {
if (message.target === 'ORIGINAL' && video){
video.volume = message.value;
// NEW9 CRITICAL: Оновлюємо повзунок оригіналу в інтерфейсі Vue
if (overlayAppInstance && typeof overlayAppInstance.setExternalOriginalVolume === 'function') {
overlayAppInstance.setExternalOriginalVolume(message.value);
}
}
if (message.target === 'TRANSLATED') {
globalTranslatedVolume = message.value;
updateAllChunksVolume(message.value);
// NEW9 CRITICAL: Оновлюємо повзунок перекладу в інтерфейсі Vue
if (overlayAppInstance && typeof overlayAppInstance.setExternalTranslatedVolume === 'function') {
overlayAppInstance.setExternalTranslatedVolume(message.value);
}
}
}
// NEW10: Обробка сигналу зміни налаштувань субтитрів з Попапу
if (message.type === "SUBTITLES_SETTINGS_CHANGE") {
globalSubSettings = message.settings;
if (video) pushSubtitlesStateToUI(video);
if (video && (message.triggerSyncAudioCapture === true)) {
// Сповіщаємо Offscreen про необхідність зміни конфігурації генерації на беку // NEW10
chrome.runtime.sendMessage({
type: "UPDATE_SUBTITLES_CAPTURE_CONFIG",
target: "offscreen",
subSettings: globalSubSettings
}).catch(() => {});
}
return true;
}

// NEW10: Обробка сигналу скачування файлу, що прилетів з Попапу
if (message.type === "TRIGGER_SRT_DOWNLOAD_ACTION") {
triggerSRTDownload(message.lang);
return true;
}

if (message.type === "TRANSLATED_AUDIO_CHUNK_READY" && message.target === 'content') {
const absoluteKey = Math.floor(message.meta.startTime / CHUNK_STEP) * CHUNK_STEP;
// NEW10: Обробка та збереження полів субтитрів у відповідні мапи
const textEn = message.text_en || ""; // NEW10
// Тимчасова заглушка для української, якщо бекграунд/бек ще не надсилає поле text_ua
const textUk = message.text_ua || (textEn ? `${textEn} [UA заміна]` : ""); // NEW10
const endTime = message.meta.endTime || (message.meta.startTime + CHUNK_STEP); // NEW10

subtitlesMapEN.set(absoluteKey, { text: textEn, endTime: endTime }); // NEW10
subtitlesMapUK.set(absoluteKey, { text: textUk, endTime: endTime }); // NEW10
if (video) pushSubtitlesStateToUI(video); // NEW10

if (audioChunksMap.has(absoluteKey)) {
console.log(`[new8]: Чанк для ключа ${absoluteKey}с вже є в кеші. Пропускаємо запис.`);
// NEW10: Навіть якщо аудіо є, субтитри ми могли оновити, тому оновлюємо екран
if (video && !video.paused) syncChunksWithVideo(video); // NEW10
return true;
}

console.log(`[new8]: Отримано новий чанк ID:${message.meta.chunkId} для таймлайну ${absoluteKey}с. Записуємо в кеш.`);
const chunkAudio = new Audio(message.audioUrl);
chunkAudio.volume = globalTranslatedVolume;
chunkAudio.preload = "auto";

audioChunksMap.set(absoluteKey, chunkAudio);
if (message.meta.sequenceToken === currentSequenceToken) {
if (video && !video.paused) {
syncChunksWithVideo(video);
}
} else {
console.log(`[new8]: Чанк для ${absoluteKey}с збережено в кеш ТИХО (Пакет з минулої сесії: ${message.meta.sequenceToken})`);
}
}
});