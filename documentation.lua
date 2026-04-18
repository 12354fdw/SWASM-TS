-- this is only a .lua file because of funny coloring in vs code
-- treat it as a .txt


--[[
    m = memory (table containing variables)
    s = stack (another table)
    cs = call stack (stores then call site)
    pc = program counter (current instruction)
    hlt = halt flag

    call site = address of instruction that called it
]]
goofy = {
[0] = "NOP", -- Does nothing.
[1] = "UNREACHABLE", -- Halts
[2] = "RETURN", -- pops the call stack 
[3] = "CALL", -- saves current address and then jumps to target address
[4] = "JMP", -- sets program counter to the code[pc] (argument)  
[5] = "JZ", -- pops data in stack, if returns 0, jump to argument
[6] = "JNZ", -- pops data in stack, if returns NOT 0, jump to argument
[7] = "JT", -- pops data in stack, if returns TRUE, jump to argument
[8] = "JF", -- pops data in stack, if returns FALSE, jump to argument

[9] = "PUSH_N",  -- pushes number to stack
[10] = "PUSH_B", -- push boolean to stack
[11] = "POP", -- pops stack
[12] = "DUP", -- duplicates last value in stack
[13] = "SWAP", -- swaps the 2 latest values in stack
[14] = "SELECT", -- pops 3 values in stack, then pushes b if A is not 0, otherwise pushed C

[15] = "LOCAL_GET", -- pushes local memory[local pointer][args[1]] to stack
[16] = "LOCAL_SET", -- sets local memory[local pointer][args[1]] to result of popping stack
[17] = "LOCAL_TEE", -- sets local memory[local pointer][args[1]] to result of popping stack, then pushes the popped stack result back into stack
[18] = "GLOBAL_GET", -- pushes memory address args[1] to stack
[19] = "GLOBAL_SET",


[20] = "LOAD", -- pushes stack with memory address args[1]
[21] = "STORE", -- 
[22] = "LOAD_DYN",
[23] = "STORE_DYN",

[24] = "ADD",
[25] = "SUB",
[26] = "MUL",
[27] = "DIV",
[28] = "MOD",
[29] = "ABS",
[30] = "NEG",
[31] = "SQRT",
[32] = "FLOOR",
[33] = "CEIL",
[34] = "MIN",
[35] = "MAX",

[36] = "EQ",
[37] = "NE",
[38] = "LT",
[39] = "GT",
[40] = "LE",
[41] = "GE",

[42] = "AND",
[43] = "OR",
[44] = "NOT",
[45] = "XOR",

[46] = "BAND",
[47] = "BOR",
[48] = "BXOR",
[49] = "BNOT",
[50] = "SHL",
[51] = "SHR",

[52] = "NUM_TO_BOOL",
[53] = "BOOL_TO_NUM",

[54] = "IN_NUM",
[55] = "IN_BOOL",
[56] = "OUT_NUM",
[57] = "OUT_BOOL",

[58] = "TABLE_NEW",
[59] = "TABLE_GET",
[60] = "TABLE_SET",
[61] = "TABLE_GET_DYN",
[62] = "TABLE_SET_DYN",
[63] = "TABLE_LEN",
[64] = "TABLE_INSERT",
[65] = "TABLE_REMOVE",
}