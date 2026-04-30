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
  let page      = 1;
  let busy      = false;
  let hasMore   = true;
  let allPosts  = [];   // master list of every fetched post
  let activeTab = 'home';
  let searchQ   = '';
  const cache   = {};

  const searchInput   = document.getElementById('search-input');
  const searchBar     = document.getElementById('search-results-bar');
  const searchLabel   = document.getElementById('search-query-label');
  const tabHome       = document.getElementById('tab-home');
  const tabHot        = document.getElementById('tab-hot');
  const tabNew        = document.getElementById('tab-new');

  // Hide/show using display property — flex for visible, none for hidden
  function show(el, flex) { el.style.display = flex ? 'flex' : 'block'; }
  function hide(el)       { el.style.display = 'none'; }

  // ── Router ─────────────────────────────────────
  function route() {
    const m = location.pathname.match(/^\/p\/([^/]+)\/?$/);
    if (m) {
      show(viewPost); hide(viewFeed);
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
  btnMore.addEventListener('click', () => loadFeed(false));
  btnBack.addEventListener('click', () => {
    if (history.length > 1) history.back();
    else navigate('/');
  });

  // ── Search ─────────────────────────────────────
  var searchTimer;
  searchInput.addEventListener('input', function() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function() {
      searchQ = searchInput.value.trim().toLowerCase();
      if (searchQ) {
        searchLabel.textContent = searchInput.value.trim();
        show(searchBar);
        renderFiltered();
      } else {
        clearSearch();
      }
    }, 250);
  });

  function clearSearch() {
    searchQ = '';
    searchInput.value = '';
    hide(searchBar);
    renderFiltered();
  }

  // ── Tabs ────────────────────────────────────────
  function setTab(tab) {
    activeTab = tab;
    tabHome.className = tab === 'home' ? 'active' : '';
    tabHot.className  = tab === 'hot'  ? 'active' : '';
    tabNew.className  = tab === 'new'  ? 'active' : '';
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
        cache[p.slug] = p;
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

  // ── Build card ──────────────────────────────────
  function buildCard(p) {
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

    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML =
      '<div class="card-left">'
      +   '<img class="card-avatar" src="' + xa(avatar) + '" alt="' + xa(name) + '" onerror="this.style.visibility=\'hidden\'" />'
      + '</div>'
      + '<div class="card-body">'
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
      +   '<div class="card-actions">'
      +     '<span class="card-stat"><i class="bi bi-heart"></i> ' + likes    + '</span>'
      +     '<span class="card-stat"><i class="bi bi-chat"></i> '  + comments + '</span>'
      +     '<span class="card-stat"><i class="bi bi-eye"></i> '   + views    + '</span>'
      +   '</div>'
      + '</div>';

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

      // If not in cache, load the feed first to find the post
      if (!p) {
        const res = await fetch(`${API_BASE}/home?page=1`);
        if (!res.ok) throw new Error('Server error: ' + res.status);
        const json = await res.json();
        const posts = Array.isArray(json.data) ? json.data : [];
        posts.forEach(function(post) { cache[post.slug] = post; });
        p = cache[slug] || null;
      }

      if (!p) throw new Error('Post not found.');

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

    var av = document.getElementById('post-avatar');
    av.src = avatar; av.alt = name;
    av.onerror = function() { av.style.visibility = 'hidden'; };

    document.getElementById('post-name').textContent     = name;
    document.getElementById('post-username').textContent = username;
    document.getElementById('post-verified').style.display = verified ? 'inline' : 'none';

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
    document.getElementById('post-body').textContent  = p.body  || '';

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
        if (thumb) {
          wrap.className += ' thumb-play';
          wrap.innerHTML = '<img src="' + xa(thumb) + '" alt="video thumbnail" />'
            + '<div class="thumb-play-icon"><i class="bi bi-play-circle-fill"></i></div>';
          wrap.addEventListener('click', function() {
            var v = document.createElement('video');
            v.src = url; v.controls = true; v.autoplay = true; v.setAttribute('playsinline','');
            wrap.className = 'media-item';
            wrap.innerHTML = '';
            wrap.appendChild(v);
          });
        } else {
          var v = document.createElement('video');
          v.src = url; v.controls = true; v.preload = 'metadata'; v.setAttribute('playsinline','');
          wrap.appendChild(v);
        }
      } else {
        var img = document.createElement('img');
        img.src = url; img.alt = 'image'; img.loading = 'lazy';
        wrap.appendChild(img);
      }
      mediaWrap.appendChild(wrap);
    });

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

  // ── OG meta ──────────────────────────────────────
  function setMetas(p) {
    var title = (p.title || 'Post') + ' — BeeYarn';
    var desc  = (p.body || '').slice(0, 200) || 'View on BeeYarn';
    var img   = '';
    if (p.post_media && p.post_media.files && p.post_media.files[0]) {
      img = p.post_media.files[0].thumb || p.post_media.files[0].url || '';
    }
    document.title = title;
    setMeta('og:title', title);  setMeta('og:description', desc);
    setMeta('og:url', location.href);
    if (img) setMeta('og:image', img);
    setMeta('twitter:title', title); setMeta('twitter:description', desc);
  }

  function setMeta(name, val) {
    var attr = name.indexOf('og:') === 0 ? 'property' : 'name';
    var el = document.querySelector('meta[' + attr + '="' + name + '"]');
    if (!el) { el = document.createElement('meta'); el.setAttribute(attr, name); document.head.appendChild(el); }
    el.setAttribute('content', val);
  }

  // ── Helpers ───────────────────────────────────────
  function xh(s) {
    return String(s || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function xa(s) { return xh(s); }

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
    var s = Math.floor((Date.now() - d.getTime()) / 1000);
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

  route();

  return { loadFeed: loadFeed, setTab: setTab, clearSearch: clearSearch };
})();
