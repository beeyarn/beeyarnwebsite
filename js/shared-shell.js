(function () {
    const path = window.location.pathname.toLowerCase();
    const rootPrefix = path.includes('/career/') || path.includes('/careers/')
        ? '../'
        : '';

    // ---- LOGO: change ONLY this block to update the logo in the nav and footer ----
    // Transparent wordmarks so the logo blends into the page: green for light surfaces, white for the dark footer.
    const LOGO = {
        src: `${rootPrefix}assets/logo-green.png`,      // used on the white nav
        srcDark: `${rootPrefix}assets/logo-white.png`,  // used on the black footer
        alt: 'BeeYarn',
        showName: false,                                // set true to print the name next to the image
    };
    const logoHtml = (dark) => `<img class="by-logo-img" src="${dark ? LOGO.srcDark : LOGO.src}" alt="${LOGO.alt}" width="460" height="147">${LOGO.showName ? `<span class="by-logo-name">BeeYarn</span>` : ''}`;

    const pageLinks = [
        { label: 'Why BeeYarn', href: `${rootPrefix}whybeeyarn.html` },
        { label: 'Creator Levels', href: `${rootPrefix}beeyarn-creator-level-system.html` },
        { label: 'Careers', href: `${rootPrefix}career/index.html` },
        { label: 'FAQ', href: `${rootPrefix}faqs` },
    ];

    const footerGroups = [
        {
            title: 'Company',
            links: [
                { label: 'Why BeeYarn', href: `${rootPrefix}whybeeyarn.html` },
                { label: 'Careers', href: `${rootPrefix}career/index.html` },
                { label: 'Become a Campus Ambassador', href: `${rootPrefix}career/campus-ambassador.html` },
                { label: 'Investors', href: `${rootPrefix}investors` },
                { label: 'Contact', href: `${rootPrefix}contact` },
            ],
        },
        {
            title: 'Resources',
            links: [
                { label: 'FAQ', href: `${rootPrefix}faqs` },
                { label: 'Creator Levels', href: `${rootPrefix}beeyarn-creator-level-system.html` },
            ],
        },
        {
            title: 'Legal',
            links: [
                { label: 'Privacy Policy', href: `${rootPrefix}privacy` },
                { label: 'Terms of Use', href: `${rootPrefix}termsofuse` },
                { label: 'Content Policy', href: `${rootPrefix}contentpolicy` },
                { label: 'Refund Policy', href: `${rootPrefix}refundpolicy` },
            ],
        },
    ];

    const socialLinks = [
        {
            title: 'X (Twitter)',
            href: 'https://x.com/BeeYarnApp',
            // The pinned Font Awesome 6.0.0 build predates the fa-x-twitter glyph, so use an inline SVG instead of an icon class.
            svg: '<svg viewBox="0 0 1200 1227" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M714.163 519.284 1160.89 0h-105.86L667.137 450.887 357.328 0H0l468.492 681.821L0 1226.37h105.866l409.633-476.152 327.181 476.152H1200L714.137 519.284h.026ZM569.165 687.828l-47.468-67.894-377.686-540.24h162.604l304.797 435.991 47.468 67.894 396.2 566.721H892.476L569.165 687.854v-.026Z"/></svg>',
        },
        { title: 'Facebook', href: 'https://www.facebook.com/beeyarntechnologies', icon: 'fa-brands fa-facebook' },
        { title: 'LinkedIn', href: 'https://www.linkedin.com/company/beeyarn', icon: 'fa-brands fa-linkedin' },
    ];

    function buildHeader() {
        const navItems = pageLinks
            .map(link => `<li class="nav-item"><a class="nav-link" href="${link.href}">${link.label}</a></li>`)
            .join('\n');

        return `
<nav class="navbar navbar-expand-lg fixed-top" id="mainNav">
    <div class="container px-4 px-lg-5">
        <a class="navbar-brand by-logo" href="${rootPrefix}index.html" aria-label="BeeYarn home">${logoHtml(false)}</a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarResponsive" aria-controls="navbarResponsive" aria-expanded="false" aria-label="Toggle navigation">
            Menu
            <i class="bi-list"></i>
        </button>
        <div class="collapse navbar-collapse" id="navbarResponsive">
            <ul class="navbar-nav ms-auto me-lg-3 my-3 my-lg-0">
                ${navItems}
            </ul>
            <a class="by-btn by-nav-cta" href="https://www.beeyarn.com/home">Open app <span aria-hidden="true">&rarr;</span></a>
        </div>
    </div>
</nav>`;
    }

    function buildFooter() {
        const year = new Date().getFullYear();

        const columnsHtml = footerGroups
            .map(group => `
                <div class="site-footer-col">
                    <div class="site-footer-col-title">${group.title}</div>
                    ${group.links.map(link => `<a href="${link.href}">${link.label}</a>`).join('')}
                </div>`)
            .join('');

        const socialHtml = socialLinks
            .map(link => `
                <a href="${link.href}" target="_blank" rel="noopener" title="${link.title}" aria-label="${link.title}" class="site-footer-social-link">
                    ${link.svg ? link.svg : `<i class="${link.icon}"></i>`}
                </a>`)
            .join('');

        return `
<footer class="site-footer">
    <div class="container px-4 px-lg-5">
        <div class="site-footer-grid">
            <div class="site-footer-brand">
                <a href="${rootPrefix}index.html" class="site-footer-logo by-logo" aria-label="BeeYarn home">${logoHtml(true)}</a>
                <p class="site-footer-tagline">Creator economy for the Global South. Fair rewards, privacy first.</p>
                <div class="site-footer-social">${socialHtml}</div>
            </div>
            ${columnsHtml}
        </div>
        <div class="site-footer-bottom">
            <span>&copy; ${year} BeeYarn. All rights reserved.</span>
            <a href="#" onclick="event.preventDefault(); try { window.Cookiebot && Cookiebot.renew(); } catch (e) {}">Cookie Settings</a>
        </div>
    </div>
</footer>`;
    }

    function activateCurrentLink() {
        const currentPath = window.location.pathname.replace(/\/index\.html$/, '/');
        document.querySelectorAll('#shared-header .nav-link').forEach(link => {
            const linkUrl = new URL(link.href, window.location.origin);
            const linkPath = linkUrl.pathname.replace(/\/index\.html$/, '/');
            if (linkPath === currentPath) {
                link.classList.add('active');
            }
        });
    }

    function insertSharedShell() {
        const headerContainer = document.getElementById('shared-header');
        const footerContainer = document.getElementById('shared-footer');
        const existingNav = document.querySelector('nav#mainNav, nav.navbar, nav');
        const existingFooter = document.querySelector('footer');

        if (headerContainer) {
            headerContainer.innerHTML = buildHeader();
        } else if (existingNav) {
            existingNav.outerHTML = buildHeader();
        } else if (document.body) {
            document.body.insertAdjacentHTML('afterbegin', buildHeader());
        }

        if (footerContainer) {
            footerContainer.innerHTML = buildFooter();
        } else if (existingFooter) {
            existingFooter.outerHTML = buildFooter();
        } else if (document.body) {
            document.body.insertAdjacentHTML('beforeend', buildFooter());
        }

        activateCurrentLink();
        injectAnimations();
    }

    function injectAnimations() {
        if (!document.querySelector('link[data-beeyarn="animations"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = rootPrefix + 'css/animations.css?v=20260920n';
            link.setAttribute('data-beeyarn', 'animations');
            document.head.appendChild(link);
        }
        if (!document.querySelector('script[data-beeyarn="animations"]')) {
            const script = document.createElement('script');
            script.src = rootPrefix + 'js/animations.js';
            script.setAttribute('data-beeyarn', 'animations');
            document.body.appendChild(script);
        }
    }

    document.addEventListener('DOMContentLoaded', insertSharedShell);
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        insertSharedShell();
    }
})();
