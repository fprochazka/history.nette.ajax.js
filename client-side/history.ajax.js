(function($, undefined) {

// Is History API reliably supported? (based on Modernizr & PJAX)
if (!(window.history && history.pushState && window.history.replaceState && !navigator.userAgent.match(/((iPod|iPhone|iPad).+\bOS\s+[1-4]|WebApps\/.+CFNetwork)/))) return;

$.nette.ext('redirect', false);

var blockPopstateEvent = document.readyState !== 'complete';
var handleState = function (context, name, args) {
	var handler = context['handle' + name.substring(0, 1).toUpperCase() + name.substring(1)];
	if (handler) {
		handler.apply(context, args);
	}
};

$.nette.ext('history', {
	init: function () {

		var snippetsExt;
		if (this.cache && (snippetsExt = $.nette.ext('snippets'))) {
			this.handleUI = function (domCache) {
				var snippets = {};
				$.each(domCache, function () {
					var html;
					if (this.excludedIds) {
						var $html = $('<div>').html(this.html);
						this.excludedIds.forEach(function (id) {
							$html.find('#' + id).html($('#' + id).html());
						});
						html = $html.html();
					} else {
						html = this.html;
					}
					snippets[this.id] = html;
				});
				snippetsExt.updateSnippets(snippets, true);
				$.nette.load();
			};
		}

		this.initialState = {
			nette: true,
			href: window.location.href,
			title: document.title,
			ui: this.cache ? this.extractSnippets({}) : null
		};
		this.beforePushStateQueue.fire(this.initialState, null);
		history.replaceState(this.initialState, document.title, window.location.href);

		$(window).on('popstate.nette', $.proxy(function (e) {
			if (blockPopstateEvent && document.readyState === 'complete') {
				return;
			}

			var state = e.originalEvent.state;
			if (!state) {
				return;
			}

			if (this.cache && state.ui) {
				handleState(this, 'UI', [state.ui]);
				handleState(this, 'title', [state.title]);
			} else {
				$.nette.ajax({
					url: state.href,
					off: ['history']
				});
			}
			this.afterPopStateQueue.fire(state);
		}, this));

		setTimeout(function () { blockPopstateEvent = false; }, 0);
	},
	before: function (xhr, settings) {
		if (!settings.nette || (this.off && !settings.nette.el.is('[data-history-on]'))) {
			this.href = null;
		} else if (!settings.nette.form && !settings.nette.ui.href) {
			this.href = settings.url;
		} else if (!settings.nette.form) {
			this.href = settings.nette.ui.href;
		} else if (settings.nette.form.get(0).method === 'get') {
			this.href = settings.nette.form.get(0).action || window.location.href;
		} else {
			this.href = null;
		}

		if (this.href) {
			xhr.setRequestHeader('X-History-Request', 'true');
		}
	},
	success: function (payload, status, xhr, settings) {
		var redirect = payload.redirect || payload.url; // backwards compatibility for 'url'
		if (redirect) {
			var regexp = new RegExp('//' + window.location.host + '($|/)');
			if (this.href && ((redirect.substring(0,4) === 'http') ? regexp.test(redirect) : true)) {
				this.href = redirect;
			} else {
				window.location.href = redirect;
			}
		}
		if (this.href && this.href != window.location.href) {
			this.pushState(this.href, document.title, {}, settings.nette && settings.nette.el);
		}
		this.href = null;
	}
}, {
	href: null,
	off: false,
	cache: true,
	beforePushStateQueue: $.Callbacks(),
	afterPopStateQueue: $.Callbacks(),

	beforePushState: function (callback) {
		this.beforePushStateQueue.add(callback);
	},
	afterPopState: function (callback) {
		this.afterPopStateQueue.add(callback);
	},
	handleTitle: function (title) {
		document.title = title;
	},
	pushState: function (href, title, newSnippets, sender) {
		var state = {
			nette: true,
			href: href,
			title: title,
			ui: this.cache ? this.extractSnippets(newSnippets) : null
		};
		this.beforePushStateQueue.fire(state, sender);
		history.pushState(state, title, href);
	},
	extractSnippets: function (newSnippets) {
		var snippets = {};

		function createSnippet(id) {
			if (id in snippets) {
				return snippets[id];
			} else {
				var snippet = {id: id, html: null, excludedIds: []};
				snippets[id] = snippet;
				return snippet;
			}
		}

		$('[id^="snippet-"]').each(function () {
			var $el = $(this), id = $el.attr('id'), cache = !$el.is('[data-history-nocache]'), parents = $el.parents('[id^="snippet-"]');

			if (cache && parents.length === 0) {
				createSnippet(id).html = newSnippets.hasOwnProperty(id) ? newSnippets[id] : $el.html();
			} else if (!cache && parents.length > 0) {
				createSnippet(parents.last().attr('id')).excludedIds.push(id);
			}
		});

		return snippets;
	}
});

})(jQuery);
