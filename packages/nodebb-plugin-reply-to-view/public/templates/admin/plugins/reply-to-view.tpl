<div class="acp-page-container">
	<!-- IMPORT admin/partials/settings/header.tpl -->

	<div class="row m-0">
		<div id="spy-container" class="col-12 col-md-8 px-0 mb-4" tabindex="0">
			<form role="form" class="reply-to-view-settings">
				<div class="mb-3">
					<label class="form-label" for="hiddenText">[[reply-to-view:admin.hidden-text]]</label>
					<input class="form-control" type="text" id="hiddenText" name="hiddenText" value="{settings.hiddenText}" />
					<p class="form-text">[[reply-to-view:admin.hidden-text-help]]</p>
				</div>

				<div class="mb-3">
					<label class="form-label" for="attachmentText">[[reply-to-view:admin.attachment-text]]</label>
					<input class="form-control" type="text" id="attachmentText" name="attachmentText" value="{settings.attachmentText}" />
					<p class="form-text">[[reply-to-view:admin.attachment-text-help]]</p>
				</div>

				<div class="form-check form-switch">
					<input class="form-check-input" type="checkbox" id="bypassAdminMod" name="bypassAdminMod" {{{ if settings.bypassAdminMod }}}checked{{{ end }}} />
					<label class="form-check-label" for="bypassAdminMod">[[reply-to-view:admin.bypass-admin-mod]]</label>
					<p class="form-text">[[reply-to-view:admin.bypass-admin-mod-help]]</p>
				</div>
			</form>
		</div>

		<!-- IMPORT admin/partials/settings/toc.tpl -->
	</div>
</div>
