// Fluent X interactions: mobile nav, user menu, flashcard, mic timer
document.addEventListener('DOMContentLoaded', () => {
  // Dark mode toggle (persisted)
  const themeBtn = document.getElementById('themeToggle');
  const syncIcon = () => { if (themeBtn) themeBtn.textContent = document.documentElement.dataset.theme === 'dark' ? '☀️' : '🌙'; };
  syncIcon();
  if (themeBtn) themeBtn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('fx-theme', next); } catch (e) {}
    syncIcon();
  });

  // Mobile nav toggle
  const burger = document.getElementById('hamburger');
  const mobileNav = document.getElementById('mobileNav');
  if (burger && mobileNav) {
    burger.addEventListener('click', () => {
      burger.classList.toggle('open');
      mobileNav.classList.toggle('open');
    });
    mobileNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        burger.classList.remove('open');
        mobileNav.classList.remove('open');
      });
    });
  }

  // User menu toggle
  const menuBtn = document.getElementById('userMenuBtn');
  const menu = document.getElementById('userMenu');
  if (menuBtn && menu) {
    menuBtn.addEventListener('click', (e) => { e.stopPropagation(); menu.classList.toggle('open'); });
    document.addEventListener('click', () => menu.classList.remove('open'));
  }

  // Auto-dismiss flash messages
  setTimeout(() => {
    document.querySelectorAll('.flash').forEach(el => {
      el.style.opacity = '0'; el.style.transition = 'opacity .4s';
      setTimeout(() => el.remove(), 400);
    });
  }, 5000);

  // Vocabulary flashcard flip
  const card = document.getElementById('flashcard');
  if (card) {
    const ans = document.getElementById('cardAnswer');
    const hint = document.getElementById('cardHint');
    let open = false;
    card.addEventListener('click', () => {
      open = !open;
      if (ans) ans.style.display = open ? 'block' : 'none';
      if (hint) hint.style.display = open ? 'none' : 'block';
    });
  }

  // Word count for writing editor
  const contentInput = document.getElementById('contentInput');
  const wordCountEl = document.getElementById('wordCount');
  const charCountEl = document.getElementById('charCount');
  if (contentInput && wordCountEl) {
    const updateCounts = () => {
      const text = contentInput.value.trim();
      const words = text ? text.split(/\s+/).length : 0;
      wordCountEl.textContent = words;
      if (charCountEl) charCountEl.textContent = contentInput.value.length;
    };
    contentInput.addEventListener('input', updateCounts);
    updateCounts();
  }
});
