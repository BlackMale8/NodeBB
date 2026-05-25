'use strict';

const assert = require('assert');

const tokenizer = require('../packages/nodebb-plugin-dbsearch-chinese/lib/tokenizer');

describe('Chinese dbsearch tokenizer', () => {
	it('should preserve non-Chinese searches', () => {
		assert.strictEqual(tokenizer.forQuery('nodebb mongodb'), 'nodebb mongodb');
		assert.strictEqual(tokenizer.forIndex('nodebb mongodb'), 'nodebb mongodb');
	});

	it('should tokenize Chinese content for indexing', () => {
		const output = tokenizer.forIndex('傳統論壇回覆後可見功能');
		assert(output.includes('傳統論壇'));
		assert(output.includes('回覆後可見'));
		assert(output.includes('論壇'));
		assert(output.includes('可見'));
	});

	it('should preserve English words in mixed searches', () => {
		const output = tokenizer.forQuery('NodeBB 中文搜尋');
		assert(output.includes('NodeBB'));
		assert(output.includes('中文'));
		assert(output.includes('搜尋'));
	});
});
