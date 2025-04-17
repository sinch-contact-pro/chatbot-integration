import hmac
import json
import base64
import hashlib
import urllib3
import secrets
import os
import calendar
from datetime import datetime as DT
from datetime import UTC

# create message body string
def createBody(msg, msgid, appid, convid, identityid, contactid, channel, metadatastr=""):
    accepted_time = (DT.now(UTC).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3])+'Z'
    event_time = (DT.now(UTC).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3])+'Z'
    msg_dict = {"app_id": appid,
                "accepted_time": accepted_time,
                "event_time": event_time,
                "project_id": "39228772-6fab-44a9-9d68-5180dd43d002",
                "message": {
                    "id": msgid,
                    "direction": "TO_APP",
                    "contact_message": {
                        "text_message": {
                        "text": msg,
                    }
                },
                "channel_identity": {
                "channel": channel,
                "identity": identityid,
                "app_id": ""    
                },
                "conversation_id": convid,
                "contact_id": contactid,
                "metadata": "",
                "accept_time": accepted_time,
                "sender_id": "",
                "processing_mode": "CONVERSATION",
                "injected": False
                },
                "message_metadata": metadatastr,
                "correlation_id": ""}
                
    return json.dumps(msg_dict)

# helper to send the message
def testUrl(http, url, body, headers):
    resp = http.request('POST', url,
    headers=headers,
    body=body)
    status = resp.status
    response_text = resp.data.decode('utf-8')
    return status, response_text

# --------------------------------------- #
# Signer utility class sign and verify    #
# --------------------------------------- #
class Signer:
    def __init__(self, secret):
        print(len(secret))
        self.secret = secret

    # we must use signed content towards Contact Pro
    def sign(self, body, timestamp, nonce):
        signed_data = body + '.' + nonce + '.' + str(timestamp)
        secret = self.secret.encode('utf-8')
        digest = hmac.new(secret, signed_data.encode('utf-8'), hashlib.sha256).digest()
        bcode = base64.b64encode(digest).decode()
        print(bcode)
        return bcode

    # verify signature can be used to verify payloads coming from convapi
    def verify_signature(self, body, timestamp, signature, nonce):
        s = self.sign(body, timestamp, nonce)
        if (signature == s):
            return True
        return False
    
def main():
    #Signer for signing the content   
    sec = os.getenv("SIGN_SECRET")
    tenant_sms_url = os.getenv("TENANT_URL")
    if sec is None:
        sec = input("Give a secret for signing > ")
    if tenant_sms_url is None:
        tenant_sms_url = input("Give url to tenant sms endpoint > ")
    
    msg = input("Give some message to be sent > ") or "Testing with 🙂"
    msgid = secrets.token_hex(12) # generating unique message id
    conversation_id = "MYCONVERSATIONID" # conversation id which is unique engagement, could be e.g. bot identified conversation
    identity_id = "MYUNIQUESENDERID" # sender id representing unique sender
    contact_id = "MYUNIQUECONTACTID" # There will be a GET request from the system to webhook checking the contact details. Responding to 
    app_id = "MYAPPID" # app_id must be upper case. this string should configured in Messaging service and Queue address the format is <app_id>@<channel>.sinchconversation.com
    channel = "SINCH_CHAT" # channel is used in queue address configuration SINCH_CHAT -> nativechannel, WHATSAPP -> whatsapp, RCS -> rcs ...
    metadata ='{"Foo":"Bar"}' # One can add own metadata, this must be a string with json data, nested objects do not work in reporting use key values only
    bodytxt = createBody(msg, msgid, app_id, conversation_id, identity_id, contact_id, channel, metadata)
    signer = Signer(sec)
    stimestamp = calendar.timegm(DT.now(UTC).timetuple())
    nonce = secrets.token_hex() 
    
    # more about signing process from here https://developers.sinch.com/docs/conversation/callbacks/
    signature = signer.sign(bodytxt, stimestamp, nonce)
    print(signature)
    headers = {
    'x-sinch-webhook-signature-nonce': nonce,
    'x-sinch-webhook-signature': signature,
    'x-sinch-webhook-signature-timestamp': stimestamp,
    'x-sinch-webhook-signature-algorithm': 'HmacSHA256',
    'Content-Type': 'application/json'
    }
    print("Request headers >> ", headers)
    print(bodytxt)
    # tenant_sms_url format should be something 'https://login-<region>.cc.sinch.com/<tenant_id>/sms/sinchconversation/all'
    http = urllib3.PoolManager()
    status, respbody = testUrl(http, tenant_sms_url, bodytxt, headers)
    print("Response status >> ", status)
    print("Response body >> ", respbody)

if __name__ == '__main__':
    main()
