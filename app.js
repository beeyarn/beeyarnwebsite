/* =============================================
   BeeYarn Feed SPA — app.js
   Routes: /        → feed  (GET /api/home)
           /p/:slug → post  (GET /api/post/:slug)
   ============================================= */

const App = (() => {
  'use strict';

  const API_BASE = 'https://api.beeyarn.com/api';

  /* ── DOM refs ──────────────────────────────── */
  const views       = { feed: document.getElementById('view-feed'), post: document.getElementById('view-post') };
  const feedLoading = document.getElementById('feed-loading');
  const feedError   = document.getElementById('feed-error');
  const feedErrorMsg= document.getElementById('feed-error-msg');
  const feedList    = document.getElementById('feed-list');
  const feedLoadMore= document.getElementById('feed-load-more');
  const btnLoadMore = document.getElementById('btn-load-more');
  const postLoading = document.getElementById('post-loading');
  const postArticle = document.getElementById('post-article');
  const postError   = document.getElementById('post-error');
  const postErrorMsg= document.getElementById('post-error-msg');
  const btnBack     = document.getElementById('btn-back');

  /* ── State ─────────────────────────────────── */
  let feedPage     = 1;
  let feedBusy     = false;
  let feedHasMore  = true;
  // Cache posts loaded from feed so post detail can reuse the data
  const postCache  = {};

  /* ── Router ────────────────────────────────── */
  function route() {
    const path      = location.pathname;
    const postMatch = path.match(/^\/p\/([^/]+)\/?$/);

    if (postMatch) {
      showView('post');
      loadPost(decodeURIComponent(postMatch[1]));
    } else {
      showView('feed');
      if (feedTbody.children.length === 0) loadFeed(true);
    }
  }

  function showView(name) {
    Object.entries(views).forEach(([k, el]) => { el.hidden = (k !== name); });
    window.scrollTo(0, 0);
  }

  /* ── Navigation ────────────────────────────── */
  function navigate(path) {
    history.pushState({}, '', path);
    route();
  }

  window.addEventListener('popstate', route);

  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    try {
      const url = new URL(a.href, location.origin);
      if (url.origin === location.origin && url.pathname.startsWith('/p/')) {
        e.preventDefault();
        navigate(url.pathname);
      }
    } catch (_) {}
  });

  btnBack.addEventListener('click', () => {
    if (history.length > 1) history.back();
    else navigate('/');
  });

  /* ── Feed ──────────────────────────────────── */
  async function loadFeed(reset = false) {
    if (feedBusy) return;
    if (reset) {
      feedPage = 1;
      feedHasMore = true;
      feedList.innerHTML = '';
      feedLoadMore.hidden = true;
    }
    if (!feedHasMore) return;

    feedBusy = true;
    feedLoading.hidden = false;
    feedError.hidden   = true;

    try {
      const res  = await fetch(`${API_BASE}/home?page=${feedPage}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      const posts   = json.data ?? [];
      const meta    = json.meta ?? {};
      const hasMore = meta.current_page < meta.last_page;

      posts.forEach(p => {
        postCache[p.slug] = p;
        feedList.appendChild(buildRow(p));
      });

      feedPage++;
      feedHasMore = hasMore;
      feedLoadMore.hidden = !feedHasMore;
    } catch (err) {
      feedErrorMsg.textContent = 'Could not load posts. ' + err.message;
      feedError.hidden = false;
    } finally {
      feedLoading.hidden = true;
      feedBusy = false;
    }
  }

  btnLoadMore.addEventListener('click', () => loadFeed(false));

  /* ── Build feed card ───────────────────────── */
  function buildRow(p) {
    const slug      = p.slug;
    const title     = p.title || '(untitled)';
    const topic     = p.topic || '';
    const avatar    = p.user?.profile_picture?.thumb || p.user?.profile_picture?.url || '';
    const name      = p.user?.name || 'BeeYarner';
    const username  = p.user?.username ? '@' + p.user.username : '';
    const time      = relativeTime(p.created_at);
    const views_    = fmt(p.number_of_views ?? 0);
    const likes     = fmt(p.likes_count ?? 0);
    const comments  = fmt(p.comments_count ?? 0);
    const files     = p.post_media?.files ?? [];
    const firstFile = files[0] ?? null;

    // media preview (thumbnail or image)
    let mediaHtml = '';
    if (firstFile) {
      const thumb = firstFile.thumb || firstFile.url || '';
      if (firstFile.type === 'video') {
        mediaHtml = `
          <div class="by-card__media-thumb">
            <img src="${escAttr(thumb)}" alt="video" loading="lazy" onerror="this.parentElement.style.display='none'" />
            <div class="by-video-overlay"><i class="bi bi-play-circle-fill"></i></div>
          </div>`;
      } else if (thumb) {
        mediaHtml = `
          <div class="by-card__media-thumb">
            <img src="${escAttr(thumb)}" alt="media" loading="lazy" onerror="this.parentElement.style.display='none'" />
          </div>`;
      }
    }

    const card = document.createElement('article');
    card.className = 'by-card';
    card.dataset.slug = slug;

    card.innerHTML = `
      <div class="by-card__left">
        <img class="by-avatar by-avatar--sm" src="${escAttr(avatar)}" alt="${escAttr(name)}"
             onerror="this.style.visibility='hidden'" />
      </div>
      <div class="by-card__right">
        <div class="by-card__header">
          <span class="by-card__name">${escHtml(name)}</span>
          <span class="by-card__dot">·</span>
          <span class="by-card__handle">${escHtml(username)}</span>
          <span class="by-card__dot">·</span>
          <span class="by-card__time">${time}</span>
          ${topic ? `<span class="by-card__topic"><span class="by-topic-chip">${escHtml(topic)}</span></span>` : ''}
        </div>
        ${title ? `<p class="by-card__title">${escHtml(title)}</p>` : ''}
        ${p.body ? `<p class="by-card__body">${escHtml(p.body)}</p>` : ''}
        ${mediaHtml}
        <div class="by-card__footer">
          <span class="by-card__stat"><i class="bi bi-heart"></i>${likes}</span>
          <span class="by-card__stat"><i class="bi bi-chat"></i>${comments}</span>
          <span class="by-card__stat"><i class="bi bi-eye"></i>${views_}</span>
        </div>
      </div>
    `;

    card.addEventListener('click', () => navigate('/p/' + encodeURIComponent(slug)));
    return card;
  }

  /* ── Post detail ───────────────────────────── */
  async function loadPost(slug) {
    postLoading.hidden = false;
    postArticle.hidden = true;
    postError.hidden   = true;

    try {
      // Try cache first (data already fetched from feed), then fetch
      let post = postCache[slug] ?? null;
      if (!post) {
        const res = await fetch(`${API_BASE}/post/${encodeURIComponent(slug)}`);
        if (!res.ok) throw new Error(res.status === 404 ? 'Post not found.' : `HTTP ${res.status}`);
        const json = await res.json();
        post = json.data ?? json;
        postCache[slug] = post;
      }
      renderPost(post);
      updateMeta(post);
    } catch (err) {
      postErrorMsg.textContent = err.message || 'Post not found.';
      postError.hidden = false;
    } finally {
      postLoading.hidden = true;
    }
  }

  /* ── Render post detail ────────────────────── */
  function renderPost(p) {
    const name     = p.user?.name || 'BeeYarner';
    const username = p.user?.username || '';
    const avatar   = p.user?.profile_picture?.url || p.user?.profile_picture?.thumb || '';
    const verified = p.user?.is_verified || false;

    document.getElementById('post-title').textContent    = p.title || '';
    document.getElementById('post-topic-tag').textContent= p.topic || '';
    document.getElementById('post-topic-tag').hidden      = !p.topic;
    document.getElementById('post-name').textContent      = name;
    document.getElementById('post-username').textContent  = username ? '@' + username : '';
    document.getElementById('post-verified').hidden        = !verified;
    document.getElementById('post-time').textContent       = formatDate(p.created_at);
    document.getElementById('post-time').setAttribute('datetime', p.created_at || '');
    document.getElementById('post-body').textContent       = p.body || '';
    document.getElementById('post-views').textContent      = p.number_of_views ?? 0;
    document.getElementById('post-likes').textContent      = p.likes_count ?? 0;
    document.getElementById('post-comments').textContent   = p.comments_count ?? 0;
    document.getElementById('post-shares').textContent     = p.shares_count ?? 0;

    const avatarEl = document.getElementById('post-avatar');
    avatarEl.src = avatar;
    avatarEl.alt = name;
    avatarEl.onerror = () => { avatarEl.style.visibility = 'hidden'; };

    // Media
    const mediaWrap = document.getElementById('post-media');
    mediaWrap.innerHTML = '';
    const files = p.post_media?.files ?? [];
    files.forEach(f => mediaWrap.appendChild(buildMediaItem(f)));

    // App link = share_url or construct it
    const shareUrl = p.share_url || `https://www.beeyarn.com/p/${encodeURIComponent(p.slug)}`;
    document.getElementById('post-app-link').href = shareUrl;

    // Share button
    const btnShare = document.getElementById('btn-share-post');
    btnShare.onclick = () => {
      if (navigator.share) {
        navigator.share({ title: p.title, url: shareUrl }).catch(() => {});
      } else {
        navigator.clipboard?.writeText(shareUrl).then(() => alert('Link copied!')).catch(() => {});
      }
    };

    postArticle.hidden = false;
  }

  /* ── Media item ────────────────────────────── */
  function buildMediaItem(f) {
    const wrap = document.createElement('div');
    wrap.className = 'by-media-item';

    const url   = f.url   || '';
    const thumb = f.thumb || '';
    const type  = (f.type || '').toLowerCase();

    if (type === 'video') {
      // Show thumbnail with play button; click replaces with <video>
      if (thumb) {
        wrap.classList.add('by-thumb-wrap');
        wrap.innerHTML = `
          <img src="${escAttr(thumb)}" alt="video thumbnail" />
          <div class="by-play-btn"><i class="bi bi-play-circle-fill"></i></div>
        `;
        wrap.addEventListener('click', () => {
          const v = document.createElement('video');
          v.src      = url;
          v.controls = true;
          v.autoplay = true;
          v.playsinline = true;
          wrap.innerHTML = '';
          wrap.classList.remove('by-thumb-wrap');
          wrap.appendChild(v);
        });
      } else {
        const v = document.createElement('video');
        v.src      = url;
        v.controls = true;
        v.playsinline = true;
        v.preload  = 'metadata';
        wrap.appendChild(v);
      }
    } else {
      const img = document.createElement('img');
      img.src     = url;
      img.alt     = 'post image';
      img.loading = 'lazy';
      wrap.appendChild(img);
    }

    return wrap;
  }

  /* ── OG meta ───────────────────────────────── */
  function updateMeta(p) {
    const title = `${p.title || 'Post'} — BeeYarn`;
    const desc  = (p.body || '').slice(0, 200) || 'View this post on BeeYarn.';
    const image = p.post_media?.files?.[0]?.thumb
               || p.post_media?.files?.[0]?.url
               || p.user?.profile_picture?.url
               || '';

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
    if (!el) { el = document.createElement('meta'); el.setAttribute(attr, val); document.head.appendChild(el); }
    el.setAttribute('content', content);
  }

  /* ── Helpers ───────────────────────────────── */
  function fmt(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1000)    return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
  }

  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function escAttr(str) { return escHtml(str); }

  function relativeTime(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60)    return 'just now';
    if (s < 3600)  return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  }

  function formatDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  /* ── Boot ──────────────────────────────────── */
  route();

  return { loadFeed };
})();
