#!/bin/bash
sudo airmon-ng stop mon0
sudo airmon-ng stop mon1
sleep 1

sudo airmon-ng start wlan1 1
sudo airmon-ng start wlan2 11
DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
sudo tshark -Q -i mon0 -i mon1 -2 -R "tcp.srcport == 433 or tcp.dstport == 443 or tcp.srcport==80 or tcp.dstport==80" -T fields -Eseparator=/t -e frame.time -e ip.src -e wlan.sa -e tcp.srcport -e ip.dst -e wlan.da -e tcp.dstport -l | \
awk -F"\t" '{OFS="\t"}{if ($2 ~ /^10./) print $1, "out", $3, $5, $7, $8; else print $1, "in", $6,  $2, $4, $8} {system("")}' >> $DIR/capture.log
