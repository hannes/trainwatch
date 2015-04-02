var zmq    = require('zmq');
var zlib   = require('zlib');
var xml2js = require('xml2js');
var lru    = require('lru-cache');
var request    = require('request');
var monetdb = require('monetdb');

var conn = monetdb.connect({dbname : 'trainwatch', debug: false} , function(err) {
	if (!err) console.log('connected');
});

var subscriber = zmq.socket('sub');
var bbox = [4.904793, 52.372271, 4.930092, 52.378978];
var trainresolv = lru({max: 100});

function finish(treinnr, ts, lat, lng, dest) {
	if (dest == undefined) {
		// means is no IC
		return;
	}
	conn.query('INSERT INTO trains VALUES(now(), ?, ?, ?, ?)', 
    	[treinnr, dest, lat, lng], function(err, res) {
    	console.log(treinnr, ts,  lat, lng, dest);
	    if (err) console.log(err);
	});
}

subscriber.on('message', function (topic, data) {
	zlib.gunzip(data, function(err, xml) {
	   	if (err) {
	   		consle.log(err);
	   		return;
	   	}
	   	xml2js.parseString(xml, function (err, result) {
	   		if (err) {
		   		console.log(err);
		   		return;
		   	}
	    	result.ArrayOfTreinLocation.TreinLocation.forEach(function(t) {
	    		var treinnr = t.TreinNummer[0]._;
	    		var tt = t.TreinMaterieelDelen[0];
	    		var lat = parseFloat(tt.Latitude[0]);
	    		var lng = parseFloat(tt.Longitude[0]);
	    		var ts = tt.GpsDatumTijd[0];

	    		if (lat < bbox[1] || lat > bbox[3] || lng < bbox[0] || lng > bbox[2]) {
	    			return;
	    		}
    			if (trainresolv.has(treinnr)) {
    				finish(treinnr, ts, lat, lng, trainresolv.get(treinnr));
    			} else {
    				// some ghetto programming
    				request('http://www.ovradar.nl/api1/meta/IFF%7CIC%7C' + 
    					treinnr + '%7C0%7C' + new Date().toJSON().slice(0,10), function (error, response, body) {
						if (error) {
							console.log(error);
							return;
						}
						var rdata = JSON.parse(body);
						trainresolv.set(treinnr, rdata.destname);
						finish(treinnr, ts, lat, lng, trainresolv.get(treinnr));
					});
    			}
	    	});
		});
	});
})

subscriber.connect('tcp://vid.openov.nl:6701');
subscriber.subscribe('/TreinLocatieService/AllTreinLocaties');