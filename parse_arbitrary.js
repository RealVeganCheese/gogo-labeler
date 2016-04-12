#!/usr/bin/env nodejs

var fs = require('fs');
var path = require('path');
var csvParse = require('csv-parse');

// returns true if any of the values in a hash equal the specified value
function hasValue(h, val) {
    var key;
    for(key in h) {
        if(h[key] == val) {
            return true;
        }
    }
    return false;
}

function keyifi(str) {
    return str.replace(/[^\w\d]+/g, '_').toLowerCase();
}

function clean(str) {
    if(str.replace(/\s+/g, '') == '') {
        return null;
    }
    // remove leading and trailing whitespace
    str = str.replace(/^\s+/, '').replace(/\s+$/, '');
    return str;
}


function LineParser() {

    var keys = null;
    var o, fields, j;
    return function(i, line, callback) {
        if(!keys) {
            keys = line;
            for(j=0; j < keys.length; j++) {
                keys[j] = keyifi(keys[j]);
            }
            return;
        }
        o = {};
        fields = line;
        var cleaned;
        for(j=0; j < fields.length; j++) {
            if(keys[j]) {
                if(fields[j]) {
                    cleaned = clean(fields[j]);
                    if(cleaned) {
                        o[keys[j]] = cleaned;
                    }
                } else {
                        o[keys[j]] = null;
                }
            }
        }
//        if(Object.keys(o).length > 0) {
            callback(null, i, o);
//        }
    };
}

module.exports = function(inFile, callback, done_callback) {

    var parser = csvParse()
    var i = 1;
    var readyForNext = true;
    var weAreDone = false;
    var doneCallbackCalled = false;

    var parseLine = new LineParser();

    parser.on('readable', function() {
        if(!readyForNext) {
            return;
        }
        var line = parser.read();
        if(!line) {
            if(weAreDone && !doneCallbackCalled) {
                done_callback();
                doneCallbackCalled = true;
            }
            return;
        }
        if(i > 1) {
            readyForNext = false;
        }
        parseLine(i, line, function(err, line, person) {
            callback(err, line, person, function() {
                readyForNext = true;
                parser.emit('readable');
            });
        });
        i++;
    });

    parser.on('error', function(err) {
        parser.end();
        callback("Parser error: " + err);
    });

    parser.on('end', function() {
        weAreDone = true;
        parser.emit('readable');
    });

    var inStream = fs.createReadStream(inFile, {encoding: 'utf8'});

    inStream.pipe(parser);
}
