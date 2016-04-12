
var fs = require('fs');
var path = require('path');
var util = require('util');
var clone = require('clone');
var https = require('https');
var prompt = require('prompt');
var settings = require('./settings.js');
var packages = require('./packages.js');
var countryData = require('country-data');

// turn a string into a valid filename
function filenameize(str) {
    return str.replace(/[^\w\d\s\.]+/g, '').replace(/\s+/g, '_').replace(/\.+/g, '.').toLowerCase();
}

function countryNameToCode(name) {

    if(name.length == 2) { // probably already a country code
        return name;
    }

    name = name.replace(/\s+/g, ' ').toLowerCase();
    var key, country;
    for(key in countryData.countries.all) {
        country = countryData.countries.all[key];
        if(country.name.toLowerCase() == name) {
            return country.alpha2;
        }
    }
    return null;
}

function reallyBuyShippingLabel(shipment, output_dir, callback) {
    
    var rate = shipment.lowestRate(['USPS']);

    console.log(rate);

    shipment.buy({rate: rate}, function(err, shipment) {
        if(err) {
            return callback(err);
        }
        console.log("got here:", shipment);

        var filename = filenameize(shipment.to_address.name)+'-'+shipment.tracking_code+'.png';
        var filepath = path.join(output_dir, filename);
        var f = fs.createWriteStream(filepath);

        https.get(shipment.postage_label.label_url, function(resp) {
            if(resp.statusCode != 200) {
                console.error("Error: HTTP response code " + resp.statusCode);
                return;
            }
            resp.pipe(f);
            f.on('close', function() {
                callback(null, shipment, filepath);
            });
        });
    });
}


function buyShippingLabel(easypost, address, perk, output_dir, opts, callback) {
    if(typeof opts === 'function') {
        callback = opts;
        opts = {};
    }

    if(!packages[perk]) {
        return callback("No package defined for this perk. Check packages.js");
    }

    var pack = clone(packages[perk]);

    if(!pack.length || !pack.width || !pack.height || !pack.weight) {
        return callback("Package must have the fields: length, width, height and weight");
    }

    var country_code = countryNameToCode(address.country);
    if(!country_code) {
        return callback("Could not find country code for country: " + address.country);
    }

    var toAddress = {
        name: address.name,
        street1: address.address,
        street2: address.address_2,
        city: address.city,
        state: address.state_province,
        zip: address.zip_postal_code,
        country: country_code
    };

    if(!pack.items) {
        pack.items = [];
    }

    var i, item;
    for(i=0; i < pack.items.length; i++) {
        item = pack.items[i];

        if(!item.description || !item.hs_tariff_number || !item.origin_country || !item.value || !item.weight) {
            if(opts.local) {
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

    var customsInfo = clone(settings.customsInfo);
    customsInfo.customs_items = pack.items;

    easypost.Shipment.create({
        to_address: toAddress,
        from_address: settings.fromAddress,
        parcel: parcel,
        customs_info: customsInfo
    }, function(err, shipment) {
        if(err) {
            return callback(err);
        }

        buyOpts = {rate: shipment.lowestRate(['USPS'])};

        if(!opts.reallyPayMoney) {
            // We're just testing so don't show a warning
            console.log("Test mode: Not actually spending any money!");
            reallyBuyShippingLabel(shipment, output_dir, callback);
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
            
            if(toAddress.country != 'US') {
                var i;
                if(pack.items.length > 0) {
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

                if(err || (!hasValue(result, 'y'))) {
                    console.error("Aborted by user.");
                    process.exit(1);
                }
                reallyBuyShippingLabel(shipment, output_dir, callback);
            });
        }
    });
}


module.exports = buyShippingLabel;
