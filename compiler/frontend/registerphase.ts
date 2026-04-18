import { ClassIR, FuncIR, GlobalIR, IRBuilder } from "../ir";
import ts, { NodeArray } from "typescript";
import { resolveNodeType } from "./utils";

export type NamespaceRegistry = Map<
	string,
	{
		name: string;
		functions: Map<string, FuncIR>;
		classes: Map<string, ClassIR>;
		globals: Map<string, GlobalIR>;
	}
>;

export class registerPhase {
	public namespaceRegistry: NamespaceRegistry = new Map();

	private namespaceStack: string[] = [];

	constructor(private readonly irBuilder: IRBuilder) {}

	public register(statements: NodeArray<ts.Statement>) {
		this.registerStatements(statements);
	}

	private registerStatements(statements: NodeArray<ts.Statement>) {
		statements.forEach((stmt: ts.Statement) => {
			/* eslint-disable prettier/prettier */
			if (ts.isFunctionDeclaration(stmt)) { this.registerFunction(stmt); return; }
			if (ts.isVariableStatement(stmt)) { this.registerGlobals(stmt); return; }
			if (ts.isClassDeclaration(stmt)) { this.registerClass(stmt); return; }
			if (ts.isModuleDeclaration(stmt)) { this.registerModule(stmt); return; }
			/* eslint-enable prettier/prettier */
		});
	}

	private registerFunction(node: ts.FunctionDeclaration) {
		const name = `NS__${this.getCurrentNamespaceKey()}__${node.name!.text}`;
		const params = node.parameters.map((p) => (p.name as ts.Identifier).text);

		const func: FuncIR = {
			name,
			label: name,
			params,
			returns: [],
			body: [],
			returnedType: false,
		};

		this.getNamespaceWrapper().functions.set(name, func);
		this.irBuilder.addFunction(func);
	}

	private registerGlobals(node: ts.VariableStatement) {
		for (const decl of node.declarationList.declarations) {
			const name = (decl.name as ts.Identifier).text;

			const global: GlobalIR = {
				name,
				idx: 0, // assigned in bind phase
			};

			this.getNamespaceWrapper().globals.set(name, global);
			this.irBuilder.addGlobal(global);
		}
	}

	private registerClass(node: ts.ClassDeclaration) {
		const name = `NS__${this.getCurrentNamespaceKey()}__${node.name!.text}`;
		const ctor = node.members.find(ts.isConstructorDeclaration);

		const cls: ClassIR = {
			name,
			fields: new Map(),
			methods: new Map(),
			parent: this.getParentName(node), // to be assigned in binding phase
			constructorParams: ctor ? ctor.parameters.map((p) => (p.name as ts.Identifier).text) : [],
			ctorLabel: `${name}__ctor`,
		};

		let fieldCounter = 1;
		for (const member of node.members) {
			if (ts.isPropertyDeclaration(member) && member.name) {
				const fname = (member.name as ts.Identifier).text;
				const ftype = resolveNodeType(member.type);
				cls.fields.set(fname, { idx: fieldCounter++, type: ftype, name: member.name.getText() });
			}

			if (ts.isMethodDeclaration(member) && member.name) {
				const mname = (member.name as ts.Identifier).text;
				const mangled = `${name}__${mname}`;
				const func: FuncIR = {
					name: mangled,
					label: mangled,
					params: ["this", ...member.parameters.map((p) => (p.name as ts.Identifier).text)],
					returns: [],
					body: [],
					returnedType: false, // used interally in lowering
				};
				this.getNamespaceWrapper().functions.set(mangled, func);

				cls.methods.set(mname, { name: member.name.getText(), idx: fieldCounter++, func, methodName: name });
				this.irBuilder.addFunction(func);
			}
		}

		if (ctor) {
			for (const param of ctor.parameters) {
				const isParamProp = param.modifiers?.some(
					(m) =>
						m.kind === ts.SyntaxKind.PrivateKeyword ||
						m.kind === ts.SyntaxKind.PublicKeyword ||
						m.kind === ts.SyntaxKind.ProtectedKeyword ||
						m.kind === ts.SyntaxKind.ReadonlyKeyword,
				);
				if (isParamProp) {
					const fname = (param.name as ts.Identifier).text;
					const ftype = resolveNodeType(param.type);
					cls.fields.set(fname, { idx: fieldCounter++, type: ftype, name: fname });
				}
			}
		}

		if (ctor) this.registerConstructor(ctor, cls);

		this.getNamespaceWrapper().classes.set(name, cls);
		this.irBuilder.addClass(cls);
	}

	private registerConstructor(member: ts.ConstructorDeclaration, cls: ClassIR) {
		const mangled = `${cls.name}__CONSTRUCTOR_IMPL`;

		const func: FuncIR = {
			name: mangled,
			label: mangled,
			params: ["this", ...member.parameters.map((p) => (p.name as ts.Identifier).text)],
			returns: [],
			body: [],
			returnedType: false,
		};

		this.getNamespaceWrapper().functions.set(mangled, func);
		this.irBuilder.addFunction(func);
	}

	private registerModule(node: ts.ModuleDeclaration) {
		const body = node.body;

		if (!body) return; // this is a cruel joke
		if (!ts.isModuleBlock(body)) return; // how is it not a moduleBlock?????

		this.namespaceStack.push(node.name.text);
		this.getNamespaceWrapper().name = this.getCurrentNamespaceKey();
		this.registerStatements(body.statements);
		this.namespaceStack.pop();
	}

	private getCurrentNamespaceKey(): string {
		return this.namespaceStack.join("__") || "GLOBAL";
	}

	private getNamespaceWrapper() {
		const key = this.getCurrentNamespaceKey();

		let ns = this.namespaceRegistry.get(key);
		if (!ns) {
			ns = {
				functions: new Map(),
				classes: new Map(),
				globals: new Map(),
				name: "",
			};
			this.namespaceRegistry.set(key, ns);
		}

		return ns;
	}

	// class helper
	private getParentName(node: ts.ClassDeclaration): string | undefined {
		const clause = node.heritageClauses?.find((h) => h.token === ts.SyntaxKind.ExtendsKeyword);
		if (!clause) return undefined;
		return (clause.types[0].expression as ts.Identifier).text;
	}
}
