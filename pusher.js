var app = require('http').createServer(function (req, res) {
  file.serve(req, res);
}),
  io = require('socket.io').listen(app),
  fs = require('fs'),
  es =  require('event-stream'),
  lru = require("lru-cache"), 
  dns = require('dns'), 
  static = require('node-static');

var file = new static.Server('./public');

app.listen(8000);

// blast that stuff to web sockets
var sockets = [];
io.sockets.on('connection', function(socket) {
      sockets.push(socket);
});

var macvendors = {};

var mvss = fs.createReadStream("mvs.tsv");
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
  'google'      : /^.*\.1e100\.net$/
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

// anonymize macs
  obs.macaddr = obs.macaddr.substring(0,5) + ':--:--:' + obs.macaddr.substring(12);

  if (/^(10|192\.168)\./.test(obs.ipaddr)) return; // ignore local ips
  sockets.forEach(function(socket){
    socket.volatile.emit('notification', obs);
  });
  if (!ipresolv.has(obs.ipaddr)) {
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
        sockets.forEach(function(socket){
          socket.volatile.emit('notification', rese);
        });
      });
  }
}));
});
