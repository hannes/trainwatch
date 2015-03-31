var app = require('http').createServer(function (req, res) {
  file.serve(req, res);
}),
  io = require('socket.io').listen(app),
  fs = require('fs'),
  es =  require('event-stream'),
  lru = require("lru-cache"), 
  dns = require('dns'), 
  static = require('node-static'), 
  monetdb = require('monetdb');

var file = new static.Server(__dirname + '/public');

var conn = monetdb.connect({host : '10.0.0.220', dbname: 'trainwatch'} , function(err) {
    if (err) console.log('connection failed' + err);
});

app.listen(8000);


var lastmsgs = [];
var lastmsgsn = 1000;

function emit(sockets, msg) {
  while (lastmsgs.length > lastmsgsn) {
    lastmsgs.shift();
  }
  sockets.forEach(function(socket){
      socket.emit('notification', msg);
  });
  msg.replayed = true;
  lastmsgs.push(msg);
}


// blast that stuff to web sockets
var sockets = [];
io.sockets.on('connection', function(socket) {
  for (msgi in lastmsgs) {
    var msg = lastmsgs[msgi];
    socket.emit('notification', msg);
  }
  sockets.push(socket);
});

var macvendors = {};

var mvss = fs.createReadStream(__dirname + "/mvs.tsv");
mvss.pipe(es.split('\n')).pipe(es.mapSync(function(data) {
  var fields = data.split('\t');
  if (fields.length < 2) return;
  // make vendor names slightly prettier
  macvendors[fields[0]] = fields[1].split("#")[0].trim();
}));

function gv(mac) {
  var macprefix = mac.substring(0,8).toUpperCase();
  if (macprefix in macvendors) {
    return macvendors[macprefix];
  }
  return '';
}

var ipresolv = lru({max: 1000});

var mappings = {
  'Instagram'   : /^instagram\..*\.facebook\.com$|^instagram-shv.*\.fbcdn\.net$/,
  'Messenger'   : /^mqtt-shv-.*\.facebook\.com$/,
  'Facebook'    : /^.*\.(facebook\.com|fbcdn\.net)$/,
  'CandyCrush'  : /^mobilecrush\.king\.com$/,
  'Outlook'     : /^.*\.(hotmail.com|.*\.mail\.live\.com|a-msedge\.net)$/,
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
  'google'      : /^.*\.(1e100\.net|google\.com)$/,
  'yahoo'       : /^.*\.yahoo\.com$/

};

function gm(tld) {
  for (var app in mappings) {
      var regex = mappings[app];
      if (regex.test(tld)) {
        return app;
      }
    }
  return '';
}

var dblookup = lru({max: 1000});


mvss.on('end', function() { // only start reading stdin once the mappings have been loaded
process.stdin.pipe(es.split('\n')).pipe(es.mapSync(function(data) {
  var fields = data.split('\t');
  if (fields.length < 2) return;

  var obs = {
    type : 'packet',
    macaddr: fields[2],
    ipaddr: fields[3],
    vendor: gv(fields[2]),
    timestamp: new Date(Date.parse(fields[0])).toISOString()
  }

  var orgmac = obs.macaddr;
// anonymize macs
  obs.macaddr = obs.macaddr.substring(0,5) + ':--:--:' + obs.macaddr.substring(12);

  if (/^(10|192\.168)\./.test(obs.ipaddr)) return; // ignore local ips
  // this pushes out the activity
  emit(sockets, obs);

  // do some resolver games
  if (!ipresolv.has(obs.ipaddr)) {
    try { 
      dns.reverse(obs.ipaddr, function(err, hostnames) {
          var hostname = '';
          var app = '';
          if (!err && hostnames != undefined) {
            hostname = hostnames[0];
            app = gm(hostname);
          } else {
            app = gm(obs.ipaddr);
          }
          var rese = {type: 'resolve', ip: obs.ipaddr, hostname:hostname, app:app};
          ipresolv.set(obs.ipaddr, rese);
          emit(sockets, rese);
        });
    } catch (err) {
      console.log("dns resolve error", err); 
      ipresolv.set(obs.ipaddr, {type: 'resolve', ip: obs.ipaddr, hostname:'', app:''});
    }
  } else {
    emit(sockets, ipresolv.get(obs.ipaddr));
  }

  // check history
  if (!dblookup.has(orgmac)) {
    // SQL heaven, get only first ts of each burst, needs dummy first ts
    conn.query('WITH obs AS (SELECT CAST (\'1970-01-01\' AS timestamp) AS ts, 0 AS id UNION ALL SELECT ts, ROW_NUMBER() OVER () AS id FROM capture WHERE mac=? ), diffs AS (SELECT c1.ts, (c1.ts-c2.ts)/1000 AS tdiff FROM obs AS c1 JOIN obs AS c2 ON (c1.id = c2.id + 1)) SELECT ts FROM diffs WHERE tdiff > 600 ORDER BY ts DESC;', 
    [orgmac], function(err, res) {
      if (err) {
        console.warn(err);
        return;
      }
      if (res.rows < 1) {
        return;
      }
      var hist = {
        type: 'history',
        macaddr: obs.macaddr,
        timestamps: []
      }
      res.data.forEach(function(ts) {
        hist.timestamps.push(new Date(Date.parse(ts)).toISOString());
      })
      emit(sockets, hist);
    });

    dblookup.set(orgmac, true);
  }
}));
});
