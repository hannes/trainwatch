#!/bin/bash
for i in *.png ; do 
	out=../public/apps/$i
	if [ ! -f $out ]; then 
		echo `basename $i`
		convert -trim $i tmp-$i
		convert tmp-$i transparency.mask -compose CopyOpacity -composite PNG32:tmp-$i
		convert tmp-$i -resize 200 $out
		rm tmp-$i
	fi 
done
