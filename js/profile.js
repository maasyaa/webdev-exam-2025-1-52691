(() => {
  'use strict'

  function qs (sel) {
    return document.querySelector(sel)
  }

  function qsa (sel) {
    return Array.from(document.querySelectorAll(sel))
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

    el.querySelector('button').addEventListener('click', () => el.remove())
    box.prepend(el)

    setTimeout(() => {
      if (el.isConnected) el.remove()
    }, 5000)
  }

  function formatDate (iso) {
    if (!iso) return '—'
    const d = new Date(iso)
    if (isNaN(d)) return '—'
    return d.toLocaleDateString('ru-RU')
  }

  function formatPrice (v) {
    return window.WebExamStorage.formatPrice(v)
  }

  function updateCartBadge () {
    const badge = qs('#korzinaCountBadge')
    if (!badge) return
    badge.textContent = window.WebExamStorage.getCartCount()
  }

  function renderEmpty () {
    setHidden(qs('#emptyState'), false)
    qs('#ordersTbody').innerHTML = ''
  }

  function renderTable (orders) {
    const tbody = qs('#ordersTbody')
    if (!tbody) return

    if (!orders || orders.length === 0) {
      renderEmpty()
      return
    }

    setHidden(qs('#emptyState'), true)

    tbody.innerHTML = orders.map(o => `
      <tr data-id="${o.id}">
        <td>${o.id}</td>
        <td>${formatDate(o.created_at)}</td>
        <td>${(o.goods || []).length}</td>
        <td>${formatPrice(o.total_sum)}</td>
        <td>${formatDate(o.delivery_date)} ${o.delivery_interval || ''}</td>
        <td class="text-end">
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-primary" data-action="details">Подробнее</button>
            <button class="btn btn-outline-secondary" data-action="edit">Изменить</button>
            <button class="btn btn-outline-danger" data-action="delete">Удалить</button>
          </div>
        </td>
      </tr>
    `).join('')
  }

  async function loadOrders () {
    showLoading(true)
    try {
      const orders = await window.WebExamApi.getOrders()
      renderTable(Array.isArray(orders) ? orders : [])
    } catch (e) {
      notify('danger', 'Не удалось загрузить заказы.')
      renderEmpty()
    } finally {
      showLoading(false)
    }
  }

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
      qs('#d_total').textContent = formatPrice(o.total_sum)
      qs('#d_comment').textContent = o.comment || '—'

      const goodsBox = qs('#d_goods')
      if (goodsBox) {
        goodsBox.innerHTML = (o.goods || []).map(g =>
          `<div>#${g.id} — ${g.name}</div>`
        ).join('')
      }

      new bootstrap.Modal(qs('#detailsModal')).show()
    } catch (e) {
      notify('danger', 'Не удалось загрузить заказ.')
    }
  }

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

  function openDelete (id) {
    qs('#del_id').value = id
    qs('#del_label').textContent = `#${id}`
    new bootstrap.Modal(qs('#deleteModal')).show()
  }

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

  function bindApiKey () {
    const input = qs('#apiKeyInput')
    if (!input) return

    input.value = window.WebExamApi.getApiKey()

    qs('#apiKeySaveBtn')?.addEventListener('click', () => {
      window.WebExamApi.setApiKey(input.value.trim())
      notify('success', 'Ключ сохранён.')
      loadOrders()
    })

    qs('#apiKeyClearBtn')?.addEventListener('click', () => {
      window.WebExamApi.setApiKey('')
      input.value = ''
      notify('info', 'Ключ очищен.')
      loadOrders()
    })
  }

  function bind () {
    updateCartBadge()
    bindApiKey()
    bindTableActions()

    qs('#refreshBtn')?.addEventListener('click', loadOrders)
    qs('#saveEditBtn')?.addEventListener('click', saveEdit)
    qs('#confirmDeleteBtn')?.addEventListener('click', confirmDelete)

    loadOrders()
  }

  document.addEventListener('DOMContentLoaded', bind)
})()
