#!/bin/sh
curl "https://code.wireshark.org/review/gitweb?p=wireshark.git;a=blob_plain;f=manuf" | \
grep "^[0-9A-F][0-9A-F]:[0-9A-F][0-9A-F]:[0-9A-F][0-9A-F]\t" | \
sed 's/ *#.*//' > mvs.tsv 
