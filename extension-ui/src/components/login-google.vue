<template>
    <div class="ver-header">
        <div class="ver-header-component">
            <div class="logo">
                <img :src="logo" alt="Logo">
                <h1>{{ nameLogo }}</h1>
            </div>
        </div>
    </div>

    <div v-if="currentPanel === 1">
        <div class="ver-hero-Login">
            <div class="ver-hero-Login-img__lock">
                <img :src="lockLogin" alt="Lock Login">
            </div>
            <div class="ver-hero-login-text">
                <h2>Увійдіть для перекладу</h2>
                <h3>Авторизація через Google дозволить безкоштовно переглядати відео на YouTube</h3>
            </div>
        </div>

        <div class="ver-centerInformation-notActiveMova">
            <h2>З мови: Блоковано(Sing in)</h2>
            <h2>На мову: Блоковано(Sing in)</h2>
            <div class="terms-wrapper" :class="{ 'has-error': hasError }">
                <label class="terms-label">
                    <span>Погоджуюсь з умовами сервісу</span>
                    <input type="checkbox" v-model="isAgreed" class="terms-checkbox">
                </label>
            </div>
        </div>

        <div class="ver-nadFooter-login">
            <button @click="handleAuth">Увійти через Google</button>
        </div>
    </div>
    <!--! Панель налаштування перекладу -->
    <div v-else-if="currentPanel === 2">
        <div class="panel-2-hero-img__worldPanel2">
            <img :src="worldPanel2" alt="world Panel 2">
            <h2>Налаштуйте переклад</h2>
        </div>
        <div class="panel-2-main-twoBox-block">
            <div class="panel-2-main-ActiveMova">
                <div class="panel-2-main-ActiveMova-Zmova">
                    <h2>З мови:</h2>
                    <select name="" id="">
                        <option value="">Англійська</option>
                        <option value="">Українська</option>
                    </select>
                </div>
                <div class="panel-2-main-ActiveMova-Namova">
                    <h2>На мову:</h2>
                    <select name="" id="">
                        <option value="">Українська</option>
                        <option value="">Англійська</option>
                    </select>
                </div>
                <div class="panel-2-main-radio-voice">
                    <h2>Голос ШІ:</h2>
                    <label><input type="radio" name="voice" value="voice1"><span>Жіночий</span></label>
                    <label><input type="radio" name="voice" value="voice2"><span>Чоловічий</span></label>
                </div>
                <div class="panel-2-main-status-optima">
                    <h2>{{ statusTranslation }}</h2>
                </div>
                <div class="panel-2-main-logout">
                    <button @click="triggerLogout" class="btn-logout">Вийти з акаунта</button>
                </div>
            </div>
            <div class="panel-2-main-sound">
                <div class="volume-controls">
                    <div class="volume-item">
                        <div class="volume-label-row">
                            <h2>Гучність оригіналу:</h2>
                        </div>
                        <input type="range" min="0" max="100" v-model="originalVolume" class="volume-slider">
                    </div>
                    <div class="volume-item">
                        <div class="volume-label-row">
                            <h2>Гучність перекладу:</h2>
                        </div>
                        <input type="range" min="0" max="100" v-model="translationVolume" class="volume-slider">
                    </div>
                </div>
                <div class="panel-2-main-autoPausa">
                    <label>
                        <input type="checkbox">
                        <span>Автопауза при затримках звуку</span>
                    </label>
                </div>
                <div class="panel-3-nadFooter-login">
                    [27.05.2026 20:06] Dima: <button @click="triggerStartTranslation" class="btn-action-green">Почати
                        захоплення</button>
                </div>
            </div>
        </div>
    </div>

    <div v-else-if="currentPanel === 3">
        <div class="ver-centerInformation-notActiveMova">
            <h2 style="color: #1E7A57; text-align: center; padding-top: 15px;">Переклад активний...</h2>
        </div>

        <!-- NEW: Контейнер панелі управління плеєром у Попапі -->
        <div class="player-controls" style=" margin-top: 15px; padding: 10px; border: 1px solid #ccc; border-radius: 5px;
        ">
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
                <input type="range" min="0" max="1" step="0.05" v-model="volOriginal"
                    @input="updateVolume('ORIGINAL')" />
                <span>{{ Math.round(volOriginal * 100) }}%</span>
            </div>

            <!-- NEW: Повзунок керування українською доріжкою перекладу -->
            <div>
                <label>Переклад (UA): </label>
                <input type="range" min="0" max="1" step="0.05" v-model="volTranslated"
                    @input="updateVolume('TRANSLATED')" />
                <span>{{ Math.round(volTranslated * 100) }}%</span>
            </div>
        </div>

        <div class="ver-nadFooter-login">
            <button @click="triggerStopTranslation" class="btn-stop">Зупинити переклад</button>

            <button @click="triggerLogout" class="btn-logout">Вийти з акаунта</button>
        </div>
    </div>
    <div class="ver-footer-laine-top"></div>
    <div class="ver-footer-container">
        <div class="ver-footer-recklames">
            <h3>Курси англійської зі знижкою 50%! <a href="#">Дізнатись більше -></a></h3>
        </div>
    </div>
</template>

<script>
import logo from "../assets/logo.svg";
import lockLogin from "../assets/lock-login.svg";
import worldPanel2 from "../assets/World-translations.svg";
import { ref, onMounted } from "vue";

export default {
    name: "VerBoss",
    data() {
        return {
            logo,
            lockLogin,
            worldPanel2,
        };
    },

    setup() {
        const nameLogo = "VerBoss";
        const isAuthenticated = ref(false);
        const accessToken = ref("");
        const isAgreed = ref(false);
        const hasError = ref(false);
        const statusTranslation = "Відео вже оптимізовано (Кеш)"
        const selectedVoice = ref("male");
        const originalVolume = ref(50);    // Значення за замовчуванням 20%
        const translationVolume = ref(50); // Значення за замовчуванням 80%

        // Нова змінна для керування панелями (1, 2 або 3)
        const currentPanel = ref(1);

        // Логіка авторизації
        const login = () => {
            if (!isAgreed.value) {
                hasError.value = true;
                setTimeout(() => {
                    hasError.value = false;
                }, 1500);
                return;
            }

            const AUTH_URL = "https://sponge-subzero-gating.ngrok-free.dev/login/google";

            chrome.identity.launchWebAuthFlow(
                {
                    url: AUTH_URL,
                    interactive: true,
                },
                (redirectUrl) => {
                    console.log("УРА! Ми отримали URL:", redirectUrl);
                    if (chrome.runtime.lastError) {
                        console.error("Помилка Identity API:", chrome.runtime.lastError.message);
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

                                // Перемикаємо на другу панель після успішного входу!
                                currentPanel.value = 2;
                                console.log("Авторизація успішна, перехід на панель 2");
                            });
                        }
                    }
                }
            );
        };

        // Загальна функція виходу для 2 та 3 панелі
        const triggerLogout = () => {
            // Видаляємо і токен, і статус перекладу
            chrome.storage.local.remove(["access_token", "is_translating"], () => {
                accessToken.value = "";
                isAuthenticated.value = false;
                isAgreed.value = false; // Скидаємо чекбокс для безпеки
                currentPanel.value = 1;// Повертаємо на найпершу панель входу
                console.log("Користувач вийшов, дані сховища очищено");
            });
        };

        // Дія при натисканні "Почати захоплення"
        const triggerStartTranslation = () => {
            // Викликаємо твій фоновий скрипт перекладу
            startTranslationBackground();

            // Записуємо в сховище, що переклад запущено, і перемикаємо на панель 3
            chrome.storage.local.set({ is_translating: true }, () => {
                currentPanel.value = 3;
                console.log("Статус перекладу збережено: true");
            });
        };

        // Дія при натисканні "Зупинити переклад"
        const triggerStopTranslation = () => {
            console.log("Переклад зупинено");

            // Записуємо в сховище, що переклад зупинено, і повертаємо на панель 2
            chrome.storage.local.set({ is_translating: false }, () => {
                currentPanel.value = 2;
                console.log("Статус перекладу збережено: false");
            });
        };

        // Твоя рідна функція зв'язку з фоновим скриптом хрому
        const startTranslationBackground = () => {
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
                        }
                    );
                });
            } else {
                console.error("Chrome API не знайдено. Запущено не як розширення?");
            }
        };

        // Перевірка сесії при відкритті розширення
        onMounted(async () => {
            if (typeof chrome !== "undefined" && chrome.storage) {
                // Запитуємо одночасно і токен, і статус активності перекладу
                const result = await chrome.storage.local.get(["access_token", "is_translating"]);
                if (result.access_token) {
                    accessToken.value = result.access_token;
                    isAuthenticated.value = true;
                    // Розумна перевірка: куди саме перекидати користувача
                    if (result.is_translating === true) {
                        currentPanel.value = 3; // Переклад був активний — показуємо Панель 3
                        console.log("Сесія відновлена: переклад триває, відкриваємо панель 3");
                    } else {
                        currentPanel.value = 2; // Переклад не запускали — показуємо Панель 2 (налаштування)
                        console.log("Сесія відновлена: переклад неактивний, відкриваємо панель 2");
                    }
                }
            }
        });

        return {
            nameLogo,
            worldPanel2,
            isAuthenticated,
            accessToken,
            isAgreed,
            hasError,
            currentPanel,
            handleAuth: login,
            triggerLogout,
            triggerStartTranslation,
            triggerStopTranslation,
            statusTranslation,
            originalVolume,
            translationVolume,
        };
    },
};
</script>