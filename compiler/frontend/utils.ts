import ts from "typescript";
import { SWTypes } from "../ir";

export function resolveNodeType(node?: ts.TypeNode): SWTypes {
	if (!node) return "number";
	const text = node.getText();

	if (text === "boolean") return "boolean";
	if (text === "number") return "number";
	return "table";
}
