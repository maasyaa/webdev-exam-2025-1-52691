// Хранит ID товаров, предоставляет методы добавления/удаления/очистки

(() => {
  'use strict';

  const CART_KEY = 'webexam_korzina_good_ids'; // Ключ для хранения в localStorage

  // Читает ID товаров из корзины
  function readCartIds() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map(n => Number(n))
        .filter(n => Number.isFinite(n));
    } catch (e) {
      return [];
    }
  }

  // Сохраняет ID товаров в корзине
  function writeCartIds(ids) {
    const clean = Array.from(new Set(ids.map(n => Number(n)).filter(n => Number.isFinite(n))));
    localStorage.setItem(CART_KEY, JSON.stringify(clean));
  }

  // Добавляет товар в корзину (если ещё не добавлен)
  function addToCart(goodId) {
    const ids = readCartIds();
    const idNum = Number(goodId);
    if (!Number.isFinite(idNum)) return;
    if (!ids.includes(idNum)) {
      ids.push(idNum);
      writeCartIds(ids);
    }
  }

  // Удаляет товар из корзины
  function removeFromCart(goodId) {
    const idNum = Number(goodId);
    if (!Number.isFinite(idNum)) return;
    const ids = readCartIds().filter(id => id !== idNum);
    writeCartIds(ids);
  }

  // Очищает корзину
  function clearCart() {
    localStorage.removeItem(CART_KEY);
  }

  // Проверяет, есть ли товар в корзине
  function isInCart(goodId) {
    const idNum = Number(goodId);
    if (!Number.isFinite(idNum)) return false;
    return readCartIds().includes(idNum);
  }

  // Возвращает количество товаров в корзине
  function getCartCount() {
    return readCartIds().length;
  }

  // Форматирует цену: округляет и добавляет ₽
  function formatPrice(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0 ₽';
    return `${Math.round(n)} ₽`;
  }

  // Генерирует событие обновления корзины (для других скриптов)
  function notifyUpdated() {
    window.dispatchEvent(new CustomEvent('webexam:korzina-updated'));
  }

  // Экспорт методов
  window.WebExamStorage = {
    addToCart: (id) => { addToCart(id); notifyUpdated(); },
    removeFromCart: (id) => { removeFromCart(id); notifyUpdated(); },
    clearCart: () => { clearCart(); notifyUpdated(); },
    isInCart,
    getCartCount,
    formatPrice,
    readCartIds
  };
})();