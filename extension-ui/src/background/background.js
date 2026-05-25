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
                    return sendResponse({ status: "Already active" });
                }

                // 2. Отримуємо Stream ID
                const streamId = await chrome.tabCapture.getMediaStreamId({
                    targetTabId: message.tabId
                });

                // NEW7: 3. Замість setTimeout та hasDocument викликаємо нашу залізобетонну функцію
                await ensureOffscreenExists();

                // NEW7: 4. Тепер відправляємо сигнал СИНХРОННО (без таймаутів), бо ми впевнені, що Offscreen вже є
                await chrome.runtime.sendMessage({
                    type: 'START_CAPTURE',
                    target: 'offscreen',
                    data: { streamId }
                });

                sendResponse({ status: "Success" });
            } catch (error) {
                console.error("❌ VerBoss: Помилка у фоні:", error);
                sendResponse({ status: "Error", message: error.message });
            }
        })();

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

    // NEW7: Якщо Offscreen згенерував готове аудіо перекладу, пересилаємо його в Content Script
    if (message.type === "TRANSLATED_AUDIO_READY") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].id) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: "TRANSLATED_AUDIO_READY",
                    target: "content",
                    audioUrl: message.audioUrl
                }).catch(err => console.warn("VerBoss [BG]: Вкладка закрита або контент-скрипт не готовий:", err.message));
            }
        });
        
        sendResponse({ status: "Audio URL forwarded to content script" });
        return true;
    }
});