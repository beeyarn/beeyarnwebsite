/* =============================================
   BeeYarn Feed SPA — app.js
   Routes: /           → feed view
           /p/:slug    → post detail view
   API:    https://api.beeyarn.com
   ============================================= */

const App = (() => {
  'use strict';

  const API_BASE = 'https://api.beeyarn.com/api';
  const APP_PKG  = 'com.beeyarn.beeyarn';

  /* ── DOM refs ─────────────────────────────── */
  const views = {
    feed: document.getElementById('view-feed'),
    post: document.getElementById('view-post'),
  };

  const feedList      = document.getElementById('feed-list');
  const feedLoading   = document.getElementById('feed-loading');
  const feedError     = document.getElementById('feed-error');
  const feedErrorMsg  = document.getElementById('feed-error-msg');
  const feedLoadMore  = document.getElementById('feed-load-more');
  const btnLoadMore   = document.getElementById('btn-load-more');

  const postLoading   = document.getElementById('post-loading');
  const postArticle   = document.getElementById('post-article');
  const postError     = document.getElementById('post-error');
  const postErrorMsg  = document.getElementById('post-error-msg');
  const appBanner     = document.getElementById('app-banner');
  const appBannerLink = document.getElementById('app-banner-link');
  const btnBack       = document.getElementById('btn-back');

  /* ── State ────────────────────────────────── */
  let feedPage     = 1;
  let feedLoading_ = false;
  let feedHasMore  = true;

  /* ── Router ───────────────────────────────── */
  function route() {
    const path = location.pathname;
    const postMatch = path.match(/^\/p\/([^/]+)\/?$/);

    if (postMatch) {
      showView('post');
      loadPost(decodeURIComponent(postMatch[1]));
    } else {
      showView('feed');
      if (feedList.children.length === 0) loadFeed(true);
    }
  }

  function showView(name) {
    Object.entries(views).forEach(([k, el]) => {
      el.hidden = (k !== name);
    });
    window.scrollTo(0, 0);
  }

  /* ── Navigation ───────────────────────────── */
  function navigate(path) {
    history.pushState({}, '', path);
    route();
  }

  window.addEventListener('popstate', route);

  // Intercept same-origin /p/... links
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const url = new URL(a.href, location.origin);
    if (url.origin === location.origin && url.pathname.startsWith('/p/')) {
      e.preventDefault();
      navigate(url.pathname);
    }
  });

  btnBack.addEventListener('click', () => {
    if (history.length > 1) history.back();
    else navigate('/');
  });

  /* ── Feed ─────────────────────────────────── */
  async function loadFeed(reset = false) {
    if (feedLoading_) return;
    if (reset) {
      feedPage = 1;
      feedHasMore = true;
      feedList.innerHTML = '';
      feedLoadMore.hidden = true;
    }
    if (!feedHasMore) return;

    feedLoading_ = true;
    feedLoading.hidden = false;
    feedError.hidden = true;

    try {
      const res = await fetch(`${API_BASE}/posts?page=${feedPage}&per_page=15`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      // Support {data:[...]} envelope or plain array
      const posts   = Array.isArray(json) ? json : (json.data ?? []);
      const hasMore = Array.isArray(json)
        ? posts.length === 15
        : !!(json.next_page_url ?? (json.meta && json.meta.current_page < json.meta.last_page));

      posts.forEach(p => feedList.appendChild(buildCard(p)));
      feedPage++;
      feedHasMore = hasMore && posts.length > 0;
      feedLoadMore.hidden = !feedHasMore;
    } catch (err) {
      feedErrorMsg.textContent = 'Could not load posts. ' + err.message;
      feedError.hidden = false;
    } finally {
      feedLoading.hidden = true;
      feedLoading_ = false;
    }
  }

  btnLoadMore.addEventListener('click', () => loadFeed(false));

  /* ── Build card ───────────────────────────── */
  function buildCard(post) {
    const slug    = post.slug ?? post.id;
    const name    = esc(post.user?.name ?? post.author ?? 'BeeYarner');
    const uname   = post.user?.username ? '@' + esc(post.user.username) : '';
    const avatar  = post.user?.avatar_url ?? post.user?.profile_photo_url ?? '';
    const body    = esc(post.body ?? post.content ?? '');
    const time    = relativeTime(post.created_at);
    const likes   = post.likes_count   ?? post.likes   ?? 0;
    const comments= post.comments_count ?? post.comments ?? 0;
    const media   = post.media?.[0] ?? null;

    const card = document.createElement('article');
    card.className = 'by-card';
    card.setAttribute('role', 'link');
    card.setAttribute('tabindex', '0');
    card.dataset.slug = slug;

    card.innerHTML = `
      <div class="by-card__header">
        <img class="by-avatar" src="${esc(avatar)}" alt="${name}"
             onerror="this.src=''" />
        <div class="by-card__meta">
          <span class="by-card__name">${name}</span>
          ${uname ? `<span class="by-card__username">${uname}</span>` : ''}
        </div>
        <time class="by-card__time">${time}</time>
      </div>
      ${media ? renderCardMedia(media) : ''}
      ${body ? `<div class="by-card__body">${body}</div>` : ''}
      <div class="by-card__footer">
        <span><i class="bi bi-heart"></i>${likes}</span>
        <span><i class="bi bi-chat"></i>${comments}</span>
      </div>
    `;

    card.addEventListener('click', () => navigate('/p/' + encodeURIComponent(slug)));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') navigate('/p/' + encodeURIComponent(slug));
    });

    return card;
  }

  function renderCardMedia(media) {
    const url = esc(media.url ?? media.original_url ?? '');
    if (!url) return '';
    const type = (media.type ?? media.mime_type ?? '').toLowerCase();
    if (type.startsWith('video') || url.match(/\.(mp4|webm|mov)(\?|$)/i)) {
      return `<div class="by-card__media"><video src="${url}" muted playsinline preload="metadata"></video></div>`;
    }
    return `<div class="by-card__media"><img src="${url}" alt="post media" loading="lazy" /></div>`;
  }

  /* ── Post detail ──────────────────────────── */
  async function loadPost(slug) {
    postLoading.hidden = false;
    postArticle.hidden = true;
    postError.hidden   = true;
    appBanner.hidden   = true;

    try {
      const res = await fetch(`${API_BASE}/posts/${encodeURIComponent(slug)}`);
      if (!res.ok) throw new Error(res.status === 404 ? 'Post not found.' : `HTTP ${res.status}`);
      const json = await res.json();
      const post = json.data ?? json;

      renderPost(post, slug);
      updateMeta(post);
      showAppBanner(slug);
    } catch (err) {
      postErrorMsg.textContent = err.message || 'Post not found.';
      postError.hidden = false;
    } finally {
      postLoading.hidden = true;
    }
  }

  function renderPost(post, slug) {
    const name    = esc(post.user?.name ?? post.author ?? 'BeeYarner');
    const uname   = post.user?.username ? '@' + esc(post.user.username) : '';
    const avatar  = post.user?.avatar_url ?? post.user?.profile_photo_url ?? '';
    const body    = esc(post.body ?? post.content ?? '');
    const time    = formatDate(post.created_at);
    const likes   = post.likes_count    ?? post.likes    ?? 0;
    const comments= post.comments_count  ?? post.comments  ?? 0;

    document.getElementById('post-avatar').src = avatar;
    document.getElementById('post-avatar').alt = name;
    document.getElementById('post-author').textContent   = name;
    document.getElementById('post-username').textContent = uname;
    document.getElementById('post-time').textContent     = time;
    document.getElementById('post-time').setAttribute('datetime', post.created_at ?? '');
    document.getElementById('post-body').textContent     = post.body ?? post.content ?? '';
    document.getElementById('post-like-count').textContent    = likes;
    document.getElementById('post-comment-count').textContent = comments;

    // Media
    const mediaWrap = document.getElementById('post-media');
    mediaWrap.innerHTML = '';
    const mediaItems = post.media ?? [];
    mediaItems.forEach(m => {
      const url  = m.url ?? m.original_url ?? '';
      const type = (m.type ?? m.mime_type ?? '').toLowerCase();
      if (!url) return;
      if (type.startsWith('video') || url.match(/\.(mp4|webm|mov)(\?|$)/i)) {
        const v = document.createElement('video');
        v.src      = url;
        v.controls = true;
        v.playsinline = true;
        v.preload  = 'metadata';
        mediaWrap.appendChild(v);
      } else {
        const img = document.createElement('img');
        img.src     = url;
        img.alt     = 'post image';
        img.loading = 'lazy';
        mediaWrap.appendChild(img);
      }
    });

    // App deep link (Android App Links)
    const deepLink = `https://www.beeyarn.com/p/${encodeURIComponent(slug)}`;
    document.getElementById('post-app-link').href = deepLink;

    postArticle.hidden = false;
  }

  function showAppBanner(slug) {
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    if (isMobile) {
      appBannerLink.href = `https://www.beeyarn.com/p/${encodeURIComponent(slug)}`;
      appBanner.hidden = false;
    }
  }

  /* ── OG meta update ───────────────────────── */
  function updateMeta(post) {
    const title = (post.user?.name ?? 'BeeYarner') + ' on BeeYarn';
    const desc  = (post.body ?? post.content ?? '').slice(0, 200);
    const image = post.media?.[0]?.url ?? post.media?.[0]?.original_url ?? '';

    document.title = title;
    setMeta('property', 'og:title',       title);
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:url',         location.href);
    if (image) setMeta('property', 'og:image', image);
    setMeta('name', 'twitter:title',       title);
    setMeta('name', 'twitter:description', desc);
  }

  function setMeta(attr, val, content) {
    let el = document.querySelector(`meta[${attr}="${val}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, val);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  }

  /* ── Helpers ──────────────────────────────── */
  function esc(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(String(str)));
    return d.innerHTML;
  }

  function relativeTime(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60)   return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm';
    if (s < 86400)return Math.floor(s / 3600) + 'h';
    return Math.floor(s / 86400) + 'd';
  }

  function formatDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  /* ── Boot ─────────────────────────────────── */
  route();

  // Expose for inline onclick (retry buttons)
  return { loadFeed };
})();
