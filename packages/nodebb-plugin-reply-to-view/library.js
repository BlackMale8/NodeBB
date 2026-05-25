'use strict';

const path = require('path');
const validator = require('validator');

const nodebbRequire = modulePath => (
	require.main && require.main.require ?
		require.main.require(modulePath) :
		require(path.join(__dirname, '../..', modulePath.replace(/^\.\//, '')))
);

const db = nodebbRequire('./src/database');
const meta = nodebbRequire('./src/meta');
const posts = nodebbRequire('./src/posts');
const privileges = nodebbRequire('./src/privileges');
const routeHelpers = nodebbRequire('./src/routes/helpers');
const topics = nodebbRequire('./src/topics');

const plugin = module.exports;

const HIDE_RE = /\[(hide|reply)\]([\s\S]*?)\[\/\1\]/gi;
const HIDE_MARKER_RE = /\[(hide|reply)\][\s\S]*?\[\/\1\]/i;
const OPEN_CLOSE_RE = /\[\/?(?:hide|reply)\]/gi;
const UPLOAD_URL_RE = /(?:https?:\/\/[^"'<>\s]+)?\/assets\/uploads\/files\/[^"'<>\s)]+/i;
const LINK_RE = /<a\b[^>]*\bhref=(["'])([^"']*\/assets\/uploads\/files\/[^"']+)\1[^>]*>[\s\S]*?<\/a>/gi;
const MEDIA_RE = /<(?:img|video|audio|source|embed)\b[^>]*(?:src|poster)=(["'])([^"']*\/assets\/uploads\/files\/[^"']+)\1[^>]*>(?:<\/(?:video|audio|source|embed)>)?/gi;
const CACHE_TTL = 30 * 1000;
const settingsCache = {
	expires: 0,
	data: null,
};
const replyCache = new Map();

let apiWrapped = false;

plugin.addAdminNavigation = async function (header) {
	header.plugins.push({
		route: '/plugins/reply-to-view',
		icon: 'fa-lock',
		name: '[[reply-to-view:admin.title]]',
	});
	return header;
};

plugin.renderAdmin = async function (req, res) {
	const settings = await getSettings();
	res.render('admin/plugins/reply-to-view', {
		title: '[[reply-to-view:admin.title]]',
		settings,
	});
};

plugin.onSettingsSet = function ({ plugin: pluginId }) {
	if (pluginId === 'reply-to-view') {
		settingsCache.expires = 0;
		settingsCache.data = null;
	}
};

plugin.init = async function ({ router }) {
	wrapPostsApi();
	routeHelpers.setupAdminPageRoute(router, '/admin/plugins/reply-to-view', [], plugin.renderAdmin);
};

plugin.filterPosts = async function (payload) {
	if (!payload || !Array.isArray(payload.posts) || !payload.posts.length) {
		return payload;
	}

	await applyVisibility(payload.posts, payload.uid);
	return payload;
};

plugin.filterRawPost = async function (payload) {
	if (!payload || !payload.postData || !hasHiddenMarkup(payload.postData)) {
		return payload;
	}

	await ensurePostFields(payload.postData);
	const [visible] = await getVisibility([payload.postData], payload.uid);
	if (visible) {
		payload.postData.content = stripHideTags(payload.postData.content);
		payload.postData.sourceContent = stripHideTags(payload.postData.sourceContent);
		return payload;
	}

	payload.postData.content = concealRawContent(payload.postData.content);
	payload.postData.sourceContent = concealRawContent(payload.postData.sourceContent);
	return payload;
};

plugin.registerFormatting = async function (payload) {
	payload.options.push({
		name: 'reply-to-view-hide',
		title: '[[reply-to-view:button-title]]',
		className: 'fa fa-lock',
		visibility: payload.defaultVisibility,
	});
	return payload;
};

plugin.onTopicReply = async function ({ post, data }) {
	const tid = post && post.tid ? post.tid : data && data.tid;
	if (tid) {
		clearTopicCache(tid);
	}
};

plugin.onPostSetFields = async function ({ data }) {
	if (!data || (!Object.prototype.hasOwnProperty.call(data, 'content') &&
			!Object.prototype.hasOwnProperty.call(data, 'sourceContent') &&
			!Object.prototype.hasOwnProperty.call(data, 'deleted'))) {
		return;
	}

	const tid = data.tid || (data.pid ? await posts.getPostField(data.pid, 'tid') : null);
	if (tid) {
		clearTopicCache(tid);
	}
};

async function applyVisibility(postData, uid) {
	const candidates = postData.filter(hasHiddenMarkup);
	if (!candidates.length) {
		return;
	}

	await Promise.all(candidates.map(ensurePostFields));
	const visibility = await getVisibility(candidates, uid);
	candidates.forEach((post, index) => {
		if (visibility[index]) {
			revealPost(post);
		} else {
			concealPost(post);
		}
	});
}

async function ensurePostFields(post) {
	if (!post || !post.pid || (post.tid && post.uid)) {
		return;
	}
	const fields = await posts.getPostFields(post.pid, ['pid', 'tid', 'uid']);
	if (fields) {
		post.tid = post.tid || fields.tid;
		post.uid = post.uid || fields.uid;
	}
}

async function getVisibility(postData, uid) {
	uid = parseInt(uid, 10) || 0;
	if (!uid) {
		return postData.map(() => false);
	}

	const settings = await getSettings();
	const tids = Array.from(new Set(postData.map(post => post && post.tid).filter(Boolean)));
	const topicData = await topics.getTopicsFields(tids, ['tid', 'uid']);
	const tidToTopic = new Map(topicData.filter(Boolean).map(topic => [String(topic.tid), topic]));
	const privs = settings.bypassAdminMod ?
		await Promise.all(tids.map(tid => privileges.topics.get(tid, uid))) :
		tids.map(() => ({}));
	const tidToPrivs = new Map(tids.map((tid, index) => [String(tid), privs[index] || {}]));

	const uniqueChecks = [];
	const seen = new Set();
	for (const post of postData) {
		const topic = tidToTopic.get(String(post.tid));
		if (!topic) {
			continue;
		}
		const key = `${post.tid}:${uid}`;
		if (!seen.has(key) && !isAlwaysVisible(post, topic, uid, tidToPrivs.get(String(post.tid)))) {
			seen.add(key);
			uniqueChecks.push({ tid: post.tid, uid });
		}
	}
	await resolveReplyChecks(uniqueChecks);

	return postData.map((post) => {
		const topic = tidToTopic.get(String(post.tid));
		if (!topic) {
			return false;
		}
		const topicPrivs = tidToPrivs.get(String(post.tid));
		return isAlwaysVisible(post, topic, uid, topicPrivs) || replyCache.get(`${post.tid}:${uid}`)?.value === true;
	});
}

function isAlwaysVisible(post, topic, uid, topicPrivs) {
	return parseInt(post.uid, 10) === uid ||
		parseInt(topic.uid, 10) === uid ||
		(topicPrivs && topicPrivs.isAdminOrMod);
}

async function resolveReplyChecks(checks) {
	const now = Date.now();
	const misses = checks.filter(({ tid, uid }) => {
		const cached = replyCache.get(`${tid}:${uid}`);
		return !cached || cached.expires <= now;
	});
	if (!misses.length) {
		return;
	}

	await Promise.all(misses.map(async ({ tid, uid }) => {
		const postCount = await db.sortedSetScore(`tid:${tid}:posters`, uid);
		const value = (parseInt(postCount, 10) || 0) > 0;
		replyCache.set(`${tid}:${uid}`, {
			value,
			expires: Date.now() + CACHE_TTL,
		});
	}));
}

function revealPost(post) {
	post.content = stripHideTags(post.content);
	post.sourceContent = stripHideTags(post.sourceContent);
}

function concealPost(post) {
	post.content = concealHtmlContent(post.content);
	post.sourceContent = concealRawContent(post.sourceContent);
	post.uploads = [];
	post.attachments = [];
	if (post.teaser) {
		post.teaser.content = concealHtmlContent(post.teaser.content);
	}
}

function concealRawContent(content) {
	if (!content) {
		return content;
	}
	return stripUploads(String(content).replace(HIDE_RE, hiddenNotice));
}

function concealHtmlContent(content) {
	if (!content) {
		return content;
	}
	return stripUploads(String(content).replace(HIDE_RE, hiddenNotice));
}

function stripHideTags(content) {
	return content ? String(content).replace(OPEN_CLOSE_RE, '') : content;
}

function stripUploads(content) {
	if (!content || !UPLOAD_URL_RE.test(content)) {
		return content;
	}
	return String(content)
		.replace(LINK_RE, attachmentNotice)
		.replace(MEDIA_RE, attachmentNotice)
		.replace(UPLOAD_URL_RE, attachmentNotice);
}

function hiddenNotice() {
	return noticeHtml('hidden-content', getCachedSettings().hiddenText);
}

function attachmentNotice() {
	return noticeHtml('hidden-attachment', getCachedSettings().attachmentText);
}

function noticeHtml(kind, text) {
	return `<div class="reply-to-view-notice reply-to-view-${kind}"><i class="fa fa-lock" aria-hidden="true"></i> ${validator.escape(String(text))}</div>`;
}

function hasHiddenMarkup(post) {
	const content = post && (post.sourceContent || post.content || '');
	return HIDE_MARKER_RE.test(String(content));
}

async function getSettings() {
	const now = Date.now();
	if (settingsCache.data && settingsCache.expires > now) {
		return settingsCache.data;
	}

	const data = await meta.settings.get('reply-to-view');
	settingsCache.data = {
		hiddenText: data.hiddenText || '此內容回覆後可見',
		attachmentText: data.attachmentText || '此附件回覆後可見',
		bypassAdminMod: data.bypassAdminMod !== 'off',
	};
	settingsCache.expires = now + CACHE_TTL;
	return settingsCache.data;
}

function getCachedSettings() {
	return settingsCache.data || {
		hiddenText: '此內容回覆後可見',
		attachmentText: '此附件回覆後可見',
		bypassAdminMod: true,
	};
}

function clearTopicCache(tid) {
	for (const key of replyCache.keys()) {
		if (key.startsWith(`${tid}:`)) {
			replyCache.delete(key);
		}
	}
}

function wrapPostsApi() {
	if (apiWrapped) {
		return;
	}
	apiWrapped = true;

	const apiPosts = nodebbRequire('./src/api/posts');
	const originalGet = apiPosts.get;
	const originalGetRaw = apiPosts.getRaw;

	apiPosts.get = async function (caller, data) {
		const post = await originalGet.call(this, caller, data);
		if (post) {
			await applyVisibility([post], caller.uid);
		}
		return post;
	};

	apiPosts.getRaw = async function (caller, data) {
		const content = await originalGetRaw.call(this, caller, data);
		if (!content || !HIDE_MARKER_RE.test(String(content))) {
			return content;
		}

		const post = await posts.getPostFields(data.pid, ['pid', 'tid', 'uid', 'content', 'sourceContent']);
		if (!post) {
			return content;
		}
		post.content = content;
		post.sourceContent = content;

		const [visible] = await getVisibility([post], caller.uid);
		return visible ? stripHideTags(content) : concealRawContent(content);
	};
}
