import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import prettier from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";
import { defineConfig } from "eslint/config";

export default defineConfig([
	// Base JS rules
	{
		files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
		plugins: { js },
		extends: ["js/recommended"],
		languageOptions: {
			globals: globals.browser,
		},
	},

	// CommonJS override
	{
		files: ["**/*.js"],
		languageOptions: {
			sourceType: "commonjs",
		},
	},

	// TypeScript rules
	...tseslint.configs.recommended,

	// ✅ Prettier integration (IMPORTANT)
	{
		plugins: {
			prettier,
		},
		rules: {
			"prettier/prettier": "warn",
		},
	},

	// ✅ disables ESLint rules that conflict with Prettier
	prettierConfig,
]);
