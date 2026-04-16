<template>
    <div>
        <h3 style="color: green;">{{ message }}</h3>
        <p>Лічильник: {{ count }}</p>
        <button @click="increment">Додати</button>
    </div>
</template>
<script>
import { ref, onMounted } from 'vue';

export default {
    name: "TestModuleOne",

    // setup() залишається таким же, як ти звик
    setup() {
        const message = "I am text of the test component one";
        const count = ref(0);

        const increment = () => {
            count.value++;
        };

        // Ось твій mounted (життєвий цикл)
        onMounted(() => {
            console.log("Компонент один завантажився!");
        });

        // Все, що хочемо бачити в шаблоні, повертаємо тут
        return {
            message,
            count,
            increment,
        };
    }
}
</script>

<style scoped>
/* Стилі можна винести сюди, щоб не захаращувати HTML */
h3 {
    font-family: sans-serif;
}
</style>