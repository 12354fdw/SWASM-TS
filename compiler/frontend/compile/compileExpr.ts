import ts from "typescript";
import { Expr } from "../../ir";
import { CompileContext } from "./compileContext";

export class ExprCompiler {
	constructor(private readonly ctx: CompileContext) {}

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
}
