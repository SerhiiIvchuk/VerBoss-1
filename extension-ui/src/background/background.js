/* global chrome */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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

                // 3. Створення Offscreen з твоєю діагностикою
                if (!(await chrome.offscreen.hasDocument?.())) {
                    console.log("Спроба створити Offscreen...");
                    try {
                        await chrome.offscreen.createDocument({
                            url: chrome.runtime.getURL('offscreen.html'),
                            reasons: ['USER_MEDIA'],
                            justification: 'To capture audio for transcription',
                        });
                        console.log("✅ Offscreen успішно створено!");
                    } catch (offscreenError) {
                        if (offscreenError.message.includes('Only one offscreen document may be created')) {
                            console.log("⚠️ Offscreen вже існує, це нормально.");
                        } else {
                            throw offscreenError; // Перекидаємо помилку далі в головний catch
                        }
                    }
                }

                // 4. Надсилаємо сигнал в Offscreen
                setTimeout(() => {
                    chrome.runtime.sendMessage({
                        type: 'START_CAPTURE',
                        target: 'offscreen',
                        data: { streamId }
                    });
                }, 250);

                sendResponse({ status: "Success" });
            } catch (error) {
                console.error("❌ VerBoss: Помилка у фоні:", error);
                sendResponse({ status: "Error", message: error.message });
            }
        })();

        return true; 
    }

    if (message.type === "PAUSE_CAPTURE" || message.type === "RESUME_CAPTURE") {
        chrome.runtime.sendMessage({
            type: message.type,
            target: 'offscreen'
        });
        sendResponse({ status: "Command forwarded" });
    }
});