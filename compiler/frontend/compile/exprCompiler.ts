import ts from "typescript";
import { Expr } from "../../ir";
import { CompileContext } from "./compileContext";
import { getClassIR, resolveFunction } from "../utils";

export class ExprCompiler {
	constructor(private ctx: CompileContext) {
		ctx.exprCompiler = this;
	}

	public compile(node: ts.Expression): Expr {
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
			if (this.ctx.isLocal(node.text)) {
				return { type: "local", name: node.text };
			}

			const idx = this.ctx.getCurrentNS().globals.get(node.text)?.idx;
			if (!idx) throw Error(`Unknown global '${this.ctx.getCurrentNS().name}.${node.text}'`);
			return {
				type: "global",
				ref: {
					name: node.text,
					idx: idx,
				},
			};
		}

		// just unwrap it lol
		if (ts.isParenthesizedExpression(node)) {
			return this.compile(node.expression);
		}

		// binary expressions
		if (ts.isBinaryExpression(node)) {
			return this.compileExpr_BINARY(node);
		}

		// prefixunary
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
			const cls = this.ctx.resolveClass(className);
			if (!cls) throw Error(`Unknown class: ${className}`);

			return {
				type: "new",
				className,
				ctorLabel: cls.ctorLabel,
				args: (node.arguments ?? []).map((a) => this.compile(a)),
			};
		}

		// array
		if (ts.isArrayLiteralExpression(node)) {
			const init = node.elements.map((v) => {
				return this.compile(v);
			});

			return {
				type: "new_array",
				init,
			};
		}

		throw Error(`Unsupported Expression: '${ts.SyntaxKind[node.kind].toString()}'`);
	}

	private compileExpr_BINARY(node: ts.BinaryExpression): Expr {
		const left = this.compile(node.left);
		const right = this.compile(node.right);
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
		const expr = this.compile(node.operand);
		/* eslint-disable prettier/prettier */
			switch (node.operator) {
				case ts.SyntaxKind.MinusToken: return { type: "unary", op: "neg", expr };								// -
				case ts.SyntaxKind.ExclamationToken: return { type: "unary", op: "not", expr };							// !
				case ts.SyntaxKind.TildeToken: return { type: "unary", op: "bnot", expr };								// ~
				default: throw Error(`Unsupported binary expression: '${ts.SyntaxKind[node.operator].toString()}'!`);
			}
		/* eslint-enable prettier/prettier */
	}

	private compileExpr_CALL(node: ts.CallExpression): Expr {
		// obj.method()
		if (ts.isPropertyAccessExpression(node.expression)) {
			const property = node.expression as ts.PropertyAccessExpression;

			// IO functions
			if (ts.isIdentifier(property.expression) && property.expression.text === "IO") {
				const fnName = property.name.text;
				if (fnName === "getNumber")
					return {
						type: "in_num",
						channel: parseInt((node.arguments[0] as ts.NumericLiteral).text),
					};
				if (fnName === "getBool")
					return {
						type: "in_bool",
						channel: parseInt((node.arguments[0] as ts.NumericLiteral).text),
					};
			}

			const obj = this.compile(property.expression);
			const methodName = property.name.getText();

			const cls = getClassIR(property, this.ctx);
			const method = cls.methods.get(methodName)!;
			const methodIdx = method.idx;

			return {
				type: "method_call",
				obj,
				methodIdx,
				args: node.arguments.map((a) => this.compile(a)),
				name: methodName,
				clazz: cls.name,
			};
		}

		// foo()
		if (ts.isIdentifier(node.expression)) {
			const fnName = node.expression.text;

			const func = resolveFunction(fnName, this.ctx);
			if (!func) throw Error(`Unknown function ${fnName}`);

			return {
				type: "call",
				func,
				args: node.arguments.map((a) => this.compile(a)),
			};
		}

		throw Error(`Unsupported call expression: '${ts.SyntaxKind[node.expression.kind].toString()}'!`);
	}

	private compileExpr_PROPERTYACCESS(node: ts.PropertyAccessExpression): Expr {
		const obj = this.compile(node.expression);
		const fieldName = node.name.text;
		const cls = getClassIR(node, this.ctx);

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
}
