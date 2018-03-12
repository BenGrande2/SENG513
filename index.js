/*
	Name: Benjamin Grande
	ID: 10147040
	Tut: B01
*/

var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
app.use(require('cookie-parser')());

var users = {};
var messages = [];
var usernames = [];
var userIds = [];
var userHashes = {};
var activeUsers = [];
app.get('/css/*', function(req, res) {
	res.sendFile(__dirname +"/public"+ req.url);
});


app.get('/status', function(req, res) {
	var onlineUsers = {};
	for (var i in activeUsers) {
		onlineUsers[activeUsers[i]] = users[activeUsers[i]];
	}
	res.send({
		users: onlineUsers,
		messages: messages
	});
});

app.get('/', function(req, res){
	// Note: very insecure, as someone could easily spoof their id to someone elses.
	// Prof mentioned in lecture that we did not need to worry about security
	// User Id's simply increment like they would in a DB
	var uid = req.cookies["userID"]
	var userHash = req.cookies["userHash"];
	if (userHash == null || (uid != null && userHashes[uid] != userHash)) {
		uid = null;
		userHash = Math.random().toString(36).substring(7);
	}
	if (uid == null) {
		uid = userIds.length;
		res.cookie ("userID", uid, { maxAge: 60 * 60 * 1000 });
		res.cookie ("userHash", userHash, { maxAge: 60 * 60 * 1000 });
		userIds.push(uid);
		userHashes[uid] = userHash;
		
	}

	
	res.sendFile(__dirname + '/index.html');
});
io.on('connection', function(socket){
	var cookies = socket.handshake.headers.cookie.split("; ");
	var userID;
	var userName;
	for (var i in cookies) {
		var keyVal = cookies[i].split("=");
		if (keyVal[0] == "userID") {
			userID = keyVal[1];
			
		}
		
	}
	if (userID != null) {
		if (users[userID] != null) {
			userName = users[userID].name;
		}
	}
	
	if (userName == null) {
		var tempusername = userID;
		var count = 0;
		while (usernames.includes(tempusername)) {
			tempusername = userID+"_"+count;
			count += 1;
		}
		userName = tempusername;
	}
	
	if (users[userID] == null) {
		users[userID] = {
			'name': userName,
			"uid": userID,
			"sid": socket.id,
		}
	}
	usernames.push(users[userID]["name"]);
	activeUsers.push(userID);
	io.emit('user-joined', {
		sid: socket.id,
		uid: userID,
		name: users[userID].name
	});
	socket.on('send-nickname', function(nickname) {
		if (usernames.includes(nickname) && nickname != users[userID]["name"]) {
			return socket.emit("nickname-change-error", "Fail: User with nickname: "+nickname+" already exists.");
		}
		var ind = usernames.indexOf(users[userID]["name"]);
		if (ind > 0) {
			usernames.splice(ind, 1);
		}
		
		var event = 'user-renamed';
		var data = {
			name: nickname,
			uid: userID,
			sid: socket.id
		};
		if (users[userID] == null) {
			event = 'user-joined'
			users[userID] = {};
		}
		else {
			data["oldname"] = users[userID]["name"];
		}
		users[userID]['name'] = nickname;
		io.emit(event, data);	
	});
	socket.on('disconnect', function() {
		var ind = activeUsers.indexOf(userID);
		if (ind > 0) {
			activeUsers.splice(ind, 1);
		}
		
		if (users[userID] != null) {
			io.emit('user-left', {
				sid: socket.id,
				uid: userID,
				name: users[userID]["name"]
			});
			
		}
		
	});
	socket.on('chat message', function(msg) {
		var color = "-webkit-linear-gradient(#f5f5f5 0%, #dedede 100%)";
		msg['sid'] = socket.id;
		msg['sender'] = users[userID]['name'];
		msg["uid"] = userID;
		msg["time"] = (new Date).getTime();
		if (users[msg.uid]["color"] != null) {
			msg['color'] = users[userID]["color"];
		}
		messages.push(msg);
		io.emit('chat message',msg);
	});
	socket.on('change nickcolor', function(col) {
		users[userID]['color'] = col.color;
		col['sid'] = socket.id;
		col["uid"] = userID;
		io.emit('change nickcolor',col);
	});
});
http.listen(3000, function(){
	console.log('listening on *:3000');
});
