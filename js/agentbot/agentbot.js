/**
 */
'use strict'

// to avoid issue with the self signed certificate
// process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const https = require('https');
const base64 = require('base-64');
const crypto = require("crypto");
const axe = require('axios');
var config = require('./conf_agent.json');
		 
// Options to be used by request 
var axconfig = {
		hostname: config.baseUrl,
        port: config.port,
//        baseUrl: "https://" + config.baseUrl,
		url: "https://prod-eu.sapcctr.com/standarddemo/ecfs/authentication",
		method: "POST",
		headers: {
		    "Content-Type": "application/x-www-form-urlencoded",
		    "Authorization": "ECFAUTH"
        }
};


var userGUID, sessionCookie;
var pattern = /JSESSIONID=[0-9A-Fa-f]*/;

var subscribeReq = {
			"client_req_id": crypto.randomBytes(16).toString("hex"),
			"method": "SUBSCRIBE",
            "uri": "/users/me/properties"
		}

var subscribeQueueReq = {
		"client_req_id": crypto.randomBytes(16).toString("hex"),
		"method": "SUBSCRIBE",
        "uri": "/users/me/queues"
	}

var subscribeInteractionsReq = {
		"client_req_id": crypto.randomBytes(16).toString("hex"),
		"method": "SUBSCRIBE",
		"uri": "/users/me/interactions"
    }
    
var putGetReadyReq = {
    "client_req_id": crypto.randomBytes(16).toString("hex"),
    "method": "PUT",
    "uri": "/users/me/properties",
    "body": {work_status: "ready"}   
}

function transferChat(clientReqId, interactionGUID, destQueue) {
	return {
		"client_req_id": clientReqId,
	  	"method": "PUT",
	  	"uri": "/users/me/interactions/"+interactionGUID,
	  	"body": {	
	  		"channel_status": "transferring",
	  		"destination": destQueue
	  	}		
	}
}

function postInteraction(clientReqId) {
	return {
		"client_req_id": clientReqId,
	  	"method": "POST",
	  	"uri": "/users/me/interactions",
	  	"body": {
	  			channel_type: "chat", 
	  			channel_sub_type: "text", 
	  			destination: config.destination
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

// /users/me/queues?
function subscribeQueues(clientReqId) {
	return {
		"client_req_id": clientReqId,
	  	"method": "SUBSCRIBE",
	  	"uri": "/users/me/queues",
	  	"body": {}		
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

var base64credentials = Buffer.from(config.username + ":" + config.password).toString('base64')
var authformdata = "Authorization=Basic%20" + base64credentials
var authUrl = "https://" + config.baseUrl + config.authUri
axe.post(authUrl, authformdata,  axconfig)
    .then(function (response) {
        console.log("Authentication response: ")
        console.log(response.data);
        console.log(response.status);
        console.log(response.statusText);
        var body = response.data;
        var data = response.data;
        
        //console.log(response.headers);
        //console.log(response.config);

        // user GUID
		userGUID = data.id;
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
    		  //ws.send(JSON.stringify(putProperty(crypto.randomBytes(16).toString("hex"))));
    		  // Subscribe to resources
    		  //ws.send(JSON.stringify(subscribeReq));
    		  // Various request examples

			  let pingTimer = setInterval(() => {
				// Send ping every 50 seconds
				ws.ping();
			 }, 50000)
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
            var jsonmsg = JSON.parse(data)

			if (jsonmsg.body && jsonmsg.body.hasOwnProperty('transactions')) {
                var interBody = jsonmsg.body;
                console.log(jsonmsg.uri)
                console.log(interBody.transactions)
				for (var key in interBody) {
					//console.log('1: '+ interBody[key]);
					for (var trans in interBody[key]) {
                    //console.log(interBody[key][trans]);
                    let currtrans = interBody[key][trans]
                    console.log(currtrans)

					    for (var res in interBody[key][trans]) {
						//console.log(interBody[key][trans].subscribed_resource)
                            if (interBody[key][trans].subscribed_resource == 'accepted') {
								var uri = interBody[key][trans].uri;
								var intId = interBody[key][trans].uri.split("/")[4]//interBody[key][trans][res].id;
								//if (intId && intId != null) {
								ws.send(JSON.stringify(messageInteraction(crypto.randomBytes(16).toString("hex"), intId, config.message)));										  
								//}
							}	  								  								  
						}
					}
				}
			}else{
                //console.log(jsonmsg);
                if (jsonmsg.sessionid){
                    console.log("AGENT TERMINAL SESSION ID " + jsonmsg.sessionid)
                    //got session id safe to send somethng
                    ws.send(JSON.stringify(subscribeReq));
                    ws.send(JSON.stringify(subscribeInteractionsReq));    		  
                    //ws.send(JSON.stringify(postInteraction(crypto.randomBytes(16).toString("hex"))));
                    ws.send(JSON.stringify(subscribeQueueReq)); 
                    ws.send(JSON.stringify(putGetReadyReq));

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



      })
    .catch(function (error) {
        console.log(error);
      });


//Authenticate user
// Callback function is used to deal with response
var callback = function(response){	
	// Continuously update stream with data
	var body = '';
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
    		  //ws.send(JSON.stringify(putProperty(crypto.randomBytes(16).toString("hex"))));
    		  // Subscribe to resources
    		  ws.send(JSON.stringify(subscribeReq));
    		  // Various request examples
    		  ws.send(JSON.stringify(subscribeInteractionsReq));    		  
			  //ws.send(JSON.stringify(postInteraction(crypto.randomBytes(16).toString("hex"))));
			  ws.send(JSON.stringify(subscribeQueueReq)); 
			  let pingTimer = setInterval(() => {
				// Send ping every 50 seconds
				ws.ping();
			 }, 50000)
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
			  console.log(data);
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
									  //if (intId && intId != null) {
										//  ws.send(JSON.stringify(messageInteraction(crypto.randomBytes(16).toString("hex"), intId, config.message)));										  
									  //}
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
//var res = https.request(options, callback);
//res.end();