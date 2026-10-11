/* Кафе «Ланч» (демо) — чек, который собирает заказ. Без зависимостей. */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const OPEN_MIN = 8 * 60;        // 08:00
  const CLOSE_MIN = 23 * 60;      // 23:00
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rub = (n) => n.toLocaleString('ru-RU') + ' ₽';
  const plural = (n, forms) => {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return forms[0];
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return forms[1];
    return forms[2];
  };

  /* ---------- Moscow time: open / closed, receipt date ---------- */
  const minutesInMoscow = () => {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
      const get = (t) => Number(parts.find((p) => p.type === t).value);
      return get('hour') * 60 + get('minute');
    } catch (e) {
      const d = new Date();
      return d.getHours() * 60 + d.getMinutes();
    }
  };

  const status = $('#status');
  const updateStatus = () => {
    if (!status) return;
    const text = $('.status__text', status);
    const now = minutesInMoscow();
    const open = now >= OPEN_MIN && now < CLOSE_MIN;
    status.classList.toggle('is-closed', !open);
    if (open) {
      const left = CLOSE_MIN - now;
      text.textContent = left <= 45 ? `Открыто ещё ${left} мин · до 23:00` : 'Открыто сейчас · до 23:00';
    } else {
      text.textContent = 'Закрыто · откроемся в 08:00';
    }
  };
  updateStatus();
  window.setInterval(updateStatus, 60 * 1000);

  const dateEl = $('#checkDate');
  if (dateEl) {
    try {
      dateEl.textContent = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        .format(new Date()).replace(',', '');
    } catch (e) { /* leave the printed fallback */ }
  }

  /* ---------- entrance: the receipt prints, the tiles drop, the stamp lands ---------- */
  const receipt = $('#check');
  const drops = $$('[data-drop]');
  const tiles = drops.filter((el) => el.classList.contains('tile'));
  const stamps = drops.filter((el) => !el.classList.contains('tile'));

  if (reduceMotion) {
    drops.forEach((el) => el.classList.add('is-landed'));
    if (receipt) receipt.classList.add('is-printed');
  } else {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (receipt) receipt.classList.add('is-printed');
        tiles.forEach((el, i) => window.setTimeout(() => el.classList.add('is-landed'), 260 + i * 360));
        stamps.forEach((el) => window.setTimeout(() => el.classList.add('is-landed'), 1750));
      });
    });
  }

  drops.forEach((el) => el.addEventListener('animationend', () => el.classList.add('is-still'), { once: true }));

  /* ---------- nudge the tiles ---------- */
  const LIMIT = 90;
  tiles.forEach((tile) => {
    let active = false, sx = 0, sy = 0, ox = 0, oy = 0;
    const read = (name) => parseFloat(tile.style.getPropertyValue(name)) || 0;
    tile.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      active = true;
      tile.setPointerCapture(e.pointerId);
      tile.classList.add('is-dragging');
      sx = e.clientX; sy = e.clientY; ox = read('--dx'); oy = read('--dy');
    });
    tile.addEventListener('pointermove', (e) => {
      if (!active) return;
      const dx = Math.max(-LIMIT, Math.min(LIMIT, ox + e.clientX - sx));
      const dy = Math.max(-LIMIT, Math.min(LIMIT, oy + e.clientY - sy));
      tile.style.setProperty('--dx', dx + 'px');
      tile.style.setProperty('--dy', dy + 'px');
    });
    const settle = () => {
      if (!active) return;
      active = false;
      tile.classList.remove('is-dragging');
      tile.classList.add('is-settling');
      window.setTimeout(() => tile.classList.remove('is-settling'), 520);
    };
    tile.addEventListener('pointerup', settle);
    tile.addEventListener('pointercancel', settle);
  });

  /* ---------- the order ---------- */
  const KEY = 'lanch.check';
  let order = [];
  try {
    const stored = JSON.parse(window.localStorage.getItem(KEY) || '[]');
    if (Array.isArray(stored)) order = stored.filter((i) => i && typeof i.name === 'string' && Number.isFinite(i.price) && i.qty > 0);
  } catch (e) { order = []; }
  const save = () => { try { window.localStorage.setItem(KEY, JSON.stringify(order)); } catch (e) { /* private mode */ } };

  const keyOf = (i) => `${i.name}|${i.variant || ''}`;
  const total = () => order.reduce((s, i) => s + i.price * i.qty, 0);
  const count = () => order.reduce((s, i) => s + i.qty, 0);

  const message = () => {
    if (!order.length) return 'Здравствуйте! Хочу сделать заказ в «Ланч»';
    const lines = order.map((i) => `${i.qty} × ${i.name}${i.variant ? ` (${i.variant})` : ''} — ${(i.price * i.qty).toLocaleString('ru-RU')} ₽`);
    return `Здравствуйте! Хочу сделать заказ в «Ланч»:\n${lines.join('\n')}\nИтого: ${rub(total())}\n\nДоставка или самовывоз: `;
  };

  const linesEl = $('#checkLines');
  const emptyEl = $('#checkEmpty');
  const totalEl = $('#checkTotal');
  const statusEl = $('#checkStatus');
  const clearBtn = $('#clearCheck');
  const bar = $('#orderbar');
  const barCount = $('#orderbarCount');
  const barTotal = $('#orderbarTotal');
  const barLast = $('#orderbarLast');
  let lastTimer = 0;

  const render = (newKey) => {
    if (!linesEl) return;
    linesEl.innerHTML = order.map((i) => {
      const k = keyOf(i);
      const fresh = k === newKey && !reduceMotion ? ' is-new' : '';
      return `<li class="line${fresh}" data-key="${esc(k)}">
        <span class="line__qty">${i.qty}×</span>
        <span class="line__name">${esc(i.name)}${i.variant ? ` <span class="line__var">${esc(i.variant)}</span>` : ''}</span>
        <span class="line__leader" aria-hidden="true"></span>
        <span class="line__price">${(i.price * i.qty).toLocaleString('ru-RU')}</span>
        <span class="line__ctrl">
          <button type="button" class="qty" data-delta="-1" aria-label="Убрать одну: ${esc(i.name)}"><svg class="ico" aria-hidden="true"><use href="#i-minus"/></svg></button>
          <button type="button" class="qty" data-delta="1" aria-label="Добавить ещё: ${esc(i.name)}"><svg class="ico" aria-hidden="true"><use href="#i-plus"/></svg></button>
        </span>
      </li>`;
    }).join('');

    const has = order.length > 0;
    if (emptyEl) emptyEl.hidden = has;
    if (clearBtn) clearBtn.hidden = !has;
    if (totalEl) totalEl.textContent = rub(total());
    if (statusEl) {
      statusEl.textContent = has ? 'Голод: почти побеждён' : 'Голод: обнаружен';
      statusEl.classList.toggle('is-ok', has);
    }
    if (bar) {
      const n = count();
      barCount.textContent = has ? `${n} ${plural(n, ['позиция', 'позиции', 'позиций'])}` : 'Чек пуст';
      barTotal.textContent = rub(total());
      if (has && newKey) {
        const it = order.find((i) => keyOf(i) === newKey);
        if (barLast && it) {
          barLast.textContent = `+ ${it.qty}× ${it.name}${it.variant ? ` (${it.variant})` : ''} — ${(it.price * it.qty).toLocaleString('ru-RU')} ₽`;
          barLast.classList.remove('is-printing');
          void barLast.offsetWidth;
          if (!reduceMotion) barLast.classList.add('is-printing');
          window.clearTimeout(lastTimer);
          lastTimer = window.setTimeout(() => { barLast.textContent = ''; barLast.classList.remove('is-printing'); }, 2600);
        }
        if (!reduceMotion) {
          barTotal.classList.remove('is-bump');
          void barTotal.offsetWidth;
          barTotal.classList.add('is-bump');
        }
      }
    }
  };

  const add = (name, price, variant) => {
    const item = { name, price, variant: variant || '', qty: 1 };
    const k = keyOf(item);
    const existing = order.find((i) => keyOf(i) === k);
    if (existing) existing.qty += 1; else order.push(item);
    save();
    render(k);
  };

  const change = (k, delta) => {
    const item = order.find((i) => keyOf(i) === k);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) order = order.filter((i) => i !== item);
    save();
    render();
  };

  document.addEventListener('click', (e) => {
    const addBtn = e.target.closest('[data-add]');
    if (addBtn) {
      const holder = addBtn.closest('[data-name]');
      if (!holder) return;
      const name = holder.dataset.name;
      const price = Number(addBtn.dataset.price || holder.dataset.price);
      if (!name || !Number.isFinite(price)) return;
      add(name, price, addBtn.dataset.variant);
      addBtn.classList.add('is-added');
      window.setTimeout(() => addBtn.classList.remove('is-added'), 650);
      return;
    }
    const qtyBtn = e.target.closest('.qty[data-delta]');
    if (qtyBtn) {
      const line = qtyBtn.closest('[data-key]');
      if (line) change(line.dataset.key, Number(qtyBtn.dataset.delta));
    }
  });

  if (clearBtn) clearBtn.addEventListener('click', () => { order = []; save(); render(); });

  render();

  /* ---------- demo mode: outbound links explain what the live site would do ---------- */
  const toast = $('#demoToast');
  const toastTitle = $('#demoToastTitle');
  const toastText = $('#demoToastText');
  const toastMsg = $('#demoToastMsg');
  const DEMO = {
    whatsapp: ['WhatsApp', 'В рабочей версии откроется чат с кафе в WhatsApp, и чек уже будет вставлен текстом:'],
    telegram: ['Telegram', 'В рабочей версии откроется чат с кафе в Telegram, и чек уже будет вставлен текстом:'],
    phone: ['Звонок', 'В рабочей версии здесь сразу начнётся звонок в кафе. Номер на демо-сайте вымышленный.'],
    yandex: ['Карты', 'В рабочей версии откроется маршрут до кафе в Яндекс Картах.'],
    '2gis': ['2ГИС', 'В рабочей версии откроется карточка кафе в 2ГИС с маршрутом и отзывами.'],
    instagram: ['Instagram', 'В рабочей версии откроется профиль кафе с Reels и актуальным.'],
  };
  const EMPTY_CHAT = 'В рабочей версии откроется чат с кафе. Добавьте блюда плюсом — и чек уйдёт туда готовым текстом.';
  let toastTimer = 0;
  const hideToast = () => {
    if (!toast || toast.hidden) return;
    window.clearTimeout(toastTimer);
    toast.classList.remove('is-on');
    window.setTimeout(() => { if (!toast.classList.contains('is-on')) toast.hidden = true; }, reduceMotion ? 0 : 260);
  };
  const showToast = (kind) => {
    if (!toast) return;
    const [title, text] = DEMO[kind] || ['ссылка', 'Эта ссылка отключена в демо-версии.'];
    const chat = kind === 'whatsapp' || kind === 'telegram';
    const withCheck = chat && order.length > 0;
    toastTitle.textContent = `Демо · ${title}`;
    toastText.textContent = chat && !withCheck ? EMPTY_CHAT : text;
    toastMsg.hidden = !withCheck;
    toastMsg.textContent = withCheck ? message() : '';
    toast.hidden = false;
    void toast.offsetWidth;
    toast.classList.add('is-on');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(hideToast, withCheck ? 9000 : 5000);
  };
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-demo]');
    if (!link) return;
    e.preventDefault();
    showToast(link.dataset.demo);
  });
  if (toast) {
    $('#demoToastClose').addEventListener('click', hideToast);
    toast.addEventListener('pointerenter', () => window.clearTimeout(toastTimer));
    toast.addEventListener('pointerleave', () => { toastTimer = window.setTimeout(hideToast, 3000); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheetOpen) hideToast(); });
  }

  /* ---------- under 1024px the check lives in a bottom sheet ---------- */
  const sheet = $('#checkSheet');
  const sheetBody = $('#checkSheetBody');
  const sheetBar = $('#checkSheetBar');
  const checkCol = $('.check-col');
  const barSum = $('#orderbarSum');
  const narrow = window.matchMedia('(max-width: 1023px)');
  let sheetOpen = false;
  let lastFocus = null;

  // the same receipt node serves both layouts: the desktop column or the mobile sheet
  const placeReceipt = () => {
    if (!receipt || !sheetBody || !checkCol) return;
    const home = narrow.matches ? sheetBody : checkCol;
    if (receipt.parentNode !== home) home.appendChild(receipt);
  };

  const setSheet = (open) => {
    if (!sheet || open === sheetOpen) return;
    sheetOpen = open;
    sheet.classList.toggle('is-open', open);
    document.documentElement.classList.toggle('is-sheet-open', open);
    document.body.classList.toggle('is-sheet-open', open);
    if (barSum) barSum.setAttribute('aria-expanded', String(open));
    if (open) {
      lastFocus = document.activeElement;
      sheet.scrollTop = 0;
      const close = $('.sheet__close', sheet);
      if (close) close.focus({ preventScroll: true });
    } else if (lastFocus && typeof lastFocus.focus === 'function') {
      lastFocus.focus({ preventScroll: true });
      lastFocus = null;
    }
  };

  if (barSum) barSum.addEventListener('click', () => setSheet(!sheetOpen));
  $$('[data-sheet-close]').forEach((el) => el.addEventListener('click', () => setSheet(false)));
  document.addEventListener('keydown', (e) => {
    if (!sheetOpen) return;
    if (e.key === 'Escape') { setSheet(false); return; }
    if (e.key !== 'Tab' || !sheet) return;
    // keep keyboard focus inside the sheet while it is open
    const focusable = $$('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])', sheet).filter((el) => el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    else if (!sheet.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  });

  const onNarrowChange = () => { placeReceipt(); if (!narrow.matches) setSheet(false); };
  placeReceipt();
  if (narrow.addEventListener) narrow.addEventListener('change', onNarrowChange);
  else narrow.addListener(onNarrowChange);

  // pull the handle down to dismiss
  if (sheet && sheetBar) {
    let dragging = false, startY = 0, startT = 0, dy = 0;
    sheetBar.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      dragging = true; startY = e.clientY; startT = e.timeStamp; dy = 0;
      sheetBar.setPointerCapture(e.pointerId);
      sheet.classList.add('is-dragging');
    });
    sheetBar.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      dy = Math.max(0, e.clientY - startY);
      sheet.style.transform = `translateY(${dy}px)`;
    });
    const release = (e) => {
      if (!dragging) return;
      dragging = false;
      sheet.classList.remove('is-dragging');
      sheet.style.transform = '';
      const flick = dy > 24 && e.timeStamp - startT < 300;
      if (flick || dy > Math.min(140, sheet.offsetHeight * 0.3)) setSheet(false);
      if (dy > 6) {
        // a drag is not a tap: swallow the click the browser synthesises on release
        const swallow = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
        document.addEventListener('click', swallow, { capture: true, once: true });
        window.setTimeout(() => document.removeEventListener('click', swallow, { capture: true }), 400);
      }
    };
    sheetBar.addEventListener('pointerup', release);
    sheetBar.addEventListener('pointercancel', release);
  }

  /* ---------- category chips: stick under the top bar, follow the scroll ---------- */
  const catbar = $('#catbar');
  const catList = $('#catbarList');
  const chips = catbar ? $$('.catbar__chip', catbar) : [];
  const cats = chips.map((a) => document.getElementById((a.getAttribute('href') || '').slice(1)));
  if (catbar && chips.length && cats.every(Boolean)) {
    const topH = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--top-h')) || 60;
    let active = -1, ticking = false;

    const setActive = (i) => {
      if (i === active) return;
      active = i;
      chips.forEach((a, j) => {
        a.classList.toggle('is-active', j === i);
        if (j === i) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
      if (i < 0 || !catList) return;
      const lr = catList.getBoundingClientRect(), cr = chips[i].getBoundingClientRect();
      const left = catList.scrollLeft + (cr.left - lr.left) - (lr.width - cr.width) / 2;
      catList.scrollTo({ left: Math.max(0, left), behavior: reduceMotion ? 'auto' : 'smooth' });
    };

    const update = () => {
      ticking = false;
      if (!narrow.matches) { catbar.classList.remove('is-stuck'); setActive(-1); return; }
      const rect = catbar.getBoundingClientRect();
      const stuck = rect.top <= topH() + 0.5;
      catbar.classList.toggle('is-stuck', stuck);
      if (!stuck) { setActive(-1); return; }
      const line = rect.bottom + 24;
      let i = 0;
      for (let k = 0; k < cats.length; k++) {
        if (cats[k].getBoundingClientRect().top <= line) i = k; else break;
      }
      setActive(i);
    };
    const onScroll = () => { if (!ticking) { ticking = true; window.requestAnimationFrame(update); } };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();

    /* fade the left/right edge only while there's more strip to scroll to */
    if (catList) {
      let edgeTicking = false;
      const updateEdges = () => {
        edgeTicking = false;
        const max = catList.scrollWidth - catList.clientWidth;
        catbar.classList.toggle('has-fade-l', catList.scrollLeft > 4);
        catbar.classList.toggle('has-fade-r', catList.scrollLeft < max - 4);
      };
      catList.addEventListener('scroll', () => { if (!edgeTicking) { edgeTicking = true; window.requestAnimationFrame(updateEdges); } }, { passive: true });
      window.addEventListener('resize', updateEdges);
      updateEdges();
    }

    chips.forEach((a, i) => a.addEventListener('click', (e) => {
      e.preventDefault();
      const y = window.scrollY + cats[i].getBoundingClientRect().top - topH() - catbar.offsetHeight - 16;
      window.scrollTo({ top: Math.max(0, y), behavior: reduceMotion ? 'auto' : 'smooth' });
      if (window.history && history.replaceState) history.replaceState(null, '', '#' + cats[i].id);
    }));
  }

  /* ---------- showcase: each card flips through its frames while on screen ---------- */
  const HOLD_A = 500, HOLD_B = 1500, STAGGER = 700;
  $$('[data-card]').forEach((card, ci) => {
    const pics = $$('.card__pics img', card);
    if (pics.length < 2 || reduceMotion) return;
    // 1st and 3rd cards flip every 0.5s, 2nd and 4th every 1.5s
    const hold = ci % 2 ? HOLD_B : HOLD_A;
    let i = 0, timer = 0, inView = false;
    const step = () => {
      const next = (i + 1) % pics.length;
      pics[i].classList.remove('is-on');
      pics[next].classList.add('is-on');
      i = next;
      timer = window.setTimeout(step, hold);
    };
    const start = () => { if (!timer && inView && !document.hidden) timer = window.setTimeout(step, hold + ci * STAGGER); };
    const stop = () => { window.clearTimeout(timer); timer = 0; };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          inView = en.isIntersecting;
          if (inView) { pics.forEach((p) => { p.loading = 'eager'; }); start(); } else stop();
        });
      }, { threshold: 0.25 }).observe(card);
    } else { inView = true; start(); }
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });
  });

})();
