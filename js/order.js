// Работа с заказами
let currentOrderId = null;

// Загрузка заказов
async function loadOrders() {
    const tbody = document.getElementById('ordersTableBody');
    
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" class="loading">Загрузка заказов...</td></tr>';

    try {
        const orders = await api.get('/exam-2024-1/api/orders');
        
        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="loading">У вас пока нет заказов</td></tr>';
            return;
        }

        // Сортируем заказы по дате (новые первыми)
        orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        tbody.innerHTML = '';
        
        // Загружаем данные о товарах для отображения
        const goodsMap = new Map();
        
        // Собираем все уникальные ID товаров из заказов
        const allGoodIds = new Set();
        orders.forEach(order => {
            if (order.goods && Array.isArray(order.goods)) {
                order.goods.forEach(good => {
                    if (good.id) {
                        allGoodIds.add(good.id);
                    }
                });
            }
        });

        // Загружаем данные о товарах
        try {
            const goodsPromises = Array.from(allGoodIds).map(id => 
                api.get(`/exam-2024-1/api/goods/${id}`).catch(() => null)
            );
            const goods = await Promise.all(goodsPromises);
            
            goods.forEach(good => {
                if (good) {
                    goodsMap.set(good.id, good);
                }
            });
        } catch (error) {
            console.error('Ошибка при загрузке данных о товарах:', error);
        }

        orders.forEach((order, index) => {
            const row = createOrderRow(order, index + 1, goodsMap);
            tbody.appendChild(row);
        });

    } catch (error) {
        console.error('Ошибка при загрузке заказов:', error);
        tbody.innerHTML = `<tr><td colspan="7" class="loading">Ошибка при загрузке заказов: ${error.message}</td></tr>`;
        showNotification('Ошибка при загрузке заказов', 'error');
    }
}

// Создание строки таблицы заказа
function createOrderRow(order, number, goodsMap) {
    const row = document.createElement('tr');
    
    // Формируем состав заказа
    let composition = 'Товары не указаны';
    if (order.goods && Array.isArray(order.goods) && order.goods.length > 0) {
        const goodsNames = order.goods.map(good => {
            const goodData = goodsMap.get(good.id);
            const name = goodData ? goodData.name : `Товар #${good.id}`;
            const quantity = good.quantity || 1;
            return `${name} (${quantity} шт.)`;
        });
        composition = goodsNames.join(', ');
    }

    // Вычисляем стоимость
    let totalCost = 0;
    if (order.goods && Array.isArray(order.goods)) {
        order.goods.forEach(good => {
            const goodData = goodsMap.get(good.id);
            if (goodData) {
                const price = goodData.actual_price || goodData.price || 0;
                const discount = goodData.discount_price || goodData.discount || 0;
                const finalPrice = (discount && discount > 0 && discount < price) ? discount : price;
                totalCost += finalPrice * (good.quantity || 1);
            }
        });
    }

    // Форматируем дату
    const orderDate = new Date(order.created_at);
    const formattedDate = orderDate.toLocaleString('ru-RU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });

    // Форматируем дату доставки
    const deliveryDate = order.delivery_date 
        ? new Date(order.delivery_date).toLocaleDateString('ru-RU')
        : 'Не указана';

    row.innerHTML = `
        <td>${number}</td>
        <td>${formattedDate}</td>
        <td>${composition}</td>
        <td>${totalCost.toFixed(2)} ₽</td>
        <td>${deliveryDate}</td>
        <td>${order.delivery_interval || order.delivery_time || 'Не указано'}</td>
        <td>
            <div class="action-buttons">
                <button class="action-btn btn-view" onclick="viewOrder(${order.id})">Просмотр</button>
                <button class="action-btn btn-edit" onclick="editOrder(${order.id})">Редактирование</button>
                <button class="action-btn btn-delete" onclick="deleteOrder(${order.id})">Удаление</button>
            </div>
        </td>
    `;

    return row;
}

// Просмотр заказа
async function viewOrder(orderId) {
    try {
        console.log('Loading order:', orderId);
        const orderResult = await api.get(`/exam-2024-1/api/orders/${orderId}`);
        console.log('Order result:', orderResult);
        
        // API может вернуть массив с одним элементом или объект
        let order = orderResult;
        if (Array.isArray(orderResult) && orderResult.length > 0) {
            order = orderResult[0];
        } else if (Array.isArray(orderResult) && orderResult.length === 0) {
            throw new Error('Заказ не найден');
        }
        
        console.log('Order data:', order);
        
        if (!order || !order.id) {
            throw new Error('Неверный формат данных заказа');
        }
        
        // Загружаем данные о товарах
        // API может вернуть good_ids (массив ID) или goods (массив объектов)
        const goodsMap = new Map();
        let goodsList = [];
        
        if (order.good_ids && Array.isArray(order.good_ids)) {
            // Если есть good_ids, загружаем товары по ID
            const uniqueIds = [...new Set(order.good_ids)];
            const goodsPromises = uniqueIds.map(id => 
                api.get(`/exam-2024-1/api/goods/${id}`).catch(() => null)
            );
            const goods = await Promise.all(goodsPromises);
            goods.forEach(good => {
                if (good) {
                    // Извлекаем объект из массива, если нужно
                    const goodObj = Array.isArray(good) ? good[0] : good;
                    if (goodObj && goodObj.id) {
                        goodsMap.set(goodObj.id, goodObj);
                    }
                }
            });
            
            // Подсчитываем количество каждого товара
            const goodsCount = {};
            order.good_ids.forEach(id => {
                goodsCount[id] = (goodsCount[id] || 0) + 1;
            });
            
            // Формируем список товаров с количеством
            Object.keys(goodsCount).forEach(id => {
                const goodData = goodsMap.get(parseInt(id));
                if (goodData) {
                    goodsList.push({
                        id: parseInt(id),
                        quantity: goodsCount[id],
                        data: goodData
                    });
                }
            });
        } else if (order.goods && Array.isArray(order.goods)) {
            // Если есть goods, используем их
            const goodsPromises = order.goods.map(good => {
                const goodId = good.id || good;
                return api.get(`/exam-2024-1/api/goods/${goodId}`).catch(() => null);
            });
            const goods = await Promise.all(goodsPromises);
            goods.forEach((good, index) => {
                if (good) {
                    const goodObj = Array.isArray(good) ? good[0] : good;
                    if (goodObj && goodObj.id) {
                        goodsMap.set(goodObj.id, goodObj);
                        goodsList.push({
                            id: goodObj.id,
                            quantity: order.goods[index].quantity || 1,
                            data: goodObj
                        });
                    }
                }
            });
        }

        // Формируем состав заказа
        let compositionHtml = '<ul style="list-style: none; padding: 0;">';
        let totalCost = 0;
        
        if (goodsList.length > 0) {
            goodsList.forEach(item => {
                const goodData = item.data;
                const price = goodData.actual_price || goodData.price || 0;
                const discount = goodData.discount_price || goodData.discount || 0;
                const finalPrice = (discount && discount > 0 && discount < price) ? discount : price;
                const quantity = item.quantity || 1;
                const itemTotal = finalPrice * quantity;
                totalCost += itemTotal;
                
                compositionHtml += `
                    <li style="padding: 0.5rem 0; border-bottom: 1px solid var(--border-color);">
                        <strong>${goodData.name || 'Товар #' + item.id}</strong> - ${quantity} шт. × ${finalPrice.toFixed(2)} ₽ = ${itemTotal.toFixed(2)} ₽
                    </li>
                `;
            });
        } else {
            compositionHtml += '<li>Товары не найдены</li>';
        }
        compositionHtml += '</ul>';

        // Форматируем дату оформления
        let formattedDate = 'Не указана';
        if (order.created_at) {
            try {
                const orderDate = new Date(order.created_at);
                if (!isNaN(orderDate.getTime())) {
                    formattedDate = orderDate.toLocaleString('ru-RU', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                }
            } catch (e) {
                console.error('Error formatting order date:', e);
            }
        }

        // Форматируем дату доставки
        let deliveryDate = 'Не указана';
        if (order.delivery_date) {
            try {
                // API может вернуть дату в формате dd.mm.yyyy или YYYY-MM-DD
                let dateStr = order.delivery_date;
                if (dateStr.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
                    // Формат dd.mm.yyyy
                    const parts = dateStr.split('.');
                    const date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                    if (!isNaN(date.getTime())) {
                        deliveryDate = date.toLocaleDateString('ru-RU', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        });
                    }
                } else {
                    // Формат YYYY-MM-DD
                    const date = new Date(dateStr);
                    if (!isNaN(date.getTime())) {
                        deliveryDate = date.toLocaleDateString('ru-RU', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        });
                    }
                }
            } catch (e) {
                console.error('Error formatting delivery date:', e);
            }
        }

        const modalBody = document.getElementById('viewModalBody');
        if (!modalBody) {
            throw new Error('Элемент viewModalBody не найден');
        }
        
        modalBody.innerHTML = `
            <div style="display: grid; gap: 1rem;">
                <div><strong>Номер заказа:</strong> ${order.id || 'Не указан'}</div>
                <div><strong>Дата оформления:</strong> ${formattedDate}</div>
                <div><strong>Имя:</strong> ${order.full_name || 'Не указано'}</div>
                <div><strong>Email:</strong> ${order.email || 'Не указан'}</div>
                <div><strong>Телефон:</strong> ${order.phone || 'Не указан'}</div>
                <div><strong>Адрес доставки:</strong> ${order.delivery_address || 'Не указан'}</div>
                <div><strong>Дата доставки:</strong> ${deliveryDate}</div>
                <div><strong>Время доставки:</strong> ${order.delivery_interval || order.delivery_time || 'Не указано'}</div>
                <div><strong>Состав заказа:</strong> ${compositionHtml}</div>
                <div><strong>Итоговая стоимость:</strong> ${totalCost.toFixed(2)} ₽</div>
                ${order.comment ? `<div><strong>Комментарий:</strong> ${order.comment}</div>` : ''}
                ${order.subscribe ? '<div><strong>Подписка на рассылку:</strong> Да</div>' : ''}
            </div>
        `;

        const modal = document.getElementById('viewModal');
        if (modal) {
            modal.classList.add('show');
            modal.style.display = 'flex';
        } else {
            throw new Error('Модальное окно viewModal не найдено');
        }

    } catch (error) {
        console.error('Ошибка при загрузке заказа:', error);
        showNotification(`Ошибка при загрузке заказа: ${error.message}`, 'error');
    }
}

// Редактирование заказа
async function editOrder(orderId) {
    currentOrderId = orderId;
    
    try {
        console.log('Loading order for edit:', orderId);
        const orderResult = await api.get(`/exam-2024-1/api/orders/${orderId}`);
        console.log('Order result for edit:', orderResult);
        
        // API может вернуть массив с одним элементом или объект
        let order = orderResult;
        if (Array.isArray(orderResult) && orderResult.length > 0) {
            order = orderResult[0];
        } else if (Array.isArray(orderResult) && orderResult.length === 0) {
            throw new Error('Заказ не найден');
        }
        
        if (!order || !order.id) {
            throw new Error('Неверный формат данных заказа');
        }
        
        // Заполняем форму
        document.getElementById('editFullName').value = order.full_name || '';
        document.getElementById('editEmail').value = order.email || '';
        document.getElementById('editPhone').value = order.phone || '';
        document.getElementById('editAddress').value = order.delivery_address || '';
        
        // Форматируем дату для input[type="date"]
        // API возвращает дату в формате dd.mm.yyyy или YYYY-MM-DD
        if (order.delivery_date) {
            let date;
            // Проверяем формат даты
            if (order.delivery_date.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
                // Формат dd.mm.yyyy
                const parts = order.delivery_date.split('.');
                date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            } else {
                // Формат YYYY-MM-DD
                date = new Date(order.delivery_date);
            }
            const formattedDate = date.toISOString().split('T')[0];
            document.getElementById('editDeliveryDate').value = formattedDate;
        } else {
            document.getElementById('editDeliveryDate').value = '';
        }
        
        document.getElementById('editDeliveryTime').value = order.delivery_interval || order.delivery_time || '';
        document.getElementById('editComment').value = order.comment || '';

        const modal = document.getElementById('editModal');
        modal.classList.add('show');
        modal.style.display = 'flex';

    } catch (error) {
        console.error('Ошибка при загрузке заказа для редактирования:', error);
        showNotification(`Ошибка при загрузке заказа: ${error.message}`, 'error');
    }
}

// Удаление заказа
async function deleteOrder(orderId) {
    currentOrderId = orderId;
    
    const modal = document.getElementById('deleteModal');
    modal.classList.add('show');
    modal.style.display = 'flex';
}

// Сохранение изменений заказа
async function saveOrderChanges() {
    if (!currentOrderId) return;

    const form = document.getElementById('editOrderForm');
    const formData = new FormData(form);

    // Форматируем дату в правильный формат (dd.mm.yyyy для API)
    const deliveryDateValue = formData.get('delivery_date');
    let deliveryDate = null;
    if (deliveryDateValue) {
        // input[type="date"] возвращает дату в формате YYYY-MM-DD
        const date = new Date(deliveryDateValue + 'T00:00:00');
        
        // Проверяем, что дата валидна
        if (isNaN(date.getTime())) {
            showNotification('Неверный формат даты доставки', 'error');
            return;
        }
        
        // Форматируем в dd.mm.yyyy
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        deliveryDate = `${day}.${month}.${year}`;
    }
    
    const orderData = {
        full_name: formData.get('full_name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        delivery_address: formData.get('delivery_address'),
        delivery_date: deliveryDate,
        delivery_interval: formData.get('delivery_interval'), // API ожидает delivery_interval
        comment: formData.get('comment') || null
    };

    // Валидация
    if (!orderData.full_name || !orderData.email || !orderData.phone || 
        !orderData.delivery_address || !orderData.delivery_date || !orderData.delivery_interval) {
        showNotification('Заполните все обязательные поля', 'error');
        return;
    }
    
    // Удаляем null и пустые значения
    if (!orderData.comment || orderData.comment === '') {
        delete orderData.comment;
    }

    try {
        await api.put(`/exam-2024-1/api/orders/${currentOrderId}`, orderData);
        
        showNotification('Заказ успешно изменён', 'success');
        closeEditModal();
        loadOrders();

    } catch (error) {
        console.error('Ошибка при сохранении заказа:', error);
        showNotification(`Ошибка при сохранении заказа: ${error.message}`, 'error');
    }
}

// Подтверждение удаления заказа
async function confirmDelete() {
    if (!currentOrderId) return;

    try {
        await api.delete(`/exam-2024-1/api/orders/${currentOrderId}`);
        
        showNotification('Заказ успешно удалён', 'success');
        closeDeleteModal();
        loadOrders();

    } catch (error) {
        console.error('Ошибка при удалении заказа:', error);
        showNotification(`Ошибка при удалении заказа: ${error.message}`, 'error');
    }
}

// Закрытие модальных окон
function closeViewModal() {
    const modal = document.getElementById('viewModal');
    modal.classList.remove('show');
    modal.style.display = 'none';
}

function closeEditModal() {
    const modal = document.getElementById('editModal');
    modal.classList.remove('show');
    modal.style.display = 'none';
    currentOrderId = null;
}

function closeDeleteModal() {
    const modal = document.getElementById('deleteModal');
    modal.classList.remove('show');
    modal.style.display = 'none';
    currentOrderId = null;
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    // Загружаем заказы
    loadOrders();

    // Обработчики закрытия модальных окон
    document.getElementById('closeViewModal').addEventListener('click', closeViewModal);
    document.getElementById('closeEditModal').addEventListener('click', closeEditModal);
    document.getElementById('closeDeleteModal').addEventListener('click', closeDeleteModal);
    document.getElementById('cancelEditBtn').addEventListener('click', closeEditModal);
    document.getElementById('cancelDeleteBtn').addEventListener('click', closeDeleteModal);
    document.getElementById('confirmDeleteBtn').addEventListener('click', confirmDelete);

    // Обработчик формы редактирования
    document.getElementById('editOrderForm').addEventListener('submit', (e) => {
        e.preventDefault();
        saveOrderChanges();
    });

    // Закрытие модальных окон при клике вне их
    document.getElementById('viewModal').addEventListener('click', (e) => {
        if (e.target.id === 'viewModal') {
            closeViewModal();
        }
    });

    document.getElementById('editModal').addEventListener('click', (e) => {
        if (e.target.id === 'editModal') {
            closeEditModal();
        }
    });

    document.getElementById('deleteModal').addEventListener('click', (e) => {
        if (e.target.id === 'deleteModal') {
            closeDeleteModal();
        }
    });
});

// Экспорт функций для использования в onclick
window.viewOrder = viewOrder;
window.editOrder = editOrder;
window.deleteOrder = deleteOrder;