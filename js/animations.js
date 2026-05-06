(function () {
    'use strict';

    // Selectors to auto-tag for scroll reveal
    // Each entry: { sel, stagger } — stagger adds delay attrs to siblings
    var REVEAL_RULES = [
        { sel: '#features .col-md-6',          stagger: true  },
        { sel: '#features .col-lg-4',          stagger: false },
        { sel: '#features .col-lg-8',          stagger: false },
        { sel: '#features #privacy-policy',    stagger: false },
        { sel: '#features #content-policy',    stagger: false },
        { sel: '#features #terms-of-use',      stagger: false },
        { sel: '#features #refund-policy',     stagger: false },
        { sel: '#features #faq-content',       stagger: false },
        { sel: '#features #contact-content',   stagger: false },
        { sel: '#download h2',                 stagger: false },
        { sel: '#download .d-flex',            stagger: false },
    ];

    function tagElements() {
        REVEAL_RULES.forEach(function (rule) {
            var els = document.querySelectorAll(rule.sel);
            els.forEach(function (el, i) {
                if (!el.hasAttribute('data-animate')) {
                    el.setAttribute('data-animate', '');
                    if (rule.stagger && i > 0 && i <= 4) {
                        el.setAttribute('data-animate-delay', String(i));
                    }
                }
            });
        });
    }

    function initScrollReveal() {
        var targets = document.querySelectorAll('[data-animate]');
        if (!targets.length) return;

        if (!('IntersectionObserver' in window)) {
            targets.forEach(function (el) { el.classList.add('is-visible'); });
            return;
        }

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0, rootMargin: '0px 0px -40px 0px' });

        targets.forEach(function (el) { observer.observe(el); });
    }

    function initNavbarScroll() {
        var nav = document.getElementById('mainNav');
        if (!nav) return;
        function update() {
            nav.classList.toggle('scrolled', window.scrollY > 20);
        }
        window.addEventListener('scroll', update, { passive: true });
        update();
    }

    function init() {
        tagElements();
        initScrollReveal();
        initNavbarScroll();
    }

    // Run after DOMContentLoaded; small delay lets shared-shell finish injecting
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 60); });
    } else {
        setTimeout(init, 60);
    }
})();
