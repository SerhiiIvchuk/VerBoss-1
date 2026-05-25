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
      <button @click="startTranslation" class="btn-start">
        Почати захоплення
      </button>
      <button @click="logout" style="margin-top: 10px">Вийти</button>
      <!-- NEW: Контейнер панелі управління плеєром у Попапі -->
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

        <!-- NEW: Блок кнопок маніпуляцій відтворенням -->
        <div style="margin-bottom: 10px">
          <button @click="sendPlayerCommand('PLAY')">Відтворити</button>
          <button @click="sendPlayerCommand('PAUSE')" style="margin: 0 5px">
            Пауза
          </button>
          <button @click="sendPlayerCommand('REWIND')">На початок</button>
        </div>

        <!-- NEW: Повзунок керування оригінальною доріжкою відео -->
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

        <!-- NEW: Повзунок керування українською доріжкою перекладу -->
        <div>
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
      </div>
    </div>
  </div>
</template>
<script>
import { ref, onMounted } from "vue";

export default {
  name: "VerBoss",

  setup() {
    const message = "I am text of VerBoss";
    const count = ref(0);
    const isAuthenticated = ref(false);
    const authUrl = "https://sponge-subzero-gating.ngrok-free.dev/login/google";
    const accessToken = ref("");
    // NEW: Реактивні змінні для збереження рівнів гучності в інтерфейсі Попапу
    const volOriginal = ref(0.3);
    const volTranslated = ref(1.0);

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
            },
          );
        });
      } else {
        console.error("Chrome API не знайдено. Ви запустіть це як розширення?");
      }
    };
    // Життєвий цикл: Монтування
    onMounted(async () => {
      if (typeof chrome !== "undefined" && chrome.storage) {
        const result = await chrome.storage.local.get(["access_token"]);
        if (result.access_token) {
          accessToken.value = result.access_token;
          isAuthenticated.value = true;
        }
      }
      // NEW: При відкритті попапу запитуємо поточний стан гучності з вкладки, щоб синхронізувати повзунки
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(
            tabs[0].id,
            { type: "GET_PLAYER_STATE" },
            (response) => {
              if (response) {
                volOriginal.value = response.volOriginal;
                volTranslated.value = response.volTranslated;
              }
            },
          );
        }
      });
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
      // NEW: Експортуємо нові змінні та методи для темплейту Vue
      volOriginal,
      volTranslated,
      sendPlayerCommand,
      updateVolume,
    };
  },
};
</script>

<style scoped>
/* Стилі можна винести сюди, щоб не захаращувати HTML */
h3 {
  font-family: sans-serif;
}
</style>
