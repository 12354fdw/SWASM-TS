import ts from "typescript";
import { CompileContext } from "./compileContext";
import { resolveNodeType } from "../utils";

export class FunctionCompiler {
	constructor(private readonly ctx: CompileContext) {}

	public compile(node: ts.FunctionDeclaration) {
		this.ctx.beginScope();

		const name = node.name!.text;
		const func = this.ctx.getCurrentNS().functions.get(name)!;

		if (node.type && node.type.getText() !== "void") {
			func.returns = [resolveNodeType(node.type)];
		}

		for (const p of node.parameters) {
			this.ctx.declareLocal((p.name as ts.Identifier).text);
		}

		const prev = this.ctx.currFunc;
		this.ctx.currFunc = func;

		if (node.body) {
			for (const stmt of node.body.statements) {
				const ir = this.ctx.stmtCompiler.compile(stmt);
				if (ir) func.body.push(...ir);
			}
		}

		this.ctx.currFunc = prev;
		this.ctx.endScope();
	}
}
