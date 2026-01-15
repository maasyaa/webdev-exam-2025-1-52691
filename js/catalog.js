(() => {
  'use strict'

  const PER_PAGE = 12

  let page = 1
  let totalLoaded = 0
  let lastQuery = ''
  let activeFilters = {
    categories: new Set(),
    priceFrom: null,
    priceTo: null,
    discountOnly: false,
    sort: 'rating_desc'
  }

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

  function updateCartBadge () {
    const badge = qs('#korzinaCountBadge')
    if (!badge) return
    badge.textContent = window.WebExamStorage.getCartCount()
  }

  function renderCategories (items) {
    const box = qs('#categoriesBox')
    if (!box) return

    const categories = Array.from(
      new Set(items.map(i => i.category).filter(Boolean))
    )

    if (categories.length === 0) {
      box.innerHTML = '<div class="text-muted small">Нет категорий</div>'
      return
    }

    box.innerHTML = categories
      .map(cat => {
        const id = `cat_${cat}`
        return `
          <div class="form-check">
            <input class="form-check-input" type="checkbox" id="${id}" value="${cat}">
            <label class="form-check-label" for="${id}">${cat}</label>
          </div>
        `
      })
      .join('')
  }

function buildCard (item) {
  const inCart = window.WebExamStorage.isInCart(item.id)

  const ratingHtml = item.rating
    ? `<div class="text-muted small mb-1">Рейтинг: ${Number(item.rating).toFixed(1)}</div>`
    : ''

  const actualPrice = Number(item._raw?.actual_price)
  const discountPrice = Number(item._raw?.discount_price)
  const hasDiscount = Number.isFinite(discountPrice) && discountPrice > 0 && discountPrice < actualPrice

  const priceHtml = hasDiscount
    ? `<div class="d-flex align-items-baseline gap-2">
        <div class="fw-semibold">${window.WebExamStorage.formatPrice(item.price)}</div>
        <div class="text-muted text-decoration-line-through small">${window.WebExamStorage.formatPrice(actualPrice)}</div>
      </div>`
    : `<div class="fw-semibold">${window.WebExamStorage.formatPrice(item.price)}</div>`

  return `
    <div class="col-12 col-sm-6 col-lg-4">
      <div class="card h-100">
        <img src="${item.image}" class="card-img-top" alt="${item.title}">
        <div class="card-body d-flex flex-column">
          <h3 class="h6">${item.title}</h3>
          <div class="text-muted small mb-1">${item.category}</div>
          ${ratingHtml}
          ${priceHtml}
          <button
            class="btn ${inCart ? 'btn-secondary' : 'btn-primary'} mt-auto"
            data-id="${item.id}"
            ${inCart ? 'disabled' : ''}
          >
            ${inCart ? 'В корзине' : 'В корзину'}
          </button>
        </div>
      </div>
    </div>
  `
}


  function renderGoods (items, append = false) {
    const grid = qs('#goodsGrid')
    const empty = qs('#emptyState')
    if (!grid || !empty) return

    if (!append) grid.innerHTML = ''

    if (!items || items.length === 0) {
      setHidden(empty, false)
      return
    }

    setHidden(empty, true)

    grid.insertAdjacentHTML(
      'beforeend',
      items.map(buildCard).join('')
    )
  }

  async function loadGoods ({ reset = false } = {}) {
    if (reset) {
      page = 1
      totalLoaded = 0
      renderGoods([], false)
    }

    showLoading(true)

    try {
      const params = {
        page,
        per_page: PER_PAGE,
        query: lastQuery,
        sort_order: activeFilters.sort
      }

      const data = await window.WebExamApi.getGoods(params)

      const items = Array.isArray(data.items) ? data.items : []
      const total = Number(data.total) || 0

      if (page === 1) {
        renderCategories(items)
      }

      renderGoods(items, page > 1)

      totalLoaded += items.length

      setHidden(
        qs('#loadMoreBtn'),
        totalLoaded >= total
      )

      page += 1
    } catch (e) {
      renderGoods([], false)
    } finally {
      showLoading(false)
    }
  }

  function onGridClick (e) {
    const btn = e.target.closest('button[data-id]')
    if (!btn) return

    const id = btn.getAttribute('data-id')
    window.WebExamStorage.addToCart(id)

    btn.textContent = 'В корзине'
    btn.classList.remove('btn-primary')
    btn.classList.add('btn-secondary')
    btn.disabled = true

    updateCartBadge()
  }

  function applyFiltersFromForm () {
    const form = qs('#filtersForm')
    if (!form) return

    activeFilters.categories.clear()

    qsa('#categoriesBox input[type="checkbox"]:checked')
      .forEach(cb => activeFilters.categories.add(cb.value))

    const pf = qs('#priceFrom')?.value
    const pt = qs('#priceTo')?.value

    activeFilters.priceFrom = pf ? Number(pf) : null
    activeFilters.priceTo = pt ? Number(pt) : null
    activeFilters.discountOnly = Boolean(qs('#discountOnly')?.checked)
  }

  function bind () {
    updateCartBadge()

    qs('#goodsGrid')?.addEventListener('click', onGridClick)

    qs('#loadMoreBtn')?.addEventListener('click', () => loadGoods())

    qs('#filtersForm')?.addEventListener('submit', (e) => {
      e.preventDefault()
      applyFiltersFromForm()
      loadGoods({ reset: true })
    })

    qs('#resetFiltersBtn')?.addEventListener('click', () => {
      qs('#filtersForm')?.reset()
      activeFilters = {
        categories: new Set(),
        priceFrom: null,
        priceTo: null,
        discountOnly: false,
        sort: 'rating_desc'
      }
      loadGoods({ reset: true })
    })

    qs('#sortSelect')?.addEventListener('change', (e) => {
      activeFilters.sort = e.target.value
      loadGoods({ reset: true })
    })

    window.addEventListener('webexam:search', (e) => {
      lastQuery = e.detail?.query || ''
      loadGoods({ reset: true })
    })

    window.addEventListener('webexam:korzina-updated', updateCartBadge)

    loadGoods({ reset: true })
  }

  document.addEventListener('DOMContentLoaded', bind)
})()
