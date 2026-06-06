/* global chrome */

let isPaused = false;
let chunkCount = 0;
let audioContext = null;
let socket = null; // NEW
let audioBuffer = []; // NEW: Масив для накопичення даних між відправками
const SAMPLE_RATE = 16000; // NEW: Частота, яку "любить" Whisper
// new8: Поточний активний токен сесії, який прийшов від контент-скрипта
let currentSequenceToken = "initial_session"; // new8
// new8: Лічильник для імітації послідовних шматків
let currentChunkIndex = 0; // new8
// new8: Максимальна кількість тестових файлів у папці audioparts
const MAX_TEST_CHUNKS = 12; // new8
// new8: Змінна для збереження ID інтервалу, щоб вчасно його скидати
let fakeBackendInterval = null; // new8
let sendIntervalTimer = null; // NEW9: Зберігаємо ID таймера відправки WAV чанків
let activeStreamTabId = null; // NEW9 CRITICAL: Зберігаємо ID вкладки-власника аудіопотоку

// NEW10: Об'єкт для збереження поточних налаштувань користувача з UI для сокету
let activeUserPreferences = {
enableSubtitles: true,
subtitlesLang: ["en", "ua"],
enableTranslation: true,
targetLanguage: "uk"
};

function encodeWAV(samples) {
let buffer = new ArrayBuffer(44 + samples.length * 2);
let view = new DataView(buffer);

const writeString = (offset, string) => {
for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
};

writeString(0, 'RIFF');
view.setUint32(4, 32 + samples.length * 2, true);
writeString(8, 'WAVE');
writeString(12, 'fmt ');
view.setUint32(16, 16, true);
view.setUint16(20, 1, true);
view.setUint16(22, 1, true);
view.setUint32(24, SAMPLE_RATE, true);
view.setUint32(28, SAMPLE_RATE * 2, true);
view.setUint16(32, 2, true);
view.setUint16(34, 16, true);
writeString(36, 'data');
view.setUint32(40, samples.length * 2, true);

// ВАЖЛИВО: Використовуємо окрему функцію для запису даних,
// щоб уникнути помилок при розрахунку офсету
writeAudioData(view, 44, samples); // <--- ЗМІНЕНО: Виклик функції запису

return buffer;
}
// NEW: Функція ініціалізації з'єднання
function connectWebSocket() {
// NEW9: Перед відкриттям переконуємося, що старий сокет закрито без виклику реконнектів
if (socket) { socket.onclose = null; socket.close(); } // NEW9
socket = new WebSocket('wss://sponge-subzero-gating.ngrok-free.dev/ws/stt');
socket.onopen = () => console.log("Offscreen: WS Connected");
socket.onmessage = (event) => {
const data = JSON.parse(event.data);
console.log("Whisper result:", data.text);
// NEW: Передача тексту в Popup для відображення користувачу
chrome.runtime.sendMessage({
type: 'TRANSCRIPTION_RESULT',
target: 'popup',
text: data.text
});
};
socket.onclose = () => {
console.log("Offscreen: WS Closed. Reconnecting...");
setTimeout(connectWebSocket, 3000);
};
}

function writeAudioData(view, offset, input) {
for (let i = 0; i < input.length; i++, offset += 2) {
// Затискаємо амплітуду в межах [-1, 1]
let s = Math.max(-1, Math.min(1, input[i]));
// Конвертуємо Float32 в Int16 (PCM)
view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
}
}

// NEW: Емуляція отримання тестового 50-секундного файлу.
// Коли прийде фінальний бек, ця функція буде викликатися по події socket.onmessage замість транскрипції.
function getTestUkrainianAudio() {
// Повертаємо шлях до локального тестового файлу, що лежить у папці розширення
return chrome.runtime.getURL('space_ua.mp3');
}
// new8: Функція імітації запуску потоку чанків з бекенду для конкретної секунди та сесії
function startFakeBackendStreaming(startSecond, sequenceToken) {
// new8: Якщо попередній таймер працював — зупиняємо його
if (fakeBackendInterval) clearInterval(fakeBackendInterval); // new8
// new8: Оновлюємо глобальний токен сесії
currentSequenceToken = sequenceToken; // new8
// new8: Вираховуємо початковий індекс шматка на основі секунди (крок 5с)
currentChunkIndex = Math.floor(startSecond / 5); // new8

// new8: Запускаємо регулярну імітацію кожні 5 секунд
fakeBackendInterval = setInterval(() => {
// new8: Якщо вийшли за межі наявних 12 файлів — зупиняємо потік
if (currentChunkIndex >= MAX_TEST_CHUNKS) {
clearInterval(fakeBackendInterval); // new8
return; // new8
}

// new8: Форматуємо індекс у рядок типу "003"
const paddedIndex = String(currentChunkIndex).padStart(3, '0');
// new8: Формуємо шлях до тестового аудіо у папці audioparts (внутрішній URL розширення)
const audioUrl = chrome.runtime.getURL(`audioparts/output_${paddedIndex}.mp3`);
// new8: Розраховуємо точний абсолютний час старту цього чанка на таймлайні
const startTime = currentChunkIndex * 5;

// NEW10: Імітація текстової відповіді за новою схемою (text_en та text_ua)
const mockPhrases = [
"You need to hear this if you love", // 0-5с (Chunk 0)
"space. Got a minute? Let's explore some crazy space facts. First up, HD1897", // 5-10с (Chunk 1)
"It's an exoplanet where it rains glass sideways at 5,400 miles per hour.", // 10-15с (Chunk 2)
"Can you imagine getting caught in that storm next did you know a day on Mars is almost like ours?", // 15-20с (Chunk 3)
"24 hours, 37 minutes and 22 seconds. So close yet so far.", // 20-25с (Chunk 4)
"And get this, the sun makes up 99.8% of our solar system's mass. That's", // 25-30с (Chunk 5)
"one heavy star. The rest? All the planets, moons and space rocks combined.", // 30-35с (Chunk 6)
"NASA's top-of-the-line suits cost about $150 million each. That's a lot of dough for...", // 35-40с (Chunk 7)
"some out-of-this-world fashion. Finally, black holes can spaghettify objects. Extreme gravity...", // 40-45с (Chunk 8)
"stretches things into long thin shapes like spaghetti. Yikes. Like these facts?", // 45-50с (Chunk 9)
"Smash that like button and hit subscribe for more spacey goodness. See you next time!" // 50-55с (Chunk 10)
];
const selectedText = mockPhrases[currentChunkIndex % mockPhrases.length] || "Spoken content description."; // NEW10
// new8: Відправляємо збагачену структуру даних у загальну шину для content.js
chrome.runtime.sendMessage({
type: "TRANSLATED_AUDIO_CHUNK_READY",
target: "content",
audioUrl: audioUrl,
text_en: selectedText, // NEW10: Додаємо симуляцію англійського речення Whisper
text_ua: "", // NEW10: Поки що залишаємо порожнім для перевірки роботи фронтенд-заглушки
meta: {
chunkId: currentChunkIndex,
startTime: startTime,
endTime: startTime + 5.0, // NEW10
duration: 5.0, // new8: Тестова тривалість 5 секунд
sequenceToken: currentSequenceToken, // new8: Маркуємо поточною активною сесією
tabId: activeStreamTabId // NEW9: Тепер background.js чітко знає, куди слати чанк!
}
});

console.log(`[new8 Offscreen]: Відправлено чанк №${currentChunkIndex} для часу ${startTime}с, Сесіння: ${currentSequenceToken}`);
// new8: Переходимо до наступного чанка
currentChunkIndex++;
}, 5000);
}

// NEW10: Функція мапінгу UI станів на конфіг майбутнього серійного об'єкта
function updateInternalPreferences(subSettings) {
if (!subSettings) return;
activeUserPreferences.enableSubtitles = subSettings.en.generate || subSettings.uk.generate;
activeUserPreferences.subtitlesLang = [];
if (subSettings.en.generate) activeUserPreferences.subtitlesLang.push("en");
if (subSettings.uk.generate) activeUserPreferences.subtitlesLang.push("ua");
}

chrome.runtime.onMessage.addListener(async (message) => {
if (message.target !== 'offscreen') return;

if (message.type === 'START_CAPTURE') {
// NEW9: Запам'ятовуємо ID вкладки, надісланий із бекграунда
activeStreamTabId = (message.data && message.data.tabId) ? message.data.tabId : null;
connectWebSocket(); // NEW: Підключаємо сокет при старті
startAudioWorklet(message.data.streamId);
// // NEW: Одразу повідомляємо сторінку, що у нас є готова доріжка перекладу (поки що тестова)
// chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
// if (tabs[0]) {
// chrome.runtime.sendMessage({
// type: "TRANSLATED_AUDIO_READY",
// target: "content",
// audioUrl: getTestUkrainianAudio()
// });
// }
// });
// FIXED: Офскрін не має доступу до chrome.tabs.
// Надсилаємо повідомлення у загальну шину розширення, де його успішно перехопить content_script.js
// chrome.runtime.sendMessage({
// type: "TRANSLATED_AUDIO_READY",
// target: "content",
// audioUrl: getTestUkrainianAudio()
// });
// console.log("Offscreen: Відправлено сигнал TRANSLATED_AUDIO_READY в контент скрипт.");
// new8: При першому старті запускаємо імітацію з 0-ї секунди з дефолтним токеном
startFakeBackendStreaming(0, "initial_session"); // new8
}
// NEW9: Консервація — зупиняємо надсилання даних бекенду, глушимо таймери, але не вбиваємо документ
else if (message.type === 'STOP_CAPTURE_STREAM') {
console.log("Offscreen [STOP]: Команда припинення захоплення. Очищення стрім-контексту..."); // NEW9
isPaused = true; // NEW9: Блокуємо потрапляння нових фреймів з ворклета в буфер
if (fakeBackendInterval) { clearInterval(fakeBackendInterval); fakeBackendInterval = null; } // NEW9: Рвемо фейк-бек інтервал
if (sendIntervalTimer) { clearInterval(sendIntervalTimer); sendIntervalTimer = null; } // NEW9: Рвемо таймер відправки сокетів
audioBuffer = []; // NEW9: Повністю зливаємо залишки сирого звуку
activeStreamTabId = null; // NEW9 CRITICAL: Скидаємо прив'язку до вкладки
if (socket) { // NEW9: Закриваємо з'єднання з сервером Whisper
socket.onclose = null; // NEW9: Прибираємо автореконнект
socket.close();
socket = null;
console.log("Offscreen [STOP]: Веб-сокет успішно відключено."); // NEW9
}
}
// new8: Обробка запиту від контент-крипта на генерацію з нової точки після перемотування
else if (message.type === 'REQUEST_NEW_STREAM') {
// NEW9: Поновлюємо активність, якщо користувач перемотав під час «паузи»
isPaused = false; // NEW9
if (message.subSettings) updateInternalPreferences(message.subSettings); // NEW10
console.log(`[new8 Offscreen]: Отримано запит на новий потік з ${message.startTime}с, Сесія: ${message.sequenceToken}`); // new8
startFakeBackendStreaming(message.startTime, message.sequenceToken); // new8
}
// else if (message.type === 'PAUSE_CAPTURE') {
// isPaused = true;
// console.log("Offscreen: Захоплення призупинено (PAUSE)");
// } else if (message.type === 'RESUME_CAPTURE') {
// isPaused = false;
// console.log("Offscreen: Захоплення відновлено (PLAY)");
// }
// NEW10: Слухач динамічної зміни конфігу субтитрів з UI
else if (message.type === 'UPDATE_SUBTITLES_CAPTURE_CONFIG') {
updateInternalPreferences(message.subSettings);
console.log("Offscreen [NEW10]: Оновлено внутрішні преференції для об'єкта підкорення:", activeUserPreferences);
}
});

async function startAudioWorklet(streamId) {
console.log("Offscreen: Запуск захоплення через AudioWorklet...");

const stream = await navigator.mediaDevices.getUserMedia({
audio: {
mandatory: {
chromeMediaSource: 'tab',
chromeMediaSourceId: streamId
}
}
});

// audioContext = new AudioContext();
// UPDATED: Додано фіксований sampleRate для Whisper
audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
// Завантажуємо ворклет (файл з public/processor.js)
await audioContext.audioWorklet.addModule('processor.js');

const source = audioContext.createMediaStreamSource(stream);
const workletNode = new AudioWorkletNode(audioContext, 'audio-processor');

// Отримуємо дані з ворклета
workletNode.port.onmessage = (event) => {
if (isPaused) return;
// const audioData = event.data; // Float32Array чанк
// chunkCount++;

// if (chunkCount % 50 === 0) {
// NEW11 FIX: Відновлюємо та дописуємо логіку збирання буфера всередині лісенера повідомлень ворклета
audioBuffer.push(...event.data);
};

// NEW11 FIX: Дописуємо до кінця оригінальний таймер відправки WAV даних на бек, який був обірваний
sendIntervalTimer = setInterval(() => {
if (audioBuffer.length > 0 && socket && socket.readyState === WebSocket.OPEN) {
const samples = new Float32Array(audioBuffer);
audioBuffer = []; 
const hasSound = samples.some(sample => Math.abs(sample) > 0.0001);

if (!hasSound) return;
const wavBuffer = encodeWAV(samples);
socket.send(wavBuffer);
console.log(`[Sent] WAV segment: ${wavBuffer.byteLength} bytes`);
}
}, 5000);

// NEW11 FIX: Коректно підключаємо оригінальні вузли для класичної схеми відтворення на сторінці Ютуба
source.connect(workletNode);
workletNode.connect(audioContext.destination);
source.connect(audioContext.destination); // Щоб чути оригінальний звук у браузері
}