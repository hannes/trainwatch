drop table capture;
CREATE TABLE "sys"."capture" (
	"ts"       TIMESTAMP,
	"dir"      CHARACTER LARGE OBJECT,
	"mac"      CHARACTER LARGE OBJECT,
	"remoteip" CHARACTER LARGE OBJECT,
	"port"     INTEGER
);
copy into capture from '/home/hannes/trainwatch/capture.log' using delimiters '\t','\n','';
