import { state } from "./data";
import { show } from "./render";
import { getElement, setTitle, titleText } from "./utils";

function setControlButtonState() {
	const disabled = !(!state.record && state.data.length > 0);
	(getElement("cntrl-stepback") as HTMLButtonElement).disabled = disabled;
	(getElement("cntrl-step") as HTMLButtonElement).disabled = disabled;
	(getElement("cntrl-stepover") as HTMLButtonElement).disabled = disabled;
	(getElement("cntrl-stepout") as HTMLButtonElement).disabled = disabled;
}

export function setupButtons() {
	getElement("btn-record").onclick = () => {
		state.record = true;
		state.data = [];

		(getElement("btn-record") as HTMLButtonElement).disabled = true;
		(getElement("btn-stoprecord") as HTMLButtonElement).disabled = false;

		setTitle(`${titleText} [RECORDING, ${state.data.length} dumps]`, "limegreen");
		setControlButtonState();
	};

	getElement("btn-stoprecord").onclick = () => {
		state.record = false;

		(getElement("btn-record") as HTMLButtonElement).disabled = false;
		(getElement("btn-stoprecord") as HTMLButtonElement).disabled = true;

		setTitle(`${titleText} [IDLE, ${state.data.length} dumps]`, "limegreen");
		setControlButtonState();

		state.dumpIdx = 0;

		show();
	};

	getElement("cntrl-step").onclick = () => {
		if (state.dumpIdx < state.data.length - 1) {
			state.dumpIdx++;
			show();
			setTitle(`${titleText} [IDLE, ${state.dumpIdx + 1}/${state.data.length} dumps]`, "limegreen");
		}
	};

	getElement("cntrl-stepback").onclick = () => {
		if (state.dumpIdx > 0) {
			state.dumpIdx--;
			show();
			setTitle(`${titleText} [IDLE, ${state.dumpIdx + 1}/${state.data.length} dumps]`, "limegreen");
		}
	};
}
