<template>
    <div class="ver-header">
        <div class="ver-header-component">
            <div class="logo">
                <img :src="logo" alt="Logo">
                <h1>{{ nameLogo }}</h1>
            </div>
        </div>
    </div>
    <!-- toLogin -->
    <div class="ver-hero-Login">
        <div class="ver-hero-Login-img__lock">
            <img :src="lockLogin" alt="Lock Login">
        </div>
        <div class="ver-hero-login-text">
            <h2>Увійдіть для перекладу</h2>
            <h3>Авторизація через Google дозволить безкоштовно переглядати відео на YouTube</h3>
        </div>
    </div>
    <!-- notActiveMova -->
    <div class="ver-centerInformation-notActiveMova">
        <h2>З мови: Блоковано(Sing in)</h2>
        <h2>На мову: Блоковано(Sing in)</h2>
        <div v-if="!isAuthenticated" class="terms-wrapper" :class="{ 'has-error': hasError }">
            <label class="terms-label">
                <span>Погоджуюсь з умовами сервісу</span>
                <input type="checkbox" v-model="isAgreed" class="terms-checkbox">
            </label>
        </div>
    </div>
    <!-- Login -->

    <div class="ver-nadFooter-login">
        <div v-if="!isAuthenticated">
            <button @click="handleAuth">Увійти через Google</button>
        </div>
        <div class="ver-footer-recklames">
            <h3>Курси англійської зі знижкою 50%! <a href="">Дізнатись більше -></a></h3>
        </div>

        <!-- <div v-else>
            <button @click="logout" style="margin-top: 10px">Вийти</button>
        </div> -->
    </div>

    <!-- Кнопка старту -->
    <!-- <div v-if="!showTranslationProgress" class="btn-start-wrapper">
        <button  @click="startTranslation" class="btn-start">
            Почати захоплення
        </button>
    </div> -->
</template>
<script>
import logo from "../assets/logo.svg";
import lockLogin from "../assets/lock-login.svg";
import { ref, onMounted } from "vue";

export default {
    name: "VerBoss",
    data() {
        return {
            logo,
            lockLogin,
        };
    },

    setup() {
        const nameLogo = "VerBoss";
        const isAuthenticated = ref(false);
        const accessToken = ref("");
        const isAgreed = ref(false);
        const hasError = ref(false);

        // Функція ініціації входу
        const login = () => {

            if (!isAgreed.value) {
                hasError.value = true; // Вмикаємо червоне підсвічування
                // Через 1.5 секунди вимикаємо, щоб анімацію можна було тригеренути повторно
                setTimeout(() => {
                    hasError.value = false;
                }, 1500);

                return; // Зупиняємо виконання, далі код авторизації не йде
            }

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
            logo,
            lockLogin,
            message,
            count,
            increment,
            isAuthenticated,
            accessToken,
            nameLogo,
            authUrl,
            handleAuth: login,
            logout,
            startTranslation,
            isAgreed,
            hasError,
        };
    },
};
</script>

<style scoped></style>

