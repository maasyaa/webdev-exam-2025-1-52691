(() => {
  'use strict'

  function qs (sel) {
    return document.querySelector(sel)
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

  function readForm () {
    const form = qs('#orderForm')
    if (!form) return null

    const fd = new FormData(form)

    return {
      full_name: String(fd.get('full_name') || '').trim(),
      email: String(fd.get('email') || '').trim(),
      subscribe: fd.get('subscribe') ? 1 : 0,
      phone: String(fd.get('phone') || '').trim(),
      delivery_address: String(fd.get('delivery_address') || '').trim(),
      delivery_date: String(fd.get('delivery_date') || '').trim(),
      delivery_interval: String(fd.get('delivery_interval') || '').trim(),
      comment: String(fd.get('comment') || '').trim()
    }
  }

  function validate (data, cartIds) {
    if (!data) return 'Форма не найдена.'
    if (!data.full_name) return 'Введите имя.'
    if (!data.email) return 'Введите email.'
    if (!data.phone) return 'Введите телефон.'
    if (!data.delivery_address) return 'Введите адрес доставки.'
    if (!data.delivery_date) return 'Выберите дату доставки.'
    if (!data.delivery_interval) return 'Выберите интервал доставки.'
    if (!cartIds || cartIds.length === 0) return 'Корзина пуста.'
    return ''
  }

  function buildPayload (data, cartIds) {
    return {
      ...data,
      good_ids: cartIds
    }
  }

  async function submitOrder () {
    const cartIds = window.WebExamStorage.readCartIds()
    const data = readForm()
    console.log('Данные формы:', data)
    console.log('ID товаров:', cartIds)


    const err = validate(data, cartIds)
    if (err) {
      notify('danger', err)
      return
    }

    const payload = buildPayload(data, cartIds)

    try {
      await window.WebExamApi.createOrder(payload)
      window.WebExamStorage.clearCart()
      notify('success', 'Заказ оформлен.')
      setTimeout(() => {
        window.location.href = 'profile.html'
      }, 700)
    } catch (e) {
      notify('danger', e && e.message ? e.message : 'Ошибка при оформлении заказа.')
    }
  }

  function bind () {
    const form = qs('#orderForm')
    if (!form) return

    form.addEventListener('submit', (e) => {
      e.preventDefault()
      submitOrder()
    })
  }

  document.addEventListener('DOMContentLoaded', bind)
})()
