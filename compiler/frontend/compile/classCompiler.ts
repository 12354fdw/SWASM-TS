import ts from "typescript";
import { CompileContext } from "./compileContext";
import { FuncIR, Stmt } from "../../ir";

export class ClassCompiler {
	constructor(private readonly ctx: CompileContext) {}

	public compile(node: ts.ClassDeclaration) {
		const name = node.name!.text;
		const cls = this.ctx.resolveClass(name);
		if (!cls) throw Error(`Unknown class: ${name}`);
		const prev = this.ctx.currClass;
		this.ctx.currClass = cls;

		for (const member of node.members) {
			if (ts.isMethodDeclaration(member)) {
				const mname = (member.name as ts.Identifier).text;
				const method = cls.methods.get(mname)!;
				const func = method.func;

				this.ctx.beginScope();
				func.params.forEach((p) => {
					this.ctx.declareLocal(p); // also includes "this"
				});

				const prev = this.ctx.currFunc;
				this.ctx.currFunc = func;

				if (member.body) {
					for (const stmt of member.body.statements) {
						func.body.push(...this.ctx.stmtCompiler.compile(stmt));
					}
				}

				this.ctx.currFunc = prev;
				this.ctx.endScope();
			}

			if (ts.isConstructorDeclaration(member)) {
				this.compileConstructor(member);
			}
		}
		this.ctx.currClass = prev;
	}

	private compileConstructor(member: ts.ConstructorDeclaration) {
		const cls = this.ctx.currClass!;

		// find the constructor func from the registry
		let func: FuncIR | null = null;
		for (const [, ns] of this.ctx.registry) {
			for (const [, f] of ns.functions) {
				if (f.name.endsWith(`__${cls.name}__CONSTRUCTOR`)) {
					func = f;
					break;
				}
			}
			if (func) break;
		}
		if (!func) throw Error(`No constructor found for ${cls.name}`);

		this.ctx.beginScope();
		func.params.forEach((p) => this.ctx.declareLocal(p));

		const prev = this.ctx.currFunc;
		this.ctx.currFunc = func;

		// auto assign parameter properties (private a, public b, etc)
		for (const param of member.parameters) {
			const isParamProp = param.modifiers?.some(
				(m) =>
					m.kind === ts.SyntaxKind.PrivateKeyword ||
					m.kind === ts.SyntaxKind.PublicKeyword ||
					m.kind === ts.SyntaxKind.ProtectedKeyword ||
					m.kind === ts.SyntaxKind.ReadonlyKeyword,
			);
			if (isParamProp) {
				const pname = (param.name as ts.Identifier).text;
				const field = cls.fields.get(pname)!;
				func.body.push({
					type: "field_assign",
					obj: { type: "local", name: "this" },
					fieldIdx: field.idx,
					value: { type: "local", name: pname },
					name: pname,
				} satisfies Stmt);
			}
		}

		// compile explicit body statements
		if (member.body) {
			for (const stmt of member.body.statements) {
				func.body.push(...this.ctx.stmtCompiler.compile(stmt));
			}
		}

		this.ctx.currFunc = prev;
		this.ctx.endScope();
	}
}
