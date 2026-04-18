import ts from "typescript";
import { ClassIR, SWTypes } from "../ir";
import { CompileContext } from "./compile/compileContext";

export function resolveNodeType(node?: ts.TypeNode): SWTypes {
	if (!node) return "number";
	const text = node.getText();

	if (text === "boolean") return "boolean";
	if (text === "number") return "number";
	return "table";
}

export function resolveFunction(name: string, ctx: CompileContext) {
	for (const ns of [ctx.getCurrentNS(), ctx.registry.get("GLOBAL")]) {
		if (!ns) continue;
		for (const [, func] of ns.functions) {
			if (func.name.endsWith(`__${name}`)) return func;
		}
	}
	return null;
}

export function getClassIR(node: ts.PropertyAccessExpression, ctx: CompileContext): ClassIR {
	const type = ctx.checker.getTypeAtLocation(node.expression);
	const symbol = type.getSymbol();
	const className = symbol?.getName();
	if (!className) throw Error(`Cannot resolve class for expression`);
	return resolveClass(className, ctx);
}

export function resolveClass(name: string, ctx: CompileContext): ClassIR {
	for (const [, ns] of ctx.registry) {
		for (const [, cls] of ns.classes) {
			if (cls.name.endsWith(`__${name}`)) return cls;
		}
	}
	throw Error(`Unknown class: ${name}`);
}
