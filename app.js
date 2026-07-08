/* BeeYarn Feed SPA
   /                  → feed     GET /api/home
   /p/:slug           → post     GET /api/post/:slug
   /profile/:username → profile  GET /api/profile/:username
*/
const App = (() => {
  'use strict';

  const API_BASE = 'https://api.beeyarn.com/api';

  // Auth Modal
  const authOverlay = document.getElementById('auth-modal-overlay');
  window.AuthModal = {
    show: function() { authOverlay.classList.remove('hidden'); document.body.style.overflow = 'hidden'; },
    hide: function() { authOverlay.classList.add('hidden'); document.body.style.overflow = ''; }
  };
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape') AuthModal.hide(); });

  // Media Lightbox (fullscreen image/video viewer)
  const lightboxOverlay = document.getElementById('media-lightbox');
  const lightboxContent = document.getElementById('media-lightbox-content');
  window.MediaLightbox = {
    show: function(type, url) {
      lightboxContent.innerHTML = type === 'video'
        ? '<video src="' + xa(url) + '" controls autoplay playsinline></video>'
        : '<img src="' + xa(url) + '" alt="" />';
      lightboxOverlay.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    },
    hide: function() {
      lightboxOverlay.classList.add('hidden');
      lightboxContent.innerHTML = '';
      document.body.style.overflow = '';
    }
  };
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape') MediaLightbox.hide(); });

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

  const viewProfile     = document.getElementById('view-profile');
  const profileLoading  = document.getElementById('profile-loading');
  const profileError    = document.getElementById('profile-error');
  const profileErrorMsg = document.getElementById('profile-error-msg');
  const profileArticle  = document.getElementById('profile-article');
  const btnBackProfile  = document.getElementById('btn-back-profile');

  // State
  let page         = 1;
  let busy         = false;
  let hasMore      = true;
  let allPosts     = [];   // master list of every fetched post
  let activeTab    = 'home';
  let searchQ      = '';
  let savedScrollY = 0;
  const cache      = {};
  const profileCache = {};

  const searchInput       = document.getElementById('search-input');
  const mobileSearchInput = document.getElementById('mobile-search-input');
  const searchBar         = document.getElementById('search-results-bar');
  const searchLabel       = document.getElementById('search-query-label');
  const tabHome       = document.getElementById('tab-home');
  const tabHot        = document.getElementById('tab-hot');
  const tabNew        = document.getElementById('tab-new');

  // Hide/show using display property — flex for visible, none for hidden
  function show(el, flex) { el.style.display = flex ? 'flex' : 'block'; }
  function hide(el)       { el.style.display = 'none'; }

  // ── Router ─────────────────────────────────────
  function route(restoreScroll) {
    const mPost    = location.pathname.match(/^\/p\/([^/]+)\/?$/);
    const mProfile = location.pathname.match(/^\/profile\/([^/]+)\/?$/);
    if (mPost) {
      savedScrollY = window.scrollY;
      show(viewPost); hide(viewFeed); hide(viewProfile);
      loadPost(decodeURIComponent(mPost[1]));
      window.scrollTo(0, 0);
    } else if (mProfile) {
      savedScrollY = window.scrollY;
      show(viewProfile); hide(viewFeed); hide(viewPost);
      loadProfile(decodeURIComponent(mProfile[1]));
      window.scrollTo(0, 0);
    } else {
      show(viewFeed); hide(viewPost); hide(viewProfile);
      if (feedList.children.length === 0) {
        loadFeed(true);
        window.scrollTo(0, 0);
      } else if (restoreScroll) {
        window.scrollTo(0, savedScrollY);
      } else {
        window.scrollTo(0, 0);
      }
    }
  }

  function navigate(path) {
    history.pushState({}, '', path);
    route(false);
  }

  window.addEventListener('popstate', function() { route(true); });
  btnMore.addEventListener('click', () => loadFeed(false));
  btnBack.addEventListener('click', () => {
    if (history.length > 1) history.back();
    else navigate('/');
  });
  btnBackProfile.addEventListener('click', () => {
    if (history.length > 1) history.back();
    else navigate('/');
  });

  // ── Search ─────────────────────────────────────
  var searchTimer;

  function doSearch(q) {
    searchQ = q.toLowerCase();
    searchLabel.textContent = q;
    show(searchBar);
    renderFiltered();
  }

  function onSearchInput(inputEl) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function() {
      var q = inputEl.value.trim();
      if (q) {
        doSearch(q);
      } else {
        clearSearch();
      }
    }, 350);
  }

  searchInput.addEventListener('input', function() { onSearchInput(searchInput); });
  if (mobileSearchInput) {
    mobileSearchInput.addEventListener('input', function() { onSearchInput(mobileSearchInput); });
  }

  function clearSearch() {
    searchQ = '';
    searchInput.value = '';
    if (mobileSearchInput) mobileSearchInput.value = '';
    hide(searchBar);
    renderFiltered();
  }

  // Mobile search panel toggle
  window.MobileSearch = {
    toggle: function() {
      var bar = document.getElementById('mobile-search-bar');
      if (bar.style.display === 'none') {
        bar.style.display = 'block';
        if (mobileSearchInput) mobileSearchInput.focus();
      } else {
        this.close();
      }
    },
    close: function() {
      var bar = document.getElementById('mobile-search-bar');
      bar.style.display = 'none';
      clearSearch();
    }
  };

  // ── Tabs ────────────────────────────────────────
  function setTab(tab) {
    activeTab = tab;
    [tabHome, tabHot, tabNew].forEach(function(el) {
      el.className = '';
      el.setAttribute('aria-selected', 'false');
    });
    var active = tab === 'home' ? tabHome : tab === 'hot' ? tabHot : tabNew;
    active.className = 'active';
    active.setAttribute('aria-selected', 'true');
    renderFiltered();
  }

  // ── Render filtered/sorted list ─────────────────
  function renderFiltered() {
    var posts = allPosts.slice();

    // Filter by search
    if (searchQ) {
      posts = posts.filter(function(p) {
        var title = (p.title || '').toLowerCase();
        var body  = (p.body  || '').toLowerCase();
        var name  = ((p.user && p.user.name)     || '').toLowerCase();
        var uname = ((p.user && p.user.username)  || '').toLowerCase();
        return title.indexOf(searchQ) !== -1
            || body.indexOf(searchQ)  !== -1
            || name.indexOf(searchQ)  !== -1
            || uname.indexOf(searchQ) !== -1;
      });
    }

    // Sort by tab
    if (activeTab === 'hot') {
      posts.sort(function(a, b) {
        var scoreB = (b.likes_count || 0) + (b.number_of_views || 0) * 0.5;
        var scoreA = (a.likes_count || 0) + (a.number_of_views || 0) * 0.5;
        return scoreB - scoreA;
      });
    } else if (activeTab === 'new') {
      posts.sort(function(a, b) {
        return new Date(b.created_at.replace(' ','T')) - new Date(a.created_at.replace(' ','T'));
      });
    }

    feedList.innerHTML = '';

    if (posts.length === 0) {
      feedList.innerHTML = '<div class="no-results"><i class="bi bi-search"></i><p>No posts found'
        + (searchQ ? ' for "' + xh(searchInput.value.trim()) + '"' : '') + '</p></div>';
      return;
    }

    posts.forEach(function(p) { feedList.appendChild(buildCard(p)); });
  }

  // ── Feed ───────────────────────────────────────
  async function loadFeed(reset) {
    if (busy) return;
    if (reset) {
      page = 1; hasMore = true; allPosts = [];
      feedList.innerHTML = '';
      hide(feedMore);
    }
    if (!hasMore) return;

    busy = true;
    show(feedLoading, true);
    hide(feedError);

    try {
      const res  = await fetch(`${API_BASE}/home?page=${page}`);
      if (!res.ok) throw new Error('Server error: ' + res.status);

      const json = await res.json();
      const posts = Array.isArray(json.data) ? json.data : [];
      const meta  = json.meta || {};

      posts.forEach(function(p) {
        if (!p.is_ad && p.slug) cache[p.slug] = p;
        if (p.original_post && p.original_post.slug) cache[p.original_post.slug] = p.original_post;
        allPosts.push(p);
      });
      renderFiltered();

      page++;
      hasMore = (meta.current_page || 1) < (meta.last_page || 1);
      if (hasMore) show(feedMore); else hide(feedMore);

    } catch (e) {
      document.getElementById('feed-error-msg').textContent = 'Could not load posts. ' + e.message;
      show(feedError, true);
    }

    hide(feedLoading);
    busy = false;
  }

  // ── Build ad card ───────────────────────────────
  function buildAdCard(p) {
    const advertiser = p.advertiser || {};
    const avatar  = (advertiser.profile_picture && (advertiser.profile_picture.thumb || advertiser.profile_picture.url)) || '';
    const name    = advertiser.name     || 'Sponsored';
    const handle  = advertiser.username ? '@' + advertiser.username : '';
    const files   = (p.post_media && p.post_media.files) ? p.post_media.files : [];
    const first   = files[0] || null;
    const isVideo = first && first.type === 'video';
    const imgSrc  = first ? (first.thumb || first.url || '') : '';
    const fullSrc = first ? (first.url || first.thumb || '') : '';

    // Banner: full-width image if available, else gold accent strip
    const bannerHtml = imgSrc
      ? '<div class="ad-card__banner">'
        +   '<img src="' + xa(imgSrc) + '" alt="" loading="lazy" onerror="this.parentElement.className=\'ad-card__banner--empty\';this.remove()" />'
        +   (isVideo ? '<div class="card-thumb-play ad-card__play"><i class="bi bi-play-circle-fill"></i></div>' : '')
        +   '<span class="ad-card__sponsored"><i class="bi bi-megaphone-fill"></i> Sponsored</span>'
        + '</div>'
      : '<div class="ad-card__banner--empty"></div>';

    // Inline pill when no image banner
    const inlinePill = imgSrc ? ''
      : '<span class="ad-card__sponsored ad-card__sponsored--inline"><i class="bi bi-megaphone-fill"></i> Sponsored</span>';

    // CTA button — API returns a flat object: { type, label, url }
    let ctaHtml = '';
    if (p.cta && p.cta.url) {
      const isWhatsapp = p.cta.type === 'whatsapp';
      const cls   = isWhatsapp ? 'ad-card__cta-primary' : 'ad-card__cta-secondary';
      const icon  = isWhatsapp ? 'bi-whatsapp' : 'bi-box-arrow-up-right';
      const label = p.cta.label || (isWhatsapp ? 'Message on WhatsApp' : 'Visit Website');
      ctaHtml += '<a class="' + cls + '" href="' + xa(p.cta.url) + '" target="_blank" rel="noopener">'
        + '<i class="bi ' + icon + '"></i> ' + xh(label) + '</a>';
    }

    const el = document.createElement('div');
    el.className = 'ad-card';
    el.innerHTML =
      bannerHtml
      + '<div class="ad-card__header">'
      +   '<img class="ad-card__avatar" src="' + xa(avatar) + '" alt="' + xa(name) + '" onerror="this.style.visibility=\'hidden\'" />'
      +   '<div class="ad-card__advertiser">'
      +     '<div class="ad-card__name">' + xh(name) + '</div>'
      +     (handle ? '<div class="ad-card__handle">' + xh(handle) + '</div>' : '')
      +   '</div>'
      +   inlinePill
      + '</div>'
      + '<div class="ad-card__body">'
      +   (p.topic ? '<span class="ad-card__topic">' + xh(p.topic) + '</span>' : '')
      +   (p.title ? '<div class="ad-card__title">' + xh(p.title) + '</div>' : '')
      +   (p.body  ? '<div class="ad-card__text">'  + xh(p.body)  + '</div>' : '')
      + '</div>'
      + (ctaHtml ? '<div class="ad-card__cta">' + ctaHtml + '</div>' : '');

    const bannerEl = el.querySelector('.ad-card__banner');
    if (bannerEl && fullSrc) {
      bannerEl.style.cursor = 'pointer';
      bannerEl.addEventListener('click', function(e) {
        e.stopPropagation();
        MediaLightbox.show(isVideo ? 'video' : 'image', fullSrc);
      });
    }

    if (p.cta && p.cta.url) {
      el.classList.add('ad-card--clickable');
      el.addEventListener('click', function(e) {
        if (e.target.closest('a')) return; // let the CTA link/banner anchor handle its own click
        window.open(p.cta.url, '_blank', 'noopener');
      });
    }

    return el;
  }

  // ── Build quoted/original post box (for reposts) ─
  function quoteBoxHtml(op) {
    if (!op) return '';
    const qAvatar   = (op.user && op.user.profile_picture && (op.user.profile_picture.thumb || op.user.profile_picture.url)) || '';
    const qName     = (op.user && op.user.name) || 'BeeYarner';
    const qUsername = (op.user && op.user.username) ? '@' + op.user.username : '';
    const qTime     = ago(op.created_at);
    const qFiles    = (op.post_media && op.post_media.files) ? op.post_media.files : [];
    const qFirst    = qFiles[0] || null;

    let qThumbHtml = '';
    if (qFirst) {
      const qSrc = qFirst.thumb || qFirst.url || '';
      if (qSrc) {
        qThumbHtml = '<div class="quote-thumb">'
          + '<img src="' + xa(qSrc) + '" alt="" loading="lazy" onerror="this.parentElement.style.display=\'none\'" />'
          + (qFirst.type === 'video' ? '<div class="card-thumb-play"><i class="bi bi-play-circle-fill"></i></div>' : '')
          + '</div>';
      }
    }

    return '<div class="quote-box__meta">'
      +   '<img class="quote-box__avatar" src="' + xa(qAvatar) + '" alt="' + xa(qName) + '" onerror="this.style.visibility=\'hidden\'" />'
      +   '<span class="quote-box__name">' + xh(qName) + '</span>'
      +   (qUsername ? '<span class="quote-box__dot">·</span><span class="quote-box__handle">' + xh(qUsername) + '</span>' : '')
      +   (qTime ? '<span class="quote-box__dot">·</span><span class="quote-box__time">' + qTime + '</span>' : '')
      + '</div>'
      + (op.title ? '<div class="quote-box__title">' + xh(op.title) + '</div>' : '')
      + (op.body  ? '<div class="quote-box__text">'  + xh(op.body)  + '</div>' : '')
      + qThumbHtml;
  }

  // ── Build card ──────────────────────────────────
  function buildCard(p) {
    if (p.is_ad) return buildAdCard(p);
    const avatar   = (p.user && p.user.profile_picture && (p.user.profile_picture.thumb || p.user.profile_picture.url)) || '';
    const name     = (p.user && p.user.name) || 'BeeYarner';
    const username = (p.user && p.user.username) ? '@' + p.user.username : '';
    const time     = ago(p.created_at);
    const likes    = fmt(p.likes_count    || 0);
    const comments = fmt(p.comments_count || 0);
    const views    = fmt(p.number_of_views || 0);
    const files    = (p.post_media && p.post_media.files) ? p.post_media.files : [];
    const first    = files[0] || null;

    let thumbHtml = '';
    if (first) {
      const src     = first.thumb || first.url || '';
      const isVideo = first.type === 'video';
      if (src) {
        thumbHtml = '<div class="card-thumb">'
          + '<img src="' + xa(src) + '" alt="" loading="lazy" onerror="this.parentElement.style.display=\'none\'" />'
          + (isVideo ? '<div class="card-thumb-play"><i class="bi bi-play-circle-fill"></i></div>' : '')
          + '</div>';
      }
    }

    const isRepost   = !!(p.is_repost && p.original_post);
    const repostHtml = isRepost
      ? '<div class="repost-badge"><i class="bi bi-repeat"></i> ' + xh(name) + ' reposted</div>'
      : '';
    const quoteHtml = isRepost
      ? '<div class="quote-box">' + quoteBoxHtml(p.original_post) + '</div>'
      : '';

    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML =
      '<div class="card-left">'
      +   '<img class="card-avatar" src="' + xa(avatar) + '" alt="' + xa(name) + '" onerror="this.style.visibility=\'hidden\'" />'
      + '</div>'
      + '<div class="card-body">'
      +   repostHtml
      +   '<div class="card-meta">'
      +     '<span class="card-name">'   + xh(name)     + '</span>'
      +     '<span class="card-dot">·</span>'
      +     '<span class="card-handle">' + xh(username)  + '</span>'
      +     '<span class="card-dot">·</span>'
      +     '<span class="card-time">'   + time          + '</span>'
      +     (p.topic ? '<span class="card-dot">·</span><span class="card-topic">' + xh(p.topic) + '</span>' : '')
      +   '</div>'
      +   (p.title ? '<div class="card-title">' + xh(p.title) + '</div>' : '')
      +   (p.body  ? '<div class="card-excerpt">' + xh(p.body) + '</div>' : '')
      +   thumbHtml
      +   quoteHtml
      +   '<div class="card-actions">'
      +     '<button class="card-stat card-action-btn" onclick="event.stopPropagation();AuthModal.show()"><i class="bi bi-heart"></i> ' + likes    + '</button>'
      +     '<button class="card-stat card-action-btn" onclick="event.stopPropagation();AuthModal.show()"><i class="bi bi-chat"></i> '  + comments + '</button>'
      +     '<span class="card-stat"><i class="bi bi-eye"></i> '   + views    + '</span>'
      +   '</div>'
      + '</div>';

    if (isRepost && p.original_post.slug) {
      const quoteEl = el.querySelector('.quote-box');
      quoteEl.addEventListener('click', function(e) {
        e.stopPropagation();
        navigate('/p/' + encodeURIComponent(p.original_post.slug));
      });
    }

    el.addEventListener('click', () => navigate('/p/' + encodeURIComponent(p.slug)));
    return el;
  }

  // ── Post detail ─────────────────────────────────
  async function loadPost(slug) {
    show(postLoading, true);
    hide(postError);
    hide(postArticle);

    try {
      let p = cache[slug];

      if (!p) {
        const res = await fetch(`${API_BASE}/posts/${encodeURIComponent(slug)}`);
        if (!res.ok) throw new Error(res.status === 404 ? 'Post not found.' : 'Server error: ' + res.status);
        const json = await res.json();
        p = json.data || json;
        cache[slug] = p;
      }

      if (!p) throw new Error('Post not found.');
      if (p.original_post && p.original_post.slug) cache[p.original_post.slug] = p.original_post;

      renderPost(p);
      setMetas(p);
    } catch (e) {
      postErrorMsg.textContent = e.message || 'Post not found.';
      show(postError, true);
    }

    hide(postLoading);
  }

  // ── Render post ─────────────────────────────────
  function renderPost(p) {
    const user     = p.user || {};
    const pic      = user.profile_picture || {};
    const avatar   = pic.url || pic.thumb || '';
    const name     = user.name     || 'BeeYarner';
    const username = user.username ? '@' + user.username : '';
    const verified = user.is_verified || false;

    const isRepost     = !!(p.is_repost && p.original_post);
    const repostBadge  = document.getElementById('post-repost-badge');
    const quoteWrap     = document.getElementById('post-quote');
    if (isRepost) {
      document.getElementById('post-repost-name').textContent = name;
      repostBadge.removeAttribute('hidden');
      quoteWrap.innerHTML = quoteBoxHtml(p.original_post);
      quoteWrap.onclick = p.original_post.slug
        ? function() { navigate('/p/' + encodeURIComponent(p.original_post.slug)); }
        : null;
    } else {
      repostBadge.setAttribute('hidden', '');
      quoteWrap.innerHTML = '';
      quoteWrap.onclick = null;
    }

    var av = document.getElementById('post-avatar');
    av.src = avatar; av.alt = name;
    av.onerror = function() { av.style.visibility = 'hidden'; };

    document.getElementById('post-name').textContent     = name;
    document.getElementById('post-username').textContent = username;
    var verifiedEl = document.getElementById('post-verified');
    if (verified) verifiedEl.removeAttribute('hidden'); else verifiedEl.setAttribute('hidden', '');

    var topicEl   = document.getElementById('post-topic-tag');
    var topicWrap = document.getElementById('post-topic-wrap');
    if (p.topic) {
      topicEl.textContent = p.topic;
      topicWrap.style.display = 'inline';
      topicEl.style.display   = 'inline';
    } else {
      topicWrap.style.display = 'none';
      topicEl.style.display   = 'none';
    }

    var timeEl = document.getElementById('post-time');
    timeEl.textContent = fullDate(p.created_at);
    timeEl.setAttribute('datetime', p.created_at || '');

    document.getElementById('post-title').textContent = p.title || '';
    document.getElementById('post-body').innerHTML    = linkify(p.body || '');

    document.getElementById('post-likes').textContent    = fmt(p.likes_count     || 0);
    document.getElementById('post-comments').textContent = fmt(p.comments_count  || 0);
    document.getElementById('post-shares').textContent   = fmt(p.shares_count    || 0);
    document.getElementById('post-views').textContent    = fmt(p.number_of_views || 0);

    // Media
    var mediaWrap = document.getElementById('post-media');
    mediaWrap.innerHTML = '';
    var files = (p.post_media && p.post_media.files) ? p.post_media.files : [];
    files.forEach(function(f) {
      var url   = f.url   || '';
      var thumb = f.thumb || '';
      var wrap  = document.createElement('div');
      wrap.className = 'media-item';

      if (f.type === 'video') {
        wrap.className += ' thumb-play';
        wrap.innerHTML = (thumb ? '<img src="' + xa(thumb) + '" alt="video thumbnail" />' : '<video src="' + xa(url) + '" preload="metadata"></video>')
          + '<div class="thumb-play-icon"><i class="bi bi-play-circle-fill"></i></div>';
        wrap.addEventListener('click', function() { MediaLightbox.show('video', url); });
      } else {
        var img = document.createElement('img');
        img.src = url; img.alt = 'image'; img.loading = 'lazy';
        wrap.appendChild(img);
        wrap.style.cursor = 'pointer';
        wrap.addEventListener('click', function() { MediaLightbox.show('image', url); });
      }
      mediaWrap.appendChild(wrap);
    });

    document.getElementById('btn-post-like').onclick    = function() { AuthModal.show(); };
    document.getElementById('btn-post-comment').onclick = function() { AuthModal.show(); };

    var shareUrl = p.share_url || ('https://www.beeyarn.com/p/' + encodeURIComponent(p.slug));
    document.getElementById('post-app-link').href = shareUrl;

    document.getElementById('btn-share').onclick = function() {
      if (navigator.share) {
        navigator.share({ title: p.title, url: shareUrl });
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(shareUrl).then(function() { alert('Link copied!'); });
      }
    };

    show(postArticle);
  }

  // ── Profile detail ──────────────────────────────
  async function loadProfile(username) {
    show(profileLoading, true);
    hide(profileError);
    hide(profileArticle);

    try {
      let u = profileCache[username];

      if (!u) {
        const res = await fetch(`${API_BASE}/profile/${encodeURIComponent(username)}`);
        if (!res.ok) throw new Error(res.status === 404 ? 'Profile not found.' : 'Server error: ' + res.status);
        const json = await res.json();
        u = json.data || json;
        profileCache[username] = u;
      }

      if (!u) throw new Error('Profile not found.');

      renderProfile(u, username);
      setProfileMetas(u, username);
    } catch (e) {
      profileErrorMsg.textContent = e.message || 'Profile not found.';
      show(profileError, true);
    }

    hide(profileLoading);
  }

  function renderProfile(u, username) {
    const pic     = u.profile_picture || {};
    const avatar  = u.avatar || pic.url || pic.thumb || '';
    const name    = u.name || u.full_name || ('@' + username);
    const handle  = '@' + (u.username || username);
    const bio     = (u.bio || u.about || '').trim();

    var av = document.getElementById('profile-avatar');
    av.src = avatar; av.alt = name;
    av.onerror = function() { av.style.visibility = 'hidden'; };

    document.getElementById('profile-name').textContent     = name;
    document.getElementById('profile-username').textContent = handle;

    var verifiedEl = document.getElementById('profile-verified');
    if (u.is_verified) verifiedEl.removeAttribute('hidden'); else verifiedEl.setAttribute('hidden', '');

    var bioEl = document.getElementById('profile-bio');
    bioEl.textContent = bio;
    bioEl.style.display = bio ? 'block' : 'none';

    show(profileArticle);
  }

  function setProfileMetas(u, username) {
    var name  = u.name || u.full_name || ('@' + username);
    var title = name + ' (@' + (u.username || username) + ') on BeeYarn';
    var desc  = (u.bio || u.about || '').slice(0, 200) || ('Check out @' + (u.username || username) + '\'s profile on BeeYarn.');
    var pic   = u.profile_picture || {};
    var img   = u.avatar || pic.url || pic.thumb || '';
    document.title = title;
    setMeta('og:title', title);
    setMeta('og:description', desc);
    setMeta('og:url', location.href);
    setMeta('description', desc);
    if (img) { setMeta('og:image', img); setMeta('twitter:image', img); }
    setMeta('twitter:title', title);
    setMeta('twitter:description', desc);
  }

  // ── OG meta ──────────────────────────────────────
  function setMetas(p) {
    var title = (p.title || 'Post') + ' — BeeYarn';
    var desc  = (p.body || '').slice(0, 200) || 'View on BeeYarn';
    var img   = '';
    if (p.post_media && p.post_media.files && p.post_media.files[0]) {
      img = p.post_media.files[0].thumb || p.post_media.files[0].url || '';
    }
    document.title = title;
    setMeta('og:title', title);
    setMeta('og:description', desc);
    setMeta('og:url', location.href);
    setMeta('description', desc);
    if (img) { setMeta('og:image', img); setMeta('twitter:image', img); }
    setMeta('twitter:title', title);
    setMeta('twitter:description', desc);
  }

  function setMeta(name, val) {
    var attr = name.indexOf('og:') === 0 ? 'property' : 'name';
    var el = document.querySelector('meta[' + attr + '="' + name + '"]');
    if (!el) { el = document.createElement('meta'); el.setAttribute(attr, name); document.head.appendChild(el); }
    el.setAttribute('content', val);
  }

  // ── Helpers ───────────────────────────────────────

  // Escape text then turn http/https URLs into clickable <a> tags
  function linkify(text) {
    if (!text) return '';
    var urlRegex = /https?:\/\/[^\s<>"']+/g;
    var result = '';
    var lastIndex = 0;
    var match;
    while ((match = urlRegex.exec(text)) !== null) {
      result += xh(text.slice(lastIndex, match.index));
      var url = match[0];
      result += '<a href="' + xh(url) + '" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">' + xh(url) + '</a>';
      lastIndex = match.index + url.length;
    }
    result += xh(text.slice(lastIndex));
    return result;
  }

  function xh(s) {
    return String(s || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function xa(url) {
    var s = String(url || '');
    if (/^\s*javascript\s*:/i.test(s) || /^\s*data\s*:/i.test(s)) return '';
    return xh(s);
  }

  function fmt(n) {
    n = parseInt(n, 10) || 0;
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1000)    return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
  }

  function ago(str) {
    if (!str) return '';
    // Handle "2026-04-30 18:12:25" format (replace space with T for iOS/Safari)
    var d = new Date(str.replace(' ', 'T'));
    if (isNaN(d)) return '';
    var diff = Date.now() - d.getTime();
    if (diff < 0)  return 'just now';  // future date — clock skew
    var s = Math.floor(diff / 1000);
    if (s < 60)    return 'just now';
    if (s < 3600)  return Math.floor(s / 60)   + 'm';
    if (s < 86400) return Math.floor(s / 3600)  + 'h';
    return Math.floor(s / 86400) + 'd';
  }

  function fullDate(str) {
    if (!str) return '';
    var d = new Date(str.replace(' ', 'T'));
    if (isNaN(d)) return str;
    return d.toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
  }

  // ── Boot ──────────────────────────────────────────
  // Hide everything first, then route
  hide(feedLoading);
  hide(feedError);
  hide(feedMore);
  hide(viewPost);
  hide(viewProfile);

  route();

  return { loadFeed: loadFeed, setTab: setTab, clearSearch: clearSearch };
})();
