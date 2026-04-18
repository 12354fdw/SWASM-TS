import ts from "typescript";
import fs from "fs";
import { ClassIR, Expr, FuncIR, IRBuilder, Stmt, SWTypes } from "../ir";
import path from "path";
import { Assembler } from "../assembler";

export class Codegen {
	private irBuilder = new IRBuilder();
	private checker: ts.TypeChecker;
	private topLevel: ts.Statement[] = [];

	private classRegistry = new Map<string, ClassIR>();
	private functionRegistry = new Map<string, FuncIR>();

	private currentFunc: FuncIR | null = null;
	private currentClass: ClassIR | null = null;

	private scopes: Set<string>[] = [];

	private namespaceStack: string[] = [];
	constructor(private readonly program: ts.Program) {
		this.checker = program.getTypeChecker();
	}

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
		src.statements.forEach((stmt) => {
			if (ts.isFunctionDeclaration(stmt)) {
				this.registerFunction(stmt);
				this.compileFunction(stmt);
				return;
			}

			if (ts.isClassDeclaration(stmt)) {
				this.registerClass(stmt);
				this.compileClass(stmt);
				return;
			}

			if (ts.isModuleDeclaration(stmt)) {
				this.compileModule(stmt);
				return;
			}

			// should be top level
			this.topLevel.push(stmt);
		});

		this.compileToplevel();
	}

	private compileModule(node: ts.ModuleDeclaration) {
		this.namespaceStack.push(node.name.text);

		// TODO: impl this and rewrite everything to use namespaces

		this.namespaceStack.pop();
	}

	private compileToplevel() {
		if (this.topLevel.length === 0) return;

		// register __main
		const func: FuncIR = {
			name: `NS__${this.getCurrentNamespaceKey()}__main`,
			label: `NS__${this.getCurrentNamespaceKey()}__main`,
			params: [],
			returns: [],
			body: [],
			returnedType: false,
		};

		this.irBuilder.addFunction(func);

		// parse topLevel and inject into body
		this.beginScope();
		const prev = this.currentFunc;
		this.currentFunc = func;

		for (const stmt of this.topLevel) {
			func.body.push(...this.compileStatement(stmt));
		}

		this.currentFunc = prev;
		this.exitScope();
	}

	private registerClass(node: ts.ClassDeclaration) {
		const name = node.name!.text;
		const ctor = node.members.find(ts.isConstructorDeclaration);

		const cls: ClassIR = {
			name: `NS__${this.getCurrentNamespaceKey()}__${name}`,
			fields: new Map(),
			methods: new Map(),
			parent: this.getParentName(node),
			constructorParams: ctor ? ctor.parameters.map((p) => (p.name as ts.Identifier).text) : [],
		};

		let fieldCounter = 1;
		for (const member of node.members) {
			if (ts.isPropertyDeclaration(member) && member.name) {
				const fname = (member.name as ts.Identifier).text;
				const ftype = this.resolveNodeType(member.type);
				cls.fields.set(fname, { idx: fieldCounter++, type: ftype, name: member.name.getText() }); // idx is resolved in lowering phase
			}

			if (ts.isMethodDeclaration(member) && member.name) {
				const mname = (member.name as ts.Identifier).text;
				const mangled = `NS__${this.getCurrentNamespaceKey()}__${name}__${mname}`;
				const func: FuncIR = {
					name: mangled,
					label: mangled,
					params: ["this", ...member.parameters.map((p) => (p.name as ts.Identifier).text)],
					returns: [], // TODO: get returns
					body: [],
					returnedType: false, // used interally in lowering
				};
				this.functionRegistry.set(mangled, func);
				this.irBuilder.addFunction(func);

				cls.methods.set(mname, { name: member.name.getText(), idx: fieldCounter++, func, methodName: name }); // idx is resolved in lowering phase
			}
		}

		if (ctor) {
			for (const param of ctor.parameters) {
				const name = (param.name as ts.Identifier).text;
				const isParamProperty = param.modifiers?.some(
					(m) =>
						m.kind === ts.SyntaxKind.PrivateKeyword ||
						m.kind === ts.SyntaxKind.PublicKeyword ||
						m.kind === ts.SyntaxKind.ProtectedKeyword ||
						m.kind === ts.SyntaxKind.ReadonlyKeyword,
				);
				if (isParamProperty) {
					cls.fields.set(name, { idx: fieldCounter++, type: this.resolveNodeType(param.type), name });
				}
			}
		}

		this.classRegistry.set(name, cls);
		this.irBuilder.addClass(cls);
	}

	private compileClass(node: ts.ClassDeclaration) {
		const name = node.name!.text;
		const cls = this.classRegistry.get(name)!;
		const prev = this.currentClass;
		this.currentClass = cls;

		for (const member of node.members) {
			if (ts.isMethodDeclaration(member)) {
				const mname = (member.name as ts.Identifier).text;
				const mangled = `NS__${this.getCurrentNamespaceKey()}__${name}__${mname}`;
				const func = this.functionRegistry.get(mangled)!;

				this.beginScope();
				func.params.forEach((p) => {
					this.declareLocal(p); // also includes "this"
				});

				const prev = this.currentFunc;
				this.currentFunc = func;

				if (member.body) {
					for (const stmt of member.body.statements) {
						func.body.push(...this.compileStatement(stmt));
					}
				}

				this.currentFunc = prev;
				this.exitScope();
			}

			if (ts.isConstructorDeclaration(member)) {
				this.compileConstructor(member);
			}
		}
		this.currentClass = prev;
	}

	private compileConstructor(member: ts.ConstructorDeclaration) {
		const cls = this.currentClass!;
		const name = cls.name;
		const mangled = `NS__${this.getCurrentNamespaceKey()}__${name}__CONSTRUCTOR`;

		const func: FuncIR = {
			name: mangled,
			label: mangled,
			params: ["this", ...member.parameters.map((p) => (p.name as ts.Identifier).text)],
			returns: [],
			body: [],
			returnedType: false,
		};

		this.functionRegistry.set(mangled, func);
		this.irBuilder.addFunction(func);

		this.beginScope();
		func.params.forEach((p) => this.declareLocal(p));

		const prev = this.currentFunc;
		this.currentFunc = func;

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
				func.body.push(...this.compileStatement(stmt));
			}
		}

		this.currentFunc = prev;
		this.exitScope();
	}

	private registerFunction(node: ts.FunctionDeclaration): FuncIR {
		const name = node.name!.text;
		const params = node.parameters.map((p) => (p.name as ts.Identifier).text);

		const func: FuncIR = {
			name: `NS__${this.getCurrentNamespaceKey()}__${name}`,
			label: `NS__${this.getCurrentNamespaceKey()}__${name}`,
			params,
			returns: [],
			body: [],
			returnedType: false,
		};

		this.functionRegistry.set(name, func);
		this.irBuilder.addFunction(func);
		return func;
	}

	private compileFunction(node: ts.FunctionDeclaration) {
		this.beginScope();

		const name = node.name!.text;
		const func = this.functionRegistry.get(name)!;

		if (node.type && node.type.getText() !== "void") {
			func.returns = [this.resolveNodeType(node.type)];
		}

		for (const p of node.parameters) {
			this.declareLocal((p.name as ts.Identifier).text);
		}

		const prev = this.currentFunc;
		this.currentFunc = func;

		if (node.body) {
			for (const stmt of node.body.statements) {
				const ir = this.compileStatement(stmt);
				if (ir) func.body.push(...ir);
			}
		}

		this.currentFunc = prev;
		this.exitScope();
	}

	private compileStatement(node: ts.Statement): Stmt[] {
		// variables
		if (ts.isVariableStatement(node)) {
			return this.compileVariableStatement(node);
		}

		// expression statements. why?
		if (ts.isExpressionStatement(node)) {
			const expr = node.expression;

			if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
				return this.compileAssignmentStatement(expr);
			}
			return [
				{
					type: "expr",
					expr: this.compileExpr(expr),
				},
			];
		}

		// return
		if (ts.isReturnStatement(node)) {
			return [
				{
					type: "return",
					values: node.expression ? [this.compileExpr(node.expression)] : [],
					fn: this.currentFunc!,
				},
			];
		}

		throw Error(`Unsupported Statement: '${ts.SyntaxKind[node.kind]}'`);
	}

	private compileVariableStatement(node: ts.VariableStatement): Stmt[] {
		return [...node.declarationList.declarations].map((decl) => {
			const name = (decl.name as ts.Identifier).text;
			this.declareLocal(name);

			const value = decl.initializer
				? this.compileExpr(decl.initializer)
				: ({ type: "number", value: 0 } as Expr);

			return { type: "let", name, value } satisfies Stmt;
		});
	}

	private compileExpr(node: ts.Expression): Expr {
		// number literals
		if (ts.isNumericLiteral(node)) {
			return { type: "number", value: parseFloat(node.text) };
		}

		// boolean literals
		if (node.kind === ts.SyntaxKind.TrueKeyword) {
			return { type: "boolean", value: true };
		}
		if (node.kind === ts.SyntaxKind.FalseKeyword) {
			return { type: "boolean", value: false };
		}

		// variables
		if (ts.isIdentifier(node)) {
			if (this.isLocal(node.text)) {
				return { type: "local", name: node.text };
			}
			return { type: "global", name: node.text };
		}

		// just unwrap it lol
		if (ts.isParenthesizedExpression(node)) {
			return this.compileExpr(node.expression);
		}

		// binary expression
		if (ts.isBinaryExpression(node)) {
			return this.compileExpr_BINARY(node);
		}

		// unary expression
		if (ts.isPrefixUnaryExpression(node)) {
			return this.compileExpr_PREFIXUNARY(node);
		}

		// calls
		if (ts.isCallExpression(node)) {
			return this.compileExpr_CALL(node);
		}

		// property access (obj.xyz)
		if (ts.isPropertyAccessExpression(node)) {
			return this.compileExpr_PROPERTYACCESS(node);
		}

		// this
		if (node.kind === ts.SyntaxKind.ThisKeyword) return { type: "local", name: "this" };

		// new
		if (ts.isNewExpression(node)) {
			const className = (node.expression as ts.Identifier).text;
			return {
				type: "new",
				className,
				args: (node.arguments ?? []).map((a) => this.compileExpr(a)),
			};
		}

		throw Error(`Unsupported Expression: '${ts.SyntaxKind[node.kind].toString()}'`);
	}

	private compileExpr_BINARY(node: ts.BinaryExpression): Expr {
		const left = this.compileExpr(node.left);
		const right = this.compileExpr(node.right);
		/* eslint-disable prettier/prettier */
		switch (node.operatorToken.kind) {
			case ts.SyntaxKind.PlusToken: return { type: "binary", op: "add", left, right }; 						// +
			case ts.SyntaxKind.MinusToken: return { type: "binary", op: "sub", left, right }; 						// -
			case ts.SyntaxKind.AsteriskToken: return { type: "binary", op: "mul", left, right };					// *
			case ts.SyntaxKind.SlashToken: return { type: "binary", op: "div", left, right }; 						// /
			case ts.SyntaxKind.PercentToken: return { type: "binary", op: "mod", left, right };						// %
			case ts.SyntaxKind.EqualsEqualsEqualsToken: return { type: "binary", op: "eq", left, right }; 			// ===
			case ts.SyntaxKind.ExclamationEqualsEqualsToken: return { type: "binary", op: "ne", left, right }; 		// !==
			case ts.SyntaxKind.LessThanToken: return { type: "binary", op: "lt", left, right };						// <
			case ts.SyntaxKind.GreaterThanToken: return { type: "binary", op: "gt", left, right }; 					// >
			case ts.SyntaxKind.LessThanEqualsToken: return { type: "binary", op: "le", left, right };				// <=
			case ts.SyntaxKind.GreaterThanEqualsToken: return { type: "binary", op: "ge", left, right };			// >=
			case ts.SyntaxKind.AmpersandAmpersandToken: return { type: "binary", op: "and", left, right };			// &&
			case ts.SyntaxKind.BarBarToken: return { type: "binary", op: "or", left, right };						// ||
			case ts.SyntaxKind.AmpersandToken: return { type: "binary", op: "band", left, right };					// &
			case ts.SyntaxKind.BarToken: return { type: "binary", op: "bor", left, right };							// |
			case ts.SyntaxKind.CaretToken: return { type: "binary", op: "bxor", left, right };						// ^
			case ts.SyntaxKind.LessThanLessThanToken: return { type: "binary", op: "shl", left, right };			// <<
			case ts.SyntaxKind.GreaterThanGreaterThanToken: return { type: "binary", op: "shr", left, right };		// >>
			case ts.SyntaxKind.FirstAssignment: return { type: "binary", op: "assign", left, right };				// =
			default: throw Error(`Unsupported binary expression: '${ts.SyntaxKind[node.operatorToken.kind].toString()}'!`);
		}
		/* eslint-enable prettier/prettier */
	}

	private compileExpr_PREFIXUNARY(node: ts.PrefixUnaryExpression): Expr {
		const expr = this.compileExpr(node.operand);
		/* eslint-disable prettier/prettier */
		switch (node.operator) {
			case ts.SyntaxKind.MinusToken: return { type: "unary", op: "neg", expr };											// -
			case ts.SyntaxKind.ExclamationToken: return { type: "unary", op: "not", expr };										// !
			case ts.SyntaxKind.TildeToken: return { type: "unary", op: "bnot", expr };											// ~
			default: throw Error(`Unsupported binary expression: '${ts.SyntaxKind[node.operator].toString()}'!`);
		}
		/* eslint-enable prettier/prettier */
	}

	private compileExpr_CALL(node: ts.CallExpression): Expr {
		// obj.method()
		if (ts.isPropertyAccessExpression(node.expression)) {
			const property = node.expression as ts.PropertyAccessExpression;

			const obj = this.compileExpr(property.expression);
			const methodName = property.name.getText();

			const cls = this.getClassIR(property);
			const method = cls.methods.get(methodName)!;
			const methodIdx = method.idx;

			return {
				type: "method_call",
				obj,
				methodIdx,
				args: node.arguments.map((a) => this.compileExpr(a)),
				name: methodName,
				clazz: cls.name,
			};
		}

		// builtin global functions
		if (ts.isIdentifier(node.expression)) {
			// There are litteraly none, but JUST IN CASE
		}

		// foo()
		if (ts.isIdentifier(node.expression)) {
			const fnName = node.expression.text;

			const func = this.functionRegistry.get(fnName);
			if (!func) throw Error(`Unknown function ${fnName}`);

			return {
				type: "call",
				func,
				args: node.arguments.map((a) => this.compileExpr(a)),
			};
		}

		throw Error(`Unsupported call expression: '${ts.SyntaxKind[node.expression.kind].toString()}'!`);
	}

	private compileExpr_PROPERTYACCESS(node: ts.PropertyAccessExpression): Expr {
		const obj = this.compileExpr(node.expression);
		const fieldName = node.name.text;
		const cls = this.getClassIR(node);

		const field = cls.fields.get(fieldName);
		if (field) {
			return { type: "field", obj, fieldIdx: field.idx, name: fieldName };
		}

		const method = cls.methods.get(fieldName);
		if (method) {
			return { type: "field", obj, fieldIdx: method.idx, name: fieldName };
		}

		throw Error(`Unknown field/method '${fieldName}' on class '${cls.name}'`);
	}

	private compileAssignmentStatement(node: ts.BinaryExpression): Stmt[] {
		const value = this.compileExpr(node.right);

		// this.field = val
		if (ts.isPropertyAccessExpression(node.left)) {
			const cls = this.getClassIR(node.left);
			const fieldName = node.left.name.text;
			const field = cls.fields.get(fieldName)!;
			const obj = this.compileExpr(node.left.expression);
			return [{ type: "field_assign", obj, fieldIdx: field.idx, value, name: fieldName }];
		}

		// x = val
		if (ts.isIdentifier(node.left)) {
			return [{ type: "local_assign", name: node.left.text, value }];
		}

		throw Error(`Unsupported assignment target: ${ts.SyntaxKind[node.left.kind]}`);
	}

	// helpers
	private resolveNodeType(node?: ts.TypeNode): SWTypes {
		if (!node) return "number";
		const text = node.getText();

		if (text === "boolean") return "boolean";
		if (text === "number") return "number";
		return "table";
	}

	private getClassIR(node: ts.PropertyAccessExpression): ClassIR {
		const type = this.checker.getTypeAtLocation(node.expression);
		const symbol = type.getSymbol();
		const className = symbol?.getName();

		if (!className) throw Error(`Cannot resolve class for expression`);

		const cls = this.classRegistry.get(className);
		if (!cls) throw Error(`Unknown class '${className}'`);

		return cls;
	}

	private getParentName(node: ts.ClassDeclaration): string | undefined {
		const clause = node.heritageClauses?.find((h) => h.token === ts.SyntaxKind.ExtendsKeyword);
		if (!clause) return undefined;
		return (clause.types[0].expression as ts.Identifier).text;
	}

	// scope helpers
	private beginScope() {
		this.scopes.push(new Set());
	}

	private exitScope() {
		this.scopes.pop();
	}

	private declareLocal(name: string) {
		this.scopes[this.scopes.length - 1].add(name);
	}

	private isLocal(name: string): boolean {
		for (let i = this.scopes.length - 1; i >= 0; i--) {
			if (this.scopes[i].has(name)) return true;
		}
		return false;
	}

	// namespace helpers
	private getCurrentNamespaceKey(): string {
		return this.namespaceStack.join("__") || "GLOBAL";
	}
}
