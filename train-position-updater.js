var zmq     = require('zmq');
var zlib    = require('zlib');
var xml2js  = require('xml2js');
var monetdb = require('monetdb');

var conn = monetdb.connect({dbname : 'trainwatch'} , function(err) {
	if (err) console.warn(err);
});

var bbox = [4.904793, 52.372271, 4.930092, 52.378978];
traindest = {};

var vid = zmq.socket('sub');
vid.on('message', function (topic, data) {
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
			if (!result.ArrayOfTreinLocation.TreinLocation) {
				console.log('skipping unreadable message');
				return;
			}
	    	result.ArrayOfTreinLocation.TreinLocation.forEach(function(t) {
	    		var treinnr = t.TreinNummer[0]._;
	    		var tt = t.TreinMaterieelDelen[0];
	    		var tsl = parseInt(tt.MaterieelDeelNummer[ 0 ]);
	    		var lat = parseFloat(tt.Latitude[0]);
	    		var lng = parseFloat(tt.Longitude[0]);
	    		var ts = tt.GpsDatumTijd[0];

	    		if (lat < bbox[1] || lat > bbox[3] || lng < bbox[0] || lng > bbox[2]) {
	    			return;
	    		}
	    		var dest = traindest[treinnr];
	    		if (!dest) {
	    			console.log('no destination for train ', treinnr);
	    			return;
	    		}
				conn.query('INSERT INTO trains VALUES(now(), ?, ?, ?, ?, ?)', 
					[treinnr, dest, lat, lng, tsl], function(err, res) {
					console.log(treinnr, ts,  lat, lng, dest);
					if (err) console.log(err);
				});
	    	});
		});
	});
});
vid.connect('tcp://vid.openov.nl:6701');
vid.subscribe('/TreinLocatieService/AllTreinLocaties');


var dvs = zmq.socket('sub');
dvs.on('message', function (topic, data) {
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
			var trein = result['ns0:PutReisInformatieBoodschapIn']['ns1:ReisInformatieProductDVS'][0]['ns1:DynamischeVertrekStaat'][0]['ns1:Trein'][0];
			var treinnr = trein['ns1:TreinNummer'][0];
			var ic = trein['ns1:TreinSoort'][0]['$']['Code'];
			if (ic != 'IC') {
				return;
			}
			var best = trein['ns1:TreinEindBestemming'][0]['ns1:MiddelNaam'][0];
			traindest[treinnr] = best;
		});
	});
});
dvs.connect('tcp://do.u0d.de:7660');
dvs.subscribe('/RIG/InfoPlusDVSInterface');
