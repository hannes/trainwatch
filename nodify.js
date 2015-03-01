var es =  require('event-stream');
var dns = require('dns');
var fs =  require('fs');
var lru = require("lru-cache")

var lastobs = lru({max: 1000});
var lastint = lru({max: 1000});
var iptoapp = lru({max: 1000});

// awk -F "\t" 'OFS="\t"{count[$4]++}END{for(j in count) if (count[j] > 2) print j,count[j]}'  | sort -t $'\t' -n -k 2 -r
// {dd <- read.table("capture.log", sep="\t", quote=NULL, header=F, stringsAsFactors=F, col.names=c("time","dir","mac","remoteip","port","domain")); dd$timep <- strptime(dd$time, format="%b %d, %Y %H:%M:%OS"); hist(dd$timep, "hours")}

var mappings = {
	'Instagram'   : /^instagram\..*\.facebook\.com$|^instagram-shv.*\.fbcdn\.net$/,
	'Facebook Messenger' : /^mqtt-shv-.*\.facebook\.com$/,
	'Facebook'    : /^.*\.(facebook\.com|fbcdn\.net)$/,
	'Candy Crush' : /^mobilecrush\.king\.com$/,
	'Outlook.com' : /^.*\.(hotmail.com|.*\.mail\.live\.com|a-msedge\.net)$/,
	'Marktplaats' : /^.*\.marktplaats\.(com|nl)$/,
	'Dropbox'     : /^.*\.dropbox\.com$/,
	'Netflix'     : /^.*\.nflxvideo\.net$/,
	'Spotify'     : /^.*\.spotify\.com$/,
	'Buienalarm'  : /^188\.226\.199\.6$/,
	'Telegram'    : /^149\.154\.167\.91$/,
	'iCloud'      : /^(.*\.(apple|icloud|icloud-content|digitalhub)\.com|^17\..*$)$/, // class A for Apple
	'Twitter'     : /^199\.96\.57\..*$/,
	'Grepolis'    : /^.*\.gp\.innogames\.net$/,
	'Whatsapp'    : /^173\.192\.222\..*-static\.reverse\.softlayer\.com$/,
	'BullChat'    : /^(rs200435\.rs\.hosteurope\.de|rs20043\.rs\.hosteurope\.de|lvps178-77-100-159\.dedicated\.hosteurope\.de)$/,
	'NPO'         : /^.*\.omroep\.nl$/,
	'NU.nl'       : /^62-69-.*\.ptr\.as24646\.net$/,
	'__ignore'    : /^(192\.44\.68\.3|74\.217\.75\.7|93\.184\.220\.20|2\.(21|19)\..*|.*\.ztomy.com|cdn-87-248-221-254\.par\.llnw\.net|.*\.nr-data\.net|.*\.adform\.net|.*\.avast\.com|.*\.akamaitechnologies\.com|.*\.amazonaws\.com|.*\.1e100\.net|cache\.google\.com|.*\.cloudfront\.net)$/,
};

function gm(tld) {
	for (var app in mappings) {
   		var regex = mappings[app];
   		if (regex.test(tld)) {
   			return app;
   		}
   	}
 	return tld;
}

var macvendors = {};

function gv(mac) {
	var macprefix = mac.substring(0,8).toUpperCase();
	if (macprefix in macvendors) {
		return macvendors[macprefix];
	}
	return '';
}

var mvss = fs.createReadStream("mvs.tsv");
mvss.pipe(es.split('\n')).pipe(es.mapSync(function(data) {
	var fields = data.split('\t');
	if (fields.length < 2) return;
	// make vendor names slightly prettier
	macvendors[fields[0]] = fields[1].split("#")[0].trim().
	replace('SamsungE', 'Samsung').
	replace('HuaweiTe', 'Huawei').
	replace('LgElectr', 'LG').
	replace('SonyMobi', 'Sony').
	replace('HonHaiPr', 'Foxconn').
	replace('Htc'     , 'HTC').
	replace('LiteonTe', 'LiteOn').
	replace('IntelCor', 'Intel').
	replace('MurataMa', 'Murata').
	replace('AmoiElec', 'AMOI');
}));

function finish(timestamp, macaddr, app) {
	if (app == '__ignore') return;
	var intkey = macaddr + '_' + app;
	if (lastint.has(intkey)) return;
	lastint.set(intkey, true);

	console.log(timestamp + '\t' + macaddr.substring(0,4) + '...' + macaddr.substring(13) +'\t'+ gv(macaddr) +'\t' + app);
}

mvss.on('end', function() { // only start reading stdin once the mappings have been loaded
process.stdin.pipe(es.split('\n')).pipe(es.mapSync(function(data) {
	var fields = data.split('\t');
	if (fields.length < 2) return;
	var macaddr = fields[2];
	var ipaddr  = fields[3];
	var timestamp = new Date(Date.parse(fields[0])).toISOString();

	if (/^(10|192\.168)\./.test(ipaddr)) return; // ignore local ips
	var obskey = macaddr + '_' + ipaddr;
	if (lastobs.has(obskey)) return;
	lastobs.set(obskey, true);

	if (iptoapp.has(ipaddr)) {
		finish(timestamp, macaddr, iptoapp.get(ipaddr));
	} else {
		dns.reverse(ipaddr, function(err, hostnames) {
			var hostname = '';
			if (err || !hostnames) {
				hostname = ipaddr;
			} else {
				hostname = hostnames[0];
			}
			var app = gm(hostname);
			iptoapp.set(ipaddr, app);
			finish(timestamp, macaddr, app);
		});
	}
}));
});

