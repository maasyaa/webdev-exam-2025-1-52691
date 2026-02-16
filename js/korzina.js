// Показывает товары, рассчитывает стоимость, отправляет заказ

(() => {
  'use strict';

  const qs = sel => document.querySelector(sel);

  function setHidden(el, hidden) {
    if (!el) return;
    el.classList.toggle('hidden', Boolean(hidden));
  }

  function showLoading(show) {
    setHidden(qs('#loadingIndicator'), !show);
  }

  function notify(type, text) {
    const box = qs('#notifications');
    if (!box) return;
    const el = document.createElement('div');
    el.className = `alert alert-${type}`;
    el.textContent = text;
    box.prepend(el);
    setTimeout(() => el.remove(), 3000);
  }

  // Вычисляет цену товара (со скидкой, если есть)
  function pickPrice(good) {
    const dp = Number(good.discount_price);
    const ap = Number(good.actual_price);
    return Number.isFinite(dp) && dp > 0 && dp < ap ? dp : (Number.isFinite(ap) ? ap : 0);
  }

  // Отображает один товар в корзине
  function renderCartItem(good) {
    const price = pickPrice(good);
    const hasDiscount = Number(good.discount_price) > 0 && good.discount_price < good.actual_price;

    const imageUrl = good.image_url ? good.image_url : '/img/no-image.png';

    const priceHtml = hasDiscount
      ? `<div class="flex align-center gap">
          <div class="bold">${window.WebExamStorage.formatPrice(price)}</div>
          <div class="text-muted small">${window.WebExamStorage.formatPrice(good.actual_price)}</div>
        </div>`
      : `<div class="bold">${window.WebExamStorage.formatPrice(price)}</div>`;

    return `
      <div class="col-12 col-md-6">
        <div class="box pad grid gap">
          <div class="flex align-center gap">
            <img src="${imageUrl}" alt="${good.name}" class="goodCardImage">
            <div>
              <h3 class="subtitle">${good.name}</h3>
              <div class="text-muted small">${good.main_category}</div>
            </div>
          </div>
          <div class="text-muted small">Рейтинг: ⭐ ${good.rating.toFixed(1)}</div>
          ${priceHtml}
          <button class="btn btn-outline" data-remove-id="${good.id}">
            Удалить
          </button>
        </div>
      </div>`;
  }

  // Сумма всех товаров
  function getGoodsSum(goods) {
    return goods.reduce((sum, g) => sum + pickPrice(g), 0);
  }

  // Рассчитывает стоимость доставки
  function calcDeliveryCost() {
    const dateStr = qs('#deliveryDate')?.value;
    const interval = qs('#deliveryInterval')?.value;
    if (!dateStr) return 0;

    const dt = new Date(dateStr);
    const day = dt.getDay();
    const isWeekend = (day === 0 || day === 6);

    if (isWeekend) return 500;
    if (interval && interval.startsWith('18:00')) return 400;
    return 200;
  }

  // Обновляет итоги (товары, доставка, итого)
  function updateTotals(goods) {
    const goodsSum = getGoodsSum(goods);
    const deliverySum = calcDeliveryCost();
    const totalSum = goodsSum + deliverySum;

    qs('#goodsSumText').textContent = window.WebExamStorage.formatPrice(goodsSum);
    qs('#deliverySumText').textContent = window.WebExamStorage.formatPrice(deliverySum);
    qs('#totalSumText').textContent = window.WebExamStorage.formatPrice(totalSum);
  }

  // Обновляет значок количества товаров в корзине
  function updateCartBadge() {
    const badge = qs('#korzinaCountBadge') || qs('#korzinaBadge');
    if (badge) badge.textContent = window.WebExamStorage.getCartCount();
  }

  // Включает/выключает кнопку "Оформить"
  function setSubmitEnabled(enabled) {
    const btn = qs('#submitOrderBtn');
    if (btn) btn.disabled = !enabled;
  }

  // Загружает товары по ID из корзины
  async function loadGoodsByCartIds(ids) {
    const tasks = ids.map(async id => {
      try {
        const data = await window.WebExamApi.getGoodById(id);
        const good = Array.isArray(data) ? data[0] : data;
        if (!good || !good.id) return null;
        if (good.image_url) {
          good.image_url = good.image_url;
        }
        return good;
      } catch (e) {
        console.warn(`Не удалось загрузить товар ${id}`, e);
        return null;
      }
    });
    return (await Promise.all(tasks)).filter(Boolean);
  }

  // Отрисовывает содержимое корзины
  async function renderCart() {
    const grid = qs('#korzinaGrid');
    const empty = qs('#emptykorzina');
    if (!grid || !empty) return;

    const ids = window.WebExamStorage.readCartIds();
    updateCartBadge();

    if (ids.length === 0) {
      grid.innerHTML = '';
      setHidden(empty, false);
      setSubmitEnabled(false);
      updateTotals([]);
      return;
    }

    setHidden(empty, true);
    showLoading(true);

    const goods = await loadGoodsByCartIds(ids);
    showLoading(false);

    if (goods.length === 0) {
      grid.innerHTML = '';
      setHidden(empty, false);
      setSubmitEnabled(false);
      updateTotals([]);
      notify('danger', 'Товары не загружены.');
      return;
    }

    grid.innerHTML = goods.map(renderCartItem).join('');
    setSubmitEnabled(true);
    updateTotals(goods);
  }

  // Удаление товаров из корзины
  function bindCartActions() {
    qs('#korzinaGrid')?.addEventListener('click', e => {
      const btn = e.target.closest('[data-remove-id]');
      if (!btn) return;
      const id = Number(btn.dataset.removeId);
      if (!Number.isFinite(id)) return;
      window.WebExamStorage.removeFromCart(id);
      renderCart();
      notify('info', 'Товар удалён.');
    });

    qs('#clearkorzinaBtn')?.addEventListener('click', () => {
      window.WebExamStorage.clearCart();
      renderCart();
      notify('info', 'Корзина очищена.');
    });

    window.addEventListener('webexam:korzina-updated', renderCart);
  }

  // Устанавливает минимальную дату доставки (сегодня)
  function setMinDeliveryDate() {
    const input = qs('#deliveryDate');
    if (!input) return;
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    input.min = `${yyyy}-${mm}-${dd}`;
  }

  // Обработка отправки формы заказа
  async function handleOrderSubmit(e) {
    e.preventDefault();
    const ids = window.WebExamStorage.readCartIds();
    if (ids.length === 0) return notify('danger', 'Корзина пуста.');

    const formData = new FormData(e.target);
    const orderData = Object.fromEntries(formData);
    orderData.good_ids = ids.map(Number);
    orderData.subscribe = orderData.subscribe ? 1 : 0;

    // Преобразование даты в формат дд.мм.гггг
    const d = new Date(orderData.delivery_date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    orderData.delivery_date = `${day}.${month}.${year}`;

    try {
      showLoading(true);
      await window.WebExamApi.createOrder(orderData);
      window.WebExamStorage.clearCart();
      e.target.reset();
      notify('success', 'Заказ оформлен!');
      renderCart();
      setTimeout(() => window.location.href = 'profile.html', 2000);
    } catch (e) {
      notify('danger', `Ошибка: ${e.message}`);
    } finally {
      showLoading(false);
    }
  }

  // Привязка событий формы заказа
  function bindOrderForm() {
    qs('#orderForm')?.addEventListener('submit', handleOrderSubmit);
    ['deliveryDate', 'deliveryInterval'].forEach(id => {
      qs(`#${id}`)?.addEventListener('change', () => {
        const ids = window.WebExamStorage.readCartIds();
        if (ids.length > 0) loadGoodsByCartIds(ids).then(updateTotals);
      });
    });
  }

  // Инициализация
  function bind() {
    setMinDeliveryDate();
    bindCartActions();
    bindOrderForm();
    renderCart();
  }

  document.addEventListener('DOMContentLoaded', bind);
})();