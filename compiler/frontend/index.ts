import ts from "typescript";
import fs from "fs";
import { FuncIR, IRBuilder } from "../ir";
import path from "path";
import { Assembler } from "../assembler";
import { CompileContext } from "./compile/compileContext";
import { registerPhase } from "./registerphase";
import { bindPhase } from "./binder";
import { $info } from "../logger";

export class Codegen {
	private irBuilder = new IRBuilder();
	private ctx!: CompileContext;
	constructor(private readonly program: ts.Program) {}

	public compile(): string {
		const sources = this.program.getSourceFiles().filter((f) => !f.isDeclarationFile);
		for (const src of sources) {
			this.compileSourceFile(src);
		}

		const asm = this.irBuilder.lower();

		const asmFile = path.resolve("./pgrm.swasm");
		fs.writeFileSync(asmFile, asm);

		const assembler = new Assembler();

		return assembler.assemble(asm).join(",");
	}

	private compileSourceFile(src: ts.SourceFile) {
		$info(`Compiling ${src.fileName}`);
		const register = new registerPhase();
		register.register(src.statements);

		const bind = new bindPhase(register.namespaceRegistry);
		bind.bind();

		this.ctx = new CompileContext(this.program, register.namespaceRegistry, this.irBuilder);

		for (const stmt of src.statements) {
			if (ts.isFunctionDeclaration(stmt)) this.ctx.funcCompiler.compile(stmt);
			else if (ts.isClassDeclaration(stmt)) this.ctx.classCompiler.compile(stmt);
			else if (ts.isModuleDeclaration(stmt)) this.ctx.moduleCompiler.compile(stmt);
		}

		this.compileToplevel(src.statements);
	}

	private compileToplevel(statements: ts.NodeArray<ts.Statement>) {
		const topLevel = [...statements].filter(
			(stmt) => !ts.isFunctionDeclaration(stmt) && !ts.isClassDeclaration(stmt) && !ts.isModuleDeclaration(stmt),
		);

		if (topLevel.length === 0) return;

		const func: FuncIR = {
			name: `NS__GLOBAL____main`,
			label: `NS__GLOBAL____main`,
			params: [],
			returns: [],
			body: [],
			returnedType: false,
		};

		this.irBuilder.addFunction(func);

		this.ctx.currFunc = func;
		this.ctx.resetLocals();
		this.ctx.beginScope();

		for (const stmt of topLevel) {
			func.body.push(...this.ctx.stmtCompiler.compile(stmt));
		}

		this.ctx.endScope();
		this.ctx.currFunc = null;
	}
}
