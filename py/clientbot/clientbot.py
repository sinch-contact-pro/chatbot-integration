import asyncio
import pathlib
import ssl
import websockets
import requests
import configparser
import base64
import uuid
import json
# %%
ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
ssl_context.load_default_certs()
from urllib import request, parse
#basic = uid + ":" + pwd
basic = "Anonymous"
basic_bytes = basic.encode("ascii") 
b64_bytes = base64.b64encode(basic_bytes) 
b64_str = "Basic " + b64_bytes.decode("ascii")
print(b64_str)
b = b64_str
data = parse.urlencode({"Authorization": b}).encode()
heads = {
"Content-Type": "application/x-www-form-urlencoded",
"Origin": "prod-eu.sapcctr.com",
"Authorization": "Anonymous"
}

#req =  request.Request("https://prod-eu.sapcctr.com/standarddemo/ecfs/authentication", headers=heads,  data=data) # this will make the method "POST"
#request.urlopen(req)
resp = requests.post('https://prod-eu.sapcctr.com/standarddemo/visitor/ecfs/authentication', headers=heads, data=data) 
#print(resp.cookies)
print (requests.utils.dict_from_cookiejar(resp.cookies))
dictestives = requests.utils.dict_from_cookiejar(resp.cookies)
jsessionid = dictestives["JSESSIONID"]
jsessionstr = "JSESSIONID=" + jsessionid
cookiehead  = [("Cookie", jsessionstr)]

alias = "Visitor"
visitor = input("Give your visitor email address: ")
destination = input("Give queue address: ")

# Put user properties. You should set users email address with this message
put_user_properties = {
    "client_req_id": uuid.uuid4().hex,
	"method": "PUT",
	"uri": "/users/me/properties",
	"body": {	
	  		"chat_address": visitor, 
	  		"alias": alias
    }
}

# Subscribe to interactions
subscribe_me = {
	"client_req_id": uuid.uuid4().hex,
	"method": "SUBSCRIBE",
	"uri": "/users/me/properties"
}

# Subscribe to my interactions
subscribe_my_interactions = {
	"client_req_id": uuid.uuid4().hex,
	"method": "SUBSCRIBE",
	"uri": "/users/me/interactions"
}

# Post interaction
post_interaction = {
    "client_req_id": uuid.uuid4().hex,
    "method": "POST",
    "uri": "/users/me/interactions",
    "body": {
	    "channel_type": "chat", 
	    "channel_sub_type": "text", 
	    "destination": destination,		
	    "attached_data": {
    	    "foo": "bar", 
		    "bin": "baz",
		    "mycreature": {
                "head": "0", "body": "X", "legs":"||"
            }
	    }
    }
}

# Post messages to chat

is_running = True

async def openseasam():
    uri = "wss://prod-eu.sapcctr.com/standarddemo/visitor/ecfs/ws_endpoint/"
    is_connected = False
    async with websockets.connect(
        uri, 
        ssl=ssl_context,
        extra_headers=cookiehead, 
        subprotocols="chat"
    ) as websocket:
        while True:
            try:              
                message = await websocket.recv()
                parsed = json.loads(message)
                print(json.dumps(parsed, indent=4, sort_keys=True))

                if (is_connected == False):
                    print("putting properties...")
                    await websocket.send(json.dumps(put_user_properties))
                    print("subscribe me")
                    await websocket.send(json.dumps(subscribe_me))
                    print("subscribing to my interactions...")
                    await websocket.send(json.dumps(subscribe_my_interactions))
                    print("sending interaction")
                    await websocket.send(json.dumps(post_interaction))
                    is_connected=True

                
            except websockets.exceptions.ConnectionClosed:
                print('ConnectionClosed')
                is_connected = False
                is_running = False
                break

asyncio.get_event_loop().run_until_complete(asyncio.wait([   
   openseasam()
]))



# %%
