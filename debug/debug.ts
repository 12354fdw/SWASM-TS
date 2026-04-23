import express from "express";
import http from "http";
import WebSocket, { WebSocketServer } from "ws";

const port = 8080;

const app = express();
const server = http.createServer(app);

const wss = new WebSocketServer({ server });

const clients = new Set<WebSocket>();

function broadcast(msg: object) {
	const str = JSON.stringify(msg);
	for (const ws of clients) {
		if (ws.readyState === WebSocket.OPEN) {
			ws.send(str);
		}
	}
}

wss.on("connection", (ws) => {
	clients.add(ws);
	ws.on("close", () => clients.delete(ws));
});

app.get("/dump", (req, res) => {
	const state = req.query.s as string;
	//console.log(req.query.s as string);
	try {
		broadcast({ type: "dump", data: JSON.parse(state) });
	} catch {
		broadcast({ type: "dump", raw: state });
	}
	res.send("ok");
});

app.get("/log", (req, res) => {
	const msg = req.query.msg as string;
	console.log(`[VM] ${msg}`);
	broadcast({ type: "log", msg });
	res.send("ok");
});

app.get("/", (req, res) => {
	res.sendFile("./website/index.html", {
		root: __dirname,
	});
});

app.use("/resources", express.static("debug/website"));

server.listen(port, () => {
	console.log(`debug server running on localhost:${port}`);
});
