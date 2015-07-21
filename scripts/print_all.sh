#!/bin/sh

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <dir_with_png_labels>"
  echo "Rememeber to edit this script to set correct printer name"
  exit 1
fi

# To list printers:
# lpstat -p -D

PRINTER="Zebra-ZP-500-Plus"

mkdir -p ${1}/printed

for file in ${1}/*.png
do
  echo "Printing ${1}"
  lpr -P $PRINTER -o page-left=0 -o page-right=0 -o page-top=0 -o page-bottom=0 $file
  mv $file ${1}/printed/
done
