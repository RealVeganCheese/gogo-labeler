
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


Now print all the labels:

```
for i in *.png; do ql570 /dev/usb/lp0 n $i; done
```

