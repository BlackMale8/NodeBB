'use strict';

const fs = require('fs');
const path = require('path');

const cjkPattern = /[\u3400-\u9fff\uf900-\ufaff]/;
const asciiTokenPattern = /[A-Za-z0-9_@.:/#-]+/g;

let nodejieba;
try {
	nodejieba = require('nodejieba');
	const userDict = path.join(__dirname, '../public/userdict.utf8');
	if (fs.existsSync(userDict)) {
		nodejieba.load({ userDict });
	}
} catch (err) {
	nodejieba = null;
}

function unique(tokens) {
	return Array.from(new Set(tokens.filter(Boolean)));
}

function splitMixedText(text) {
	const segments = [];
	let current = '';
	let currentIsCjk = false;

	for (const char of String(text || '')) {
		const isCjk = cjkPattern.test(char);
		if (!current) {
			current = char;
			currentIsCjk = isCjk;
		} else if (isCjk === currentIsCjk) {
			current += char;
		} else {
			segments.push({ text: current, isCjk: currentIsCjk });
			current = char;
			currentIsCjk = isCjk;
		}
	}
	if (current) {
		segments.push({ text: current, isCjk: currentIsCjk });
	}
	return segments;
}

function ngrams(text, min, max) {
	const chars = Array.from(text);
	const tokens = [];
	for (let size = min; size <= max; size += 1) {
		if (chars.length < size) {
			continue;
		}
		for (let i = 0; i <= chars.length - size; i += 1) {
			tokens.push(chars.slice(i, i + size).join(''));
		}
	}
	return tokens;
}

function tokenizeCjkForIndex(text) {
	const words = nodejieba ? nodejieba.cutAll(text) : [];
	return unique(words.concat(ngrams(text, 1, 4)));
}

function tokenizeCjkForQuery(text) {
	const chars = Array.from(text);
	if (chars.length <= 2) {
		return [text];
	}
	const words = nodejieba ? nodejieba.cutAll(text).filter(word => Array.from(word).length > 1) : [];
	return unique(words.concat(ngrams(text, 2, 2)));
}

function tokenizeAscii(text) {
	return text.match(asciiTokenPattern) || [];
}

function tokenize(text, mode) {
	if (!text || !cjkPattern.test(String(text))) {
		return String(text || '');
	}

	const tokens = [];
	splitMixedText(text).forEach((segment) => {
		if (segment.isCjk) {
			tokens.push(...(mode === 'query' ? tokenizeCjkForQuery(segment.text) : tokenizeCjkForIndex(segment.text)));
		} else {
			tokens.push(...tokenizeAscii(segment.text));
		}
	});

	if (mode === 'index') {
		tokens.push(String(text));
	}
	return unique(tokens).join(' ');
}

exports.forIndex = text => tokenize(text, 'index');
exports.forQuery = text => tokenize(text, 'query');
