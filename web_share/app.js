/**
 * BeeYarn Web SPA
 * Vanilla JS, History API routing, fetch()-based data layer.
 */

'use strict';

/* ============================================================
   CONFIG
   ============================================================ */
const API_BASE  = 'https://api.beeyarn.com/api';
const PER_PAGE  = 10;
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.beeyarn.beeyarn';

/* ============================================================
   IN-MEMORY CACHE
   ============================================================ */
const Cache = {
  /** @type {Map<string, object>} slug → post */
  posts: new Map(),

  /** Current feed pagination state */
  feed: {
    page:    0,
    hasMore: true,
    loading: false,
  },

  addPosts(posts) {
    for (const post of posts) {
      if (post.slug) this.posts.set(post.slug, post);
    }
  },

  getBySlug(slug) {
    return this.posts.get(slug) ?? null;
  },

  resetFeed() {
    this.posts.clear();
    this.feed.page    = 0;
    this.feed.hasMore = true;
    this.feed.loading = false;
  },
};

/* ============================================================
   API
   ============================================================ */
const Api = {
  /**
   * Fetch a page of home posts.
   * @param {number} page
   * @returns {Promise<object[]>}
   */
  async fetchHomePosts(page = 1) {
    const url = `${API_BASE}/home?page=${page}&per_page=${PER_PAGE}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.success) throw new Error('API returned success: false');
    return Array.isArray(json.data) ? json.data : [];
  },
};

/* ============================================================
   UTILITIES
   ============================================================ */

/**
 * Format a date string as relative time ("just now", "5m", "2h", "3d", etc.)
 * @param {string} dateStr
 * @returns {string}
 */
function relativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const sec  = Math.floor(diff / 1000);
  if (sec < 30)          return 'just now';
  if (sec < 3600)        return `${Math.floor(sec / 60)}m`;
  if (sec < 86400)       return `${Math.floor(sec / 3600)}h`;
  if (sec < 86400 * 7)   return `${Math.floor(sec / 86400)}d`;
  if (sec < 86400 * 30)  return `${Math.floor(sec / (86400 * 7))}w`;
  if (sec < 86400 * 365) return `${Math.floor(sec / (86400 * 30))}mo`;
  return `${Math.floor(sec / (86400 * 365))}y`;
}

/**
 * Format large numbers compactly ("1.2k", "4.5M").
 * @param {number} n
 * @returns {string}
 */
function formatCount(n) {
  if (!n && n !== 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/**
 * Escape HTML to prevent XSS when inserting user content.
 * @param {string} str
 * @returns {string}
 */
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Detect Android mobile via user agent. */
function isAndroidMobile() {
  return /Android/i.test(navigator.userAgent);
}

/* ============================================================
   DOWNLOAD MODAL
   ============================================================ */
const Modal = {
  overlay:  document.getElementById('downloadModal'),
  closeBtn: document.getElementById('modalClose'),

  init() {
    this.closeBtn.addEventListener('click', () => this.hide());
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hide();
    });
  },

  show() {
    this.overlay.classList.add('visible');
    this.overlay.setAttribute('aria-hidden', 'false');
    this.closeBtn.focus();
  },

  hide() {
    this.overlay.classList.remove('visible');
    this.overlay.setAttribute('aria-hidden', 'true');
  },
};

/* ============================================================
   ROUTER (History API, no hash)
   ============================================================ */
const Router = {
  /** @type {Array<{pattern: RegExp, view: Function, keys: string[]}>} */
  routes: [],

  /** Register a route. Supports :param segments. */
  on(path, view) {
    const keys = [];
    const pattern = new RegExp(
      '^' +
      path.replace(/:([^/]+)/g, (_, key) => { keys.push(key); return '([^/]+)'; }) +
      '/?$'
    );
    this.routes.push({ pattern, view, keys });
  },

  /** Navigate programmatically (pushes history). */
  navigate(path, { replace = false } = {}) {
    if (replace) {
      history.replaceState(null, '', path);
    } else {
      history.pushState(null, '', path);
    }
    this._dispatch(path);
  },

  /** Dispatch to the matching view based on current path. */
  _dispatch(path) {
    for (const route of this.routes) {
      const match = path.match(route.pattern);
      if (match) {
        const params = {};
        route.keys.forEach((key, i) => { params[key] = decodeURIComponent(match[i + 1]); });
        route.view(params);
        return;
      }
    }
    // 404 fallback
    Views.notFound();
  },

  /** Start the router (listen to popstate + intercept <a data-link> clicks). */
  start() {
    window.addEventListener('popstate', () => this._dispatch(location.pathname));
    document.body.addEventListener('click', (e) => {
      const link = e.target.closest('[data-link]');
      if (!link) return;
      e.preventDefault();
      const href = link.getAttribute('href');
      if (href) this.navigate(href);
    });
    this._dispatch(location.pathname);
  },
};

/* ============================================================
   RENDER HELPERS
   ============================================================ */

/**
 * Build avatar element HTML. Falls back to initial letter.
 * @param {object} user
 * @param {string} sizeClass — 'avatar' or 'detail-avatar'
 * @returns {string}
 */
function avatarHtml(user, sizeClass = 'avatar') {
  const thumb = user?.profilePicture?.thumb;
  const name  = user?.name || '?';
  if (thumb) {
    return `<img class="${sizeClass}" src="${esc(thumb)}" alt="${esc(name)}" loading="lazy" />`;
  }
  const initial = name.charAt(0).toUpperCase();
  return `<div class="avatar-placeholder" aria-hidden="true">${esc(initial)}</div>`;
}

/**
 * Build verified badge HTML (empty string if not verified).
 * @param {boolean} isVerified
 * @returns {string}
 */
function verifiedBadgeHtml(isVerified) {
  return isVerified
    ? `<span class="verified-badge" title="Verified" aria-label="Verified">✓</span>`
    : '';
}

/**
 * Build topic pill HTML.
 * @param {string|object} topic
 * @returns {string}
 */
function topicHtml(topic) {
  if (!topic) return '';
  const label = typeof topic === 'string' ? topic : (topic.name || topic.title || '');
  if (!label) return '';
  return `<span class="topic-pill">${esc(label)}</span>`;
}

/**
 * Build the media preview for a feed card (first media item only).
 * @param {object[]} media
 * @returns {string}
 */
function cardMediaHtml(media) {
  if (!media || media.length === 0) return '';
  const first = media[0];
  const thumb = first.thumb || first.url;
  if (!thumb) return '';

  const countBadge = media.length > 1
    ? `<span class="media-count-badge">+${media.length - 1}</span>`
    : '';

  if (first.type === 'video') {
    return `
      <div class="post-media-wrap">
        <img src="${esc(thumb)}" alt="Video thumbnail" loading="lazy" />
        <div class="video-play-icon" aria-hidden="true">▶</div>
        ${countBadge}
      </div>`;
  }

  return `
    <div class="post-media-wrap">
      <img src="${esc(thumb)}" alt="Post image" loading="lazy" />
      ${countBadge}
    </div>`;
}

/**
 * Build full media list for post detail view.
 * @param {object[]} media
 * @returns {string}
 */
function detailMediaHtml(media) {
  if (!media || media.length === 0) return '';
  return `<div class="detail-media-list">${media.map(m => {
    if (m.type === 'video') {
      return `
        <div class="detail-media-item">
          <video src="${esc(m.url)}" controls playsinline preload="metadata"
                 poster="${esc(m.thumb || '')}"></video>
        </div>`;
    }
    const src = m.url || m.thumb;
    return `
      <div class="detail-media-item">
        <img src="${esc(src)}" alt="Post media" loading="lazy" />
      </div>`;
  }).join('')}</div>`;
}

/**
 * Build a single post feed card HTML string.
 * @param {object} post
 * @returns {string}
 */
function postCardHtml(post) {
  const user     = post.user || {};
  const media    = post.media || [];
  const sponsoredBadge = post.isAd
    ? `<span class="post-sponsored-badge">Sponsored</span>`
    : '';

  return `
    <article class="post-card" data-slug="${esc(post.slug)}" role="button" tabindex="0"
             aria-label="Post by ${esc(user.name)}">
      <div class="post-card-header">
        ${avatarHtml(user)}
        <div class="post-author-info">
          <div class="post-author-name">
            ${esc(user.name || 'Unknown')}
            ${verifiedBadgeHtml(user.isVerified)}
          </div>
          <div class="post-author-meta">
            <span>@${esc(user.username || '')}</span>
            <span>·</span>
            <span>${relativeTime(post.createdAt)}</span>
          </div>
        </div>
        ${sponsoredBadge}
      </div>

      ${topicHtml(post.topic) ? `<div>${topicHtml(post.topic)}</div>` : ''}

      ${cardMediaHtml(media)}

      <div class="post-card-body">
        ${post.title ? `<h2 class="post-title">${esc(post.title)}</h2>` : ''}
        ${post.body  ? `<p class="post-text">${esc(post.body)}</p>` : ''}
      </div>

      <div class="post-metrics">
        <button class="metric-btn js-interaction" aria-label="Like">
          <span class="metric-icon">❤️</span>
          <span>${formatCount(post.likeCount)}</span>
        </button>
        <button class="metric-btn js-interaction" aria-label="Comment">
          <span class="metric-icon">💬</span>
          <span>${formatCount(post.commentCount)}</span>
        </button>
        <button class="metric-btn js-interaction" aria-label="Share">
          <span class="metric-icon">↗️</span>
          <span>${formatCount(post.shareCount)}</span>
        </button>
      </div>
    </article>`;
}

/**
 * Build N skeleton card HTML strings.
 * @param {number} count
 * @returns {string}
 */
function skeletonCardsHtml(count = 4) {
  return Array.from({ length: count }, () => `
    <div class="skeleton-card" aria-hidden="true">
      <div class="skeleton-header">
        <div class="skeleton skeleton-avatar"></div>
        <div class="skeleton-lines">
          <div class="skeleton skeleton-line long"></div>
          <div class="skeleton skeleton-line short"></div>
        </div>
      </div>
      <div class="skeleton skeleton-media"></div>
      <div class="skeleton-text-block">
        <div class="skeleton skeleton-line long"></div>
        <div class="skeleton skeleton-line long"></div>
        <div class="skeleton skeleton-line short"></div>
      </div>
    </div>`).join('');
}

/* ============================================================
   VIEWS
   ============================================================ */
const app = document.getElementById('app');

const Views = {
  /* ── FEED ─────────────────────────────────────────────── */
  feed() {
    // Render shell (restore scroll position tracking)
    app.innerHTML = `
      <div id="feedList"></div>
      <div class="load-sentinel" id="loadSentinel">
        <div class="spinner" id="feedSpinner" aria-label="Loading more posts"></div>
      </div>
      <div class="feed-end-msg" id="feedEnd" hidden>You're all caught up 🐝</div>
    `;

    const feedList    = document.getElementById('feedList');
    const sentinel    = document.getElementById('loadSentinel');
    const spinner     = document.getElementById('feedSpinner');
    const feedEnd     = document.getElementById('feedEnd');

    // If we already have cached posts, render them immediately
    if (Cache.posts.size > 0) {
      const cachedPosts = [...Cache.posts.values()];
      feedList.innerHTML = cachedPosts.map(postCardHtml).join('');
      if (!Cache.feed.hasMore) {
        sentinel.hidden = true;
        feedEnd.hidden  = false;
      }
    }

    // Wire up card clicks (event delegation)
    feedList.addEventListener('click', (e) => {
      // Interaction buttons — show modal, don't navigate
      if (e.target.closest('.js-interaction')) {
        e.stopPropagation();
        Modal.show();
        return;
      }
      const card = e.target.closest('.post-card');
      if (card && card.dataset.slug) {
        Router.navigate(`/p/${card.dataset.slug}`);
      }
    });

    // Keyboard accessibility for cards
    feedList.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const card = e.target.closest('.post-card');
        if (card && card.dataset.slug) {
          e.preventDefault();
          Router.navigate(`/p/${card.dataset.slug}`);
        }
      }
    });

    /** Load the next page of posts into the feed. */
    const loadNextPage = async () => {
      if (Cache.feed.loading || !Cache.feed.hasMore) return;
      Cache.feed.loading = true;
      spinner.hidden = false;

      // Show skeletons on first load
      if (Cache.feed.page === 0) {
        feedList.innerHTML = skeletonCardsHtml(4);
      }

      try {
        const nextPage = Cache.feed.page + 1;
        const posts    = await Api.fetchHomePosts(nextPage);

        // Remove skeletons on first load
        if (Cache.feed.page === 0) feedList.innerHTML = '';

        if (posts.length === 0) {
          Cache.feed.hasMore = false;
        } else {
          Cache.addPosts(posts);
          Cache.feed.page = nextPage;

          const fragment = document.createDocumentFragment();
          const temp     = document.createElement('div');
          temp.innerHTML = posts.map(postCardHtml).join('');
          while (temp.firstChild) fragment.appendChild(temp.firstChild);
          feedList.appendChild(fragment);

          if (posts.length < PER_PAGE) Cache.feed.hasMore = false;
        }

        if (!Cache.feed.hasMore) {
          sentinel.hidden = true;
          feedEnd.hidden  = false;
        }
      } catch (err) {
        console.error('Feed fetch error:', err);
        if (Cache.feed.page === 0) {
          feedList.innerHTML = `
            <div class="state-box">
              <div class="state-icon">😕</div>
              <div class="state-title">Something went wrong</div>
              <div class="state-sub">Could not load posts. Please check your connection.</div>
              <button class="btn btn-primary" id="retryBtn">Retry</button>
            </div>`;
          document.getElementById('retryBtn')?.addEventListener('click', () => {
            Cache.resetFeed();
            Views.feed();
          });
        }
        sentinel.hidden = true;
      } finally {
        Cache.feed.loading = false;
        spinner.hidden = true;
      }
    };

    // Infinite scroll via IntersectionObserver
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadNextPage();
    }, { rootMargin: '200px' });

    observer.observe(sentinel);

    // Initial load (only if no cache yet)
    if (Cache.posts.size === 0) {
      loadNextPage();
    }
  },

  /* ── POST DETAIL ───────────────────────────────────────── */
  async postDetail({ slug }) {
    // Render loading state immediately
    app.innerHTML = `
      <button class="detail-back-btn js-back" aria-label="Back to feed">← Back</button>
      <div id="detailContent">${skeletonCardsHtml(1)}</div>
    `;

    document.querySelector('.js-back').addEventListener('click', () => {
      // Go back in history if possible, else navigate to feed
      if (history.state !== null || document.referrer) {
        history.back();
      } else {
        Router.navigate('/');
      }
    });

    const detailContent = document.getElementById('detailContent');

    // Try to get post from cache first
    let post = Cache.getBySlug(slug);

    if (!post) {
      // Cold start: fetch page 1 and search for the post by slug
      try {
        const posts = await Api.fetchHomePosts(1);
        Cache.addPosts(posts);
        post = Cache.getBySlug(slug);
      } catch (err) {
        console.error('Detail fetch error:', err);
      }
    }

    if (!post) {
      // Post not found
      detailContent.innerHTML = `
        <div class="state-box">
          <div class="state-icon">🔍</div>
          <div class="state-title">Post not found</div>
          <div class="state-sub">This post may no longer be available.</div>
          <a href="${PLAY_STORE_URL}" target="_blank" rel="noopener noreferrer"
             class="btn btn-primary">Download BeeYarn</a>
        </div>`;
      return;
    }

    // Render full post detail
    const user  = post.user || {};
    const media = post.media || [];

    detailContent.innerHTML = `
      <div class="detail-card">
        <header class="detail-header">
          ${avatarHtml(user, 'detail-avatar')}
          <div>
            <div class="detail-author-name">
              ${esc(user.name || 'Unknown')}
              ${verifiedBadgeHtml(user.isVerified)}
            </div>
            <div class="detail-author-meta">
              <span>@${esc(user.username || '')}</span>
              <span>·</span>
              <span>${relativeTime(post.createdAt)}</span>
              ${post.isAd ? `<span>· <em>Sponsored</em></span>` : ''}
            </div>
          </div>
        </header>

        ${post.topic ? `<div class="detail-topic-wrap">${topicHtml(post.topic)}</div>` : ''}

        ${detailMediaHtml(media)}

        <div class="detail-body">
          ${post.title ? `<h1 class="detail-title">${esc(post.title)}</h1>` : ''}
          ${post.body  ? `<p class="detail-text">${esc(post.body)}</p>` : ''}
        </div>

        <div class="detail-view-count">
          👁 ${formatCount(post.viewCount)} views
        </div>

        <div class="detail-metrics">
          <button class="metric-btn js-interaction" aria-label="Like">
            <span class="metric-icon">❤️</span>
            <span>${formatCount(post.likeCount)}</span>
          </button>
          <button class="metric-btn js-interaction" aria-label="Comment">
            <span class="metric-icon">💬</span>
            <span>${formatCount(post.commentCount)}</span>
          </button>
          <button class="metric-btn js-interaction" aria-label="Share">
            <span class="metric-icon">↗️</span>
            <span>${formatCount(post.shareCount)}</span>
          </button>
        </div>
      </div>`;

    // Wire interaction buttons to modal
    detailContent.querySelectorAll('.js-interaction').forEach(btn => {
      btn.addEventListener('click', () => Modal.show());
    });

    // Android deep link: try to open the app; show modal if not opened after 1.5s
    if (isAndroidMobile()) {
      const deepLink = `beeyarn://p/${encodeURIComponent(slug)}`;

      // Attempt to open the native app
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = deepLink;
      document.body.appendChild(iframe);

      // Fallback after 1500ms if still on the page (app not installed / not opened)
      const fallbackTimer = setTimeout(() => {
        if (!document.hidden) {
          Modal.show();
        }
      }, 1500);

      // If the user comes back (app was opened and they switched back),
      // clear the timer to avoid a stale popup.
      document.addEventListener('visibilitychange', function onVisible() {
        if (document.hidden) {
          clearTimeout(fallbackTimer);
          document.removeEventListener('visibilitychange', onVisible);
        }
      });
    }
  },

  /* ── 404 ───────────────────────────────────────────────── */
  notFound() {
    app.innerHTML = `
      <div class="state-box">
        <div class="state-icon">🐝</div>
        <div class="state-title">Page not found</div>
        <div class="state-sub">The page you're looking for doesn't exist.</div>
        <a href="/" class="btn btn-primary" data-link>Go to Feed</a>
      </div>`;
  },
};

/* ============================================================
   BOOTSTRAP
   ============================================================ */
function boot() {
  // Register routes
  Router.on('/',         () => Views.feed());
  Router.on('/p/:slug',  (params) => Views.postDetail(params));

  // Init modal
  Modal.init();

  // Start router (dispatches to current path immediately)
  Router.start();
}

// Run after DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
