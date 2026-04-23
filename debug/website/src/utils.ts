export const titleText = "Dump over Websocket viewer";

export function getElement(name: string) {
	return document.getElementById(name)!;
}

export function setTitle(text: string, color: CSSStyleDeclaration["color"] = "limegreen") {
	const title = document.getElementById("title")!;
	title.innerText = text;
	title.style.color = color;
}
