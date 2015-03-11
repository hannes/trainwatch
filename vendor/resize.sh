#!/bin/bash
for i in *.png ; do 
	out=../public/vendor/$i
	if [ ! -f $out ]; then 
		echo $i; convert $i -resize 200 $out ; 
	fi 
done
