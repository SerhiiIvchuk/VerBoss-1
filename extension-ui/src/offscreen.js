/* global chrome */

let isPaused = false;
let chunkCount = 0;
let audioContext = null;
let socket = null; // NEW
let audioBuffer = []; // NEW: Масив для накопичення даних між відправками
const SAMPLE_RATE = 16000; // NEW: Частота, яку "любить" Whisper

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
    socket = new WebSocket('wss://trifle-blah-deplete.ngrok-free.dev/ws/stt');
    
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

chrome.runtime.onMessage.addListener(async (message) => {
    if (message.target !== 'offscreen') return;

    if (message.type === 'START_CAPTURE') {
        connectWebSocket(); // NEW: Підключаємо сокет при старті
        startAudioWorklet(message.data.streamId);
        // // NEW: Одразу повідомляємо сторінку, що у нас є готова доріжка перекладу (поки що тестова)
        // chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        // if (tabs[0]) {
        //     chrome.runtime.sendMessage({
        //     type: "TRANSLATED_AUDIO_READY",
        //     target: "content",
        //     audioUrl: getTestUkrainianAudio()
        //     });
        // }
        // });
        // FIXED: Офскрін не має доступу до chrome.tabs.
        // Надсилаємо повідомлення у загальну шину розширення, де його успішно перехопить content_script.js
        chrome.runtime.sendMessage({
            type: "TRANSLATED_AUDIO_READY",
            target: "content",
            audioUrl: getTestUkrainianAudio()
        });
        console.log("Offscreen: Відправлено сигнал TRANSLATED_AUDIO_READY в контент скрипт.");
    } else if (message.type === 'PAUSE_CAPTURE') {
        isPaused = true;
        console.log("Offscreen: Захоплення призупинено (PAUSE)");
    } else if (message.type === 'RESUME_CAPTURE') {
        isPaused = false;
        console.log("Offscreen: Захоплення відновлено (PLAY)");
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
        //     console.log(`[Worklet Chunk #${chunkCount}]`, audioData.slice(0, 5));
        // }
        
        // Тут буде твій WebSocket відправник
        // NEW: Замість простого логування, додаємо дані в буфер
        audioBuffer.push(...event.data);
    };

     // NEW: Таймер, який кожні 5 секунд "зрізає" звук і відправляє його
    setInterval(() => {
        if (audioBuffer.length > 0 && socket && socket.readyState === WebSocket.OPEN) {
            // ВАЖЛИВО: копіюємо дані для обробки
            const samples = new Float32Array(audioBuffer);
            
            // Очищаємо БУФЕР ВІДРАЗУ, щоб нові дані не змішувалися зі старими
            audioBuffer = []; // <--- ПЕРЕМІЩЕНО СЮДИ для стабільності

            const wavBuffer = encodeWAV(samples);
            socket.send(wavBuffer);
            console.log(`[Sent] WAV segment: ${wavBuffer.byteLength} bytes`);
        }
    }, 5000);

    source.connect(workletNode);
    workletNode.connect(audioContext.destination);
    source.connect(audioContext.destination); // Щоб чути звук у браузері
}