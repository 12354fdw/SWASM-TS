import { state } from "./data";
import { show } from "./render";
import { setupButtons } from "./setupButtons";
import { setTitle } from "./utils";

const titleText = "Dump over Websocket viewer";

export default function main() {
	const ws = new WebSocket("ws://localhost:8080");

	ws.onmessage = (ev) => {
		const msg = JSON.parse(ev.data);
		if (!state.record) return;

		state.data.push(msg.data);
		setTitle(`${titleText} [RECORDING, ${state.data.length} dumps]`, "limegreen");

		state.dumpIdx = state.data.length - 1;
		show();
	};

	setupButtons();
}
