/*
- Complete all DO ME
- Check how to use TURN server
- Create a DB for logging ? 
- Record timestamp
- Disconnect user when user leave 
- Client leave didnt destroy room - issue - remove feed not working 
# Logging 
# Fix package.json ( color and sql )
# Fix EADDRINUSE
# Fix ECONNCETREFUSED
- 
*/

/*global console*/
var yetify = require('yetify'),
    config = require('getconfig'),
    uuid = require('node-uuid'),
    crypto = require('crypto'),
    port = parseInt(process.env.PORT || config.server.port, 10),
    io = require('socket.io').listen(port),
    colors = require('color'),
	mysql = require('mysql');


if (config.logLevel) {
    // https://github.com/Automattic/socket.io/wiki/Configuring-Socket.IO
    io.set('log level', config.logLevel);
}



// Room Variables 
var room = new Array();


// Connect to DB
var db_ready = true;
/*
var db_connection  = mysql.createPool(config.database);
db_connection.getConnection(function(err, connection) {
	if (err) 
	{
		custom_log('error','Database Failed ! - ' + err.code);
		io.server.close();
		return;
	}
	db_ready = true;
	custom_log('info','Database connected !');
});
*/

function custom_log(type, message) {
	switch(type)
	{
		case 'error':
		case 'ERROR':
			console.log('ERROR'.red.bold, message);
			break;
		case 'info':
		case 'INFO':
			console.log('INFO'.green.bold,message);
			break;
		case 'debug':
		case 'DEBUG':
			console.log('DEBUG'.grey.bold,message);
			break;
		default :
			console.log('UNKNOWN'.blue.bold,message);
			break;
	}
}


function describeRoom(name) {
    var clients = io.sockets.clients(name);
    var result = {
        clients_resource: {},
        clients_name: {},
        clients_privilege: {},
    };
    clients.forEach(function (client) {
        result.clients_resource[client.id] = client.resources;
        result.clients_name[client.id] = client.name;
        result.clients_privilege[client.id] = client.privilege;
    });
    return result;
}

function safeCb(cb) {
    if (typeof cb === 'function') {
        return cb;
    } else {
        return function () {};
    }
}

io.sockets.on('connection', function (client) {
    
	// init client
	client.authenticate = false;
	client.type = false;
	client.privilege = {
		draw:true,
		chat:true
	};
	client.resources = {
		screen: false,
		video: true,
		audio: false,
	};

    // pass a message 
    client.on('message', function (details) {
						
		if (!details) return;			
						
		switch(details.to)
		{
			/*
			*	Server 
			*/
			case 'server':
				// Authentication 
				if (details.type == 'authenticate')
				{
					/*
					*  Authentication Code - DO ME
					*/
					var response, authenticate = true;
					if (authenticate == true )
					{
						client.authenticate = true;
						client.name = client.id;
						client.type = 'tutor';
						client.privilege.draw = true;
						client.privilege.chat = true;
	
						// testing
						// io.sockets.clients(client_room).length 
						var names = ['Jack','Samuel','Jeisern','Meepo']; 
						var types = ['tutor','tutor','tutor','tutor']; 
						var i = io.sockets.clients('123').length ;
						client.name = names[i];
		
						response = {
							type: 'authenticate' , 
							payload : {
								success : true, 
								response : {
									client_privilege : client.privilege, 
									client_type : client.type, 
									client_name : client.name
								}
							}
						};					
						custom_log('info', client.name + ' has successfully authenticated');
					}
					else
					{	
						response = {
							type: 'authenticate' , 
							payload : {success : false, response : 'Invalid Session ID'}
						};
						custom_log('error', client.id + ' has failed to be authenticated');
					}
					client.emit('message', response);
				}
				else if (client.authenticate !== false)
				{
					
				}
				break;
				
				
			/*
			*	Broadcasting 
			*/
			case 'broadcast': 
				if (client.authenticate === false) return;
				if ( ! client.room ) return;
				switch(details.type)
				{
					case 'privilege':
						if (client.type == 'tutor')
						{
							otherClient = io.sockets.sockets[details.payload.peer_id];

							if (!otherClient) return;
							if (otherClient.room != client.room ) return;
							
							// broadcast the changed privilege to everyone
							details.payload.type = 'privilege';
							client.broadcast.to(client.room).emit('message', details);
							var msg = '';
							switch (details.payload.privilege)
							{
								case 'chat' : 
									msg = otherClient.name + ' has been ' + ( details.payload.can ? 'unmuted': 'muted' );
									break;
								case 'draw' : 
									msg = otherClient.name + ' paintbrush has been ' + ( details.payload.can ? ('given back to ' + otherClient.name) : 'taken away');
									break;
								case 'kick' : 
									msg =  otherClient.name + ' has been kicked !';
									break;
							}
							console.log(client.room);
							io.sockets.in(client.room).emit('message', {
								type : 'chat',
								payload : msg
							});
							
							if (details.payload.privilege == 'kick' )
							{
								otherClient.disconnect();
							}
							else
							{
								otherClient.privilege[details.payload.privilege] = details.payload.can;
							}
							
						}
						break;
			
					case 'whiteboard':
						// Code for storing the drawing - DO ME
						if ( ! client.privilege.draw ) return;
						room[client.room].whiteboard.push(details);
						client.broadcast.to(client.room).emit('message', details);
						break;
					case 'chat':
						// Code for storing the chat - DO ME
						if ( ! client.privilege.chat ) return;
						if ( ! details.payload ) return;
						if (typeof details.payload !== 'string') return;
						
						details.payload = client.name + ' : ' +  details.payload;
						room[client.room].chat.push(details);
						io.sockets.in(client.room).emit('message', details);
						break;
				}
				
				break;
			
			/*
			*	Signalling 
			*/
			default:
				if (client.authenticate === false) return;
				var otherClient = io.sockets.sockets[details.to];
				if (!otherClient) return;

				details.from = client.id;
				details.name = client.name;
				details.privilege = client.privilege;
				otherClient.emit('message', details);	
				
				break;	
		}
		
		return;
		
    });

    client.on('shareScreen', function () {
		if (client.authenticate === false) return;
		
        client.resources.screen = true;
    });

    client.on('unshareScreen', function (type) {
		if (client.authenticate === false) return;
		
        client.resources.screen = false;
        removeFeed('screen');
    });

    client.on('join', join);

    function removeFeed(type) {
        if (client.room) {
            io.sockets.in(client.room).emit('remove', {
                id: client.id,
                type: type
            });
            if (!type) {
				var client_room = client.room;
                client.leave(client.room);
                client.room = undefined;
            }
			
			// remove the data if no one is in the room.
			// maybe we can store the variables in server - DO ME
			;
			if ( ! io.sockets.clients(client_room).length )
			{
				custom_log('INFO', 'room ' + client_room + ' has been destroyed')
				room[client_room] = null;
				delete room[client_room];
			}
        }
    }

    function join(name, cb) {
		if (client.authenticate === false) return;
		
        // sanity check
        if (typeof name !== 'string') return;
		
        // leave any existing rooms
        removeFeed();
        safeCb(cb)(null, describeRoom(name));
		
        client.join(name);
        client.room = name;
		
		
		// send the room's existing data to the user
		if (room[client.room])
		{
			custom_log('INFO', client.id + ' has joined room ' + client.room);
			for(var i = 0; i < room[client.room].whiteboard.length ; i ++ )
				client.emit('message', room[client.room].whiteboard[i]);
			for(var i = 0; i < room[client.room].chat.length ; i ++ )
				client.emit('message', room[client.room].chat[i]);			
		}		
		else
		{
			custom_log('INFO', client.id + ' has create room ' + client.room);
			room[client.room] = {
				whiteboard: [],
				chat: [],
			};
		}
				
    }

    // we don't want to pass "leave" directly because the
    // event type string of "socket end" gets passed too.
    client.on('disconnect', function () {
		custom_log('debug', client.id + ' has disconnected from the room ' + client.room);
		removeFeed();
    });
    client.on('leave', function () {
		custom_log('debug', client.id + ' has left the room ' + client.room);
        removeFeed();
    });

    client.on('create', function (name, cb) {
		if (client.authenticate === false) return;
		
        if (arguments.length == 2) {
            cb = (typeof cb == 'function') ? cb : function () {};
            name = name || uuid();
        } else {
            cb = name;
            name = uuid();
        }
		
		
        // check if exists
        if (io.sockets.clients(name).length) {
            safeCb(cb)('taken');
        } else {
            join(name);
            safeCb(cb)(null, name);
        }
    });

    // tell client about stun and turn servers and generate nonces
    client.emit('stunservers', config.stunservers || []);

    // create shared secret nonces for TURN authentication
    // the process is described in draft-uberti-behave-turn-rest
    var credentials = [];
    config.turnservers.forEach(function (server) {
        var hmac = crypto.createHmac('sha1', server.secret);
        // default to 86400 seconds timeout unless specified
        var username = Math.floor(new Date().getTime() / 1000) + (server.expiry || 86400) + "";
        hmac.update(username);
        credentials.push({
            username: username,
            credential: hmac.digest('base64'),
            url: server.url
        });
    });
    client.emit('turnservers', credentials);
});

if (config.uid) process.setuid(config.uid);
console.log(yetify.logo() + ' -- signal master is running at: http://localhost:' + port);
