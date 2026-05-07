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
    const authUrl = "https://trifle-blah-deplete.ngrok-free.dev/login/google";
    const accessToken = ref("");

    // Функція ініціації входу
    const login = () => {
      const AUTH_URL =
        "https://trifle-blah-deplete.ngrok-free.dev/login/google";

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
