'use strict';

define('admin/plugins/reply-to-view', ['settings', 'alerts'], function (Settings, alerts) {
	const ACP = {};

	ACP.init = function () {
		const wrapper = $('.reply-to-view-settings');
		const defaults = {
			hiddenText: wrapper.find('#hiddenText').val(),
			attachmentText: wrapper.find('#attachmentText').val(),
			bypassAdminMod: wrapper.find('#bypassAdminMod').is(':checked'),
		};

		Settings.load('reply-to-view', wrapper, function (err, values) {
			if (err) {
				return;
			}

			if (!Object.prototype.hasOwnProperty.call(values, 'hiddenText')) {
				wrapper.find('#hiddenText').val(defaults.hiddenText);
			}
			if (!Object.prototype.hasOwnProperty.call(values, 'attachmentText')) {
				wrapper.find('#attachmentText').val(defaults.attachmentText);
			}
			if (!Object.prototype.hasOwnProperty.call(values, 'bypassAdminMod')) {
				wrapper.find('#bypassAdminMod').prop('checked', defaults.bypassAdminMod);
			}
		});

		$('#save').on('click', function () {
			Settings.save('reply-to-view', wrapper, function () {
				alerts.success('[[reply-to-view:admin.settings-saved]]');
			});
		});
	};

	return ACP;
});
