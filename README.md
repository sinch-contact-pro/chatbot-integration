# chatbot-integration
Sample code for chatbot integration with Sinch Contact Pro. We have two models to integrate. 

Clientbot is essentially model where chatbot connects from internet like a normal anonymous internet user. This is simplest way to connect and suits situation where bot already handles all web interactions and there is only need to facilitate fall back to contact center whenever bot is not able to answer to questions anymore. 

Agentbot is a model where bot connect as a contact center agent and has a full capability to whatever human agents can do. One can limit the agent capabilities with granular role based access control mechanism provided by system. All interactions and conversations are first handled by contact center and contact center managers and supervisors may decide when to use agent bot capabilities and in which services. This mechanism supports all contact center channels including webchat,conversational channels (SMS, Whatsapp, Viber, Instagram, Telegram etc. - all Sinch supported channels. List growing all the time). 

You can find examples of both integrations written in Javascript and Python. Javascript examples uses Node.js.
/js /py folders respectively.

Communication protocol is documented in /model folder. Note that protocol may change over time to have more additions. Thus it is important to check protocol URI and
type of the message carefully.

