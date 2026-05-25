<template>
  <!-- Головний контейнер віджета поверх відео -->
  <div class="ua-dub-overlay">
    <h4>UA Dub Overlay</h4>

    <!-- Кнопки маніпуляцій відтворенням -->
    <div class="controls-row">
      <button @click="triggerAction('PLAY')">▶ Відтворити</button>
      <button @click="triggerAction('PAUSE')">❚❚ Пауза</button>
      <button @click="triggerAction('REWIND')">🔄 Початок</button>
    </div>

    <!-- Повзунки гучності оригіналу та перекладу -->
    <div class="sliders-block">
      <div class="slider-row">
        <label>Оригінал: </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          v-model="volOriginal"
          @input="changeVolume('ORIGINAL')"
        />
        <span class="badge">{{ Math.round(volOriginal * 100) }}%</span>
      </div>

      <div class="slider-row">
        <label>Переклад: </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          v-model="volTranslated"
          @input="changeVolume('TRANSLATED')"
        />
        <span class="badge">{{ Math.round(volTranslated * 100) }}%</span>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from "vue";

export default {
  name: "DubOverlay",

  // Приймаємо об'єкт аудіо перекладу як пропс з контент-скрипта для прямої синхронізації
  props: {
    translatedAudio: {
      type: Object,
      required: true,
    },
  },

  setup(props) {
    const volOriginal = ref(0.3);
    const volTranslated = ref(1.0);
    let videoElement = null;

    onMounted(() => {
      // Знаходимо оригінальне відео на сторінці
      videoElement = document.querySelector("video");
      if (videoElement) {
        videoElement.volume = volOriginal.value; // Встановлюємо початковий рівень звуку оригіналу
      }
    });

    // Керування кнопками
    const triggerAction = (action) => {
      if (!videoElement) return;
      if (action === "PLAY") videoElement.play();
      if (action === "PAUSE") videoElement.pause();
      if (action === "REWIND") videoElement.currentTime = 0;
    };

    // Керування повзунками
    const changeVolume = (target) => {
      if (target === "ORIGINAL" && videoElement) {
        videoElement.volume = volOriginal.value;
      } else if (target === "TRANSLATED") {
        // Змінюємо гучність об'єкта Audio, що прийшов через пропси
        props.translatedAudio.volume = volTranslated.value;
      }
    };

    return {
      volOriginal,
      volTranslated,
      triggerAction,
      changeVolume,
    };
  },
};
</script>

<style scoped>
.ua-dub-overlay {
  position: absolute;
  top: 15px;
  left: 15px;
  background: rgba(20, 20, 20, 0.9);
  color: #ffffff;
  padding: 14px;
  border-radius: 8px;
  font-family: Arial, sans-serif;
  z-index: 2147483647;
  min-width: 260px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
  border: 1px solid #333;
}

h4 {
  margin: 0 0 12px 0;
  color: #42b983;
  font-size: 14px;
}

.controls-row {
  display: flex;
  gap: 6px;
  margin-bottom: 12px;
}

button {
  cursor: pointer;
  padding: 6px 10px;
  background: #333;
  border: 1px solid #444;
  color: white;
  border-radius: 4px;
  font-size: 12px;
  transition: background 0.2s;
}

button:hover {
  background: #444;
}

.sliders-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 12px;
}

.slider-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

label {
  min-width: 65px;
}

input[type="range"] {
  flex-grow: 1;
  margin: 0 8px;
  cursor: pointer;
}

.badge {
  min-width: 35px;
  text-align: right;
  color: #aaa;
}
</style>
