/* global chrome */
import { createApp } from "vue";
import DubOverlay from "../components/DubOverlay.vue"; // ІМПОРТ: Підключаємо твій новий Vue компонент

console.log("VerBoss: Content script завантажено.");
// NEW: Створюємо глобальний аудіо-об'єкт, куди завантажуватиметься український переклад
let translatedAudio = new Audio();

// Стало (Тимчасово для тестування хардкоду):
// const hardcodedAudioUrl = chrome.runtime.getURL('space_ua.mp3');
// console.log("VerBoss [TEST]: Прописуємо тестовий URL треку:", hardcodedAudioUrl);

// let translatedAudio = new Audio(hardcodedAudioUrl);

// NEW: Встановлюємо початкову дефолтну гучність для української доріжки на 100%
translatedAudio.volume = 1.0; 

// NEW: Функція створення ізольованого Shadow DOM та монтування туди нашого Vue-компонента
const injectOverlayWidget = (video) => {
  // NEW: Знаходимо плеєр YouTube або батьківський елемент відео на тестовій сторінці
  const videoContainer = video.closest('.html5-video-player') || video.parentNode;
  
  // NEW: Перевіряємо, щоб не створити дублікат панелі, якщо скрипт запуститься повторно
  if (videoContainer.querySelector('#ua-dub-shadow-root')) return;

  // NEW: Створюємо головну обгортку для нашого віджета
  const hostDiv = document.createElement('div');
  hostDiv.id = 'ua-dub-shadow-root';
  // NEW: Робимо позиціонування відносним, щоб абсолютний Vue-віджет не злітав
  hostDiv.style.position = 'relative'; 
  videoContainer.appendChild(hostDiv);

  // NEW: Ініціалізуємо відкритий Shadow DOM (ізоляція стилів від самого сайту)
  const shadowRoot = hostDiv.attachShadow({ mode: 'open' });
  // NEW: Створюємо елемент-таргет, в який безпосередньо «сяде» Vue
  const appTarget = document.createElement('div');
  shadowRoot.appendChild(appTarget);

  // NEW: Ініціалізуємо Vue-компонент та передаємо йому наш аудіо-об'єкт як пропс
  const app = createApp(DubOverlay, {
    translatedAudio: translatedAudio
  });
  
  // NEW: Монтуємо додаток у створену точку всередині Shadow DOM
  app.mount(appTarget);
  console.log("✅ Панель DubOverlay успішно додано на сторінку.");
};

const setupVideoListeners = () => {
    const video = document.querySelector('video');
    
    if (!video) {
        // Якщо відео ще не підвантажилося, спробуємо знайти його через секунду
        setTimeout(setupVideoListeners, 1000);
        return;
    }

    console.log("VerBoss: Відео знайдено, підключаємо датчики стану.");

    // NEW: Як тільки відео знайдено — вбудовуємо нашу накладену Vue-панель
    injectOverlayWidget(video);
  
    // Коли відео починає грати
    video.onplay = () => {
        console.log("VerBoss: Відео запущено, вмикаємо переклад...");
        chrome.runtime.sendMessage({ type: "RESUME_CAPTURE" });
        // NEW: Якщо файл перекладу вже завантажений — запускаємо його синхронно з відео
        if (translatedAudio.src) translatedAudio.play();
    };

    // Коли відео на паузі
    video.onpause = () => {
        console.log("VerBoss: Пауза, зупиняємо захоплення.");
        chrome.runtime.sendMessage({ type: "PAUSE_CAPTURE" });
        // NEW: Синхронно зупиняємо українську аудіодоріжку на паузу
        translatedAudio.pause();
    };

    // Коли користувач перемотує відео
    video.onseeking = () => {
        console.log("VerBoss: Перемотування...");
        chrome.runtime.sendMessage({ type: "PAUSE_CAPTURE" });
    };

    // NEW: Використовуємо подію оновлення часу для утримання синхронізації та наздоганяння відео
    video.ontimeupdate = () => {
        // NEW: Якщо доріжка порожня або відео стоїть на паузі — нічого не синхронізуємо
        if (!translatedAudio.src || video.paused) return;
        // NEW: Якщо дельта часу між відео та аудіо більше 0.3 секунди — примусово рівняємо аудіо
        if (Math.abs(translatedAudio.currentTime - video.currentTime) > 0.3) {
        translatedAudio.currentTime = video.currentTime;
        }
    };
};

// NEW: Слухач повідомлень для взаємодії та синхронізації з Попапом розширення
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const video = document.querySelector('video');
  
  // NEW: Попап при відкритті запитує поточний стан гучності для синхронізації своїх повзунків
  if (message.type === "GET_PLAYER_STATE") {
    sendResponse({
      volOriginal: video ? video.volume : 0.3,
      volTranslated: translatedAudio.volume
    });
    return true;
  }

  // NEW: Обробка команд кліків по кнопках Play/Pause/Rewind з попапу
  if (message.type === "PLAYER_ACTION" && video) {
    if (message.action === 'PLAY') video.play();
    if (message.action === 'PAUSE') video.pause();
    if (message.action === 'REWIND') video.currentTime = 0;
  }

  // NEW: Обробка руху повзунків гучності всередині вікна попапу
  if (message.type === "VOLUME_CHANGE") {
    if (message.target === 'ORIGINAL' && video) video.volume = message.value;
    if (message.target === 'TRANSLATED') translatedAudio.volume = message.value;
  }

  // NEW: Прийом сигналу та URL-адреси готової аудіодорічки українського перекладу з Offscreen
  if (message.type === "TRANSLATED_AUDIO_READY" && message.target === 'content') {
    translatedAudio.src = message.audioUrl;
    translatedAudio.load(); // NEW: Примусово перезавантажуємо аудіо-буфер під новий файл
    console.log("✅ Трек перекладу успішно змонтовано у внутрішній плеєр сторінки!");
  }
});

setupVideoListeners();