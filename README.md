
Command line utility that parses the CSV output from indiegogo and creates printable shipping labels for perk fulfillment. It is meant to be used with the Brother QL570 printer and the [ql570](https://github.com/sudomesh/ql570) print utility to print shipping labels (the narrow 29 mm label type).

This software is in an early (but working) state. Improvements welcome!

# Requirements

```
sudo nodejs apt-get install libcairo2-dev libjpeg8-dev libpango1.0-dev libgif-dev build-essential g++

npm install
```

# Setup

```
cp settings.js.example settings.js
```

You may want to tweak the settings, but try the defaults first. 

# Example usage

Export the relevant CSV from indiegogo to contributions.csv and run:

```
mkdir labels
./index.js --country "united states" --local contributions.csv labels/
```

This will create a bunch of .png files in the labels/ directory. If you don't like how they look, or if you get errors having to do with the text being too long or there being too many lines, then you can tweak the settings.js file. Specifically the font size, lineSpacing and padding are worth a look.

The --country "united states" argument means every shipping address outside of the U.S. is ignored. You can also use --notCountry to do the opposite. The --local argument means that the country is not included on the label.

Example using notCountry:

```
./index.js --notCountry "united states" contributions.csv labels/
```

# Specifying required fields

By default, the following fields are required:

* name
* address (or address_2)
* city
* zip_postal_code
* country

If --local is specified, then country is not included on the label and does not have to be specified. If the --country is "United States" then state_province is also required.

To change the defaults, use --require to add more required fields:

```
./index.js --country "mexico" --require state_province,address_2 contributions.csv labels/
```

You can prevent fields from being required using --ignore:

```
./index.js --country "singapore" --ignore city contributions.csv labels/
```

# Printing the labels

Make sure the ql570 command is in your PATH and do:

```
cd labels/
for i in *.png; do ql570 /dev/usb/lp0 n $i; done
```

# Troubleshooting

If you get the error:

```
Error: Too many lines. Text does not fit on label.
```

Then try lowering the font.size or font.lineSpacing in settings.js