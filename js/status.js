(function () {
    const STATUS_ENDPOINT = 'https://api.beeyarn.com/api/settings';
    const FETCH_TIMEOUT_MS = 15000;
    const POLL_INTERVAL_MS = 3 * 60 * 1000;

    // iOS isn't launched yet, so its backend flag doesn't represent a real outage:
    // it's excluded from the aggregate status and always shown as "In progress".
    const IOS_WAITLIST_URL = 'https://beeyarn.com/index.html#ios-notify';

    const COMPONENTS = [
        { key: 'servers', label: 'Servers' },
        { key: 'web', label: 'Web app' },
        { key: 'android', label: 'Android app' },
        { key: 'ios', label: 'iOS app', inProgress: true },
    ];

    const OVERALL_LABEL = {
        operational: 'All systems operational',
        degraded: 'Partial service disruption',
        outage: 'Service outage',
        unknown: 'Status unavailable',
    };

    function escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, (ch) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
        }[ch]));
    }

    function normalizeStatus(json) {
        const raw = json && json.data && json.data.system_status;
        if (!raw) return null;

        const components = COMPONENTS.map(({ key, label, inProgress }) => {
            const entry = raw[key] || {};
            return {
                key,
                label,
                inProgress: !!inProgress,
                isDown: entry.status === 'down',
                message: entry.message || null,
                updatedAt: entry.updated_at || null,
            };
        });

        const monitored = components.filter((c) => !c.inProgress);
        const downComponents = monitored.filter((c) => c.isDown);
        let overall = 'operational';
        if (downComponents.length === monitored.length) overall = 'outage';
        else if (downComponents.length > 0) overall = 'degraded';

        return { overall, components, downComponents };
    }

    function fetchStatus() {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        return fetch(STATUS_ENDPOINT, { signal: controller.signal })
            .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
            .then((json) => normalizeStatus(json))
            .catch((err) => {
                // Fail open (no banner/alert), but log so it's diagnosable from DevTools.
                console.warn('BeeYarn status check failed:', err);
                return null;
            })
            .finally(() => clearTimeout(timer));
    }

    function formatUpdatedAt(iso) {
        try {
            return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
        } catch (e) {
            return '';
        }
    }

    function componentRowHtml(component) {
        if (component.inProgress) {
            return `
                <div class="by-status-row">
                    <div>
                        <div>${escapeHtml(component.label)}</div>
                    </div>
                    <a class="by-status-pill" data-status="progress" href="${IOS_WAITLIST_URL}">
                        <span class="by-status-dot" aria-hidden="true"></span>
                        <span class="by-status-text">In progress</span>
                    </a>
                </div>`;
        }
        const state = component.isDown ? 'outage' : 'operational';
        return `
            <div class="by-status-row">
                <div>
                    <div>${escapeHtml(component.label)}</div>
                    ${component.message ? `<div class="by-status-row-msg">${escapeHtml(component.message)}</div>` : ''}
                </div>
                <span class="by-status-pill" data-status="${state}">
                    <span class="by-status-dot" aria-hidden="true"></span>
                    <span class="by-status-text">${component.isDown ? 'Down' : 'Operational'}</span>
                </span>
            </div>`;
    }

    function renderStatusPage(status) {
        const root = document.getElementById('by-status-page');
        if (!root) return;

        const state = status ? status.overall : 'unknown';

        const banner = root.querySelector('[data-status-banner]');
        if (banner) banner.dataset.status = state;

        const bannerText = root.querySelector('[data-status-banner-text]');
        if (bannerText) bannerText.textContent = OVERALL_LABEL[state];

        const updated = root.querySelector('[data-status-updated]');
        if (updated) {
            updated.textContent = status
                ? `Last checked ${formatUpdatedAt(new Date().toISOString())}`
                : 'Unable to reach the status service';
        }

        const list = root.querySelector('[data-status-components]');
        if (list && status) {
            list.innerHTML = status.components.map(componentRowHtml).join('');
        }
    }

    function refresh() {
        fetchStatus().then((status) => {
            renderStatusPage(status);
        });
    }

    refresh();
    setInterval(refresh, POLL_INTERVAL_MS);
})();
