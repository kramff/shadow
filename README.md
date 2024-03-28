# shadow
top down pvp shooting game

## Shadow Game overview

Forked from my [Plants game](https://github.com/kramff/alchemist) which was forked from my [Alchemy game](https://github.com/kramff/alchemist) to re-use the rollback netcode system I built for that project.

## Running the server

To run the websocket server:

In Server/

> node server.js

(Connects to ws port 8077)

## Hosting the website locally

To host the website files:

In Game/

> npx vite --port 8070

(Can use any port besides 8077)

## Viewing the game locally

View locally at:

http://localhost:8070/index.html

(or whatever port you picked in the last step)

## Building for web

Vite doesn't work over the internet. To build for web hosting:

In Game/

> npx vite build

Then, copy the Game/models/ folder into Game/dist/

- [ ] TODO: Have that happen automatically

The Game/dist/ folder is what should be put into the web server

- [ ] TODO: Make that transfer easier so I don't have to fiddle with dragging files around so much.

---

## Libraries, tools, other resources

This project uses [Three.js](https://threejs.org/) for 3d rendering.

This project uses [javascript module syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules) so that it can use [three.js](https://threejs.org/)'s [GLTF Loader](https://threejs.org/docs/index.html#examples/en/loaders/GLTFLoader).

This project uses [Vite](https://vitejs.dev/) for building/bundling the javascript modules. [(Following this page's recommendations)](https://threejs.org/docs/#manual/en/introduction/Installation)

The server is using the [ws library](https://github.com/websockets/ws) so it can connect to the game page's websockets.

---

## Other Notes

### Debugging with module syntax

It has been harder to inspect and debug the game since moving to javascript module syntax. Not having global access to the modularized game state variables is tricky.

To help, I created a "Hit Breakpoint" button that just hits a `debugger;` statement. However, this can't be used to inspect with the console while the game is running.

- [ ] TODO: Try putting `currentGameState` and other important variables into global scope using this approach: [stack overflow link](https://stackoverflow.com/questions/74509829/how-to-debug-javascript-modules-using-the-browser-console)

### Desync tool limit

I'm not sure what the limit is, but after some number of frames (like 5,000 or so) the "Desync Eval Tool" stops working because the server crashes when you try it.

The error is: "RangeError: Max payload size exceeded" so probably it can be split into pieces of 1,000 frames to prevent that.

