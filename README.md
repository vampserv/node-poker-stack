## node-poker-stack -- a node.js Texas Holdem game server and web client

node-poker-stack is a [node.js](http://nodejs.org) Texas Holdem game server and web client. Some notable features
are real-time game-play and chat, multiple game rooms, support up to 10 players per room with a combination
of human and bot players, and built on top of the [Pomelo](http://github.com/NetEase/pomelo) game server framework.

## Features

### Game Features

* Texas Holdem game engine for up to 10 players per room based on [node-poker](https://github.com/mjhbell/node-poker).
* Configure bots to join at intervals and play against humans or other bots. They will make use of a hand evaluator, and were very useful for debugging game logic.
* Multiple simultaneous game rooms with individual game rules (blinds, buyins, # of players, etc).
* Real-time game and chat interaction between clients via web sockets.
* Robust game records are stored which include each player action and along with game results.
* Rudimentary friend system to check whether friends are online, chat, and join their games.
* A basic web client server is available (node.js + backbone.js + websocket web browser client).

### Built using Pomelo.

* Real-time communication between server and client.
* Distributed architecture to scale painlessly.
* Pluggable architecture to easily add new features.
* Client support for a variety of clients (javascript, flash, android, iOS, cocos2d-x, C).
* See [Pomelo Framework](http://github.com/NetEase/pomelo) for more information.

### Whats missing?

* Currently, user and table information is persisted to file store.
* The web browser client could be improved (uses vanilla bootstrap.js).
* Can add more client platforms (android, ios, phonegap, etc).

## Instructions

1. coming soon!


## License

(The MIT License)

Copyright (c) 2012-2014 Edward Yang

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
