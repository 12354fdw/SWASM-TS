#!/usr/bin/env node

import process from "process";
import { $custom, $error, $fatal, $info, $warn } from "./logger";
import * as fs from "fs";
import * as ts from "typescript";
import chalk from "chalk";
import { Codegen } from "./frontend";

$info("SWASM Compiler v1.0.1 DEV1");

const args = process.argv.slice(2);
if (args.length === 0) {
	$fatal("No arguments provided!");
	$fatal("Usage: swasm-compiler <source file>");
	process.exit(1);
}

const sourceFile = args[0];

if (!fs.existsSync(sourceFile)) {
	$fatal(`Source '${sourceFile}' doesn't exists!`);
	process.exit(1);
}

$info(`Creating TS Program`);
const TSProgram = ts.createProgram([sourceFile], {
	target: ts.ScriptTarget.ES2025,
	strict: true,
	lib: ["lib.es5.d.ts"], // freestanding typescript lol
	typeRoots: ["./compiler"],
	types: ["swasm"],
	skipLibCheck: true,
});

const diagnostics = ts.getPreEmitDiagnostics(TSProgram);

let isThereError = false;

function flattenDiagnosticMessageText(messageText: string | ts.DiagnosticMessageChain, indent: number = 0) {
	if (typeof messageText === "string") {
		return messageText;
	}

	let result = messageText.messageText;

	if (messageText.next) {
		result +=
			"\n" +
			messageText.next
				.map((msg) => " ".repeat(indent + 2) + flattenDiagnosticMessageText(msg, indent + 2))
				.join("\n");
	}

	return result;
}

if (diagnostics.length > 0) {
	$warn("There are compile diagnostics!");
	diagnostics.forEach((diagnostic: ts.Diagnostic) => {
		switch (diagnostic.category) {
			case ts.DiagnosticCategory.Error:
				$custom(flattenDiagnosticMessageText(diagnostic.messageText), chalk.red("EROR"), "DIAGNOSTICS");
				isThereError = true;
				break;

			case ts.DiagnosticCategory.Message:
				$custom(flattenDiagnosticMessageText(diagnostic.messageText), chalk.green("MESG"), "DIAGNOSTICS");
				break;

			case ts.DiagnosticCategory.Suggestion:
				$custom(flattenDiagnosticMessageText(diagnostic.messageText), chalk.blueBright("SUGG"), "DIAGNOSTICS");
				break;

			case ts.DiagnosticCategory.Warning:
				$custom(flattenDiagnosticMessageText(diagnostic.messageText), chalk.yellow("WARN"), "DIAGNOSTICS");
				break;
		}
	});
}

if (isThereError) {
	$error("BUILD FAILED");
	$fatal("There are errors! Refusing to compile!", "DIAGNOSTICS");
	process.exit(1);
}

try {
	const codegen = new Codegen(TSProgram);
	codegen.compile();
	$info(`BUILD SUCCESSFULL`);
} catch (e: unknown) {
	const error = e as Error;
	$error("BUILD FAILED");
	$fatal(`COMPILE ERROR: ${error.stack}`, "CODEGEN");
}
