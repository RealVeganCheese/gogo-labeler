#!/usr/bin/env nodejs

var fs = require('fs');
var path = require('path');

var argv = require('minimist')(process.argv.slice(2), {
    boolean: ['h', 'b', 'local']
});

var Label = require('./label.js');
var parseIndiegogo = require('./parse_indiegogo.js');

var settings = require('./settings.js');

function fail(str) {
    console.error(str);
    process.exit(1);
}


function mailingLabel(label, addr, country, inverse, local) {

    // convert "USA" / "usa" / "U.S.A." to "United States"
    if(addr.country && addr.country.match(/u\.?s\.?a\.?/i)) {
        addr.country = "United States";
    }

    if(country) {
        var r = new RegExp(country.replace(/\s+/, '\\s+'), 'i');
        if(!addr.country || (!inverse && !addr.country.match(r)) || (inverse && addr.country.match(r))) {
            return false;
        }
    }

    if(!addr.name) {
        fail("Address is missing a name");
    }
    label.write(addr.name, 'bold');
    if(!addr.address && !addr.address_2) {
        fail("Address is missing a street address");
    }
    if(addr.address) {
        label.write(addr.address);
    }
    if(addr.address_2 && (addr.address_2 != addr.address)) {
        label.write(addr.address_2);
    }
    if(!addr.city) {
        fail("Address is missing a city");
    }
    label.write(addr.city);
    if(!addr.state_province) {
        fail("Address is missing a state");
    }
    if(!addr.zip_postal_code) {
        fail("Address is missing a zip or postal code");
    }

    label.write(addr.state_province + ', ' + addr.zip_postal_code);

    if(addr.country && !local) {
        label.write(addr.country);
    }
    return true;
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
    settings.country = argv.country || settings.country;
    settings.countryInverseMatch = true;
}

settings.local = argv.local || settings.local;

parseIndiegogo(inFile, function(person) {

    var label = new Label(settings);

    if(!mailingLabel(label, person, settings.country, settings.countryInverseMatch, settings.local)) {
        return false;
    }
   
    var outPath = path.join(outDir, 'label'+person.pledge_id+'.png');

    label.saveImage(outPath, function() {
        console.log("Wrote label: " + outPath);
    });

});
