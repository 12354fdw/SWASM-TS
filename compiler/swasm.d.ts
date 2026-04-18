declare namespace IO {
	function getNumber(channel: number): number;
	function getBool(channel: number): boolean;
	function setNumber(channel: number, value: number): void;
	function setBool(channel: number, value: boolean): void;
}
