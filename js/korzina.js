(() => {
  'use strict'

  function qs (sel) {
    return document.querySelector(sel)
  }

  function setHidden (el, hidden) {
    if (!el) return
    el.classList.toggle('d-none', Boolean(hidden))
  }

  function showLoading (show) {
    setHidden(qs('#loadingIndicator'), !show)
  }

  function notify (type, text) {
    const box = qs('#notifications')
    if (!box) return

    const cls =
      type === 'success' ? 'alert-success' :
      type === 'danger' ? 'alert-danger' :
      'alert-primary'

    const el = document.createElement('div')
    el.className = `alert ${cls} d-flex align-items-center justify-content-between mb-0`
    el.setAttribute('role', 'alert')
    el.innerHTML = `
      <div>${text}</div>
      <button type="button" class="btn btn-sm btn-outline-secondary">Ок</button>
    `

    const btn = el.querySelector('button')
    btn.addEventListener('click', () => el.remove())

    box.prepend(el)

    setTimeout(() => {
      if (el.isConnected) el.remove()
    }, 5000)
  }

  function pickPrice (good) {
    const dp = Number(good.discount_price)
    const ap = Number(good.actual_price)
    if (Number.isFinite(dp) && dp > 0 && dp < ap) return dp
    if (Number.isFinite(dp) && dp > 0 && !Number.isFinite(ap)) return dp
    return Number.isFinite(ap) ? ap : 0
  }

  function renderCartItem (good) {
    const price = pickPrice(good)
    const hasDiscount = Number(good.discount_price) > 0 && Number(good.discount_price) < Number(good.actual_price)

    const priceHtml = hasDiscount
      ? `<div class="d-flex align-items-baseline gap-2">
          <div class="fw-semibold">${window.WebExamStorage.formatPrice(price)}</div>
          <div class="text-muted text-decoration-line-through small">${window.WebExamStorage.formatPrice(good.actual_price)}</div>
        </div>`
      : `<div class="fw-semibold">${window.WebExamStorage.formatPrice(price)}</div>`

    return `
      <div class="col-12 col-md-6">
        <div class="card h-100">
          <img src="${good.image_url}" class="card-img-top" alt="">
          <div class="card-body d-flex flex-column">
            <div class="d-flex justify-content-between gap-2">
              <h3 class="h6 mb-1">${good.name}</h3>
              <span class="text-muted small">#${good.id}</span>
            </div>
            <div class="text-muted small mb-2">${good.main_category}</div>
            <div class="text-muted small mb-2">Рейтинг: ${Number(good.rating).toFixed(1)}</div>
            ${priceHtml}
            <button class="btn btn-outline-danger mt-auto" type="button" data-remove-id="${good.id}">
              <i class="bi bi-trash me-1"></i>Удалить
            </button>
          </div>
        </div>
      </div>
    `
  }

  function getGoodsSum (goods) {
    return goods.reduce((sum, g) => sum + pickPrice(g), 0)
  }

  function parseIntervalStartHour (interval) {
    const s = String(interval || '')
    const m = s.match(/^(\d{2}):(\d{2})/)
    if (!m) return null
    const h = Number(m[1])
    return Number.isFinite(h) ? h : null
  }

  function calcDeliveryCost () {
    const dateStr = qs('#deliveryDate')?.value || ''
    const interval = qs('#deliveryInterval')?.value || ''

    if (!dateStr) return 0

    const dt = new Date(`${dateStr}T00:00:00`)
    const day = dt.getDay() // 0 вс ... 6 сб

    const base = 200
    const isWeekend = (day === 0 || day === 6)
    if (isWeekend) return base + 300

    const startHour = parseIntervalStartHour(interval)
    if (startHour !== null && startHour >= 18) return base + 200

    return base
  }

  function updateTotals (goods) {
    const goodsSum = getGoodsSum(goods)
    const deliverySum = calcDeliveryCost()
    const totalSum = goodsSum + deliverySum

    qs('#goodsSumText').textContent = window.WebExamStorage.formatPrice(goodsSum)
    qs('#deliverySumText').textContent = window.WebExamStorage.formatPrice(deliverySum)
    qs('#totalSumText').textContent = window.WebExamStorage.formatPrice(totalSum)
  }

  function updateCartBadge () {
    const badge = qs('#korzinaCountBadge')
    if (!badge) return
    badge.textContent = window.WebExamStorage.getCartCount()
  }

  function setSubmitEnabled (enabled) {
    const btn = qs('#submitOrderBtn')
    if (!btn) return
    btn.disabled = !enabled
  }

  async function loadGoodsByCartIds (ids) {
    const tasks = ids.map(async (id) => {
      try {
        return await window.WebExamApi.getGoodById(id)
      } catch (e) {
        return null
      }
    })

    const res = await Promise.all(tasks)
    return res.filter(Boolean)
  }

  async function renderCart () {
    const grid = qs('#korzinaGrid')
    const empty = qs('#emptykorzina')
    if (!grid || !empty) return

    const ids = window.WebExamStorage.readCartIds()

    updateCartBadge()

    if (ids.length === 0) {
      grid.innerHTML = ''
      setHidden(empty, false)
      setSubmitEnabled(false)
      updateTotals([])
      return
    }

    setHidden(empty, true)
    showLoading(true)

    const goods = await loadGoodsByCartIds(ids)

    showLoading(false)

    if (goods.length === 0) {
      grid.innerHTML = ''
      setHidden(empty, false)
      setSubmitEnabled(false)
      updateTotals([])
      notify('danger', 'Не удалось загрузить товары корзины.')
      return
    }

    grid.innerHTML = goods.map(renderCartItem).join('')
    setSubmitEnabled(true)
    updateTotals(goods)
  }

  function bindCartActions () {
    qs('#korzinaGrid')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-remove-id]')
      if (!btn) return

      const id = Number(btn.getAttribute('data-remove-id'))
      if (!Number.isFinite(id)) return

      window.WebExamStorage.removeFromCart(id)
      await renderCart()
      notify('info', 'Товар удалён из корзины.')
    })

    qs('#clearKorzinaBtn')?.addEventListener('click', async () => {
      const ids = window.WebExamStorage.readCartIds()
      if (ids.length === 0) return

      window.WebExamStorage.clearCart()
      await renderCart()
      notify('info', 'Корзина очищена.')
    })

    // qs('#deliveryDate')?.addEventListener('change', async () => {
    //   await renderCart()
    // })

    // qs('#deliveryInterval')?.addEventListener('change', async () => {
    //   await renderCart()
    // })



    window.addEventListener('webexam:korzina-updated', async () => {
      await renderCart()
    })
  }

  function setMinDeliveryDate () {
    const input = qs('#deliveryDate')
    if (!input) return
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    input.min = `${yyyy}-${mm}-${dd}`
  }

  async function handleOrderSubmit (e) {
    e.preventDefault()

    const form = e.target
    const ids = window.WebExamStorage.readCartIds()

    if (ids.length === 0) {
      notify('danger', 'Корзина пуста.')
      return
    }

    // Извлекаем значения напрямую из элементов формы
    const fullNameEl = qs('#fullName')
    const emailEl = qs('#email')
    const phoneEl = qs('#phone')
    const addressEl = qs('#address')
    const deliveryDateEl = qs('#deliveryDate')
    const deliveryIntervalEl = qs('#deliveryInterval')
    const subscribeEl = qs('#subscribe')
    const commentEl = qs('#comment')

    const fullName = (fullNameEl?.value || '').trim()
    const email = (emailEl?.value || '').trim()
    const phone = (phoneEl?.value || '').trim()
    const deliveryAddress = (addressEl?.value || '').trim()
    const deliveryInterval = (deliveryIntervalEl?.value || '').trim()
    const deliveryDate = (deliveryDateEl?.value || '').trim() // Формат YYYY-MM-DD, как в profile.js
    const subscribe = subscribeEl?.checked ? 1 : 0
    const commentValue = (commentEl?.value || '').trim()

    // Валидация обязательных полей
    if (!fullName || !email || !phone || !deliveryAddress || !deliveryDate || !deliveryInterval) {
      const missingFields = []
      if (!fullName) missingFields.push('Имя')
      if (!email) missingFields.push('Email')
      if (!phone) missingFields.push('Телефон')
      if (!deliveryAddress) missingFields.push('Адрес доставки')
      if (!deliveryDate) missingFields.push('Дата доставки')
      if (!deliveryInterval) missingFields.push('Временной интервал')
      notify('danger', `Заполните все обязательные поля: ${missingFields.join(', ')}`)
      return
    }

    // Убеждаемся, что good_ids - это массив чисел
    const goodIds = ids.map(id => Number(id)).filter(id => Number.isFinite(id))

    if (goodIds.length === 0) {
      notify('danger', 'В корзине нет товаров.')
      return
    }

    // Формируем объект заказа - точно так же, как в profile.js для updateOrder
    const orderData = {
      full_name: fullName,
      email: email,
      phone: phone,
      delivery_address: deliveryAddress,
      delivery_date: deliveryDate, // Формат YYYY-MM-DD, как в profile.js
      delivery_interval: deliveryInterval,
      subscribe: subscribe,
      good_ids: goodIds
    }

    // Добавляем comment только если он не пустой (не добавляем null)
    if (commentValue) {
      orderData.comment = commentValue
    }

    try {
      showLoading(true)
      await window.WebExamApi.createOrder(orderData)

      window.WebExamStorage.clearCart()
      form.reset()

      notify('success', 'Заказ успешно оформлен!')
      await renderCart()

      // Перенаправление на страницу профиля через небольшую задержку
      setTimeout(() => {
        window.location.href = 'profile.html'
      }, 2000)
    } catch (e) {
      // Пытаемся извлечь детальную информацию об ошибке
      let errorMessage = 'Не удалось оформить заказ'
      if (e.data) {
        if (typeof e.data === 'string') {
          errorMessage += ': ' + e.data
        } else if (e.data.error) {
          errorMessage += ': ' + e.data.error
        } else if (e.data.message) {
          errorMessage += ': ' + e.data.message
        } else if (Array.isArray(e.data.errors)) {
          const errors = e.data.errors.map(err => err.message || err).join('; ')
          errorMessage += ': ' + errors
        }
      } else if (e.message) {
        errorMessage += ': ' + e.message
      }

      notify('danger', errorMessage)
    } finally {
      showLoading(false)
    }
  }

  function bindOrderForm () {
    const form = qs('#orderForm')
    if (!form) return

    form.addEventListener('submit', handleOrderSubmit)

    // Обновление итогов при изменении даты/интервала доставки
    qs('#deliveryDate')?.addEventListener('change', async () => {
      const ids = window.WebExamStorage.readCartIds()
      if (ids.length === 0) return
      const goods = await loadGoodsByCartIds(ids)
      updateTotals(goods)
    })

    qs('#deliveryInterval')?.addEventListener('change', async () => {
      const ids = window.WebExamStorage.readCartIds()
      if (ids.length === 0) return
      const goods = await loadGoodsByCartIds(ids)
      updateTotals(goods)
    })
  }

  function bind () {
    setMinDeliveryDate()
    bindCartActions()
    bindOrderForm()
    renderCart()
  }

  document.addEventListener('DOMContentLoaded', bind)
})()
