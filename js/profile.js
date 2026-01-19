(() => {
  'use strict'

  // Возвращает первый элемент по селектору
  function qs (sel) {
    return document.querySelector(sel)
  }

  // Возвращает все элементы по селектору
  function qsa (sel) {
    return Array.from(document.querySelectorAll(sel))
  }

  // Скрывает/отображает элемент
  function setHidden (el, hidden) {
    if (!el) return
    el.classList.toggle('d-none', Boolean(hidden))
  }

  // Показывает/скрывает индикатор загрузки
  function showLoading (show) {
    setHidden(qs('#loadingIndicator'), !show)
  }

  // Отображает уведомление пользователю
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

    el.querySelector('button').addEventListener('click', () => el.remove())
    box.prepend(el)

    setTimeout(() => {
      if (el.isConnected) el.remove()
    }, 5000)
  }

  // Форматирует дату в русский формат
  function formatDate (iso) {
    if (!iso) return '—'
    const d = new Date(iso)
    if (isNaN(d)) return '—'
    return d.toLocaleDateString('ru-RU')
  }

  // Форматирует цену (добавляет ₽)
  function formatPrice (v) {
    return window.WebExamStorage.formatPrice(v)
  }

  // Обновляет значок количества товаров в корзине
  function updateCartBadge () {
    const badge = qs('#korzinaCountBadge')
    if (!badge) return
    badge.textContent = window.WebExamStorage.getCartCount()
  }

  // Показывает состояние "нет заказов"
  function renderEmpty () {
    setHidden(qs('#emptyState'), false)
    qs('#ordersTbody').innerHTML = ''
  }

  // Рассчитывает сумму заказа
  function calculateOrderSum (order) {
    // Если есть total_sum, используем его
    if (order.total_sum && order.total_sum > 0) {
      return order.total_sum
    }
    
    // Если есть goods с ценами, вычисляем сумму
    if (order.goods && Array.isArray(order.goods) && order.goods.length > 0) {
      return order.goods.reduce((sum, g) => {
        const price = (g.discount_price && g.discount_price > 0 && g.discount_price < (g.actual_price || Infinity))
          ? g.discount_price
          : (g.actual_price || g.price || 0)
        const count = g.quantity || 1
        return sum + (price * count)
      }, 0)
    }
    
    return 0
  }

  // Отображает заказы в таблице
  function renderTable (orders) {
    const tbody = qs('#ordersTbody')
    if (!tbody) return

    if (!orders || orders.length === 0) {
      renderEmpty()
      return
    }

    setHidden(qs('#emptyState'), true)

    tbody.innerHTML = orders.map(o => {
      // Определяем количество товаров - может быть в goods или good_ids
      const goodsCount = o.goods ? o.goods.length : (o.good_ids ? o.good_ids.length : 0)
      
      // Вычисляем сумму заказа
      const totalSum = calculateOrderSum(o)
      
      return `
      <tr data-id="${o.id}">
        <td>${o.id}</td>
        <td>${formatDate(o.created_at)}</td>
        <td>${goodsCount}</td>
        <td>${formatPrice(totalSum)}</td>
        <td>${formatDate(o.delivery_date)} ${o.delivery_interval || ''}</td>
        <td class="text-end">
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-primary" data-action="details">Подробнее</button>
            <button class="btn btn-outline-secondary" data-action="edit">Изменить</button>
            <button class="btn btn-outline-danger" data-action="delete">Удалить</button>
          </div>
        </td>
      </tr>
    `}).join('')
  }

  // Асинхронно загружает суммы для заказов, где они не были вычислены
  async function loadOrderSums (orders) {
    // Для заказов с good_ids без total_sum загружаем товары и вычисляем сумму
    const ordersNeedingSums = orders.filter(o => 
      !o.total_sum && o.good_ids && Array.isArray(o.good_ids) && o.good_ids.length > 0
    )

    if (ordersNeedingSums.length === 0) return

    // Загружаем все уникальные ID товаров
    const allGoodIds = new Set()
    ordersNeedingSums.forEach(order => {
      order.good_ids.forEach(id => allGoodIds.add(id))
    })

    // Загружаем данные о товарах
    const goodsMap = new Map()
    const goodsPromises = Array.from(allGoodIds).map(async (id) => {
      try {
        const good = await window.WebExamApi.getGoodById(id)
        return good ? { id, good } : null
      } catch (e) {
        return null
      }
    })

    const goodsResults = await Promise.all(goodsPromises)
    goodsResults.forEach(result => {
      if (result) {
        goodsMap.set(result.id, result.good)
      }
    })

    // Вычисляем суммы и обновляем таблицу
    ordersNeedingSums.forEach(order => {
      const goodsCount = {}
      order.good_ids.forEach(id => {
        goodsCount[id] = (goodsCount[id] || 0) + 1
      })

      const totalSum = Object.entries(goodsCount).reduce((sum, [id, count]) => {
        const good = goodsMap.get(Number(id))
        if (good) {
          const price = (good.discount_price && good.discount_price > 0 && good.discount_price < (good.actual_price || Infinity))
            ? good.discount_price
            : (good.actual_price || good.price || 0)
          return sum + (price * count)
        }
        return sum
      }, 0)

      // Обновляем ячейку суммы в таблице
      const row = qs(`tr[data-id="${order.id}"]`)
      if (row) {
        const sumCell = row.querySelector('td:nth-child(4)')
        if (sumCell) {
          sumCell.textContent = formatPrice(totalSum)
        }
      }
    })
  }

  // Загружает список заказов
  async function loadOrders () {
    showLoading(true)
    try {
      const orders = await window.WebExamApi.getOrders()
      const ordersArray = Array.isArray(orders) ? orders : []
      renderTable(ordersArray)
      
      // Асинхронно загружаем суммы для заказов, где они не были вычислены
      loadOrderSums(ordersArray).catch(() => {
        // Игнорируем ошибки при загрузке сумм
      })
    } catch (e) {
      notify('danger', 'Не удалось загрузить заказы.')
      renderEmpty()
    } finally {
      showLoading(false)
    }
  }

  // Открывает модальное окно просмотра заказа
  async function openDetails (id) {
    try {
      const o = await window.WebExamApi.getOrderById(id)

      qs('#d_id').textContent = o.id
      qs('#d_date').textContent = formatDate(o.created_at)
      qs('#d_name').textContent = o.full_name
      qs('#d_email').textContent = o.email
      qs('#d_phone').textContent = o.phone
      qs('#d_address').textContent = o.delivery_address
      qs('#d_delivery').textContent =
        `${formatDate(o.delivery_date)} ${o.delivery_interval || ''}`
      qs('#d_comment').textContent = o.comment || '—'

      // Обработка товаров - может быть goods или good_ids
      const goodsBox = qs('#d_goods')
      let loadedGoods = []
      
      if (goodsBox) {
        let goodsHtml = ''
        
        if (o.goods && Array.isArray(o.goods) && o.goods.length > 0) {
          // Если товары уже в объекте заказа
          loadedGoods = o.goods
          goodsHtml = o.goods.map(g =>
            `<div>#${g.id} — ${g.name || 'Товар'}</div>`
          ).join('')
        } else if (o.good_ids && Array.isArray(o.good_ids) && o.good_ids.length > 0) {
          // Если только ID товаров - загружаем их
          const uniqueIds = [...new Set(o.good_ids)]
          const goodsPromises = uniqueIds.map(async (goodId) => {
            try {
              const good = await window.WebExamApi.getGoodById(goodId)
              return good
            } catch (e) {
              return null
            }
          })
          
          loadedGoods = await Promise.all(goodsPromises)
          const goods = loadedGoods.filter(Boolean)
          const goodsCount = {}
          o.good_ids.forEach(id => {
            goodsCount[id] = (goodsCount[id] || 0) + 1
          })
          
          goodsHtml = goods.map(good => {
            const count = goodsCount[good.id] || 1
            const name = good.name || good.title || `Товар #${good.id}`
            return `<div>#${good.id} — ${name}${count > 1 ? ` (${count} шт.)` : ''}</div>`
          }).join('')
        }
        
        goodsBox.innerHTML = goodsHtml || '<div>Товары не указаны</div>'
      }
      
      // Вычисляем сумму, если её нет
      let totalSum = o.total_sum
      if (!totalSum && loadedGoods.length > 0) {
        const goodsCount = {}
        if (o.good_ids) {
          o.good_ids.forEach(id => {
            goodsCount[id] = (goodsCount[id] || 0) + 1
          })
        }
        
        totalSum = loadedGoods.filter(Boolean).reduce((sum, g) => {
          const price = g.discount_price && g.discount_price > 0 && g.discount_price < (g.actual_price || Infinity)
            ? g.discount_price
            : (g.actual_price || g.price || 0)
          const count = goodsCount[g.id] || 1
          return sum + (price * count)
        }, 0)
      }
      
      qs('#d_total').textContent = formatPrice(totalSum || 0)

      new bootstrap.Modal(qs('#detailsModal')).show()
    } catch (e) {
      notify('danger', 'Не удалось загрузить заказ.')
    }
  }

  // Открывает модальное окно редактирования заказа
  async function openEdit (id) {
    try {
      const o = await window.WebExamApi.getOrderById(id)

      qs('#e_id').value = o.id
      qs('#e_full_name').value = o.full_name
      qs('#e_email').value = o.email
      qs('#e_phone').value = o.phone
      qs('#e_address').value = o.delivery_address
      qs('#e_delivery_date').value = o.delivery_date
      qs('#e_delivery_interval').value = o.delivery_interval
      qs('#e_subscribe').checked = Boolean(o.subscribe)
      qs('#e_comment').value = o.comment || ''

      new bootstrap.Modal(qs('#editModal')).show()
    } catch (e) {
      notify('danger', 'Не удалось открыть заказ.')
    }
  }

  // Сохраняет изменения в заказе
  async function saveEdit () {
    const id = qs('#e_id').value
    if (!id) return

    const payload = {
      full_name: qs('#e_full_name').value.trim(),
      email: qs('#e_email').value.trim(),
      phone: qs('#e_phone').value.trim(),
      delivery_address: qs('#e_address').value.trim(),
      delivery_date: qs('#e_delivery_date').value,
      delivery_interval: qs('#e_delivery_interval').value,
      subscribe: qs('#e_subscribe').checked ? 1 : 0,
      comment: qs('#e_comment').value.trim()
    }

    try {
      await window.WebExamApi.updateOrder(id, payload)
      bootstrap.Modal.getInstance(qs('#editModal')).hide()
      notify('success', 'Заказ обновлён.')
      loadOrders()
    } catch (e) {
      notify('danger', 'Не удалось сохранить изменения.')
    }
  }

  // Открывает модальное окно подтверждения удаления заказа
  function openDelete (id) {
    qs('#del_id').value = id
    qs('#del_label').textContent = `#${id}`
    new bootstrap.Modal(qs('#deleteModal')).show()
  }

  // Подтверждает удаление заказа
  async function confirmDelete () {
    const id = qs('#del_id').value
    if (!id) return

    try {
      await window.WebExamApi.deleteOrder(id)
      bootstrap.Modal.getInstance(qs('#deleteModal')).hide()
      notify('success', 'Заказ удалён.')
      loadOrders()
    } catch (e) {
      notify('danger', 'Не удалось удалить заказ.')
    }
  }

  // Привязывает обработчики к кнопкам действий с заказами
  function bindTableActions () {
    qs('#ordersTbody')?.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return

      const tr = btn.closest('tr')
      if (!tr) return

      const id = tr.getAttribute('data-id')
      if (!id) return

      const action = btn.getAttribute('data-action')

      if (action === 'details') openDetails(id)
      if (action === 'edit') openEdit(id)
      if (action === 'delete') openDelete(id)
    })
  }

  // Инициализирует страницу профиля
  function bind () {
    updateCartBadge()
    bindTableActions()

    qs('#refreshBtn')?.addEventListener('click', loadOrders)
    qs('#saveEditBtn')?.addEventListener('click', saveEdit)
    qs('#confirmDeleteBtn')?.addEventListener('click', confirmDelete)

    loadOrders()
  }

  document.addEventListener('DOMContentLoaded', bind)
})()