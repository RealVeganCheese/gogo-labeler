#!/usr/bin/env nodejs

var fs = require('fs');
var http = require('http');
var path = require('path');
var util = require('util');
var clone = require('clone');
var prompt = require('prompt');

var argv = require('minimist')(process.argv.slice(2), {
    boolean: ['h', 'b', 'local', 'reallyPayMoney', 'labelOnly']
});

var Label = require('./label.js');
var parseIndiegogo = require('./parse_indiegogo.js');
var buyShippingLabel = require('./buyShippingLabel.js');

var settings = require('./settings.js');
var packages = require('./packages.js');

var easypost = null;

if(!argv.labelOnly) {
    if(argv.reallyPayMoney) {
        if(!settings.easypost.apiKey) {
            console.error("You must set easypost.apiKey in settings.js");
            process.exit(1);
        }
        easypost = require('node-easypost')(settings.easypost.apiKey);
    } else {
        if(!settings.easypost.apiKeyTesting) {
            console.error("You must set easypost.apiKeyTesting in settings.js");
            process.exit(1);
        }
        easypost = require('node-easypost')(settings.easypost.apiKeyTesting);
    }
}

function fail(str, line, addr) {
    if(line) {
        str += " on line " + line;
    }
    console.error(str);
    if(addr) {
        console.error('  Address: ' + util.inspect(addr));
    }
    process.exit(1);
}

function isHouseNumber(str) {
    if(str.match(/^\d+[\s\.,]*\w?$/)) {
        return true;
    }
    return false;
}

function mailingLabel(label, line, addr, country, inverse, local, require, ignore) {
    try {
        // convert "USA" / "usa" / "U.S.A." to "United States"
        if(addr.country && addr.country.match(/^\s*u\.?s\.?a\.?\s*$/i)) {
            addr.country = "United States";
        }
        if(addr.country.match(/^\s*united\s+states\s*$/i) && !inverse) {
            require.state_province = true;
        }
        
        if(country) {
            var r = new RegExp(country, 'i');

            if(!addr.country) {
                return false;
            }
            if(!inverse && !addr.country.match(r)) {
                return false;
            }
            if(inverse && addr.country.match(r)) {
                return false;
            }
        }
        
        if(!addr.name && !ignore.name) {
            fail("Address is missing a name", line, addr);
        }
        if(addr.name) {
            label.write(addr.name, 'bold');
        }
        if(!addr.address && !addr.address_2 && !ignore.address) {
            fail("Address is missing a street address", line, addr);
        }

        if(addr.address && addr.address_2) {

            if(isHouseNumber(addr.address) || isHouseNumber(addr.address_2)) {
                label.write(addr.address + ' ' + addr.address_2);
            } else {
                label.write(addr.address);
                label.write(addr.address_2);
            }
        } else {
            if(addr.address) {
                label.write(addr.address);
            }

            if(addr.address_2 && (addr.address_2 != addr.address)) {
                label.write(addr.address_2);
            }
        }
        if(!addr.city && !ignore.city) {
            fail("Address is missing a city", line, addr);
        }
        if(addr.city) {
            label.write(addr.city);
        }

        var key;
        if(require) {
            for(key in require) {
                if(!addr[key]) {
                    fail("Address is missing required field: " + key);
                }
            }
        }

        if(!addr.zip_postal_code) {
            fail("Address is missing a zip or postal code", line, addr);
        }
        var state_province_zip = [];
        if(addr.state_province) {
            state_province_zip.push(addr.state_province);
        }
        if(addr.zip_postal_code) {
            state_province_zip.push(addr.zip_postal_code);
        }
        
        if(state_province_zip.length > 0) {
            label.write(state_province_zip.join(', '));
        }
        
        if(!addr.country && !local) {
            fail("Address is missing a country", line, addr);
        }

        if(addr.country && !local) {
            label.write(addr.country);
        }

    } catch(e) {
        fail(e, line, addr);
    }
    return true;
}

// find size if a size file was specified
// and add size to perk name
function findSize(person, callback) {

    if(!argv.sizeFile) {
        return callback(null, person);
    }

    var defaultSize = (argv.defaultSize || 'medium').toLowerCase();

    parseIndiegogo(argv.sizeFile, function(err, line, sperson, next) {
        var size;
        if(err) return callback(err);

        if(sperson.pledge_id == person.pledge_id) {
            size = (sperson.size || defaultSize).toLowerCase();

            if(argv.size && argv.size != size) {
                return callback();
            }
            person.perk += ' ' + size;
            return callback(null, person)
        }
        next();
    }, function() {
        person.perk += ' ' + defaultSize;
        callback(null, person);
    });
}

// verify address using easyPosst API
function verifyAddress(address, callback) {
    if(!easypost) {
        return;
    }
    easypost.Address.create(address, function(err, address) {
        fromAddress.verify(function(err, response) {
            if (err) {
                callback('Address is invalid: ' + util.inspect(address));
            } else if (response.message !== undefined && response.message !== null) {
                callback("Address: " + address + ". Is valid but has an issue: " + response.message);
            } else {
                callback(null, response);
            }
        });
    });
}


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


function arrayToHash(arr) {
    var h = {};
    var i;
    for(i=0; i < arr.length; i++) {
        h[arr[i]] = true;
    }
    return h;
}

function usage(f) {
    f = f || console.error;
    f("Usage: " + __filename + " contributions.csv [output_dir]");
}


// ==================
// End function defs
// ==================


if((argv._.length < 1)) {
    usage();
    process.exit(1);
}

if(argv.h || argv.help) {
    usage(console.log);
    process.exit(0);
}

var inFile = argv._[0];
var outDir = process.cwd();

if(argv._.length > 1) {
    outDir = argv._[1];
}

settings.allowLineBreaks = argv.b || settings.allowLineBreaks;

settings.font.size = argv.fontSize || settings.font.size;


if(argv.country) {
    settings.country = argv.country || settings.country;
    settings.countryInverseMatch = false;
} else if(argv.notCountry) {
    settings.country = argv.notCountry || settings.country;
    settings.countryInverseMatch = true;
}

if(settings.country) {
    settings.country = settings.country.replace(/\s+/, ' ');
} else {
    
}


settings.local = argv.local || settings.local;
settings.require = settings.require || [];
settings.ignore = settings.ignore || [];

if(argv.require) {
   var reqs = argv.require.split(',');
   settings.require = settings.require.concat(reqs);
}

if(argv.ignore) {
   var igns = argv.ignore.split(',');
   settings.ignore = settings.ignore.concat(igns);
}

settings.require = arrayToHash(settings.require);
settings.ignore = arrayToHash(settings.ignore);

if(easypost && argv.perk && !packages[argv.perk]) {
    console.error("The specified perk is not defined in packages.js");
    process.exit(1);
}

var numLabels = 0;


parseIndiegogo(inFile, function(err, line, person, next) {
    if(err) return fail(err, line, person);

    if(argv.perk) {
        if(!person.perk) {
            next();
            return;
        }
        if(argv.perk.toLowerCase() != person.perk.toLowerCase()) {
            next();
            return;
        }
    }

    findSize(person, function(err, person) {
        if(err) return fail(err, line, person);

        // if this person was size-filtered
        if(!person) {
            next();
            return;
        }

        if(easypost && argv.perk && packages[argv.perk]) {
            console.log("Generating package label (address and postage)");

            buyShippingLabel(easypost, person, argv.perk, outDir, argv, function(err, shipment, filepath) {
                if(err) {
                    console.error(err);
                    process.exit(1);
                }
                console.log("Writing file: " + filepath);
                next();
            });

            numLabels++;
        } else {
            console.log("Generating letter label (address only)");

            var label = new Label(settings);

            if(!mailingLabel(label, line, person, settings.country, settings.countryInverseMatch, settings.local, settings.require, settings.ignore)) {
                return false;
            }

            numLabels++;
            
            var outPath = path.join(outDir, 'label'+person.pledge_id+'.png');
            
            label.saveImage(outPath, function() {
                console.log("Wrote label: " + outPath);
                next();
            });
        }

    });
}, function() {
    console.log("Successfully wrote " + numLabels + " label(s).");
});
