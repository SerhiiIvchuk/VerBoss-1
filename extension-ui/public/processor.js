// public/processor.js
class AudioProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const channelData = input[0];
      // Передаємо дані в основний потік Offscreen Document
      // this.port.postMessage(channelData);
      // NEW: Перевіряємо, чи дані не порожні (тиша часто заповнена нулями)
      if (channelData.length > 0) {
        
        // NEW: Робимо копію даних перед відправкою. 
        // Це важливо, бо вихідний Float32Array може бути перевикористаний системою 
        // ще до того, як Offscreen його опрацює.
        const inputCopy = new Float32Array(channelData);

        // Передаємо дані в основний потік Offscreen Document
        // NEW: Додано передачу через transferables для продуктивності
        this.port.postMessage(inputCopy, [inputCopy.buffer]);
      }
    }
    return true;
  } 
}

registerProcessor('audio-processor', AudioProcessor);