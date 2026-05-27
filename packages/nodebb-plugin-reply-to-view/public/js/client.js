'use strict';

(function () {
	require([
		'composer/formatting',
		'composer/controls',
		'translator',
	], function (formatting, controls, translator) {
		let registered = false;

		function register() {
			if (registered || !formatting || !controls) {
				return;
			}
			registered = true;

			translator.getTranslations(window.config.userLang, 'reply-to-view', function (strings) {
				const placeholder = strings.placeholder || 'Hidden content';

				formatting.addButtonDispatch('reply-to-view-hide', function (textarea, selectionStart, selectionEnd) {
					if (selectionStart === selectionEnd) {
						controls.insertIntoTextarea(textarea, `[hide]${placeholder}[/hide]`);
						controls.updateTextareaSelection(
							textarea,
							selectionStart + 6,
							selectionStart + placeholder.length + 6
						);
						return;
					}

					const wrapDelta = controls.wrapSelectionInTextareaWith(textarea, '[hide]', '[/hide]');
					controls.updateTextareaSelection(
						textarea,
						selectionStart + 6 + wrapDelta[0],
						selectionEnd + 6 - wrapDelta[1]
					);
				});
			});
		}

		$(window).on('action:composer.enhanced', register);
		register();
	});
}());
