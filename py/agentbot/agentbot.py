import asyncio
import pathlib
import ssl
import websockets
import requests
import configparser
import base64
import uuid
import json
from jsonpath_ng.ext import parser
from jsonpath_ng import jsonpath
from urllib import request, parse

# %%


def authenticate():
    uid = input("Give userid: ")
    pwd = input("Give password: ")
    basic = uid + ":" + pwd
    basic_bytes = basic.encode("ascii") 
    b64_bytes = base64.b64encode(basic_bytes) 
    b64_str = "Basic " + b64_bytes.decode("ascii")
    data = parse.urlencode({"Authorization": b64_str}).encode()
    heads = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Origin": "prod-eu.sapcctr.com",
        "Authorization": "ECFAUTH"
    }

    #req =  request.Request("https://prod-eu.sapcctr.com/standarddemo/ecfs/authentication", headers=heads,  data=data)
    #request.urlopen(req)
    authurl = 'https://prod-eu.sapcctr.com/standarddemo/ecfs/authentication'
    resp = requests.post(authurl, headers=heads, data=data) 
    #print(resp.cookies)
    print (requests.utils.dict_from_cookiejar(resp.cookies))
    dictestives = requests.utils.dict_from_cookiejar(resp.cookies)
    jsessionid = dictestives["JSESSIONID"]
    jsessionstr = "JSESSIONID=" + jsessionid
    cookiehead  = [("Cookie", jsessionstr)]
    return cookiehead


# Put user properties. You should set users email address with this message
put_user_properties = {
    "client_req_id": uuid.uuid4().hex,
	"method": "PUT",
	"uri": "/users/me/properties",
	"body": {	
	  		"chat_address": "", 
	  		"alias": ""
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

# Put to me to work
work_status_ready = {
    "client_req_id": uuid.uuid4().hex,
    "method": "PUT",
    "uri": "/users/me/properties",
    "body": {"work_status": "ready"}   
}

# Accept interaction
def accept_chat(id):
    uri = "/users/me/interactions/" + id
    return {
    	"client_req_id": uuid.uuid4().hex,
		"method": "PUT",
		"uri": uri,
		"body": {"status":"accepted"},
		"retries":0,
		"max_retries":3,
		"last_status_code":"",
		"interval":5000,
		"type":"RTC"
    }

def chat_message(id, message):
    uri = "/users/me/interactions/" + id + "/transcript/messages"
    return { 
        "client_req_id": uuid.uuid4().hex,
        "method": "POST",
        "uri": uri,
        "body": {"message": message}		
    }

def handle_interaction(id):
    uri = "/users/me/interactions/" + id
    return {
    	"client_req_id": uuid.uuid4().hex,
		"method": "PUT",
		"uri": uri,
		"body": {"status":"handled"},
		"retries":0,
		"max_retries":3,
		"last_status_code":"",
		"interval":5000,
		"type":"RTC"
    }

current_interactions = {}
my_address = None

async def get_my_props(subsd):
    print(subsd)
    in_subpath =  subsd["uri"].strip("users/me/subscriptions/").split("/")
    subs_id = in_subpath[0] 
    if (subsd["method"]=="POST"):
        print("New POST subscription", subs_id)
        global my_address
        my_address = subsd["subscribed_resource"]["chat_address"]

async def bot_todo_smthng(in_action):
    response = None
    global current_interactions
    print(in_action["uri"])    
    print("interaction id ", (in_action["uri"].strip("users/me/interactions/").split("/")[0]))

    in_subpath =  in_action["uri"].strip("users/me/interactions/").split("/")
    in_id = in_subpath[0] 
    
    if (in_action["method"]=="POST" and in_id not in current_interactions): # we have new interaction
        print("New interaction coming", in_id)
        print(in_action)
        current_interactions[in_id] = in_action
        response = accept_chat(in_id)
    elif (in_action["method"]=="POST" and len(in_subpath) > 2): # post to interaction subresource (participants,messages)
        print("New POST abt something", in_id)
        if (in_subpath[1] == "transcript"): # message transcript
            if (in_action["subscribed_resource"]["originator"] != my_address): # check that it is not my own message
                echo = "Hello from Bot you said " +  in_action["subscribed_resource"]["message"]
                response = chat_message(in_id, echo)
            if (in_subpath[1] == "participants"): # new participant added
                print(in_subpath[2], "Added to discussion")
    elif (in_action["method"]=="PUT"):
        print("PUT coming", in_id)
        # todo handle interaction states here
        if (in_action["subscribed_resource"] == "ended" and in_action["uri"].split("/")[-1] == "status"):
            print("handling interaction")
            response = handle_interaction(in_id)
    elif (in_action["method"]=="DELETE"): # interaction delete
        print("DELETE", in_id)
        if (in_id in current_interactions):
            current_interactions.pop(in_id)
            print("interaction removed")
            
    return response

async def ws_shebang(cookiehead):
    uri = "wss://prod-eu.sapcctr.com/standarddemo/ecfs/ws_endpoint/"
    ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ssl_context.load_default_certs()

    is_connected = False
    async with websockets.connect(
        uri, 
        ssl=ssl_context,
        extra_headers=cookiehead, 
        subprotocols="chat"
    ) as websocket:
        while True:
            try:              
                if (is_connected == False):
                    message = await websocket.recv() 
                    # sessionid might be useful later especially if multiple instances used                   
                    print("Opening of connection message first message ", message) # contains {"sessionid":"<guid>","ecfsessionid":"<guid>"} 
                    # Att the beginning of connection we might want do these
                    print("subscribing to my properties")
                    await websocket.send(json.dumps(subscribe_me))
                    print("subscribing to my interactions")
                    await websocket.send(json.dumps(subscribe_my_interactions))
                    print("setting workstatus ready")
                    await websocket.send(json.dumps(work_status_ready))
                    is_connected=True    
 
                else:
                    message = await websocket.recv()
                    json_msg = json.loads(message)
                    #print(json_msg)
                    # Using jsonpath for convenience
                    jsonpath_expression = parser.parse("$.body.transactions[?(@.uri=~'/users/me/properties')]")
                    pfound = jsonpath_expression.find(json_msg)

                    if(pfound):
                        print("FOUND properties")
                        for p in pfound:
                            # note s.value contains the data
                            await get_my_props(p.value)
                            print("MY chat address after found checking props >> ", my_address)
                    # we are only intrested of transactions that relate to my interactions
                    # we should additionally check that status code = 200
                    jsonpath_expression = parser.parse("$.body.transactions[?(@.uri=~'/users/me/interactions/')]")
                    ifound = jsonpath_expression.find(json_msg)

                    if(ifound):
                        for i in ifound:
                            # note i.value contains the data
                            todo = await bot_todo_smthng(i.value)
                            if(todo):
                                await websocket.send(json.dumps(todo))

               
            except websockets.exceptions.ConnectionClosed:
                print('ConnectionClosed')
                is_connected = False
                is_running = False
                break

# HERE we have the main...
if __name__ == "__main__":
    cookiehead = authenticate()
    asyncio.get_event_loop().run_until_complete(asyncio.wait([   
        ws_shebang(cookiehead)
    ]))
# %%
