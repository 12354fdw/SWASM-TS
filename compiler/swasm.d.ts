declare namespace IO {
	function getNumber(channel: number): number;
	function getBool(channel: number): boolean;
	function setNumber(channel: number, value: number): void;
	function setBool(channel: number, value: boolean): void;
}

declare namespace Math {
	function abs(x: number): number;
	function sqrt(x: number): number;
	function floor(x: number): number;
	function ceil(x: number): number;

	function min(a: number, b: number): number;
	function max(a: number, b: number): number;
}
