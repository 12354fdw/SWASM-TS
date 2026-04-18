import ts from "typescript";
import { CompileContext } from "./compileContext";
import { Stmt, Expr } from "../../ir";
import { getClassIR } from "../utils";

export class StmtCompiler {
	constructor(private ctx: CompileContext) {
		ctx.stmtCompiler = this;
	}

	public compile(node: ts.Statement): Stmt[] {
		// variables
		if (ts.isVariableStatement(node)) {
			return this.compileStmt_VARIABLE(node);
		}

		// expression statements. why?
		if (ts.isExpressionStatement(node)) {
			const expr = node.expression;

			if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
				return this.compileStmt_ASSIGNMENT(expr);
			}

			if (ts.isCallExpression(expr)) {
				const intrinsic = this.compileStmt_INTRINSIC(expr);
				if (intrinsic) return intrinsic;
			}
			return [
				{
					type: "expr",
					expr: this.ctx.exprCompiler.compile(expr),
				},
			];
		}

		// return
		if (ts.isReturnStatement(node)) {
			return [
				{
					type: "return",
					values: node.expression ? [this.ctx.exprCompiler.compile(node.expression)] : [],
					fn: this.ctx.currFunc!,
				},
			];
		}

		throw Error(`Unsupported Statement: '${ts.SyntaxKind[node.kind]}'`);
	}

	private compileStmt_VARIABLE(node: ts.VariableStatement): Stmt[] {
		return [...node.declarationList.declarations].map((decl) => {
			const name = (decl.name as ts.Identifier).text;
			this.ctx.declareLocal(name);

			const value = decl.initializer
				? this.ctx.exprCompiler.compile(decl.initializer)
				: ({ type: "number", value: 0 } as Expr);

			return { type: "let", name, value } satisfies Stmt;
		});
	}

	private compileStmt_ASSIGNMENT(node: ts.BinaryExpression): Stmt[] {
		const value = this.ctx.exprCompiler.compile(node.right);

		// this.field = val
		if (ts.isPropertyAccessExpression(node.left)) {
			const cls = getClassIR(node.left, this.ctx);
			const fieldName = node.left.name.text;
			const field = cls.fields.get(fieldName)!;
			const obj = this.ctx.exprCompiler.compile(node.left.expression);
			return [{ type: "field_assign", obj, fieldIdx: field.idx, value, name: fieldName }];
		}

		// x = val
		if (ts.isIdentifier(node.left)) {
			return [{ type: "local_assign", name: node.left.text, value }];
		}

		throw Error(`Unsupported assignment target: ${ts.SyntaxKind[node.left.kind]}`);
	}

	private compileStmt_INTRINSIC(node: ts.CallExpression): Stmt[] | null {
		if (!ts.isPropertyAccessExpression(node.expression)) return null;
		const prop = node.expression;
		if (!ts.isIdentifier(prop.expression)) return null;

		const ns = prop.expression.text;
		const fnName = prop.name.text;

		if (ns === "IO") {
			if (fnName === "setNumber")
				return [
					{
						type: "out_num",
						channel: parseInt((node.arguments[0] as ts.NumericLiteral).text),
						expr: this.ctx.exprCompiler.compile(node.arguments[1]),
					},
				];
			if (fnName === "setBool")
				return [
					{
						type: "out_bool",
						channel: parseInt((node.arguments[0] as ts.NumericLiteral).text),
						expr: this.ctx.exprCompiler.compile(node.arguments[1]),
					},
				];
		}

		return null;
	}
}
