<template>
    <div class="ver-header">
        <div class="ver-header-component">
            <div class="logo">
                <img :src="logo" alt="Logo">
            </div>
            <div class="ver-header-login">
                <div v-if="!isAuthenticated">
                    <button @click="handleAuth">Увійти через Google</button>
                </div>

                <div v-else>
                    <button @click="logout" style="margin-top: 10px">Вийти</button>
                </div>
            </div>
        </div>
    </div>
    <!-- Кнопка старту -->
    <div v-if="!showTranslationProgress" class="btn-start-wrapper">
        <button  @click="startTranslation" class="btn-start">
            Почати захоплення
        </button>
    </div>

    <!-- Блок прогресу -->
    <div v-if="showTranslationProgress" class="translation-progress">
        <h2 class="translation-title">Перекладаю аудіо...</h2>
        <p class="translation-time">12s</p>

        <!-- Загальний прогрес -->
        <div class="main-progress-wrapper">
            <div class="main-progress-fill"></div>
            <span class="main-progress-percent">20%</span>
        </div>

        <!-- Оригінал -->
        <div class="audio-slider">
            <span class="audio-label">Оригінал</span>

            <input type="range" min="0" max="100" v-model="originalVolume" class="range-slider" />

            <span class="audio-percent">{{ originalVolume }}%</span>
        </div>

        <!-- Переклад -->
        <div class="audio-slider">
            <span class="audio-label">Переклад</span>

            <input type="range" min="0" max="100" v-model="translatedVolume" class="range-slider" />

            <span class="audio-percent">{{ translatedVolume }}%</span>
        </div>
    </div>

</template>
<script>
import logo from "../assets/logo.svg";
import { ref, onMounted } from "vue";

export default {
    name: "VerBoss",
    data() {
        return {
            logo,
        };
    },

    setup() {
        const originalVolume = ref(100);
        const translatedVolume = ref(100);
        const showTranslationProgress = ref(false);
        const message = "I am text of VerBoss";
        const count = ref(0);
        const isAuthenticated = ref(false);
        const authUrl = "https://sponge-subzero-gating.ngrok-free.dev/login/google";
        const accessToken = ref("");

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
            // Показуємо блок прогресу
            showTranslationProgress.value = true;
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
            logo,
            message,
            count,
            increment,
            isAuthenticated,
            accessToken,
            authUrl,
            handleAuth: login,
            logout,
            startTranslation,
            showTranslationProgress,
            originalVolume,
            translatedVolume,
        };
    },
};
</script>

<style scoped></style>