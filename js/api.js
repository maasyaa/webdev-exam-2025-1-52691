// Содержит: настройки API, запросы, обработку ответов, нормализацию данных
(() => {
  'use strict';

  // Базовые настройки API
  const API_HOST = 'https://edu.std-900.ist.mospolytech.ru';
  const API_PREFIX = '/exam-2024-1/api';
  const API_KEY_STORAGE = 'webexam_api_key'; // Ключ API хранится в localStorage

  // Получает API-ключ из хранилища
  function getApiKey() {
    return localStorage.getItem(API_KEY_STORAGE) || '';
  }

  // Сохраняет или удаляет API-ключ
  function setApiKey(value) {
    const v = String(value || '').trim();
    if (!v) {
      localStorage.removeItem(API_KEY_STORAGE);
      return;
    }
    localStorage.setItem(API_KEY_STORAGE, v);
  }

  // Формирует URL с параметрами и API-ключом
  function buildUrl(path, query = {}) {
    const url = new URL(API_HOST + API_PREFIX + path);

    let apiKey = getApiKey();
    // Если ключа нет — используем дефолтный и сохраняем его
    if (!apiKey) {
      const DEFAULT_API_KEY = '07ad9b1b-9a18-4e25-8eeb-5c6b5f3cb362';
      setApiKey(DEFAULT_API_KEY);
      apiKey = DEFAULT_API_KEY;
    }

    if (apiKey) {
      url.searchParams.set('api_key', apiKey);
    }

    // Добавляем дополнительные параметры запроса
    Object.entries(query).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      const s = String(v).trim();
      if (!s) return;
      url.searchParams.set(k, s);
    });

    return url.toString();
  }

  // Универсальный метод для JSON-запросов к API
  async function requestJson(method, path, { query, body } = {}) {
    const url = buildUrl(path, query);

    const options = {
      method,
      headers: { 'Accept': 'application/json' }
    };

    if (body !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    let res;
    try {
      res = await fetch(url, options);
    } catch (e) {
      // Обработка ошибок сети
      const msg = e.message?.includes('CERT') 
        ? 'Ошибка SSL сертификата. Проверьте дату и время.' 
        : `Ошибка сети: ${e.message}`;
      const err = new Error(msg);
      err.status = 0;
      throw err;
    }

    let data;
    try {
      data = await res.json().catch(() => null);
    } catch (e) {
      data = null;
    }

    // Обработка HTTP-ошибок
    if (!res.ok) {
      let msg = `Ошибка: ${res.status} ${res.statusText}`;
      if (data?.error) msg = data.error;
      if (data?.message) msg = data.message;
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }

    return data;
  }

  // Выбирает цену товара: со скидкой, если актуально
  function pickPrice(good) {
    const ap = Number(good?.actual_price);
    const dp = Number(good?.discount_price);
    if (Number.isFinite(dp) && dp > 0 && dp < ap) return dp;
    if (Number.isFinite(ap)) return ap;
    return 0;
  }

  // Приводит товар к стандартному формату для отображения в каталоге
  function normalizeGoodForCatalog(good) {
    return {
      id: good.id,
      title: good.name ?? '',
      price: pickPrice(good),
      image: good.image ?? '',
      category: good.main_category ?? '',
      rating: Number(good.rating) || 0,
      _raw: good // Полные данные для дальнейшего использования
    };
  }

  // Нормализует ответ от API: приводит к единому формату { items, total }
  function normalizeGoodsResponse(data) {
    if (Array.isArray(data.items)) {
      return { items: data.items.map(normalizeGoodForCatalog), total: data.total || data.items.length };
    }
    if (Array.isArray(data.goods)) {
      return { items: data.goods.map(normalizeGoodForCatalog), total: data._pagination?.total_count || data.goods.length };
    }
    if (Array.isArray(data)) {
      return { items: data.map(normalizeGoodForCatalog), total: data.length };
    }
    return { items: [], total: 0 };
  }

  // Экспорт API-методов
  window.WebExamApi = {
    getGoods: (params) => requestJson('GET', '/goods', { query: params }).then(normalizeGoodsResponse),
    getGoodById: (id) => requestJson('GET', `/goods/${id}`),
    getOrders: () => requestJson('GET', '/orders'),
    getOrderById: (id) => requestJson('GET', `/orders/${id}`),
    createOrder: (data) => requestJson('POST', '/orders', { body: data }),
    updateOrder: (id, data) => requestJson('PUT', `/orders/${id}`, { body: data }),
    deleteOrder: (id) => requestJson('DELETE', `/orders/${id}`)
  };
})();