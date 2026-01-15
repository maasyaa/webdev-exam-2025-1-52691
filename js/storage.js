(() => {
  'use strict'

  const CART_KEY = 'webexam_korzina_good_ids'

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

  function writeCartIds (ids) {
    const clean = Array.from(new Set(ids.map(n => Number(n)).filter(n => Number.isFinite(n))))
    localStorage.setItem(CART_KEY, JSON.stringify(clean))
  }

  function addToCart (goodId) {
    const ids = readCartIds()
    const idNum = Number(goodId)
    if (!Number.isFinite(idNum)) return
    if (!ids.includes(idNum)) {
      ids.push(idNum)
      writeCartIds(ids)
    }
  }

  function removeFromCart (goodId) {
    const idNum = Number(goodId)
    if (!Number.isFinite(idNum)) return
    const ids = readCartIds().filter(id => id !== idNum)
    writeCartIds(ids)
  }

  function clearCart () {
    localStorage.removeItem(CART_KEY)
  }

  function isInCart (goodId) {
    const idNum = Number(goodId)
    if (!Number.isFinite(idNum)) return false
    return readCartIds().includes(idNum)
  }

  function getCartCount () {
    return readCartIds().length
  }

  function notifyCartUpdated () {
    window.dispatchEvent(new CustomEvent('webexam:korzina-updated'))
  }

  function addAndNotify (goodId) {
    addToCart(goodId)
    notifyCartUpdated()
  }

  function removeAndNotify (goodId) {
    removeFromCart(goodId)
    notifyCartUpdated()
  }

  function clearAndNotify () {
    clearCart()
    notifyCartUpdated()
  }

  function formatPrice (value) {
    const n = Number(value)
    if (!Number.isFinite(n)) return '0 ₽'
    return `${Math.round(n)} ₽`
  }

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
