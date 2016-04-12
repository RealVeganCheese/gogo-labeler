#!/usr/bin/env nodejs

var async = require('async');
var fs = require('fs');
var http = require('http');
var path = require('path');
var util = require('util');
var clone = require('clone');
var prompt = require('prompt');


var argv = require('minimist')(process.argv.slice(2), {
    boolean: ['h', 'b', 'reallyPayMoney']
});

var parse = require('./parse_arbitrary.js');

var buyShippingLabel = require('./buyShippingLabel.js');

var Label = require('./label.js');

var settings = require('./settings.js');
var packages = require('./packages.js');

var inFile = argv._[0];
var perk = argv.perk;

function usage() {
    console.log('');
    console.log('Usage: ./shipper.js --perk "T-shirt" --out labels/ addresses.csv');
    console.log('');
    console.log('  Where the named perk is defined in packages.js');
    console.log('  and --out specifies the dir wherein to store the shipping labels.');
    console.log('');
}

if(!perk || !inFile || !argv.out) {
    usage();
    process.exit(1);
}

if(!packages[perk]) {
    console.log("The perk '" + perk + "' has not been specified in the packages.js file");
    process.exit(1);
}


var easypost = null;

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


var first = true;

var toAddress = {
    name: "Name",
    address: "Street address 1",
    address_2: "Street address 2",
    city: "City",
    state_province: "State or province",
    zip_postal_code: "zip or postal code",
    country: "country name or code (e.g. United States or US)"
};

function prettyPrintAddress(address) {
    var key;
    for(key in address) {
        console.log("  " + key + ": " + address[key]);
    }
}

function pickMapping(field, cb) {
    var promptText = "Enter the number from the list above that you want to map to the field [" + field + "] (enter to skip)";

    var key;
    var i = 0;
    for(key in toAddress) {
        console.log(i + ': ' + toAddress[key]);
        i++;
    }

    prompt.start();
    prompt.get([promptText], function(err, result) {

        if(!result || err) {
            return cb("Aborted by user.");
        }

        var val = result[Object.keys(result)[0]];

        if(val === '') { // user pressed enter without entering anything
            return cb(null, null); 
        }
        val = parseInt(val);

        if(typeof val !== 'number' || isNaN(val) || val < 0 || val >= i) {
            console.log("\n------------------------------------");
            console.log("INVALID CHOICE. Try again...");
            console.log("------------------------------------\n");
            pickMapping(field, cb);
            return;
        }

        var keys = Object.keys(toAddress);

        cb(null, keys[val]);
    });
    
}

// remap address according to mapping
function remap(mapping, address) {
    var out = {};
    var key, val, i;
    for(key in mapping) {
        out[key] = '';
        for(i=0; i < mapping[key].length; i++) {
            val = address[mapping[key][i]];
            if(val && val.length) {
                out[key] += val;
                if(i < mapping[key].length - 1) {
                    out[key] += ' ';    
                }
            }
        }
    }
    return out;
}

var keys;
var mapping = {};
parse(inFile, function(err, line, person, next) {
    if(err) {
        console.error("Error:", err);
        process.exit(1);
    }
    if(Object.keys(person).length <= 0) {
        next();
        return;
    }

    if(first) {
        keys = Object.keys(person);

        async.eachSeries(keys, function(k, cb) {
            pickMapping(k, function(err, choice) {
                if(err) {
                    console.error(err);
                    process.exit(1);       
                }

                if(choice === null) return cb();

                if(mapping[choice]) {
                    mapping[choice].push(k);
                } else {
                    mapping[choice] = [k];
                }
                cb();
            });
            
        }, function(err) {
            if(err) {
                console.error(err);
                process.exit(1);       
            }

            console.log("\n----------------------------");
            console.log("You have defined the mapping:\n");

            var key;
            for(key in mapping) {
                console.log("  "+key+": "+mapping[key].join(' + '));
            }


            console.log("\nIf this is not correct press ctrl-c to abort and try again");
            console.log("----------------------------\n");


            first = false;
            next();     
        });
        return;
    }

    var address = remap(mapping, person);;

    console.log("Generating shipping label for: ")
    console.log("");
    prettyPrintAddress(address);
    console.log("");

    buyShippingLabel(easypost, address, perk, argv.out, argv, function(err, shipment, filepath) {
        if(err) {
            console.error("Error:", err);
            process.exit(1);
        }
        
        console.log("Saving shipping label to:", filepath);

        console.log(address);
        process.exit(0)
        next();
    });

}, function() {
    console.log("DONE!");
});
