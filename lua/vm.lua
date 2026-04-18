-- =========================
-- STORMWORKS COMPAT LAYER
-- =========================

local file = io.open("./a.out", "r")
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

-- opcode -> name
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
  [66] = "CALL_DYN"
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

function dumpState(opcode)
  print("================== DUMP ==================")

  local name = OpName[opcode] or "???"
  local argc = OpOperand[opcode] or 0

  local operandStr = ""

  if argc > 0 then
    for i = 1, argc do
      local v = code[pc + i]
      if v == nil then v = "?" end
      operandStr = operandStr .. tostring(v) .. " "
    end
    print("PC:", pc, "OP:", name.." "..operandStr)
  else
    print("PC:", pc, "OP:", name)
  end

  print("STACK:")
  for i,v in ipairs(s) do
    print(i, v, type(v))
  end

  print("CURRENT LOCAL FRAME:")
  for i,v in pairs(lm[lp]) do
      print(i, v, type(v))
  end
  print("LP:", lp)
  print("LM SIZE:", #lm)

  print("MEM:")
  for k,v in ipairs(m) do
    print(k, v, type(v))
  end

  print("CS:")
  for i,v in ipairs(cs) do
    print(i, v)
  end

  print("==========================================")
end

-- =========================
-- VM
-- =========================


SPEED=100
code={}for s in string.gmatch(property.getText("CODE"),"([^,]+)")do code[#code+1]=tonumber(s)end
m,lm,lp,s,cs,pc,hlt={},{{}},1,{},{},1,false
abs,sq,fl,ce,mi,ma=math.abs,math.sqrt,math.floor,math.ceil,math.min,math.max
iN,iB,oN,oB=input.getNumber,input.getBool,output.setNumber,output.setBool

function pu(v)s[#s+1]=v end
function po(tbl)local v=tbl[#tbl]tbl[#tbl]=nil return v end

o={
[0]=function()end,
[1]=function()hlt=true output.setNumber(32, 1234567890)output.setNumber(31,pc-1) end,
[2]=function()pc=po(cs)lp=lp-1 end,
[3]=function()local a=code[pc];pc=pc+1;cs[#cs+1]=pc;pc=a;lp=lp+1;lm[lp]={} end,
[4]=function()pc=code[pc] end,
[5]=function()local a=code[pc];pc=pc+1;if po(s)==0 then pc=a end end,
[6]=function()local a=code[pc];pc=pc+1;if po(s)~=0 then pc=a end end,
[7]=function()local a=code[pc];pc=pc+1;if po(s)==true then pc=a end end,
[8]=function()local a=code[pc];pc=pc+1;local c=po(s);if c==false or c==0 then pc=a end end,

[9]=function()pu(code[pc]);pc=pc+1 end,
[10]=function()pu(code[pc]~=0);pc=pc+1 end,
[11]=function()po(s)end,
[12]=function()pu(s[#s])end,
[13]=function()local a,b=po(s),po(s);pu(a);pu(b)end,
[14]=function()local c,b,a=po(s),po(s),po(s);pu(a~=0 and b or c)end,

[15]=function()local i=code[pc];pc=pc+1;pu(lm[lp][i])end,
[16]=function()local i=code[pc];pc=pc+1;lm[lp][i]=po(s)end,
[17]=function()local i=code[pc];pc=pc+1;local v=po(s);lm[lp][i]=v;pu(v)end,
[18]=function()pu(m[code[pc]]);pc=pc+1 end,
[19]=function()m[code[pc]]=po(s);pc=pc+1 end,

[20]=function()local a=code[pc];pc=pc+1;pu(m[a])end,
[21]=function()local a=code[pc];pc=pc+1;m[a]=po(s)end,
[22]=function()local a=po(s);pu(m[a])end,
[23]=function()local a,v=po(s),po(s);m[a]=v end,
[24]=function()local b,a=po(s),po(s);pu(a+b)end,
[25]=function()local b,a=po(s),po(s);pu(a-b)end,
[26]=function()local b,a=po(s),po(s);pu(a*b)end,
[27]=function()local b,a=po(s),po(s);pu(a/b)end,
[28]=function()local b,a=po(s),po(s);pu(a%b)end,
[29]=function()pu(math.abs(po(s)))end,
[30]=function()pu(-po(s))end,
[31]=function()pu(math.sqrt(po(s)))end,
[32]=function()pu(math.floor(po(s)))end,
[33]=function()pu(math.ceil(po(s)))end,
[34]=function()local b,a=po(s),po(s);pu(math.min(a,b))end,
[35]=function()local b,a=po(s),po(s);pu(math.max(a,b))end,
[36]=function()local b,a=po(s),po(s);pu(a==b)end,
[37]=function()local b,a=po(s),po(s);pu(a~=b)end,
[38]=function()local b,a=po(s),po(s);pu(a<b)end,
[39]=function()local b,a=po(s),po(s);pu(a>b)end,
[40]=function()local b,a=po(s),po(s);pu(a<=b)end,
[41]=function()local b,a=po(s),po(s);pu(a>=b)end,
[42]=function()local b,a=po(s),po(s);pu((a~=0) and (b~=0))end,
[43]=function()local b,a=po(s),po(s);pu((a~=0) or (b~=0))end,
[44]=function()pu(not po(s))end,
[45]=function()local b,a=po(s),po(s);pu((a~=b))end,
[46]=function()local b,a=po(s),po(s);pu(a&b)end,
[47]=function()local b,a=po(s),po(s);pu(a|b)end,
[48]=function()local b,a=po(s),po(s);pu(a~b)end,
[49]=function()pu(~po(s))end,
[50]=function()local b,a=po(s),po(s);pu(a<<b)end,
[51]=function()local b,a=po(s),po(s);pu(a>>b)end,
[52]=function()pu(po(s)~=0)end,
[53]=function()pu(po(s) and 1 or 0)end,
[54]=function()pu(iN(code[pc]));pc=pc+1 end,
[55]=function()pu(iB(code[pc]));pc=pc+1 end,
[56]=function()oN(code[pc],po(s));pc=pc+1 end,
[57]=function()oB(code[pc],po(s));pc=pc+1 end,
[58]=function()pu({})end,
[59]=function()local k=code[pc];pc=pc+1;local t=po(s);pu(type(t)=="table" and t[k] or nil)end,
[60]=function()local k=code[pc];pc=pc+1;local v=po(s);local t=po(s);if type(t)=="table" then t[k]=v end end,
[61]=function()local k,t=po(s),po(s);pu(type(t)=="table" and t[k] or nil)end,
[62]=function()local k,v,t=po(s),po(s),po(s);if type(t)=="table" then t[k]=v end end,
[63]=function()local t=po(s);pu(type(t)=="table" and #t or 0)end,
[64]=function()local v,t=po(s),po(s);if type(t)=="table" then t[#t+1]=v end end,
[65]=function()local k=code[pc];pc=pc+1;local t=po(s);if type(t)=="table" then table.remove(t,k) end end,
[66]=function()local a=po(s);cs[#cs+1]=pc;lp=lp+1;lm[lp]={};pc=a end,
}

function onTick()
if hlt then return end
for i=1,SPEED do local op=code[pc] dumpState(op) pc=pc+1 (o[op])()if hlt then return end end
end

-- =========================
-- STORMWORKS COMPAT LAYER
-- =========================

while true do onTick() end