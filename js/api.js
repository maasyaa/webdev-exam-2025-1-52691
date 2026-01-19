(() => {
  'use strict'

  const API_HOST = 'https://edu.std-900.ist.mospolytech.ru'
  const API_PREFIX = '/exam-2024-1/api'
  const API_KEY_STORAGE = 'webexam_api_key'

  // Получает API-ключ из localStorage
  function getApiKey () {
    return localStorage.getItem(API_KEY_STORAGE) || ''
  }

  // Сохраняет API-ключ в localStorage
  function setApiKey (value) {
    const v = String(value || '').trim()
    if (!v) {
      localStorage.removeItem(API_KEY_STORAGE)
      return
    }
    localStorage.setItem(API_KEY_STORAGE, v)
  }

  // Формирует полный URL для API-запроса с параметрами и ключом
  function buildUrl (path, query = {}) {
    const url = new URL(API_HOST + API_PREFIX + path)

    // Всегда добавляем API ключ - если его нет в localStorage, устанавливаем дефолтный
    let apiKey = getApiKey()
    if (!apiKey || apiKey.trim() === '') {
      const DEFAULT_API_KEY = '07ad9b1b-9a18-4e25-8eeb-5c6b5f3cb362'
      setApiKey(DEFAULT_API_KEY)
      apiKey = DEFAULT_API_KEY
    }
    
    if (apiKey) {
      url.searchParams.set('api_key', apiKey)
    }

    Object.entries(query).forEach(([k, v]) => {
      if (v === undefined || v === null) return
      const s = String(v).trim()
      if (!s) return
      url.searchParams.set(k, s)
    })

    return url.toString()
  }

  // Выполняет HTTP-запрос к API с обработкой ошибок
  async function requestJson (method, path, { query, body } = {}) {
    const url = buildUrl(path, query)

    const options = {
      method,
      headers: { Accept: 'application/json' }
    }

    if (body !== undefined) {
      options.headers['Content-Type'] = 'application/json'
      const jsonBody = JSON.stringify(body)
      options.body = jsonBody
    }

    let res
    try {
      res = await fetch(url, options)
    } catch (e) {
      // Обработка сетевых ошибок (SSL, соединение и т.д.)
      let errorMsg = 'Ошибка соединения с сервером'
      if (e.message && e.message.includes('CERT')) {
        errorMsg = 'Ошибка SSL сертификата. Проверьте дату и время на компьютере или обратитесь к администратору.'
      } else if (e.message) {
        errorMsg = `Ошибка сети: ${e.message}`
      }
      const err = new Error(errorMsg)
      err.status = 0
      err.isNetworkError = true
      throw err
    }

    let data = null
    let textData = null
    try {
      textData = await res.text()
      if (textData) {
        try {
          data = JSON.parse(textData)
        } catch (e) {
          // Если не JSON, оставляем как текст
          data = textData
        }
      }
    } catch (e) {
      data = null
    }

    if (!res.ok) {
      let msg = `Ошибка API: ${res.status} ${res.statusText}`
      
      if (data) {
        // Пытаемся извлечь сообщение об ошибке из разных форматов ответа
        if (typeof data === 'string') {
          msg = data
        } else if (data.error) {
          msg = typeof data.error === 'string' ? data.error : (data.error.message || msg)
        } else if (data.message) {
          msg = data.message
        } else if (Array.isArray(data.errors)) {
          // Если ошибки в виде массива
          const errors = data.errors.map(e => e.message || e.field || String(e)).join('; ')
          msg = errors || msg
        } else if (typeof data === 'object') {
          // Пытаемся найти любое сообщение об ошибке в объекте
          const errorText = Object.values(data).find(v => typeof v === 'string') || msg
          msg = errorText
        }
      }
      
      const err = new Error(msg)
      err.status = res.status
      err.data = data
      throw err
    }

    return data
  }

  // Выбирает цену товара (учитывает скидки)
  function pickPrice (good) {
    const ap = Number(good?.actual_price)
    const dp = Number(good?.discount_price)

    if (Number.isFinite(dp) && dp > 0 && Number.isFinite(ap) && dp < ap) return dp
    if (Number.isFinite(dp) && dp > 0 && !Number.isFinite(ap)) return dp
    if (Number.isFinite(ap)) return ap
    return 0
  }

  // Нормализует данные товара для отображения в каталоге
  function normalizeGoodForCatalog (good) {
    return {
      id: good.id,
      title: good.name ?? good.title ?? '',
      price: pickPrice(good),
      image: good.image ?? good.image_url ?? '',
      category: good.main_category ?? good.category ?? '',
      rating: Number(good.rating) || 0,
      _raw: good
    }
  }

  // Нормализует ответ API с товарами в единый формат
  function normalizeGoodsResponse (data) {
    // Вариант A: { items, total }
    if (data && Array.isArray(data.items)) {
      return {
        items: data.items.map(normalizeGoodForCatalog),
        total: Number(data.total) || data.items.length
      }
    }

    // Вариант B: { goods, _pagination }
    if (data && Array.isArray(data.goods)) {
      const total =
        Number(data._pagination?.total_count) ||
        Number(data._pagination?.total) ||
        Number(data._pagination?.count) ||
        data.goods.length

      return {
        items: data.goods.map(normalizeGoodForCatalog),
        total
      }
    }

    // Вариант C: просто массив
    if (Array.isArray(data)) {
      return {
        items: data.map(normalizeGoodForCatalog),
        total: data.length
      }
    }

    return { items: [], total: 0 }
  }

  // Получает список товаров с фильтрацией и пагинацией
  async function getGoods (params = {}) {
    const data = await requestJson('GET', '/goods', { query: params })
    return normalizeGoodsResponse(data)
  }

  // Получает товар по ID
  async function getGoodById (id) {
    return await requestJson('GET', `/goods/${id}`)
  }

  // Получает список всех заказов
  async function getOrders () {
    return await requestJson('GET', '/orders')
  }

  // Получает заказ по ID
  async function getOrderById (id) {
    return await requestJson('GET', `/orders/${id}`)
  }

  // Создает новый заказ
  async function createOrder (orderData) {
    return await requestJson('POST', '/orders', { body: orderData })
  }

  // Обновляет данные заказа
  async function updateOrder (id, patchData) {
    return await requestJson('PUT', `/orders/${id}`, { body: patchData })
  }

  // Удаляет заказ
  async function deleteOrder (id) {
    return await requestJson('DELETE', `/orders/${id}`)
  }

  // Экспорт всех функций API для использования в других модулях
  window.WebExamApi = {
    API_HOST,
    API_PREFIX,
    getApiKey,
    setApiKey,
    getGoods,
    getGoodById,
    getOrders,
    getOrderById,
    createOrder,
    updateOrder,
    deleteOrder
  }

  // Установка API ключа по умолчанию - всегда используем нужный ключ
  const DEFAULT_API_KEY = '07ad9b1b-9a18-4e25-8eeb-5c6b5f3cb362'
  
  // Всегда устанавливаем нужный API ключ
  setApiKey(DEFAULT_API_KEY)
})()