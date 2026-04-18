import chalk from "chalk";

const defaultTag = "SWASM-COMPILE";

export function $info(str: string, tag: string = defaultTag) {
	console.log(chalk.blueBright(`[${tag}] `) + chalk.green("[INFO] ") + chalk.white(str));
}

export function $warn(str: string, tag: string = defaultTag) {
	console.log(chalk.blueBright(`[${tag}] `) + chalk.yellow("[WARN] ") + chalk.white(str));
}

export function $error(str: string, tag: string = defaultTag) {
	console.log(chalk.blueBright(`[${tag}] `) + chalk.red("[EROR] ") + chalk.white(str));
}

export function $fatal(str: string, tag: string = defaultTag) {
	console.log(chalk.blueBright(`[${tag}] `) + chalk.bgRed(chalk.white("[FATL] ")) + chalk.white(str));
}

export function $custom(str: string, Type: string, tag: string = defaultTag) {
	console.log(chalk.blueBright(`[${tag}] `) + `[${Type}] ` + chalk.white(str));
}
