import { DumpMessage, getDump } from "./data";
import { OpName } from "./opcode";
import { getElement } from "./utils";

export function show() {
	const dump = getDump();
	showGeneralInfo(dump);
	showStack(dump);
}

function showGeneralInfo(dump: DumpMessage) {
	let text = "";
	if (dump.arg) {
		text = `Opcode: ${OpName[dump.op]}, ${dump.arg}`;
	} else {
		text = `Opcode: ${OpName[dump.op]}`;
	}

	getElement("opcode").innerText = text;
	getElement("pc").innerText = `PC: ${dump.pc}`;
	getElement("hlt").innerText = `halted: ${dump.hlt}`;
}

function showStack(dump: DumpMessage) {
	const stackElement = getElement("stack-container");
	stackElement.innerHTML = "";

	const entries = Object.entries(dump.stack as Record<string, unknown>);

	for (const [k, v] of entries.reverse()) {
		const li = document.createElement("li");
		li.style.fontFamily = "monospace";
		li.style.color = "lightgrey";
		li.textContent = `[${k}] ${v}`;
		stackElement.appendChild(li);
	}
}
