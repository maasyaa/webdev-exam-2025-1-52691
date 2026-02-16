// Функционал: загрузка списка заказов, просмотр деталей, редактирование, удаление
// Используются модальные окна для взаимодействия

(() => {
  'use strict';

  // Удобные сокращения для поиска элементов
  const qs = sel => document.querySelector(sel);
  const qsa = sel => Array.from(document.querySelectorAll(sel));

  // Скрывает или показывает элемент через класс hidden
  function setHidden(el, hidden) {
    if (!el) return;
    el.classList.toggle('hidden', Boolean(hidden));
  }

  // Показывает/скрывает индикатор загрузки
  function showLoading(show) {
    setHidden(qs('#loadingIndicator'), !show);
  }

  // Показывает уведомление (успех, ошибка и т.п.)
  function notify(type, text) {
    const box = qs('#notifications');
    if (!box) return;
    const el = document.createElement('div');
    el.className = `alert alert-${type}`;
    el.textContent = text;
    box.prepend(el);
    setTimeout(() => el.remove(), 3000); // Удаляем через 3 секунды
  }

  // Форматирует дату из ISO-формата в "дд.мм.гггг"
  function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  }

  // Преобразует строку "дд.мм.гггг" → "гггг-мм-дд" (для input[type="date"])
  function parseDateForInput(dateStr) {
    if (!dateStr) return '';
    if (dateStr.includes('.')) {
      const parts = dateStr.split('.');
      if (parts.length === 3) {
        const [day, month, year] = parts;
        return `${year}-${month}-${day}`;
      }
    }
    return '';
  }

  // Преобразует "гггг-мм-дд" → "дд.мм.гггг" (для отправки на сервер)
  function formatInputDateToApi(dateStr) {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.split('-');
    return `${day}.${month}.${year}`;
  }

  // Форматирует цену с помощью метода из WebExamStorage
  function formatPrice(v) {
    return window.WebExamStorage.formatPrice(v);
  }

  // Обновляет значок количества товаров в корзине
  function updateCartBadge() {
    const badge = qs('#korzinaBadge');
    if (badge) badge.textContent = window.WebExamStorage.getCartCount();
  }

  // --- Закрытие модальных окон ---
  let currentOrderId = null; // Хранит ID текущего редактируемого заказа

  // Закрывает модальное окно и сбрасывает состояние
  function closeModal(modalId) {
    const modal = qs(modalId);
    if (modal) {
      modal.classList.add('is-hidden');
    }
    document.body.style.overflow = ''; // Разблокируем прокрутку
    currentOrderId = null;
  }

  // --- Открытие деталей заказа ---
  async function openDetails(orderId) {
    try {
      const result = await window.WebExamApi.getOrderById(orderId);
      // Если ответ массив — берём первый элемент
      let order = Array.isArray(result) && result.length > 0 ? result[0] : result;

      if (!order || !order.id) {
        throw new Error('Заказ не найден');
      }

      // Заполняем поля в модальном окне
      const fields = {
        '#d_id': order.id,
        '#d_date': formatDate(order.created_at),
        '#d_fullName': order.full_name || '—',
        '#d_email': order.email || '—',
        '#d_phone': order.phone || '—',
        '#d_address': order.delivery_address || '—',
        '#d_deliveryDate': formatDate(order.delivery_date) || '—',
        '#d_deliveryInterval': order.delivery_interval || '—',
        '#d_comment': order.comment || '—'
      };

      Object.entries(fields).forEach(([selector, value]) => {
        const el = qs(selector);
        if (el) el.textContent = value;
      });

      // Отрисовываем список товаров
      const itemsList = qs('#d_itemsList');
      if (itemsList) {
        itemsList.innerHTML = '';

        // Если товары уже есть в заказе
        if (order.goods && order.goods.length > 0) {
          order.goods.forEach(good => {
            const itemEl = createGoodItemElement(good);
            itemsList.appendChild(itemEl);
          });
        }
        // Если есть только ID товаров — загружаем их отдельно
        else if (order.good_ids && order.good_ids.length > 0) {
          const goodsPromises = order.good_ids.map(id =>
            window.WebExamApi.getGoodById(id).catch(() => null)
          );
          const goods = await Promise.all(goodsPromises);
          goods
            .filter(Boolean)
            .forEach(good => {
              const itemEl = createGoodItemElement({
                name: good.name,
                quantity: 1,
                actual_price: good.actual_price,
                discount_price: good.discount_price,
                image_url: good.image_url
              });
              itemsList.appendChild(itemEl);
            });
        } else {
          const div = document.createElement('div');
          div.textContent = 'Товары не указаны';
          itemsList.appendChild(div);
        }
      }

      // Показываем модальное окно
      const modal = qs('#detailsModal');
      if (modal) {
        modal.classList.remove('is-hidden');
        document.body.style.overflow = 'hidden'; // Блокируем прокрутку
      }

    } catch (e) {
      console.error('Ошибка при открытии деталей заказа:', e);
      notify('danger', 'Не удалось загрузить данные заказа.');
    }
  }

  // Создаёт элемент с информацией о товаре (для модального окна)
  function createGoodItemElement(good) {
    const div = document.createElement('div');
    div.className = 'flex align-center gap pad border-bottom';

    const imageUrl = good.image_url || '/img/no-image.png';
    const price = (good.discount_price && good.discount_price < good.actual_price)
      ? good.discount_price
      : good.actual_price || 0;

    div.innerHTML = `
      <img src="${imageUrl}" alt="${good.name}" width="40" height="40">
      <div>
        <div><strong>${good.name}</strong></div>
        <div class="text-muted small">Кол-во: ${good.quantity || 1} шт.</div>
      </div>
      <div class="bold">${formatPrice(price)}</div>
    `;

    return div;
  }

  // --- Удаление заказа ---
  async function openDelete(orderId) {
    if (!confirm('Вы уверены, что хотите удалить этот заказ?')) return;

    try {
      await window.WebExamApi.deleteOrder(orderId);
      notify('success', 'Заказ удалён');
      loadOrders(); // Обновляем список
    } catch (e) {
      notify('danger', `Ошибка: ${e.message}`);
    }
  }

  // --- Редактирование заказа ---
  async function openEdit(orderId) {
    currentOrderId = orderId;

    try {
      const result = await window.WebExamApi.getOrderById(orderId);
      let order = Array.isArray(result) && result.length > 0 ? result[0] : result;

      if (!order || !order.id) {
        throw new Error('Заказ не найден');
      }

      // Заполняем форму редактирования
      qs('#editFullName').value = order.full_name || '';
      qs('#editEmail').value = order.email || '';
      qs('#editPhone').value = order.phone || '';
      qs('#editAddress').value = order.delivery_address || '';
      qs('#editDeliveryDate').value = parseDateForInput(order.delivery_date);
      qs('#editDeliveryInterval').value = order.delivery_interval || '';
      qs('#editComment').value = order.comment || '';

      // Показываем модальное окно
      const modal = qs('#editModal');
      if (modal) {
        modal.classList.remove('is-hidden');
        document.body.style.overflow = 'hidden';
      }

    } catch (e) {
      console.error('Ошибка при загрузке заказа для редактирования:', e);
      notify('danger', 'Не удалось загрузить данные заказа.');
    }
  }

  // Сохраняет изменения заказа после редактирования
  async function saveEditOrder(e) {
    e.preventDefault();
    if (!currentOrderId) {
      notify('danger', 'Нет ID заказа');
      return;
    }

    const form = e.target;
    const formData = new FormData(form);

    // Получаем дату доставки из input и преобразуем в нужный формат
    const deliveryDateValue = formData.get('delivery_date');
    const deliveryDate = formatInputDateToApi(deliveryDateValue);

    if (!deliveryDate) {
      notify('danger', 'Введите корректную дату доставки');
      return;
    }

    // Подготовка данных для отправки
    const data = {
      full_name: formData.get('full_name').trim(),
      email: formData.get('email').trim(),
      phone: formData.get('phone').trim(),
      delivery_address: formData.get('delivery_address').trim(),
      delivery_date: deliveryDate,
      delivery_interval: formData.get('delivery_interval'),
      comment: formData.get('comment').trim() || null
    };

    // Проверка обязательных полей
    const required = ['full_name', 'email', 'phone', 'delivery_address', 'delivery_date', 'delivery_interval'];
    for (const field of required) {
      if (!data[field]) {
        notify('danger', 'Заполните все обязательные поля');
        return;
      }
    }

    try {
      await window.WebExamApi.updateOrder(currentOrderId, data);
      notify('success', 'Заказ успешно изменён');
      closeModal('#editModal');
      loadOrders(); // Обновляем таблицу
    } catch (e) {
      notify('danger', `Ошибка: ${e.message}`);
    }
  }

  // --- Привязка событий к модальным окнам ---
  function bindModalEvents() {
    // Закрытие по клику на затемнение (overlay)
    qsa('.modalOverlay').forEach(overlay => {
      overlay.addEventListener('click', () => {
        const modal = overlay.closest('.modal');
        if (modal) {
          modal.classList.add('is-hidden');
          currentOrderId = null;
        }
      });
    });

    // Закрытие по кнопкам с атрибутом data-close-modal
    qsa('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = btn.closest('.modal');
        if (modal) {
          modal.classList.add('is-hidden');
          currentOrderId = null;
        }
      });
    });

    // Привязка формы редактирования
    const form = qs('#editOrderForm');
    if (form) {
      form.addEventListener('submit', saveEditOrder);
    }
  }

  // --- Отображение таблицы заказов ---
  function renderOrders(orders) {
    const tableContainer = qs('#ordersTableContainer');
    const emptyState = qs('#emptyState');

    if (!orders || orders.length === 0) {
      setHidden(tableContainer, true);
      setHidden(emptyState, false);
      return;
    }

    setHidden(tableContainer, false);
    setHidden(emptyState, true);

    const tbody = qs('#ordersTbody');
    if (!tbody) return;

    tbody.innerHTML = orders.map(o => {
      const sum = calculateOrderSum(o);
      return `
        <tr data-id="${o.id}">
          <td>${o.id}</td>
          <td>${formatDate(o.created_at)}</td>
          <td>${o.goods?.length || o.good_ids?.length || 0} шт.</td>
          <td>${formatPrice(sum)}</td>
          <td>
            ${formatDate(o.delivery_date)}<br>
            <small>${o.delivery_interval || '—'}</small>
          </td>
          <td class="text-end">
            <div class="flex gap justify-end">
              <button class="btn btn-outline" data-action="details">Подробнее</button>
              <button class="btn btn-outline" data-action="edit">Изменить</button>
              <button class="btn btn-outline" data-action="delete">Удалить</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Рассчитывает сумму заказа (по товарам)
  function calculateOrderSum(order) {
    if (order.total_sum > 0) return order.total_sum;

    if (order.goods && Array.isArray(order.goods)) {
      return order.goods.reduce((sum, g) => {
        const price = g.discount_price && g.discount_price < g.actual_price
          ? g.discount_price
          : g.actual_price || 0;
        return sum + price * (g.quantity || 1);
      }, 0);
    }

    return 0;
  }

  // Дополнительно подгружает сумму заказа, если она не пришла
  async function loadOrderSums(orders) {
    const ordersNeedingSums = orders.filter(o => !o.total_sum && o.good_ids?.length > 0);
    if (ordersNeedingSums.length === 0) return;

    // Собираем уникальные ID товаров
    const allGoodIds = new Set(ordersNeedingSums.flatMap(o => o.good_ids));
    const goodsMap = new Map(
      await Promise.all(Array.from(allGoodIds).map(async id => {
        try {
          const good = await window.WebExamApi.getGoodById(id);
          return [id, Array.isArray(good) ? good[0] : good];
        } catch (e) {
          return [id, null];
        }
      }))
    );

    // Пересчитываем сумму и обновляем отображение
    ordersNeedingSums.forEach(o => {
      const sum = o.good_ids.reduce((acc, id) => {
        const good = goodsMap.get(id);
        if (!good) return acc;
        const price = (good.discount_price && good.discount_price < good.actual_price)
          ? good.discount_price
          : good.actual_price || 0;
        return acc + price;
      }, 0);

      const row = qs(`tr[data-id="${o.id}"]`);
      if (row) row.cells[3].textContent = formatPrice(sum);
    });
  }

  // Загружает список заказов с сервера
  async function loadOrders() {
    showLoading(true);
    try {
      const orders = await window.WebExamApi.getOrders();
      renderOrders(orders);
      await loadOrderSums(orders); // Подгружаем суммы при необходимости
    } catch (e) {
      console.error('Ошибка загрузки заказов:', e);
      notify('danger', 'Не удалось загрузить заказы');
      const tbody = qs('#ordersTbody');
      if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="textMuted">Ошибка загрузки данных</td></tr>';
      setHidden(qs('#ordersTableContainer'), false);
      setHidden(qs('#emptyState'), true);
    } finally {
      showLoading(false);
    }
  }

  // Привязка действий к кнопкам
  function bindActions() {
    // Кнопка "Обновить"
    qs('#refreshBtn')?.addEventListener('click', loadOrders);

    // Обработка кликов по таблице заказов
    qs('#ordersTable')?.addEventListener('click', e => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;

      const row = btn.closest('tr');
      const orderId = Number(row?.dataset?.id);
      if (!Number.isFinite(orderId)) return;

      const action = btn.dataset.action;

      if (action === 'details') {
        openDetails(orderId);
      } else if (action === 'edit') {
        openEdit(orderId);
      } else if (action === 'delete') {
        openDelete(orderId);
      }
    });
  }

  // Инициализация страницы
  function init() {
    try {
      updateCartBadge();
      bindModalEvents();
      bindActions();
      loadOrders();
    } catch (e) {
      console.error('Ошибка при инициализации profile.js:', e);
      notify('danger', 'Ошибка интерфейса');
    }
  }

  // Запускаем инициализацию при готовности DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();