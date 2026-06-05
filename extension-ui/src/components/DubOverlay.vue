<template>
  <div class="ua-dub-overlay">
    <div
      class="verboss-subtitles-screen-holder"
      style="
        position: absolute;
        bottom: 50px;
        left: 50%;
        transform: translateX(-50%);
        width: 80%;
        text-align: center;
        pointer-events: none;
        z-index: 2147483647;
        font-family: Arial, sans-serif;
      "
    >
      <div
        v-if="activeTextEN && localSubSettings.en.visible"
        style="
          background: rgba(0, 0, 0, 0.75);
          color: #fff;
          padding: 4px 10px;
          border-radius: 4px;
          display: inline-block;
          font-size: 18px;
          margin-bottom: 5px;
          text-shadow: 1px 1px 2px #000;
        "
      >
        {{ activeTextEN }}
      </div>
      <br
        v-if="
          activeTextEN &&
          localSubSettings.en.visible &&
          activeTextUK &&
          localSubSettings.uk.visible
        "
      />
      <div
        v-if="activeTextUK && localSubSettings.uk.visible"
        style="
          background: rgba(0, 0, 0, 0.75);
          color: #ffeb3b;
          padding: 4px 10px;
          border-radius: 4px;
          display: inline-block;
          font-size: 18px;
          text-shadow: 1px 1px 2px #000;
        "
      >
        {{ activeTextUK }}
      </div>
    </div>

    <h4>UA Dub Overlay</h4>

    <div class="controls-row">
      <button @click="triggerAction('PLAY')">▶ Відтворити</button>
      <button @click="triggerAction('PAUSE')">❚❚ Пауза</button>
      <button @click="triggerAction('REWIND')">🔄 Початок</button>
    </div>

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

    <div
      style="
        border-top: 1px dashed #ccc;
        padding-top: 10px;
        margin-top: 12px;
        font-size: 12px;
      "
    >
      <h4 style="margin: 0 0 8px 0; color: #42b983">Налаштування субтитрів</h4>

      <div
        style="
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
        "
      >
        <span>EN оригінал:</span>
        <label>
          <input
            type="checkbox"
            v-model="localSubSettings.en.generate"
            @change="dispatchLocalSubSettings(true)"
          />
          Генерувати
        </label>
        <label>
          <input
            type="checkbox"
            v-model="localSubSettings.en.visible"
            :disabled="!localSubSettings.en.generate"
            @change="dispatchLocalSubSettings(false)"
          />
          Екран
        </label>
        <button
          @click="requestLocalSRTDownload('en')"
          :disabled="localSubSettings.en.progress === 0"
        >
          💾 .SRT
        </button>
      </div>
      <div
        style="
          width: 100%;
          background: #444;
          height: 4px;
          margin-bottom: 8px;
          border-radius: 2px;
        "
      >
        <div
          :style="{ width: localSubSettings.en.progress + '%' }"
          style="
            background: #2196f3;
            height: 100%;
            border-radius: 2px;
            transition: width 0.3s;
          "
        ></div>
      </div>

      <div
        style="
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
        "
      >
        <span>UA переклад:</span>
        <label>
          <input
            type="checkbox"
            v-model="localSubSettings.uk.generate"
            @change="dispatchLocalSubSettings(true)"
          />
          Генерувати
        </label>
        <label>
          <input
            type="checkbox"
            v-model="localSubSettings.uk.visible"
            :disabled="!localSubSettings.uk.generate"
            @change="dispatchLocalSubSettings(false)"
          />
          Екран
        </label>
        <button
          @click="requestLocalSRTDownload('uk')"
          :disabled="localSubSettings.uk.progress === 0"
        >
          💾 .SRT
        </button>
      </div>
      <div
        style="width: 100%; background: #444; height: 4px; border-radius: 2px"
      >
        <div
          :style="{ width: localSubSettings.uk.progress + '%' }"
          style="
            background: #ffeb3b;
            height: 100%;
            border-radius: 2px;
            transition: width 0.3s;
          "
        ></div>
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

  // NEW11: Декларуємо події для передачі стану назад у контент-скрипт (content.js)
  emits: ["volume-changed", "settings-changed", "srt-download-requested"],

  setup(props, { emit }) {
    const volOriginal = ref(0.3);
    const volTranslated = ref(1.0);
    const localSubSettings = ref({
      en: { generate: true, visible: false, progress: 0 },
      uk: { generate: true, visible: false, progress: 0 },
    });

    const activeTextEN = ref("");
    const activeTextUK = ref("");
    let videoElement = null;

    // Метод викликається з контент-скрипта через overlayAppInstance (NEW10)
    const setExternalSubtitlesState = (newSettings) => {
      localSubSettings.value = newSettings;
    };

    // NEW11: Передача конфігу субтитрів з Оверлею у контент-скрипт при кліках користувача
    const dispatchLocalSubSettings = (triggerSyncAudioCapture = false) => {
      // Якщо генерацію вимкнуто, примусово приховуємо з екрану згідно специфікації UX
      if (!localSubSettings.value.en.generate)
        localSubSettings.value.en.visible = false;
      if (!localSubSettings.value.uk.generate)
        localSubSettings.value.uk.visible = false;

      emit("settings-changed", {
        settings: JSON.parse(JSON.stringify(localSubSettings.value)),
        triggerSyncAudioCapture,
      });
    };

    // NEW11: Запит з Оверлею на генерацію та завантаження локального файлу SRT
    const requestLocalSRTDownload = (lang) => {
      emit("srt-download-requested", lang);
    };

    // Оновлення тексту активних субтитрів під час відтворення (NEW10)
    const updateActiveSubtitlesText = (textEn, textUk) => {
      activeTextEN.value = textEn;
      activeTextUK.value = textUk;
    };

    // NEW9 CRITICAL: Визначаємо функції для зміни гучності ззовні, щоб вони існували в контексті setup
    const setExternalOriginalVolume = (val) => {
      volOriginal.value = val;
    };

    const setExternalTranslatedVolume = (val) => {
      volTranslated.value = val;
    };

    onMounted(() => {
      // Знаходимо оригінальне відео на сторінці
      videoElement = document.querySelector("video");
      if (videoElement) {
        volOriginal.value = videoElement.volume; // NEW9
      }
      // NEW9: Синхронізуємо повзунок перекладу в оверлеї з глобальним значенням із контент-скрипта
      if (props.translatedAudio) {
        volTranslated.value = props.translatedAudio.volume;
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
      let val = 0;
      if (target === "ORIGINAL" && videoElement) {
        videoElement.volume = volOriginal.value;
        val = volOriginal.value;
      } else if (target === "TRANSLATED") {
        // Змінюємо гучність об'єкта Audio, що прийшов через пропси
        props.translatedAudio.volume = volTranslated.value;
        val = volTranslated.value;
      }
      // NEW11: Передаємо подію зміни гучності назовні для синхронізації з Попапом
      emit("volume-changed", { target, value: val });
    };

    return {
      volOriginal,
      volTranslated,
      triggerAction,
      changeVolume,
      setExternalOriginalVolume, // NEW9 CRITICAL: тепер функції існують і безпечно віддаються назовні
      setExternalTranslatedVolume, // NEW9 CRITICAL: тепер функції існують і безпечно віддаються назовні
      localSubSettings,
      activeTextEN,
      activeTextUK,
      setExternalSubtitlesState,
      updateActiveSubtitlesText,
      dispatchLocalSubSettings,
      requestLocalSRTDownload,
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

button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
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
