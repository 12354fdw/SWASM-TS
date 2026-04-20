#!/usr/bin/env node

import process from "process";
import { $custom, $error, $fatal, $info, $warn } from "./logger";
import * as fs from "fs";
import * as ts from "typescript";
import chalk from "chalk";
import { Codegen } from "./frontend";

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
	typeRoots: ["./compiler"],
	types: ["swasm"],
});

const diagnostics = ts.getPreEmitDiagnostics(TSProgram);

let isThereError = false;

if (diagnostics.length > 0) {
	$warn("There are compile diagnostics!");
	diagnostics.forEach((diagnostic: ts.Diagnostic) => {
		switch (diagnostic.category) {
			case ts.DiagnosticCategory.Error:
				$custom(diagnostic.messageText.toString(), chalk.red("EROR"), "DIAGNOSTICS");
				isThereError = true;
				break;

			case ts.DiagnosticCategory.Message:
				$custom(diagnostic.messageText.toString(), chalk.green("MESG"), "DIAGNOSTICS");
				break;

			case ts.DiagnosticCategory.Suggestion:
				$custom(diagnostic.messageText.toString(), chalk.blueBright("SUGG"), "DIAGNOSTICS");
				break;

			case ts.DiagnosticCategory.Warning:
				$custom(diagnostic.messageText.toString(), chalk.yellow("WARN"), "DIAGNOSTICS");
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
