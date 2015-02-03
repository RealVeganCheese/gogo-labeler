
WARNING: Use the version tagged with v0.0.2 for now. This version is broken. I am working to implement buying package shipping labels using easypost. This is a work in progress.

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

# Printing package shipping labels

PLEASE NOTE: Printing packages shipping labels (that include postage) is currently limited to the United States.


# Printing pre-paid shipping labels

## Setting up printer

Add the printer using the printer settings. Use the Zebra ZPL Label Printer driver (assuming your printer has a model number starting with ZP). Make sure to set the Resolution to 203dpi, the Media Size to the 4.00x6.00" and the Media Tracking to the correct setting (probably Non-continuous (Web sensing)).

You'll probably want to lower the printing speed to the lowest setting to ensure that the barcodes are nice and legible.

For the Zebra ZPL 500 Plus printer there are two ways to route the label-paper through the printer. The simple straight-through way will not automatically peel the labels off the label-paper, and will require that Print Mode is set to Peel-Off. The slightly more complicated routing which is shown on the instructions on the printer will automatically peel the labels and will require that the Print Mode is set to Tear-Off.

## Printing from the command line

```
lpstat -p -D
```

You will see a line like:

```
printer Zebra-ZP-500-Plus is idle.  enabled since Thu 29 Jan 2015 05:16:39 PM PST
```

Now print using:

```
lpr -P PRINTER_NAME -o page-left=0 -o page-right=0 -o page-top=0 -o page-bottom=0 FILENAME.png
```

E.g:

```
lpr -P Zebra-ZP-500-Plus -o page-left=0 -o page-right=0 -o page-top=0 -o page-bottom=0 label.png
```

# Troubleshooting

If you get the error:

```
Error: Too many lines. Text does not fit on label.
```

Then try lowering the font.size or font.lineSpacing in settings.js