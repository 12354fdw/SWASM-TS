import ts from "typescript";
import { CompileContext } from "./compileContext";
import { resolveNodeType } from "../utils";

export class FunctionCompiler {
	constructor(private readonly ctx: CompileContext) {}

	public compile(node: ts.FunctionDeclaration) {
		const name = node.name!.text;
		const func = this.ctx.resolveFunction(name);
		if (!func) throw Error(`Unknown function: ${name}`);

		if (node.type && node.type.getText() !== "void") {
			func.returns = [resolveNodeType(node.type)];
		}

		const prev = this.ctx.currFunc;
		this.ctx.currFunc = func;
		this.ctx.resetLocals();
		this.ctx.beginScope();

		for (const p of node.parameters) {
			this.ctx.declareLocal((p.name as ts.Identifier).text);
		}

		if (node.body) {
			for (const stmt of node.body.statements) {
				func.body.push(...this.ctx.stmtCompiler.compile(stmt));
			}
		}

		this.ctx.currFunc = prev;
		this.ctx.endScope();
	}
}
