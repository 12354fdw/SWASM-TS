import ts from "typescript";
import { CompileContext } from "./compileContext";

export class ModuleCompiler {
	constructor(private readonly ctx: CompileContext) {}

	public compile(node: ts.ModuleDeclaration) {
		const body = node.body;
		if (!body || !ts.isModuleBlock(body)) return;

		this.ctx.namespaceStack.push(node.name.text);

		for (const stmt of body.statements) {
			if (ts.isFunctionDeclaration(stmt)) this.ctx.funcCompiler.compile(stmt);
			else if (ts.isClassDeclaration(stmt)) this.ctx.classCompiler.compile(stmt);
			else if (ts.isModuleDeclaration(stmt)) this.compile(stmt);
		}

		this.ctx.namespaceStack.pop();
	}
}
