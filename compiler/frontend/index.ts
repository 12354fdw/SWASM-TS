import ts from "typescript";
import fs from "fs";
import { IRBuilder, Stmt } from "../ir";
import path from "path";
import { Assembler } from "../backend/assembler";
import { CompileContext } from "./compile/compileContext";
import { registerPhase } from "./registerphase";
import { bindPhase } from "./bindPhase";
import { $info } from "../logger";
import { ClassCompiler } from "./compile/classCompiler";
import { ExprCompiler } from "./compile/exprCompiler";
import { FunctionCompiler } from "./compile/functionCompiler";
import { ModuleCompiler } from "./compile/moduleCompiler";
import { StmtCompiler } from "./compile/stmtCompiler";
import { generateROM, generateVM } from "../templateFactory";

export const MAIN_LABEL = "__TOPLEVELCODE__";

const outputDir = "./output";

const ROM_STRING_SIZE = 8000; // doing it safe and 8KB not 8KiB
const ROM_TEMPLATE_OVERHEAD = `iN,iB,oN,oB=input.getNumber,input.getBool,output.setNumber,output.setBool
ID=99
data={}
function onTick()
local sel=iN(31)
if sel~=ID then return end
local idx=iN(32)
oN(1,data[idx]or 0)
end`.length;

export class Codegen {
	private irBuilder = new IRBuilder();
	private ctx!: CompileContext;
	constructor(private readonly program: ts.Program) {}

	public compile() {
		const sources = this.program.getSourceFiles().filter((f) => !f.isDeclarationFile);

		// register
		const register = new registerPhase(this.irBuilder);
		for (const src of sources) {
			$info(`Registering ${src.fileName}`);
			register.register(src.statements);
		}

		// bind
		const bind = new bindPhase(register.namespaceRegistry);
		bind.bind();

		this.ctx = new CompileContext(this.program, register.namespaceRegistry, this.irBuilder);
		this.ctx.exprCompiler = new ExprCompiler(this.ctx);
		this.ctx.stmtCompiler = new StmtCompiler(this.ctx);
		this.ctx.funcCompiler = new FunctionCompiler(this.ctx);
		this.ctx.classCompiler = new ClassCompiler(this.ctx);
		this.ctx.moduleCompiler = new ModuleCompiler(this.ctx);

		// compile
		for (const src of sources) {
			this.compileSourceFile(src);
		}

		// initalize output
		if (fs.existsSync(outputDir)) {
			fs.rmSync(outputDir, { recursive: true, force: false });
		}
		fs.mkdirSync(outputDir, { recursive: true });

		const asm = this.irBuilder.lower();
		const asmFile = path.resolve(`${outputDir}/pgrm.swasm`);
		fs.writeFileSync(asmFile, asm);

		const bytecode = new Assembler().assemble(asm);
		const chunks = this.chunkBytecode(bytecode);

		chunks.forEach((chunk, i) => {
			const rom = generateROM(i + 1, chunk);
			fs.writeFileSync(path.resolve(`${outputDir}/ROM${i + 1}.lua`), rom);
		});

		const vm = generateVM(chunks.map((c) => c.length));
		fs.writeFileSync(path.resolve(`${outputDir}/VM.lua`), vm);

		$info(`Produced ${bytecode.length} floats spread across ${chunks.length} ROM(s)`);
	}

	private compileSourceFile(src: ts.SourceFile) {
		$info(`Compiling ${src.fileName}`);

		for (const stmt of src.statements) {
			if (ts.isFunctionDeclaration(stmt)) this.ctx.funcCompiler.compile(stmt);
			else if (ts.isClassDeclaration(stmt)) this.ctx.classCompiler.compile(stmt);
			else if (ts.isModuleDeclaration(stmt)) this.ctx.moduleCompiler.compile(stmt);
		}

		this.compileToplevel(src.statements);
	}

	private chunkBytecode(bytecode: number[]): number[][] {
		const chunks: number[][] = [];
		let current: number[] = [];
		let currentSize = ROM_TEMPLATE_OVERHEAD;

		for (const val of bytecode) {
			const valStr = val.toString();
			const cost = valStr.length + 1;

			if (currentSize + cost > ROM_STRING_SIZE) {
				chunks.push(current);
				current = [];
				currentSize = ROM_TEMPLATE_OVERHEAD;
			}

			current.push(val);
			currentSize += cost;
		}

		if (current.length > 0) chunks.push(current);
		return chunks;
	}

	private compileToplevel(statements: ts.NodeArray<ts.Statement>) {
		const topLevel = [...statements].filter(
			(stmt) =>
				!ts.isFunctionDeclaration(stmt) &&
				!ts.isClassDeclaration(stmt) &&
				!ts.isModuleDeclaration(stmt) &&
				!ts.isImportDeclaration(stmt) &&
				!ts.isExportDeclaration(stmt) &&
				!ts.isTypeAliasDeclaration(stmt) &&
				!ts.isInterfaceDeclaration(stmt) &&
				!ts.isExportAssignment(stmt),
		);

		if (topLevel.length === 0) return;
		let func = this.irBuilder.functions.find((f) => f.label === MAIN_LABEL);
		if (!func) {
			func = {
				name: MAIN_LABEL,
				label: MAIN_LABEL,
				params: [],
				returns: [],
				body: [],
				returnedType: false,
			};
			this.irBuilder.addFunction(func);
		}

		this.ctx.currFunc = func;
		this.ctx.resetLocals();
		this.ctx.beginScope();

		for (const stmt of topLevel) {
			if (ts.isVariableStatement(stmt)) {
				func.body.push(this.handleToplevelVariable(stmt));
				continue;
			}
			func.body.push(...this.ctx.stmtCompiler.compile(stmt));
		}

		this.ctx.endScope();
		this.ctx.currFunc = null;
	}

	private handleToplevelVariable(stmt: ts.VariableStatement): Stmt {
		for (const decl of stmt.declarationList.declarations) {
			const name = (decl.name as ts.Identifier).text;
			const global = this.ctx.getCurrentNS().globals.get(name);
			if (global && decl.initializer) {
				return {
					type: "global_assign",
					ref: global,
					value: this.ctx.exprCompiler.compile(decl.initializer),
				};
			}
			throw Error(`Toplevel variable '${name}' doesn't have an initializer!`);
		}
		throw Error(`Variable statement has no declarations`);
	}
}
