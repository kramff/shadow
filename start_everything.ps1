echo "Starting game server"
cd Server
start node "server.js"
cd ..

echo "Starting vite web server / builder"
cd Game
start npx "vite --port 8060"
cd ..

echo "Opening web browser"
Start "C:\Program Files\Mozilla Firefox\firefox.exe" "http://localhost:8060/index.html"

echo "Opening vim"
start "C:\Program Files\Vim\vim91\gvim.exe" "Game/game.js"

echo "Opening powershell window so you can run git"
start powershell
