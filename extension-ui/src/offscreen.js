/* global chrome */

let isPaused = false;
let chunkCount = 0;
let audioContext = null;

chrome.runtime.onMessage.addListener(async (message) => {
    if (message.target !== 'offscreen') return;

    if (message.type === 'START_CAPTURE') {
        startAudioWorklet(message.data.streamId);
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

    audioContext = new AudioContext();
    
    // Завантажуємо ворклет (файл з public/processor.js)
    await audioContext.audioWorklet.addModule('processor.js');

    const source = audioContext.createMediaStreamSource(stream);
    const workletNode = new AudioWorkletNode(audioContext, 'audio-processor');

    // Отримуємо дані з ворклета
    workletNode.port.onmessage = (event) => {
        if (isPaused) return;

        const audioData = event.data; // Float32Array чанк
        chunkCount++;

        if (chunkCount % 50 === 0) {
            console.log(`[Worklet Chunk #${chunkCount}]`, audioData.slice(0, 5));
        }
//! ===========================================================================================================================
        //! Тут буде твій WebSocket відправник
    };

    source.connect(workletNode);
    workletNode.connect(audioContext.destination);
    source.connect(audioContext.destination); // Щоб чути звук у браузері
}