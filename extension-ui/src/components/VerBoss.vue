<template>
  <div>
    <h3 style="color: green">{{ message }}</h3>
    <p>Лічильник: {{ count }} Щось оновити редірект</p>
    <button @click="increment">Додати</button>

    <div v-if="!isAuthenticated">
      <button @click="handleAuth">Увійти через Google</button>
    </div>

    <div v-else>
      <p>Вітаємо, залогінено!</p>
      <p>Ваш токен: {{ accessToken }}</p>
      <button
        v-if="!isCapturing"
        @click="startTranslation"
        class="btn-start"
        style="
          background-color: #4caf50;
          color: white;
          padding: 8px 12px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        "
      >
        Почати захоплення
      </button>
      <button
        v-else
        @click="stopTranslation"
        class="btn-stop"
        style="
          background-color: #f44336;
          color: white;
          padding: 8px 12px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        "
      >
        Припинити захоплення
      </button>
      <button @click="logout" style="margin-top: 10px">Вийти</button>
      <div
        class="player-controls"
        style="
          margin-top: 15px;
          padding: 10px;
          border: 1px solid #ccc;
          border-radius: 5px;
        "
      >
        <h4>Керування озвучкою</h4>

        <div style="margin-bottom: 10px">
          <button @click="sendPlayerCommand('PLAY')">Відтворити</button>
          <button @click="sendPlayerCommand('PAUSE')" style="margin: 0 5px">
            Пауза
          </button>
          <button @click="sendPlayerCommand('REWIND')">На початок</button>
        </div>

        <div style="margin-bottom: 5px">
          <label>Оригінал (EN): </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            v-model="volOriginal"
            @input="updateVolume('ORIGINAL')"
          />
          <span>{{ Math.round(volOriginal * 100) }}%</span>
        </div>

        <div style="margin-bottom: 10px">
          <label>Переклад (UA): </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            v-model="volTranslated"
            @input="updateVolume('TRANSLATED')"
          />
          <span>{{ Math.round(volTranslated * 100) }}%</span>
        </div>

        <div
          style="
            border-top: 1px dashed #ccc;
            padding-top: 10px;
            font-size: 12px;
          "
        >
          <h4 style="margin: 0 0 8px 0">Налаштування субтитрів</h4>

          <div
            style="
              display: flex;
              justify-content: space-between;
              margin-bottom: 4px;
            "
          >
            <span>EN оригінал:</span>
            <label
              ><input
                type="checkbox"
                v-model="subSettings.en.generate"
                @change="dispatchSubSettings(true)"
              />
              Генерувати</label
            >
            <label
              ><input
                type="checkbox"
                v-model="subSettings.en.visible"
                :disabled="!subSettings.en.generate"
                @change="dispatchSubSettings(false)"
              />
              Екран</label
            >
            <button
              @click="requestSRTDownload('en')"
              :disabled="subSettings.en.progress === 0"
            >
              💾 .SRT
            </button>
          </div>
          <div
            style="
              width: 100%;
              background: #eee;
              height: 4px;
              margin-bottom: 8px;
              border-radius: 2px;
            "
          >
            <div
              :style="{ width: subSettings.en.progress + '%' }"
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
            <label
              ><input
                type="checkbox"
                v-model="subSettings.uk.generate"
                @change="dispatchSubSettings(true)"
              />
              Генерувати</label
            >
            <label
              ><input
                type="checkbox"
                v-model="subSettings.uk.visible"
                :disabled="!subSettings.uk.generate"
                @change="dispatchSubSettings(false)"
              />
              Екран</label
            >
            <button
              @click="requestSRTDownload('uk')"
              :disabled="subSettings.uk.progress === 0"
            >
              💾 .SRT
            </button>
          </div>
          <div
            style="
              width: 100%;
              background: #eee;
              height: 4px;
              border-radius: 2px;
            "
          >
            <div
              :style="{ width: subSettings.uk.progress + '%' }"
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
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from "vue";

export default {
  name: "VerBoss",

  setup() {
    const message = "I am text of VerBoss";
    const count = ref(0);
    const isAuthenticated = ref(false);
    const authUrl = "https://trifle-blah-deplete.ngrok-free.dev/login/google";
    const accessToken = ref("");
    // NEW: Реактивні змінні для збереження рівнів гучності в інтерфейсі Попапу
    const volOriginal = ref(0.3);
    const volTranslated = ref(1.0);
    // NEW9: Стан для відстеження активності поточного стриму
    const isCapturing = ref(false);

    // NEW10: Реактивний об'єкт налаштувань субтитрів у Попапі
    const subSettings = ref({
      en: { generate: true, visible: false, progress: 0 },
      uk: { generate: true, visible: false, progress: 0 },
    });

    // NEW10 CRITICAL FIX: Створюємо сам обробник повідомлень, який ми реєструємо в onMounted
    const backgroundMessageListener = (message) => {
      if (message.type === "SUBTITLES_STATE_SYNC" && message.settings) {
        subSettings.value = message.settings;
      }
    };

    // NEW10: Передача конфігу субтитрів у Content Script при взаємодії користувача з елементами
    const dispatchSubSettings = (triggerSyncAudioCapture = false) => {
      // Якщо генерацію вимкнуто, примусово приховуємо з екрану згідно специфікації UX
      if (!subSettings.value.en.generate) subSettings.value.en.visible = false;
      if (!subSettings.value.uk.generate) subSettings.value.uk.visible = false;
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs
            .sendMessage(tabs[0].id, {
              type: "SUBTITLES_SETTINGS_CHANGE",
              settings: JSON.parse(JSON.stringify(subSettings.value)),
              triggerSyncAudioCapture: triggerSyncAudioCapture,
            })
            .catch(() => {});
        }
      });
    };

    // NEW10: Команда контент-скрипту згенерувати та завантажити файл SRT
    const requestSRTDownload = (lang) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs
            .sendMessage(tabs[0].id, {
              type: "TRIGGER_SRT_DOWNLOAD_ACTION",
              lang: lang,
            })
            .catch(() => {});
        }
      });
    };

    // NEW: Універсальна функція для надсилання команд маніпуляцій (Play/Pause/Rewind) в Content Script
    const sendPlayerCommand = (action) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: "PLAYER_ACTION",
            action,
          });
        }
      });
    };

    // NEW: Функція передачі нових значень гучності з повзунків Попапу в Content Script
    const updateVolume = (target) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          const value =
            target === "ORIGINAL" ? volOriginal.value : volTranslated.value;
          chrome.tabs.sendMessage(tabs[0].id, {
            type: "VOLUME_CHANGE",
            target,
            value: parseFloat(value),
          });
        }
      });
    };

    // Функція ініціації входу
    const login = () => {
      const AUTH_URL =
        "https://sponge-subzero-gating.ngrok-free.dev/login/google";

      // Викликаємо напряму, без зайвих перевірок, бо ми точно в розширенні
      chrome.identity.launchWebAuthFlow(
        {
          url: AUTH_URL,
          interactive: true,
        },
        (redirectUrl) => {
          console.log("УРА! Ми отримали URL:", redirectUrl);

          if (chrome.runtime.lastError) {
            console.error(
              "Помилка Identity API:",
              chrome.runtime.lastError.message,
            );
            alert("Помилка Chrome: " + chrome.runtime.lastError.message);
            return;
          }

          if (redirectUrl) {
            console.log("Отримано Redirect URL:", redirectUrl);

            const url = new URL(redirectUrl);
            const token = url.searchParams.get("token");
            if (token) {
              chrome.storage.local.set({ access_token: token }, () => {
                isAuthenticated.value = true;
                accessToken.value = token;
                console.log("Авторизація успішна!");
              });
            }
          }
        },
      );
    };

    const logout = () => {
      chrome.storage.local.remove("access_token", () => {
        accessToken.value = "";
        isAuthenticated.value = false;
      });
    };

    const increment = () => {
      count.value++;
    };

    const startTranslation = () => {
      // Перевіряємо, чи ми в середовищі розширення, щоб не було помилок при розробці
      if (typeof chrome !== "undefined" && chrome.tabs) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const activeTab = tabs[0];

          chrome.runtime.sendMessage(
            {
              type: "START_TRANSCRIPTION",
              tabId: activeTab.id,
            },
            (response) => {
              console.log("Відповідь від фону:", response);
              if (response && response.status === "Success") {
                // NEW9
                isCapturing.value = true; // NEW9: Стрим запущено, міняємо кнопку
                chrome.storage.local.set({ verboss_is_capturing: true }); // NEW9: Кешуємо стан
              } // NEW9
            },
          );
        });
      } else {
        console.error(
          "Chrome API не знайдено. Ви запуститіть це як розширення?",
        );
      }
    };

    // NEW9: Новий метод для припинення захоплення аудіо-потоку
    const stopTranslation = () => {
      if (typeof chrome !== "undefined" && chrome.tabs) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const activeTab = tabs[0];
          chrome.runtime.sendMessage(
            {
              type: "STOP_TRANSCRIPTION", // NEW9: Сигнал для background.js
              tabId: activeTab.id,
            },
            (response) => {
              console.log("Відповідь про зупинку від фону:", response);
              if (response && response.status === "Success") {
                isCapturing.value = false; // NEW9: Повертаємо кнопку старту
                chrome.storage.local.set({ verboss_is_capturing: false });
              }
            },
          );
        });
      }
    };

    // Життєвий цикл: Монтування
    onMounted(async () => {
      // NEW10: Додаємо слухач повідомлень, щоб попап на льоту отримував відсотки прогресу (навіть коли відкритий)
      if (typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime.onMessage.addListener(backgroundMessageListener);
      }

      if (typeof chrome !== "undefined" && chrome.storage) {
        // NEW9: Має бути (передаємо обидва ключі, щоб об'єкт result містив їх обидва):
        const result = await chrome.storage.local.get([
          "access_token",
          "verboss_is_capturing",
        ]);
        if (result.access_token) {
          accessToken.value = result.access_token;
          isAuthenticated.value = true;
        }
        // NEW9 CRITICAL: Замість if (result.verboss_is_capturing) робимо пряме присвоєння (бо там може бути false)
        isCapturing.value = !!result.verboss_is_capturing;
      }

      // NEW: При відкритті попапу запитуємо поточний стан гучності з вкладки, щоб синхронізувати повзунки
      if (typeof chrome !== "undefined" && chrome.tabs) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0] && tabs[0].url && !tabs[0].url.startsWith("chrome://")) {
            // Безпечна перевірка типу сторінки
            chrome.tabs.sendMessage(
              tabs[0].id,
              { type: "GET_PLAYER_STATE" },
              (response) => {
                // Перевіряємо runtime.lastError, щоб розширення не панікувало, якщо контент-скрипт ще не готовий
                if (chrome.runtime.lastError) {
                  console.log(
                    "VerBoss [Popup]: Контент-скрипт на цій сторінці ще не активний.",
                  );
                  return;
                }
                if (response) {
                  // NEW10: Додаємо сюди стягування збереженого стану субтитрів при відкритті Попапу
                  if (response.subSettings) {
                    subSettings.value = response.subSettings;
                  }
                  volOriginal.value = response.volOriginal;
                  volTranslated.value = response.volTranslated;
                }
              },
            );
          }
        });
      }
    });

    onUnmounted(() => {
      if (typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime.onMessage.removeListener(backgroundMessageListener);
      }
    });

    return {
      message,
      count,
      increment,
      isAuthenticated,
      accessToken,
      authUrl,
      handleAuth: login,
      logout,
      startTranslation,
      stopTranslation, // NEW9: Експортуємо метод для темплейту
      isCapturing, // NEW9: Експортуємо змінну стану для v-if/v-else
      // NEW: Експортуємо нові змінні та методи для темплейту Vue
      volOriginal,
      volTranslated,
      subSettings, // NEW10
      dispatchSubSettings, // NEW10
      requestSRTDownload, // NEW10
      sendPlayerCommand,
      updateVolume,
    };
  },
};
</script>

<style scoped>
h3 {
  font-family: sans-serif;
}
</style>
