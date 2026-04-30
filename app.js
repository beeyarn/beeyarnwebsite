/* BeeYarn Feed SPA
   /         → feed   GET /api/home
   /p/:slug  → post   GET /api/post/:slug
*/
const App = (() => {
  'use strict';

  const API_BASE = 'https://api.beeyarn.com/api';

  // DOM
  const viewFeed    = document.getElementById('view-feed');
  const viewPost    = document.getElementById('view-post');
  const feedLoading = document.getElementById('feed-loading');
  const feedError   = document.getElementById('feed-error');
  const feedList    = document.getElementById('feed-list');
  const feedMore    = document.getElementById('feed-load-more');
  const btnMore     = document.getElementById('btn-load-more');
  const postLoading = document.getElementById('post-loading');
  const postError   = document.getElementById('post-error');
  const postErrorMsg= document.getElementById('post-error-msg');
  const postArticle = document.getElementById('post-article');
  const btnBack     = document.getElementById('btn-back');

  // State
  let page     = 1;
  let busy     = false;
  let hasMore  = true;
  const cache  = {};

  function show(el)  { el.style.display = ''; }
  function hide(el)  { el.style.display = 'none'; }

  // ── Router ──────────────────────────────────
  function route() {
    const m = location.pathname.match(/^\/p\/([^/]+)\/?$/);
    if (m) {
      hide(viewFeed); show(viewPost);
      loadPost(decodeURIComponent(m[1]));
    } else {
      show(viewFeed); hide(viewPost);
      if (feedList.children.length === 0) loadFeed(true);
    }
    window.scrollTo(0, 0);
  }

  function navigate(path) {
    history.pushState({}, '', path);
    route();
  }

  window.addEventListener('popstate', route);

  btnBack.addEventListener('click', () => {
    if (history.length > 1) history.back();
    else navigate('/');
  });

  btnMore.addEventListener('click', () => loadFeed(false));

  // ── Feed ────────────────────────────────────
  async function loadFeed(reset) {
    if (busy) return;
    if (reset) {
      page = 1; hasMore = true;
      feedList.innerHTML = '';
      hide(feedMore);
    }
    if (!hasMore) return;

    busy = true;
    show(feedLoading);
    hide(feedError);

    try {
      const res  = await fetch(`${API_BASE}/home?page=${page}`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();

      const posts = json.data ?? [];
      const meta  = json.meta ?? {};

      posts.forEach(p => {
        cache[p.slug] = p;
        feedList.appendChild(buildCard(p));
      });

      page++;
      hasMore = (meta.current_page ?? 1) < (meta.last_page ?? 1);
      if (hasMore) show(feedMore); else hide(feedMore);
    } catch (e) {
      document.getElementById('feed-error-msg').textContent = 'Could not load posts. ' + e.message;
      show(feedError);
    } finally {
      hide(feedLoading);
      busy = false;
    }
  }

  // ── Build card ───────────────────────────────
  function buildCard(p) {
    const avatar  = p.user?.profile_picture?.thumb || p.user?.profile_picture?.url || '';
    const name    = p.user?.name    || 'BeeYarner';
    const uname   = p.user?.username ? '@' + p.user.username : '';
    const time    = ago(p.created_at);
    const likes   = fmt(p.likes_count    ?? 0);
    const comments= fmt(p.comments_count ?? 0);
    const files   = p.post_media?.files ?? [];
    const first   = files[0] ?? null;

    let thumb = '';
    if (first) {
      const src = first.thumb || first.url || '';
      const isVideo = first.type === 'video';
      thumb = `
        <div class="card-thumb">
          <img src="${xa(src)}" alt="" loading="lazy" onerror="this.parentElement.style.display='none'" />
          ${isVideo ? '<div class="card-thumb-play"><i class="bi bi-play-circle-fill"></i></div>' : ''}
        </div>`;
    }

    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `
      <div class="card-left">
        <img class="card-avatar" src="${xa(avatar)}" alt="${xa(name)}"
             onerror="this.style.visibility='hidden'" />
      </div>
      <div class="card-body">
        <div class="card-meta">
          <span class="card-name">${xh(name)}</span>
          <span class="card-dot">·</span>
          <span class="card-handle">${xh(uname)}</span>
          <span class="card-dot">·</span>
          <span class="card-time">${time}</span>
          ${p.topic ? `<span class="card-dot">·</span><span class="card-topic">${xh(p.topic)}</span>` : ''}
        </div>
        ${p.title ? `<div class="card-title">${xh(p.title)}</div>` : ''}
        ${p.body  ? `<div class="card-excerpt">${xh(p.body)}</div>` : ''}
        ${thumb}
        <div class="card-actions">
          <span class="card-stat"><i class="bi bi-heart"></i> ${likes}</span>
          <span class="card-stat"><i class="bi bi-chat"></i> ${comments}</span>
          <span class="card-stat"><i class="bi bi-eye"></i> ${fmt(p.number_of_views ?? 0)}</span>
        </div>
      </div>
    `;
    el.addEventListener('click', () => navigate('/p/' + encodeURIComponent(p.slug)));
    return el;
  }

  // ── Post detail ──────────────────────────────
  async function loadPost(slug) {
    show(postLoading);
    hide(postError);
    hide(postArticle);

    try {
      let p = cache[slug];
      if (!p) {
        const res = await fetch(`${API_BASE}/post/${encodeURIComponent(slug)}`);
        if (!res.ok) throw new Error(res.status === 404 ? 'Post not found.' : 'HTTP ' + res.status);
        const json = await res.json();
        p = json.data ?? json;
        cache[slug] = p;
      }
      renderPost(p);
      setMetas(p);
    } catch (e) {
      postErrorMsg.textContent = e.message || 'Post not found.';
      show(postError);
    } finally {
      hide(postLoading);
    }
  }

  function renderPost(p) {
    const avatar  = p.user?.profile_picture?.url || p.user?.profile_picture?.thumb || '';
    const name    = p.user?.name    || 'BeeYarner';
    const uname   = p.user?.username ? '@' + p.user.username : '';
    const verified= p.user?.is_verified || false;

    const av = document.getElementById('post-avatar');
    av.src = avatar; av.alt = name;
    av.onerror = () => { av.style.visibility = 'hidden'; };

    document.getElementById('post-name').textContent    = name;
    document.getElementById('post-username').textContent= uname;
    document.getElementById('post-verified').style.display = verified ? '' : 'none';

    const topicEl = document.getElementById('post-topic-tag');
    const topicWrap = document.getElementById('post-topic-wrap');
    if (p.topic) {
      topicEl.textContent = p.topic;
      show(topicWrap); show(topicEl);
    } else {
      hide(topicWrap); hide(topicEl);
    }

    const timeEl = document.getElementById('post-time');
    timeEl.textContent = fullDate(p.created_at);
    timeEl.setAttribute('datetime', p.created_at || '');

    document.getElementById('post-title').textContent = p.title || '';
    document.getElementById('post-body').textContent  = p.body  || '';

    document.getElementById('post-likes').textContent    = fmt(p.likes_count    ?? 0);
    document.getElementById('post-comments').textContent = fmt(p.comments_count ?? 0);
    document.getElementById('post-shares').textContent   = fmt(p.shares_count   ?? 0);
    document.getElementById('post-views').textContent    = fmt(p.number_of_views ?? 0);

    // Media
    const mediaWrap = document.getElementById('post-media');
    mediaWrap.innerHTML = '';
    (p.post_media?.files ?? []).forEach(f => {
      const url   = f.url   || '';
      const thumb = f.thumb || '';
      const wrap  = document.createElement('div');
      wrap.className = 'media-item';

      if (f.type === 'video') {
        if (thumb) {
          wrap.className += ' thumb-play';
          wrap.innerHTML = `
            <img src="${xa(thumb)}" alt="video" />
            <div class="thumb-play-icon"><i class="bi bi-play-circle-fill"></i></div>`;
          wrap.addEventListener('click', () => {
            const v = document.createElement('video');
            v.src = url; v.controls = true; v.autoplay = true; v.playsinline = true;
            wrap.className = 'media-item';
            wrap.innerHTML = ''; wrap.appendChild(v);
          });
        } else {
          const v = document.createElement('video');
          v.src = url; v.controls = true; v.playsinline = true; v.preload = 'metadata';
          wrap.appendChild(v);
        }
      } else {
        const img = document.createElement('img');
        img.src = url; img.alt = 'image'; img.loading = 'lazy';
        wrap.appendChild(img);
      }
      mediaWrap.appendChild(wrap);
    });

    const shareUrl = p.share_url || `https://www.beeyarn.com/p/${encodeURIComponent(p.slug)}`;
    document.getElementById('post-app-link').href = shareUrl;

    document.getElementById('btn-share').onclick = () => {
      if (navigator.share) navigator.share({ title: p.title, url: shareUrl }).catch(() => {});
      else if (navigator.clipboard) navigator.clipboard.writeText(shareUrl).then(() => alert('Link copied!'));
    };

    show(postArticle);
  }

  // ── OG meta ──────────────────────────────────
  function setMetas(p) {
    const title = (p.title || 'Post') + ' — BeeYarn';
    const desc  = (p.body || '').slice(0, 200) || 'View on BeeYarn';
    const img   = p.post_media?.files?.[0]?.thumb || p.post_media?.files?.[0]?.url || '';
    document.title = title;
    meta('og:title', title); meta('og:description', desc); meta('og:url', location.href);
    if (img) meta('og:image', img);
    meta('twitter:title', title); meta('twitter:description', desc);
  }

  function meta(name, val) {
    const attr = name.startsWith('og:') ? 'property' : 'name';
    let el = document.querySelector(`meta[${attr}="${name}"]`);
    if (!el) { el = document.createElement('meta'); el.setAttribute(attr, name); document.head.appendChild(el); }
    el.setAttribute('content', val);
  }

  // ── Helpers ───────────────────────────────────
  function xh(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function xa(s) { return xh(s); }

  function fmt(n) {
    if (n >= 1e6) return (n/1e6).toFixed(1).replace(/\.0$/,'') + 'M';
    if (n >= 1e3) return (n/1e3).toFixed(1).replace(/\.0$/,'') + 'K';
    return String(n);
  }

  function ago(iso) {
    if (!iso) return '';
    const s = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (s < 60)    return 'just now';
    if (s < 3600)  return Math.floor(s/60)   + 'm';
    if (s < 86400) return Math.floor(s/3600)  + 'h';
    return Math.floor(s/86400) + 'd';
  }

  function fullDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
  }

  // ── Boot ──────────────────────────────────────
  route();
  return { loadFeed };
})();
