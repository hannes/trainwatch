#!/usr/bin/python -u

import time
import sys
import random

for line in sys.stdin:
	print line,
	time.sleep(random.random()/50.0)
