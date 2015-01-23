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

var settings = require('./settings.js');
var packages = require('./packages.js');

var easypost = null;

if(!argv.labelOnly) {
    if(argv.reallyPayMoney) {
        easypost = require('node-easypost')(settings.easypost.apiKey);
    } else {
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

function reallyBuyShippingLabel(shipment, callback) {
    
    // TODO make this function actually work

    shipment.buy({rate: shipment.lowestRate(['USPS'])}, function(err, shipment) {
        console.log(shipment.tracking_code);
        console.log(shipment.postage_label.label_url);

        var filename = "postage.png";
        var f = fs.createWriteStream(filename);

        http.get(shipment.postage_label.label_url, function(resp) {
            if(resp.statusCode != 200) {
                console.error("Error: HTTP response code " + resp.statusCode);
                return;
            }
            resp.pipe(f);
            console.log("Writing: " + filename);
        });
    });

}

function buyShippingLabel(address, perk, callback) {

    // TODO convert address from indiegogo format to easypost format
    // this involves converting the country from the country name
    // to the two-letter country code

    if(!packages[perk]) {
        return callback("No package defined for this perk. Check packages.js");
    }

    var pack = clone(packages[perk]);


    if(!pack.length || !pack.width || !pack.height || !pack.weight) {
        return callback("Package must have the fields: length, width, height and weight");
    }
    

    if(!pack.items) {
        pack.items = [];
    }

    var i, item;
    for(i=0; i < pack.items.length; i++) {
        item = pack.items[i];

        if(!item.description || !item.hs_tariff_number || !item.origin_country || !item.value || !item.weight) {
            if(!argv.local) {
                return callback("Internationally shipped items must have the following fields: description, hs_tariff_number, origin_country, value and weight");
            }
        }

        if(!item.quantity) {
            item.quantity = 1;
        }
        item.value = item.quantity * item.value;
        item.weight = item.quantity * item.weight;
    }

    var parcel = {
        length: pack.length,
        width: pack.width,
        height: pack.height,
        weight: pack.weight
    };

    var customsInfo = {    
        // TODO construct this
    };

    easypost.Shipment.create({
        to_address: toAddress,
        from_address: fromAddress,
        parcel: parcel,
        customs_info: customsInfo
    }, function(err, shipment) {
        if(err) {
            return callback(err);
        }
        
        buyOpts = {rate: shipment.lowestRate(['USPS'])};

        if(!argv.reallyPayMoney) {
            // We're just testing so don't show a warning
            reallyBuyShippingLabel(buyOpts);

        } else {
            console.log("");
            console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
            console.log("!!                                    !!");
            console.log("!!             WARNING!               !!");
            console.log("!!  You are about to pay REAL MONEY!  !!");
            console.log("!!                                    !!");
            console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
            console.log("");
            
            console.log("Package info:");
            console.log("  Weight: " + pack.weight);
            console.log("  Ship to country: " + address.country);
            
            if(address.country != 'US') {
                var i;
                if(items.length > 0) {
                    console.log("  Customs information:");
                }
                for(i=0; i < pack.items.length; i++) {
                    item = pack.items[i];
                    console.log("    Item " + (i+1) + ":");
                    console.log("      Description: " + item.description);
                    console.log("      Product harmonization code: " + item.hs_tariff_number);
                    console.log("      Origin country: " + item.origin_country);
                    console.log("      Value: $" + item.value);
                    console.log("      Weight: " + item.weight + " oz");
                }
            }
            console.log(" ");
            
            var promptText = "Press the letter y and hit enter to pay the postage for the package listed above.";
            
            if(address.country != 'US') {
                promptText = "Press the letter y and hit enter to pay the postage for the package listed above and to certify that the above customs information is correct. This takes the place of a signature (y/N)";   
            }
            
            prompt.start();
            prompt.get([promptText], function(err, result) {
                
                if(err || (result !== 'y')) {
                    console.error("Aborted by user.");
                    process.exit(1);
                }
                
                reallyBuyShippingLabel(buyOpts);
            });
        }
    });
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

    if(easypost && packages[argv.perk]) {
        console.log("Generating package label (address and postage)");

        

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
        });
    }

}, function() {
    console.log("Successfully wrote " + numLabels + " labels.");
});
