#!/usr/bin/env nodejs

var fs = require('fs');
var path = require('path');
var util = require('util');

var argv = require('minimist')(process.argv.slice(2), {
    boolean: ['h', 'b', 'local']
});

var Label = require('./label.js');
var parseIndiegogo = require('./parse_indiegogo.js');

var settings = require('./settings.js');

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
            require.state = true;
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

settings.font.size = argv.size || settings.font.size;


if(argv.country) {
    settings.country = argv.country || settings.country;
    settings.countryInverseMatch = false;
} else if(argv.notCountry) {
    settings.country = argv.notCountry || settings.country;
    settings.countryInverseMatch = true;
}
settings.country = settings.country.replace(/\s+/, ' ');


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

var numLabels = 0;

parseIndiegogo(inFile, function(err, line, person) {
    if(err) {
        fail(err, line, person);
    }

    var label = new Label(settings);

    if(!mailingLabel(label, line, person, settings.country, settings.countryInverseMatch, settings.local, settings.require, settings.ignore)) {
        return false;
    }

    numLabels++;
   
    var outPath = path.join(outDir, 'label'+person.pledge_id+'.png');

    label.saveImage(outPath, function() {
        console.log("Wrote label: " + outPath);
    });

}, function() {
    console.log("Successfully wrote " + numLabels + " labels.");
});
