(function () {
    const path = window.location.pathname.toLowerCase();
    const rootPrefix = path.includes('/career/') || path.includes('/careers/')
        ? '../'
        : '';

    const pageLinks = [
        { label: 'Home', href: `${rootPrefix}index.html` },
        { label: 'Why BeeYarn', href: `${rootPrefix}whybeeyarn.html` },
        { label: 'Careers', href: `${rootPrefix}career/index.html` },
        { label: 'FAQ', href: `${rootPrefix}faqs` },
    ];

    const footerLinks = [
        { label: 'Privacy', href: `${rootPrefix}privacy` },
        { label: 'Terms of Use', href: `${rootPrefix}termsofuse` },
        { label: 'Refund Policy', href: `${rootPrefix}refundpolicy` },
        { label: 'FAQ', href: `${rootPrefix}faqs` },
        { label: 'Careers', href: `${rootPrefix}career/index.html` },
        { label: 'Contact', href: `${rootPrefix}contact` },
    ];

    const socialLinks = [
        { href: 'https://www.facebook.com/profile.php?id=61570488695195', title: 'Facebook', icon: 'fab fa-facebook-f' },
        { href: 'https://www.linkedin.com/company/beeyarn/?viewAsMember=true', title: 'LinkedIn', icon: 'fab fa-linkedin-in' },
        { href: 'https://x.com/beeyarnapp', title: 'Twitter', icon: 'fab fa-twitter' },
    ];

    function buildHeader() {
        const navItems = pageLinks
            .map(link => `<li class="nav-item"><a class="nav-link" href="${link.href}">${link.label}</a></li>`)
            .join('\n');

        return `
<nav class="navbar navbar-expand-lg navbar-light fixed-top shadow-sm" id="mainNav">
    <div class="container px-5">
        <a class="navbar-brand fw-bold" href="${rootPrefix}index.html">BeeYarn</a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarResponsive" aria-controls="navbarResponsive" aria-expanded="false" aria-label="Toggle navigation">
            Menu
            <i class="bi-list"></i>
        </button>
        <div class="collapse navbar-collapse" id="navbarResponsive">
            <ul class="navbar-nav ms-auto me-4 my-3 my-lg-0">
                ${navItems}
            </ul>
        </div>
    </div>
</nav>`;
    }

    function buildFooter() {
        const linksHtml = footerLinks
            .map(link => `<a href="${link.href}" style="color: white; text-decoration: none;">${link.label}</a><span class="mx-1">&middot;</span>`)
            .join('')
            + `<a href="#" onclick="__ucCmp && __ucCmp.showSecondLayer(); return false;" style="color: white; text-decoration: none;">Privacy Settings</a>`;

        const socialHtml = socialLinks
            .map(link => `
                <a href="${link.href}" target="_blank" title="${link.title}" class="${link.title.toLowerCase()}" style="color: white; margin: 0 10px;">
                    <i class="${link.icon}"></i>
                </a>`)
            .join('');

        return `
<footer class="text-center py-5" style="background-color: #1C5B31; color: white; margin-top: 3rem;">
    <div class="container px-5">
        <div class="small">
            <div class="mb-2">BeeYarn is a social platform that connects people through real-time messaging, video calls, and discussion forums—fostering creativity, conversations, and community.</div>
            ${linksHtml}
            <div class="d-flex justify-content-center mt-4">
                ${socialHtml}
            </div>
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
    }

    document.addEventListener('DOMContentLoaded', insertSharedShell);
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        insertSharedShell();
    }
})();
