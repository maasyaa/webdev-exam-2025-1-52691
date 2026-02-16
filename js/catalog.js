// Загрузка, фильтрация, сортировка, поиск, добавление в корзину

(() => {
  'use strict';

  const PER_PAGE = 12; // Товаров на страницу

  let page = 1;           // Текущая страница
  let totalLoaded = 0;    // Сколько уже загружено
  let lastQuery = '';     // Последний поисковый запрос
  let activeFilters = {   // Активные фильтры
    categories: new Set(),
    priceFrom: null,
    priceTo: null,
    discountOnly: false,
    sort: 'rating_desc'
  };

  const qs = sel => document.querySelector(sel);
  const qsa = sel => Array.from(document.querySelectorAll(sel));

  // Скрывает/показывает элемент
  function setHidden(el, hidden) {
    if (!el) return;
    el.classList.toggle('hidden', Boolean(hidden));
  }

  // Показывает индикатор загрузки
  function showLoading(show) {
    setHidden(qs('#loadingIndicator'), !show);
  }

  // Обновляет счётчик товаров в корзине (на иконке)
  function updateCartBadge() {
    const badge = qs('#korzinaBadge');
    if (badge) {
      badge.textContent = window.WebExamStorage.getCartCount();
    }
  }

  // Отображает категории товаров (динамически)
  function renderCategories(items) {
    const box = qs('#categoryFilters');
    if (!box) return;

    const categories = [...new Set(items.map(i => i.category).filter(Boolean))];

    if (categories.length === 0) {
      box.innerHTML = '<div class="text-muted small">Нет категорий</div>';
      return;
    }

    box.innerHTML = categories.map(cat => {
      const id = `cat_${cat}`;
      return `
        <div class="checkbox-group">
          <label class="checkbox-label">
            <input type="checkbox" id="${id}" value="${cat}" class="check">
            ${cat}
          </label>
        </div>`;
    }).join('');
  }

  // Генерирует карточку товара
  function buildCard(item) {
    const imageUrl = item._raw.image_url 
      ? item._raw.image_url 
      : '/img/no-image.png';

    const inCart = window.WebExamStorage.isInCart(item.id);

    const hasDiscount = Number.isFinite(item._raw.discount_price) &&
                        item._raw.discount_price > 0 &&
                        item._raw.discount_price < item._raw.actual_price;

    return `
      <div class="goodCard">
        <img 
          src="${imageUrl}" 
          alt="${item.title}" 
          class="goodCardImage" 
          onerror="this.src='/img/no-image.png'; this.onerror=null;"
        >
        <div class="goodCardContent">
          <h3 class="goodCardTitle">${item.title}</h3>
          <div class="goodCardRating">⭐ ${item.rating.toFixed(1)}</div>
          <div class="goodCardPrice">
            <div class="priceCurrent">${window.WebExamStorage.formatPrice(item.price)}</div>
            ${hasDiscount 
              ? `<div class="priceOld">${window.WebExamStorage.formatPrice(item._raw.actual_price)}</div>` 
              : ''}
          </div>
          <div class="goodCardActions">
            <button class="btn btnPrimary" data-id="${item.id}" ${inCart ? 'disabled' : ''}>
              ${inCart ? 'В корзине' : 'В корзину'}
            </button>
          </div>
        </div>
      </div>`;
  }

  // Отображает список товаров
  function renderGoods(items, append = false) {
    const grid = qs('#goodsGrid');
    const empty = qs('#emptyState');
    if (!grid) return;

    if (!append) grid.innerHTML = '';

    if (!items || items.length === 0) {
      setHidden(empty, false);
      return;
    }

    setHidden(empty, true);
    grid.insertAdjacentHTML('beforeend', items.map(buildCard).join(''));
  }

  // Загружает товары с сервера
  async function loadGoods({ reset = false } = {}) {
    if (reset) {
      page = 1;
      totalLoaded = 0;
      renderGoods([], false);
    }

    showLoading(true);

    try {
      const params = {
        page,
        per_page: PER_PAGE,
        query: lastQuery,
        sort_order: activeFilters.sort
      };

      const data = await window.WebExamApi.getGoods(params);
      const items = data.items || [];

      if (page === 1) renderCategories(items);
      renderGoods(items, page > 1);
      totalLoaded += items.length;

      setHidden(qs('#loadMoreBtn'), totalLoaded >= data.total);
      page++;
    } catch (e) {
      console.error('Ошибка загрузки товаров:', e);
      notify('danger', 'Не удалось загрузить товары.');
      renderGoods([], false);
    } finally {
      showLoading(false);
    }
  }

  // Обработка клика по кнопке "В корзину"
  function onGridClick(e) {
    const btn = e.target.closest('button[data-id]');
    if (!btn) return;

    const id = btn.dataset.id;
    window.WebExamStorage.addToCart(id);
    btn.textContent = 'В корзине';
    btn.disabled = true;
    updateCartBadge();
  }

  // Показывает уведомление
  function notify(type, text) {
    const box = qs('#notifications');
    if (!box) return;
    const el = document.createElement('div');
    el.className = `alert alert-${type}`;
    el.textContent = text;
    box.prepend(el);
    setTimeout(() => el.remove(), 3000);
  }

  // Привязка событий
  function bind() {
    updateCartBadge();
    qs('#goodsGrid')?.addEventListener('click', onGridClick);
    qs('#loadMoreBtn')?.addEventListener('click', () => loadGoods());
    
    // Применение фильтров
    qs('#filterForm')?.addEventListener('submit', e => {
      e.preventDefault();
      loadGoods({ reset: true });
    });

    // Сортировка
    qs('#sortSelect')?.addEventListener('change', e => {
      activeFilters.sort = e.target.value;
      loadGoods({ reset: true });
    });

    // Поиск (через кастомное событие)
    window.addEventListener('webexam:search', e => {
      lastQuery = e.detail?.query || '';
      loadGoods({ reset: true });
    });

    // Обновление корзины при изменении
    window.addEventListener('webexam:korzina-updated', updateCartBadge);

    // Первая загрузка
    loadGoods({ reset: true });
  }

  document.addEventListener('DOMContentLoaded', bind);
})();