/**
 * Steam Deck / Linux OSK input guard.
 *
 * The Steam on-screen keyboard (and Chromium Wayland IME) often commits the
 * same tap twice: a key event plus an IME/composition insert. This module
 * drops the duplicate commit, keeps Enter from firing during IME, and lifts
 * the composer out from under the keyboard.
 */
(function (root) {
  const INSERT_TYPES = {
    insertText: true,
    insertCompositionText: true,
    insertFromYank: false
  };

  const DELETE_TYPES = {
    deleteContentBackward: true,
    deleteContentForward: true,
    deleteByCut: false
  };

  function isTextField(el) {
    if (!el || el.nodeType !== 1) return false;
    const tag = el.tagName;
    if (tag === 'TEXTAREA' || el.isContentEditable) return true;
    if (tag !== 'INPUT') return false;
    const type = (el.type || 'text').toLowerCase();
    return (
      type === 'text' ||
      type === 'password' ||
      type === 'search' ||
      type === 'email' ||
      type === 'url' ||
      type === 'tel' ||
      type === 'number' ||
      type === ''
    );
  }

  function isImeKey(e) {
    return Boolean(e && (e.isComposing || e.keyCode === 229 || e.key === 'Process'));
  }

  /**
   * @param {{ t: number, data: string, type: string, target: unknown }} last
   * @param {{ data?: string, inputType: string, target: unknown }} e
   * @param {number} now
   * @param {{ sameFrameMs?: number, mixedPathMs?: number }} [opts]
   */
  function shouldDropInsert(last, e, now, opts) {
    const sameFrameMs = opts && opts.sameFrameMs != null ? opts.sameFrameMs : 12;
    const mixedPathMs = opts && opts.mixedPathMs != null ? opts.mixedPathMs : 36;
    if (!e || !last) return false;

    const type = e.inputType;
    const isInsert = type === 'insertText' || type === 'insertCompositionText';
    const isDelete = type === 'deleteContentBackward' || type === 'deleteContentForward';
    if (!isInsert && !isDelete) return false;
    if (isInsert && !e.data) return false;
    if (e.target !== last.target) return false;

    const dt = now - last.t;
    if (dt < 0) return false;

    if (isDelete) {
      return type === last.type && dt < sameFrameMs;
    }

    if (e.data !== last.data) return false;
    if (dt < sameFrameMs) return true;
    const mixed = type !== last.type && (last.type === 'insertText' || last.type === 'insertCompositionText');
    return mixed && dt < mixedPathMs;
  }

  function shouldDropKey(last, e, now, windowMs) {
    const limit = windowMs != null ? windowMs : 12;
    if (!e || !last || e.repeat || isImeKey(e)) return false;
    if (e.target !== last.target) return false;
    if (e.key !== last.key || e.code !== last.code) return false;
    const dt = now - last.t;
    return dt >= 0 && dt < limit;
  }

  function shouldDropKeyAfterInsert(lastInsert, e, now, windowMs) {
    const limit = windowMs != null ? windowMs : 24;
    if (!e || !lastInsert || e.repeat || isImeKey(e)) return false;
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    if (!e.key || e.key.length !== 1) return false;
    if (e.target !== lastInsert.target) return false;
    if (e.key !== lastInsert.data) return false;
    const dt = now - lastInsert.t;
    return dt >= 0 && dt < limit;
  }

  function prefersKeyboardAutofocus() {
    if (typeof window !== 'undefined' && window.crystal && window.crystal.platform && window.crystal.platform.steamDeck) {
      return false;
    }
    if (typeof window === 'undefined' || !window.matchMedia) return true;
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }

  if (typeof document === 'undefined') {
    root.CrystalInput = {
      isTextField,
      isImeKey,
      shouldDropInsert,
      shouldDropKey,
      shouldDropKeyAfterInsert,
      prefersKeyboardAutofocus
    };
    if (typeof module !== 'undefined' && module.exports) {
      module.exports = root.CrystalInput;
    }
    return;
  }

  let lastInsert = { t: -1e9, data: '', type: '', target: null };
  let lastKey = { t: -1e9, key: '', code: '', target: null };

  document.addEventListener(
    'beforeinput',
    (e) => {
      if (!e.cancelable) return;
      const now = performance.now();
      if (shouldDropInsert(lastInsert, e, now)) {
        e.preventDefault();
        return;
      }
      if (INSERT_TYPES[e.inputType] && e.data) {
        lastInsert = { t: now, data: e.data, type: e.inputType, target: e.target };
      } else if (DELETE_TYPES[e.inputType]) {
        lastInsert = { t: now, data: '', type: e.inputType, target: e.target };
      }
    },
    true
  );

  document.addEventListener(
    'keydown',
    (e) => {
      if (isImeKey(e)) return;
      const now = performance.now();
      if (shouldDropKey(lastKey, e, now)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      if (shouldDropKeyAfterInsert(lastInsert, e, now)) {
        e.preventDefault();
      }
      lastKey = { t: now, key: e.key, code: e.code, target: e.target };
    },
    true
  );

  function syncKeyboardInset() {
    const vv = window.visualViewport;
    let inset = 0;
    if (vv) {
      inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      if (inset < 80) inset = 0;
    }
    document.documentElement.style.setProperty('--keyboard-inset', inset + 'px');
    document.body.classList.toggle('keyboard-open', inset >= 80);
  }

  function setVisualsPaused(paused) {
    if (window.CrystalVisual && typeof window.CrystalVisual.setPaused === 'function') {
      window.CrystalVisual.setPaused(paused);
    }
    if (window.CrystalStarfield && typeof window.CrystalStarfield.setPaused === 'function') {
      window.CrystalStarfield.setPaused(paused);
    }
  }

  function onFocusChange() {
    const el = document.activeElement;
    const typing = isTextField(el);
    document.body.classList.toggle('typing', typing);
    document.body.classList.toggle('composing-chat', typing && el && el.id === 'prompt');
    setVisualsPaused(typing);
    if (typing) {
      requestAnimationFrame(() => {
        try {
          el.scrollIntoView({ block: 'center', inline: 'nearest' });
        } catch (_) {}
        syncKeyboardInset();
      });
    } else {
      syncKeyboardInset();
    }
  }

  document.addEventListener('focusin', onFocusChange);
  document.addEventListener('focusout', () => {
    setTimeout(onFocusChange, 0);
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncKeyboardInset);
    window.visualViewport.addEventListener('scroll', syncKeyboardInset);
  }
  window.addEventListener('resize', syncKeyboardInset);
  syncKeyboardInset();

  if (window.crystal && window.crystal.platform && window.crystal.platform.steamDeck) {
    document.documentElement.classList.add('steam-deck');
  }

  root.CrystalInput = {
    isTextField,
    isImeKey,
    shouldDropInsert,
    shouldDropKey,
    shouldDropKeyAfterInsert,
    prefersKeyboardAutofocus,
    syncKeyboardInset
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.CrystalInput;
  }
})(typeof window !== 'undefined' ? window : globalThis);
