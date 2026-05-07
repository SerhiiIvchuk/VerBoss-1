/* global chrome */

console.log("VerBoss: Content script завантажено.");

const setupVideoListeners = () => {
    const video = document.querySelector('video');
    
    if (!video) {
        // Якщо відео ще не підвантажилося, спробуємо знайти його через секунду
        setTimeout(setupVideoListeners, 1000);
        return;
    }

    console.log("VerBoss: Відео знайдено, підключаємо датчики стану.");

    // Коли відео починає грати
    video.onplay = () => {
        console.log("VerBoss: Відео запущено, вмикаємо переклад...");
        chrome.runtime.sendMessage({ type: "RESUME_CAPTURE" });
    };

    // Коли відео на паузі
    video.onpause = () => {
        console.log("VerBoss: Пауза, зупиняємо захоплення.");
        chrome.runtime.sendMessage({ type: "PAUSE_CAPTURE" });
    };

    // Коли користувач перемотує відео
    video.onseeking = () => {
        console.log("VerBoss: Перемотування...");
        chrome.runtime.sendMessage({ type: "PAUSE_CAPTURE" });
    };
};

setupVideoListeners();