#!/usr/bin/env nodejs

var fs = require('fs');
var path = require('path');
var lazy = require('lazy');

function keyifi(str) {
    str = str.replace(/\s*shipping\s*/ig, ''); // indiegogo specific
    return str.replace(/[^\w\d]+/g, '_').toLowerCase();
}

function clean(str) {
    return str.replace(/[\"=]/g, ''); // indiegogo specific
}


var keys = null;
var o, fields, j;
function parseLine(line, sep, callback) {
    if(!keys) {
        keys = line.split(sep);
        for(j=0; j < keys.length; j++) {
            keys[j] = keyifi(keys[j]);
        }
        return;
    }
    o = {};
    fields = line.split(sep);
    for(j=0; j < fields.length; j++) {
        if(fields[j] && keys[j]) {
            o[keys[j]] = clean(fields[j]);
        }
    }
    if(Object.keys(o).length > 0) {
        callback(o);
    }
}

module.exports = function(inFile, callback, opts) {
    opts = opts || {};
    opts.sep = opts.sep || ',';

    lazy(fs.createReadStream(inFile, {encoding: 'utf8'}))
        .lines
        .map(String)
        .forEach(function(line) {
            parseLine(line, opts.sep, callback);
        });
}
