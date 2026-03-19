/**
 * Тест реферальной системы
 * Запуск: node test-referral.js
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

async function api(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  console.log(`→ ${options.method || 'GET'} ${url}`);
  
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Auth': '1',
      ...options.headers,
    },
  });
  
  let data;
  try {
    data = await res.json();
  } catch {
    data = await res.text();
  }
  
  if (!res.ok) {
    console.error(`❌ Error ${res.status}:`, data);
    throw new Error(`${res.status}: ${JSON.stringify(data)}`);
  }
  
  console.log(`✅ OK`);
  return data;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============ MAIN TEST ============

async function runTest() {
  console.log('🚀 Тест реферальной системы\n');
  console.log('API_BASE:', API_BASE);
  console.log('='.repeat(50));
  
  try {
    // Шаг 1: Создаём тестовых пользователей
    console.log('\n📝 ШАГ 1: Создаём пользователей\n');
    
    const users = [];
    for (let i = 0; i < 5; i++) {
      const tgId = 100000000 + i * 11111111;
      const username = `user_${i + 1}`;
      
      try {
        const res = await api('/api/debug/create-user', {
          method: 'POST',
          body: JSON.stringify({ tgId, username }),
        });
        users.push(res.user);
        console.log(`   Создан: ${username} (ID: ${res.user.id}, TG: ${res.user.tg_id})\n`);
      } catch (e) {
        console.log(`   Уже существует: ${username}\n`);
        users.push({ id: `user_${i + 1}`, tg_id: tgId, username });
      }
      
      await sleep(200);
    }
    
    // Шаг 2: Регистрируем партнёра root
    console.log('\n📝 ШАГ 2: Регистрируем корневого партнёра\n');
    
    const rootPartner = await api('/api/partner/register', {
      method: 'POST',
      body: JSON.stringify({ 
        tgId: users[0].tg_id,
        username: users[0].username,
      }),
    });
    
    console.log('✅ Root партнёр:');
    console.log('   public_id:', rootPartner.partner.public_id);
    console.log('   client_code:', rootPartner.partner.client_code);
    console.log('   team_code:', rootPartner.partner.team_code);
    
    await sleep(300);
    
    // Шаг 3: Регистрируем партнёра L1
    console.log('\n📝 ШАГ 3: Регистрируем партнёра L1 (приглашён root)\n');
    
    const l1Partner = await api('/api/partner/register', {
      method: 'POST',
      body: JSON.stringify({ 
        tgId: users[1].tg_id,
        username: users[1].username,
        teamCode: rootPartner.partner.team_code,
      }),
    });
    
    console.log('✅ L1 партнёр:');
    console.log('   public_id:', l1Partner.partner.public_id);
    console.log('   client_code:', l1Partner.partner.client_code);
    console.log('   team_code:', l1Partner.partner.team_code);
    console.log('   parent_partner_id:', l1Partner.partner.parent_partner_id);
    
    await sleep(300);
    
    // Шаг 4: Регистрируем партнёра L2
    console.log('\n📝 ШАГ 4: Регистрируем партнёра L2 (приглашён L1)\n');
    
    const l2Partner = await api('/api/partner/register', {
      method: 'POST',
      body: JSON.stringify({ 
        tgId: users[2].tg_id,
        username: users[2].username,
        teamCode: l1Partner.partner.team_code,
      }),
    });
    
    console.log('✅ L2 партнёр:');
    console.log('   public_id:', l2Partner.partner.public_id);
    console.log('   client_code:', l2Partner.partner.client_code);
    console.log('   team_code:', l2Partner.partner.team_code);
    console.log('   parent_partner_id:', l2Partner.partner.parent_partner_id);
    
    await sleep(300);
    
    // Шаг 5: Создаём заказы для клиентов
    console.log('\n📝 ШАГ 5: Создаём заказы для клиентов\n');
    
    // Клиент 1 (через L1)
    console.log('Заказ 1: client_code =', l1Partner.partner.client_code);
    const order1 = await api('/api/client/order', {
      method: 'POST',
      body: JSON.stringify({ 
        tgId: users[3].tg_id,
        username: users[3].username,
        planId: 'standard',
        clientCode: l1Partner.partner.client_code,
      }),
    });
    console.log('   order_id:', order1.order.id);
    
    await sleep(200);
    
    // Клиент 2 (через L2)
    console.log('\nЗаказ 2: client_code =', l2Partner.partner.client_code);
    const order2 = await api('/api/client/order', {
      method: 'POST',
      body: JSON.stringify({ 
        tgId: users[4].tg_id,
        username: users[4].username,
        planId: 'pro',
        clientCode: l2Partner.partner.client_code,
      }),
    });
    console.log('   order_id:', order2.order.id);
    
    await sleep(300);
    
    // Шаг 6: Помечаем заказы оплаченными
    console.log('\n📝 ШАГ 6: Помечаем заказы оплаченными\n');
    
    await api(`/api/orders/${order1.order.id}/mark-paid`, {
      method: 'POST',
    });
    console.log('   Заказ 1 оплачен');
    
    await sleep(200);
    
    await api(`/api/orders/${order2.order.id}/mark-paid`, {
      method: 'POST',
    });
    console.log('   Заказ 2 оплачен');
    
    await sleep(500);
    
    // Шаг 7: Проверяем дашборды
    console.log('\n\n========== РЕЗУЛЬТАТЫ ==========\n');
    
    const rootDash = await api(`/api/partner/${rootPartner.partner.public_id}/dashboard`);
    console.log('\n📊 Root партнёр (public_id:', rootPartner.partner.public_id, '):');
    console.log('   Баланс:', rootDash.balance.available_rub, '₽');
    console.log('   Прямых клиентов:', rootDash.stats.direct_clients);
    console.log('   Команда L1:', rootDash.stats.team_l1);
    console.log('   Команда L2:', rootDash.stats.team_l2);
    console.log('   Оборот:', rootDash.stats.turnover_rub, '₽');
    
    await sleep(200);
    
    const l1Dash = await api(`/api/partner/${l1Partner.partner.public_id}/dashboard`);
    console.log('\n📊 L1 партнёр (public_id:', l1Partner.partner.public_id, '):');
    console.log('   Баланс:', l1Dash.balance.available_rub, '₽');
    console.log('   Прямых клиентов:', l1Dash.stats.direct_clients);
    console.log('   Команда L1:', l1Dash.stats.team_l1);
    console.log('   Команда L2:', l1Dash.stats.team_l2);
    console.log('   Оборот:', l1Dash.stats.turnover_rub, '₽');
    
    await sleep(200);
    
    const l2Dash = await api(`/api/partner/${l2Partner.partner.public_id}/dashboard`);
    console.log('\n📊 L2 партнёр (public_id:', l2Partner.partner.public_id, '):');
    console.log('   Баланс:', l2Dash.balance.available_rub, '₽');
    console.log('   Прямых клиентов:', l2Dash.stats.direct_clients);
    console.log('   Команда L1:', l2Dash.stats.team_l1);
    console.log('   Команда L2:', l2Dash.stats.team_l2);
    console.log('   Оборот:', l2Dash.stats.turnover_rub, '₽');
    
    // Шаг 8: Проверяем команды
    console.log('\n\n========== КОМАНДЫ ==========\n');
    
    const rootTeam = await api(`/api/partner/${rootPartner.partner.public_id}/team`);
    console.log('\n🌳 Root команда:');
    console.log('   L1:', rootTeam.team?.l1?.length || 0, 'партнёров');
    console.log('   L2:', rootTeam.team?.l2?.length || 0, 'партнёров');
    
    await sleep(200);
    
    const l1Team = await api(`/api/partner/${l1Partner.partner.public_id}/team`);
    console.log('\n🌳 L1 команда:');
    console.log('   L1:', l1Team.team?.l1?.length || 0, 'партнёров');
    console.log('   L2:', l1Team.team?.l2?.length || 0, 'партнёров');
    
    await sleep(200);
    
    const l2Team = await api(`/api/partner/${l2Partner.partner.public_id}/team`);
    console.log('\n🌳 L2 команда:');
    console.log('   L1:', l2Team.team?.l1?.length || 0, 'партнёров');
    console.log('   L2:', l2Team.team?.l2?.length || 0, 'партнёров');
    
    // Итоги
    console.log('\n\n========== ИТОГИ ==========\n');
    console.log('✅ Тест завершён!');
    console.log('\n💡 Проверьте в админке:');
    console.log('   1. Раздел "Партнёры" — должны быть 3 партнёра');
    console.log('   2. Раздел "Заказы" — должно быть 2 заказа');
    console.log('   3. Балансы партнёров — должны быть начисления');
    
  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTest();
