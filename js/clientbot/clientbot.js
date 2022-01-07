/**
 */
'use strict'

// to avoid issue with the self signed certificate
// process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const https = require('https');
const base64 = require('base-64');
const crypto = require("crypto");
const util = require('util')
var config = require('./conf_client.json');
		 
// Options to be used by request 
var options = {
		hostname: config.baseUrl,
		port: config.port,
		path: config.authUri,
		method: 'POST',
		headers: {
		    'Content-Type': 'application/x-www-form-urlencoded',
			'Authorization': 'Anonymous',
			'Origin': config.origin
		  }
	   
};

var userGUID, sessionCookie;
var pattern = /JSESSIONID=[0-9A-Fa-f]*/;

var subscribeReq = {
			"client_req_id": crypto.randomBytes(16).toString("hex"),
			"method": "SUBSCRIBE",
			"uri": "/users/me/properties"
		}

var subscribeInteractionsReq = {
		"client_req_id": crypto.randomBytes(16).toString("hex"),
		"method": "SUBSCRIBE",
		"uri": "/users/me/interactions"
	}

function postInteraction(clientReqId) {
	return {
		"client_req_id": clientReqId,
	  	"method": "POST",
	  	"uri": "/users/me/interactions",
	  	"body": {
	  			channel_type: "chat", 
	  			channel_sub_type: "text", 
				destination: config.destination,		
				attached_data: {
					"test1": 1, 
					"test2": "testing2"
			}
		}
	}
}

function putProperty(clientReqId) {
	return {
		"client_req_id": clientReqId,
	  	"method": "PUT",
	  	"uri": "/users/me/properties",
	  	"body": {	
	  		chat_address: config.originator, 
	  		alias: config.alias
	  	}		
	}
}

function messageInteraction(clientReqId, interactionGUID, message, originator) {
	return {
		"client_req_id": clientReqId,
	  	"method": "POST",
	  	"uri": "/users/me/interactions/"+interactionGUID+"/transcript/messages",
	  	"body": {	
	  		"message": message,
	  		"originator": config.originator
	  	}		
	}
}

//Authenticate user
// Callback function is used to deal with response
var callback = function(response){	
	// Continuously update stream with data
	var body = '';
	console.log('STATUS: ' + response.statusCode);
	console.log('HEADERS: ' + JSON.stringify(response.headers));
	response.setEncoding('utf8');
	response.on('data', function(data) {			
		
		body += data;
            
		// user GUID
		userGUID = JSON.parse(data).id;
		console.log('AUTHENTICATED USER: ' + userGUID);		
		// get the JSESSIONID cookie (used to idetify the session on the server side)
		sessionCookie = pattern.exec(response.headers['set-cookie'])[0]
		console.log('HTTP SESSION: ' + sessionCookie);
      
		if (sessionCookie) {
			const WebSocket = require('ws');
			// Establish websocket connection			
			const ws = new WebSocket(config.webSocketUrl, {
				origin: config.origin,
				protocolVersion: config.protocolVersion,				
				headers: {
					'Content-Type': 'application/json',
					'Cookie': sessionCookie					
				}
			});
		    
    	  ws.on('unexpected-response', function unexpResponse(request, response) {
    		  console.log(request);
    		  console.log(response);
    	  });
		
		
    	  ws.on('open', function open() {    		  
    		  console.log('WS CONNECTION ESTABLISHED: ' + config.baseUrl);
    		  console.log('');
			 
			  ws.send(JSON.stringify(putProperty(crypto.randomBytes(16).toString("hex"))));
    		  // Subscribe to resources
			  
			  ws.send(JSON.stringify(subscribeReq));
			  
    		  // Various request examples
    		  ws.send(JSON.stringify(subscribeInteractionsReq));    		  
			  ws.send(JSON.stringify(postInteraction(crypto.randomBytes(16).toString("hex"))));
			  
			  let pingTimer = setInterval(() => {
				// Send ping every 50 seconds
				ws.ping();
			 }, 5000)
    	  });
		
		  ws.on('close', function close(e) {
			  // Unsubscribe from all the resources
			  //console.log(e);
			  console.log('UNSUBSCRIBE ');
			  console.log('disconnected');
		  });

		 ws.on('ping', () => {
			console.log('got ping answering pong');
			ws.pong();
		 });
		
		 ws.on('pong', () => {
			console.log('got pong');
		 });

		  ws.on('message', function incoming(data, flags) {
			  
			  console.dir(JSON.parse(data), {depth: null, colors: true})
			  //try{
				  if (JSON.parse(data).body && JSON.parse(data).body.hasOwnProperty('transactions')) {
					  var interBody = JSON.parse(data).body;
					  for (var key in interBody) {
						  //console.log('1: '+ interBody[key]);
						  for (var trans in interBody[key]) {
							  //console.log(interBody[key][trans]);
							  for (var res in interBody[key][trans]) {
								  //console.log(interBody[key][trans].subscribed_resource);
								  if (interBody[key][trans].subscribed_resource == 'accepted') {
									  var uri = interBody[key][trans].uri;
									  var intId = interBody[key][trans].uri.split("/")[4]//interBody[key][trans][res].id;
									  if (intId && intId != null) {
										  ws.send(JSON.stringify(messageInteraction(crypto.randomBytes(16).toString("hex"), intId, config.message)));										  
									  }
								  }	  								  								  
							  }
						  }
					  }
				  }  
			  /*} catch (e) {
				  console.log(e);
			  }	*/	  		 							  		  
		  });
		
		  ws.on('error', function error(e) {
			  //console.log('error: ' + e);  	  
		  });
      }
		
   });    
   
   response.on('end', function() {
	   // Data received completely.
	   console.log(body);
   });
   
   response.on('error', function(e){
	   console.log("Request error: " + e); 
   });
}
// Make a request to the server
console.log(options)
var res = https.request(options, callback);
res.end();