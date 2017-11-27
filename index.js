'use strict';

var partial  = require('partial');
var unique   = require('unique-words');
var async    = require('async');

module.exports = checkChunk;

function checkChunk(nodehun, chunk, callback, options={}) {
    if (!nodehun || typeof nodehun.spellSuggestions !== 'function' || typeof nodehun.isCorrect !== 'function') {
        return callback(new TypeError(
            'First argument to nodehun-sentences must be an instance of nodehun'
        ));
    }

    var words = unique(chunk
        .toString()
        .split(/\s+/)
        .map(trimWord)
        .map(splitWord)
    ).filter(function(i) {
        return i && i.length > 1;
    });

    var wordCheck = partial(checkWord,nodehun, options);
    async.map(words, wordCheck, function(err, results) {
        if (err) {
            return callback(err);
        }

        callback(undefined, populatePositions(chunk, results));
    });
}

function populatePositions(text, words) {
    return words.filter(Boolean).map(function(entry) {
        return populatePosition(text, entry);
    });
}

function populatePosition(text, entry) {
    var matcher = new RegExp('(?:\\W|^)' + escapeRegExp(entry.word) + '(?:\\W|$)', 'g');
    var adjustment, match, wordLength = entry.word.length;

    entry.positions = [];
    while ((match = matcher.exec(text)) !== null) {
        adjustment = (match.index === 0 ? 0 : 1);

        entry.positions.push({
            from:   match.index + match[0].indexOf(entry.word),
            to:     match.index + wordLength + adjustment,
            length: wordLength
        });
    }

    return entry;
}

function checkWord(nodehun, options = {}, word, callback) {
    if (options.suggestions) {
        nodehun.spellSuggestions(word, function (err, correct, suggestions) {
            if (err || correct) {
                return callback(err);
            }

            callback(undefined, {
                word: word,
                suggestions: suggestions
            });
        });
    } else {
        nodehun.isCorrect(word, function (err, correct, origWord) {
            if (err || correct) {
                return callback(err);
            }

            callback(undefined, {
                word: origWord,
                correct: correct
            });
        });
    }
}


function trimWord(word) {
    // https://unicode-table.com/en/#01C0
    // http://jrgraphix.net/research/unicode_blocks.php
    
    // Accent characters and Umlats - \u00C0-\u024F
    // Arabic - \u0621-\u064A
    // Hebrew - \u0591-\u05F4
    // Thai - \u0E00-\u0E7F
    // Greek = \u0370-\u03FF
    // Greek Extended = \u1F00-\u1FFF

    var matches = word.match(/^[^\w\u00C0-\u024F\u0591-\u05F4\u0621-\u064A\u0E00-\u0E7F\u0370-\u03FF\u1F00-\u1FFF]*([\w\u00C0-\u024F\u0591-\u05F4\u0621-\u064A\u0E00-\u0E7F\u0370-\u03FF\u1F00-\u1FFF.]+)*[^\w\u00C0-\u024F\u0591-\u05F4\u0621-\u064A\u0E00-\u0E7F\u0370-\u03FF\u1F00-\u1FFF]*$/i);
    word = (matches && matches[1]) || '';
    // double check for abbreviations (i.e., e.g.) before removing trailing "."
    return /\b(\w\.\w\.)/.test(word) ? word : word.replace(/\d+|\.+$/, '');
}

function splitWord(word) {
    return word.replace(/\//g, ' ');
}

function escapeRegExp(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
}
