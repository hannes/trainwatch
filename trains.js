var request = require('request');
var monetdb = require('monetdb');

 
var conn = monetdb.connect({dbname : 'trainwatch', debug: false} , function(err) {
    if (!err) console.log('connected');
});

// create table trains(ts timestamp, ref string, label string, latitude double, longitude double);
var traincb = 'http://kubus.mailspool.nl/spoorkaart/?op=trains&bbox=4.904793%2C52.372271%2C4.930092%2C52.378978';

setInterval( function() {
		console.log(new Date());

request(traincb, function (error, response, body) {
  if (!error && response.statusCode == 200) {
  	var j = JSON.parse(body);
  	j.features.forEach(function(t) {
//  		console.log(t.properties);
//  		console.log(t.geometry.coordinates);
  		conn.query('INSERT INTO trains VALUES(now(), ?,?,?,?)', 
    [t.properties.label, t.properties.ref, parseFloat(t.geometry.coordinates[1]),  parseFloat(t.geometry.coordinates[0])], function(err, res) {
    if (err) console.log(err);
});
  	}) ;
  }
})}
, 15000);



