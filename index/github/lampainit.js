(function () {
    'use strict';

    let initialSettings = '{{initialSettings}}';

    let timer = setInterval(function () {
        if (typeof Lampa !== 'undefined') {
            clearInterval(timer);

            var unic_id = Lampa.Storage.get('lampac_unic_id', '');
            if (!unic_id) {
                unic_id = Lampa.Utils.uid(8).toLowerCase();
                Lampa.Storage.set('lampac_unic_id', unic_id);
            }

            Lampa.Utils.putScriptAsync(["https://lampac.zolroman.duckdns.org/privateinit.js?account_email=" + encodeURIComponent(Lampa.Storage.get('account_email', '')) + "&uid=" + encodeURIComponent(Lampa.Storage.get('lampac_unic_id', ''))], function () {
            });

            if (!Lampa.Storage.get('lampac_initiale', 'false')) start();

            window.lampa_settings.torrents_use = true;
            window.lampa_settings.demo = false;
            window.lampa_settings.read_only = false;

        }
    }, 200);

    let dcma_timer = setInterval(function () {
        if (typeof window.lampa_settings != 'undefined' && (window.lampa_settings.fixdcma || window.lampa_settings.dcma)) {
            clearInterval(dcma_timer)
            if (window.lampa_settings.dcma)
                window.lampa_settings.dcma = false;
        }
    }, 100);

    function start() {
        Lampa.Storage.set('lampac_initiale', 'true');

        for (let key in initialSettings) {
            if (key !== 'plugins') {
                Lampa.Storage.set(key, initialSettings[key])
            }
        }

        const plugins = Lampa.Plugins.get();
        let plugins_add = initialSettings['plugins'] || [];
        let plugins_push = []

        plugins_add.forEach(function (plugin) {
            if (!plugins.find(function (a) {
                return a.url === plugin.url
            })) {
                Lampa.Plugins.add(plugin);
                Lampa.Plugins.save();

                plugins_push.push(plugin.url)
            }
        });

        if (plugins_push.length)
            Lampa.Utils.putScript(plugins_push, () => {}, () => {}, () => {}, true);
    }
})();