import { DumpMessage, getDump } from "./data";
import { OpName } from "./opcode";
import { getElement } from "./utils";

export function show() {
	const dump = getDump();
	showGeneralInfo(dump);
}

export function showGeneralInfo(dump: DumpMessage) {
	let text = "";
	if (dump.arg) {
		text = `Opcode: ${OpName[dump.op]}, ${dump.arg}`;
	} else {
		text = `Opcode: ${OpName[dump.op]}`;
	}

	getElement("opcode").innerText = text;
}
