-- =========================
-- STORMWORKS COMPAT LAYER
-- =========================

local file = io.open("a.out", "r")
local content = file:read("*a")
file:close()


local _property = {
  CODE = content
}

property = {}
function property.getText(key)
  return _property[key] or ""
end

input = {}
function input.getNumber(channel)
  return 0
end
function input.getBool(channel)
  return false
end

output = {}
function output.setNumber(channel, value)
  -- no-op (or print if you want debug)
end
function output.setBool(channel, value)
  -- no-op
end

-- oPROGRAM_COUNTERode -> name
local OpName = {
  [0] = "NOP", 
  [1] = "UNREACHABLE",
  [2] = "RETURN",
  [3] = "CALL",
  [4] = "JMP",
  [5] = "JZ",
  [6] = "JNZ",
  [7] = "JT",
  [8] = "JF",

  [9] = "PUSH_N",
  [10] = "PUSH_B",
  [11] = "POP",
  [12] = "DUP",
  [13] = "SWAP",
  [14] = "SELECT",

  [15] = "LOCAL_GET",
  [16] = "LOCAL_SET",
  [17] = "LOCAL_TEE",
  [18] = "GLOBAL_GET",
  [19] = "GLOBAL_SET",

  [20] = "LOAD",
  [21] = "STORE",
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

local OpOperand = {
  [3] = 1,   -- CALL addr
  [4] = 1,   -- JMP addr
  [5] = 1,   -- JZ addr
  [6] = 1,   -- JNZ addr
  [7] = 1,   -- JT addr
  [8] = 1,   -- JF addr

  [9] = 1,   -- PUSH_N value
  [10] = 1,  -- PUSH_B value

  [15] = 1,  -- LOCAL_GET idx
  [16] = 1,
  [17] = 1,
  [18] = 1,
  [19] = 1,

  [20] = 1,  -- LOAD addr
  [21] = 1,

  [54] = 1,  -- IN_NUM
  [55] = 1,
  [56] = 1,
  [57] = 1,

  [59] = 1,  -- TABLE_GET key
  [60] = 1,
  [65] = 1,
}

function dumpState(oPROGRAM_COUNTERode)
  print("================== DUMP ==================")

  local name = OpName[oPROGRAM_COUNTERode] or "???"
  local argc = OpOperand[oPROGRAM_COUNTERode] or 0

  local operandStr = ""

  if argc > 0 then
    for i = 1, argc do
      local v = code[PROGRAM_COUNTER + i]
      if v == nil then v = "?" end
      operandStr = operandStr .. tostring(v) .. " "
    end
    print("PROGRAM_COUNTER:", PROGRAM_COUNTER, "OP:", name.." "..operandStr)
  else
    print("PROGRAM_COUNTER:", PROGRAM_COUNTER, "OP:", name)
  end

  print("STACK:")
  for i,v in ipairs(s) do
    print(i, v, type(v))
  end

  print("MEM:")
  for k,v in pairs(m) do
    print(k, v, type(v))
  end

  print("CALLSTACK:")
  for i,v in ipairs(CALLSTACK) do
    print(i, v)
  end

  print("==========================================")
end

-- =========================
-- VM
-- =========================

SPEED=100
ROM_CODE={}
for str in string.gmatch(property.getText("CODE"),"([^,]+)") do 
  ROM_CODE[#ROM_CODE+1]=tonumber(str)
end

-- you suck
local MEMORY = {} -- Memory bank. Stores variables
local STACK = {} -- Stack, stores variable with push/pop
local CALLSTACK = {} -- Stores address that called it
local PROGRAM_COUNTER = 1 -- Stores current instruction address
local HALT = false -- if true, halts processor

local LOCAL_MEMORY = {{}} -- contains local variables in current scope
-- reason to have the {} inside it is to init a frame at the highest level
local LOCAL_POINTER = 1 -- what scope inside that local memory to use

local CACHE = {} -- stores variables in function

local function INCREMENT_PROGRAM_COUNTER()
  PROGRAM_COUNTER = PROGRAM_COUNTER + 1
end

local function PUSH_STACK(VARIABLE) -- Pushes a variable to STACK
  table.insert(STACK,VARIABLE)
end

local function POP_CALLSTACK() -- Deletes latest variable in callstack and returns it
  return table.remove(CALLSTACK, #CALLSTACK)
end

local function POP_STACK() -- Deletes latest variable in stack and returns it
  return table.remove(STACK, #STACK)
end

local function GET_ARGS() -- returns argument (hard to explain)
  local var = ROM_CODE[PROGRAM_COUNTER]
  INCREMENT_PROGRAM_COUNTER()
  return var
end

OPERATIONS = {
  -- IDK SOMETHING

  [0] = function() end, -- NOP, does nothing.

  [1] = function() -- UNREACHABLE
    HALT = true -- set HALT to true
  end, 

  [2] = function() -- RETURN
    PROGRAM_COUNTER = POP_CALLSTACK()  -- POP callstack then set PC to it
  end,

  [3] = function() -- CALL
    CACHE[1] = GET_ARGS() -- set CACHE[1] to args[1]
    table.insert(CALLSTACK, PROGRAM_COUNTER) -- adds PC to callstack
    PROGRAM_COUNTER = CACHE[1] --sets PC to CACHE[1], which is just args[1]
  end,

  [4] = function() -- JMP
    PROGRAM_COUNTER = GET_ARGS() -- sets PC to args[1]
  end,

  [5] = function() -- JZ
    CACHE[1] = GET_ARGS() -- get jump address (args[1])
    if POP_STACK() == 0 then
      PROGRAM_COUNTER = CACHE[1] -- pop stack, then if returned is 0, set PC to args[1]
    end
  end,

  [6] = function() -- JNZ,
    CACHE[1] = GET_ARGS() -- get jump address (args[1])
    if POP_STACK() ~= 0 then
      PROGRAM_COUNTER = CACHE[1] -- pop stack, then if returned is not 0, set PC to args[1]
    end
  end,

  [7] = function()  -- JT
    CACHE[1] = GET_ARGS() -- get jump address (args[1])
    if POP_STACK() == true then
      PROGRAM_COUNTER = CACHE[1] -- pop stack, then if returned is true, set PC to args[1]
    end
  end,

  [8] = function() -- JF
    CACHE[1] = GET_ARGS() -- get jump address (args[1])
    CACHE[2] = POP_STACK()
    if CACHE[2] == false or CACHE[2] == 0 then
      PROGRAM_COUNTER = CACHE[1] -- pop stack, then if returned is false or 0, set PC to args[1]
    end
  end,

  -- STACK STUFF
  [9] = function() -- PUSH_N
    PUSH_STACK(GET_ARGS()) -- push args[1] to stack
  end,

  [10] = function() -- PUSH_B
    PUSH_STACK(GET_ARGS() ~= 0) -- push (args[1] not equal to 0) to stack
  end,

  [11] = function() -- POP 
    POP_STACK() 
  end,

  [12] = function() -- DUP
    PUSH_STACK(STACK[#STACK]) -- duplicates latest value in stack
  end,

  [13] = function() -- SWAP
    -- this literally just swaps the 2 last values in stack
    CACHE[1] = POP_STACK()
    CACHE[2] = POP_STACK()
    PUSH_STACK(CACHE[1])
    PUSH_STACK(CACHE[2])
  end,

  [14] = function() -- SELECT
    CACHE[3] = POP_STACK()
    CACHE[2] = POP_STACK()
    CACHE[1] = POP_STACK()

    PUSH_STACK(CACHE[1] ~= 0 and CACHE[2] or CACHE[3]) -- i dont know what this even does
  end,

  [15] = function() 
  LOCAL_GET
    -- Pushes memory address args[1] to stack   CACHE[1] = GET_ARGS()
    PUSH_STACK(LOCAL_MEMORY[LOCAL_POINTER][CACHE[1]])
  end,

  [16] = function()
  -- LOCAL_SET
    -- Sets memory address args[1] to pop stack   CACHE[1] = GET_ARGS()
    LOCAL_MEMORY[LOCAL_POINTER][CACHE[1]] = POP_STACK()
  end,

  [17] = function() 
 -- LOCAL_TEE
    -- Sets memory address args[1] after popping stack, then pushes back into stack.   CACHE[1] = GET_ARGS()
     CACHE[2] = POP_STACK()
     LOCAL_MEMORY[LOCAL_POINTER][CACHE[1]] = CACHE[2]
    PUSH_STACK(CACHE[2])
  end,

  [18] = function()
  -- GLOBAL_GET   PUSH_STACK(MEMORY[GET_ARGS()])
  end,

  [19] = function() 
 -- GLOBAL_SET   
  end,

  [20] = function() -- LOAD
    CACHE[1] = GET_ARGS()
    PUSH_STACK(MEMORY[CACHE[1]])
  end,

  [21] = function() 
    CACHE[1] = GET_ARGS()
    memory[CACHE[1]] = POP_STACK()
  end,

  [22] = function() 

  end,

  [23] = function() 
  end,
  [24] = function() 
  end,
  [25] = function() 
  end,
  [26] = function() 
  end,
  [27] = function() 
  end,
  [28] = function() 
  end,
  [29] = function() 
  end,
  [30] = function() 
  end,
  [31] = function() 
  end,
  [32] = function() 
  end,
  [33] = function() 
  end,
  [34] = function() 
  end,
  [35] = function() 
  end,
  [36] = function() 
  end,
  [37] = function() 
  end,
  [38] = function() 
  end,
  [39] = function() 
  end,
  [40] = function() 
  end,
  [41] = function() 
  end,
  [42] = function() 
  end,
  [43] = function() 
  end,
  [44] = function() 
  end,
  [45] = function() 
  end,
  [46] = function() 
  end,
  [47] = function() 
  end,
  [48] = function() 
  end,
  [49] = function() 
  end,
  [50] = function() 
  end,
  [51] = function() 
  end,
  [52] = function() 
  end,
  [53] = function() 
  end,
  [54] = function() 
  end,
  [55] = function() 
  end,
  [56] = function() 
  end,
  [57] = function() 
  end,
  [58] = function() 
  end,
  [59] = function() 
  end,
  [60] = function() 
  end,
  [61] = function() 
  end,
  [62] = function() 
  end,
  [63] = function() 
  end,
  [64] = function() 
  end,
  [65] = function() 
  end,
}


-- what is it?

function onTick()
  if hlt then return end -- do nothing if HALT is true
  for i=1,SPEED do -- do SPEED instructions every tick (too much = laggy as hell)
    local OPERATION=code[PROGRAM_COUNTER]  
    dumpState(op) 
    PROGRAM_COUNTER=PROGRAM_COUNTER+1 
    (o[op])()
    if hlt then return end 
  end
end
