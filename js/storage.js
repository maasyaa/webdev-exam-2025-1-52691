(() => {
  'use strict'

  const CART_KEY = 'webexam_korzina_good_ids'

  // Читает ID товаров из корзины из localStorage
  function readCartIds () {
    try {
      const raw = localStorage.getItem(CART_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed
        .map(n => Number(n))
        .filter(n => Number.isFinite(n))
    } catch (e) {
      return []
    }
  }

  // Сохраняет ID товаров корзины в localStorage
  function writeCartIds (ids) {
    const clean = Array.from(new Set(ids.map(n => Number(n)).filter(n => Number.isFinite(n))))
    localStorage.setItem(CART_KEY, JSON.stringify(clean))
  }

  // Добавляет товар в корзину
  function addToCart (goodId) {
    const ids = readCartIds()
    const idNum = Number(goodId)
    if (!Number.isFinite(idNum)) return
    if (!ids.includes(idNum)) {
      ids.push(idNum)
      writeCartIds(ids)
    }
  }

  // Удаляет товар из корзины
  function removeFromCart (goodId) {
    const idNum = Number(goodId)
    if (!Number.isFinite(idNum)) return
    const ids = readCartIds().filter(id => id !== idNum)
    writeCartIds(ids)
  }

  // Очищает корзину
  function clearCart () {
    localStorage.removeItem(CART_KEY)
  }

  // Проверяет, есть ли товар в корзине
  function isInCart (goodId) {
    const idNum = Number(goodId)
    if (!Number.isFinite(idNum)) return false
    return readCartIds().includes(idNum)
  }

  // Возвращает количество товаров в корзине
  function getCartCount () {
    return readCartIds().length
  }

  // Отправляет событие об изменении корзины
  function notifyCartUpdated () {
    window.dispatchEvent(new CustomEvent('webexam:korzina-updated'))
  }

  // Добавляет товар в корзину и отправляет уведомление
  function addAndNotify (goodId) {
    addToCart(goodId)
    notifyCartUpdated()
  }

  // Удаляет товар из корзины и отправляет уведомление
  function removeAndNotify (goodId) {
    removeFromCart(goodId)
    notifyCartUpdated()
  }

  // Очищает корзину и отправляет уведомление
  function clearAndNotify () {
    clearCart()
    notifyCartUpdated()
  }

  // Форматирует цену (добавляет ₽)
  function formatPrice (value) {
    const n = Number(value)
    if (!Number.isFinite(n)) return '0 ₽'
    return `${Math.round(n)} ₽`
  }

  // Экспорт всех функций хранилища для использования в других модулях
  window.WebExamStorage = {
    CART_KEY,
    readCartIds,
    writeCartIds,
    addToCart: addAndNotify,
    removeFromCart: removeAndNotify,
    clearCart: clearAndNotify,
    isInCart,
    getCartCount,
    formatPrice
  }
})()