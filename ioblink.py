#!/usr/bin/python -u

# Import required libraries
import RPi.GPIO as GPIO
import time
from threading import Timer
import sys
import signal


GPIO.setmode(GPIO.BCM)
#LedSeq = [4,17,22,10,9,11]
LedSeq = [22,10]

for x in range(len(LedSeq)):
	GPIO.setup(LedSeq[x], GPIO.OUT)
	GPIO.output(LedSeq[x], False)

def switchoff():
	for x in range(len(LedSeq)):
		GPIO.output(LedSeq[x], False)

def cleanup(a, b):
	GPIO.cleanup()    
	sys.exit(0)
signal.signal(signal.SIGINT, cleanup)

for line in sys.stdin:
    print line
    for x in range(len(LedSeq)):
		GPIO.output(LedSeq[x], True)
    Timer(0.1, switchoff).start()

time.sleep(1)
cleanup(4,2)