drop table capture;
CREATE TABLE "sys"."capture" (
	"ts"       TIMESTAMP,
	"dir"      CHARACTER LARGE OBJECT,
	"mac"      CHARACTER LARGE OBJECT,
	"remoteip" CHARACTER LARGE OBJECT,
	"port"     INTEGER
);
copy into capture from '/home/hannes/trainwatch/capture.log' using delimiters '\t','\n','';



drop table raw;
create table raw (
ts timestamp, ip1 string, mac1 string, port1 int, ip2 string, mac2 string, port2 int, bssid string
);

copy into raw from '/home/hannes/trainwatch/capture.raw' using delimiters '\t','\n','';


drop view trainbssidmapping;

create view trainbssidmapping as select tsnr, bssid, count(*) as instances from (
	select tsnr, bssid, unpos.midts from (
		select tsnr, ts5min, cast(avg(tss) as integer) as midts from (
			select *, tss/300 as ts5min from (
				select tsnr, (ts-cast('1970-01-01' as timestamp))/1000 as tss from trains 
					where tsnr is not null 
					and latitude between 52.373714 and 52.378953 
					and longitude between 4.909802 and 4.922892) as rawpos)
			as pos5min group by tsnr, ts5min) as unpos 
		join (
			select bssid, ts5min, cast(avg(tss) as integer) as midts from (
				select *, tss/300 as ts5min from (
					select bssid, (ts-cast('1970-01-01' as timestamp))/1000 as tss from raw) as rawbss) 
				as bss5min group by bssid, ts5min) as unbss 
			using (ts5min)) as obspairs 
	group by tsnr, bssid having count(*) > 5;
-- TODO: do instance grouping based on distance first!

