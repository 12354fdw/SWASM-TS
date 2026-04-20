// this might not be pretty but it works

export function generateROM(id: number, data: number[]): string {
	return `iN,iB,oN,oB=input.getNumber,input.getBool,output.setNumber,output.setBool
ID=${id}
data={${data.join(",")}}
function onTick()
  local sel=iN(31)
  if sel~=ID then return end
  
  local idx=iN(32)
  oN(1, data[idx] or 0)
end`;
}

export function generateVM(romtable: number[]) {
	return `
SPEED=100
iN,iB,oN,oB=input.getNumber,input.getBool,output.setNumber,output.setBool
code={}
roms={${romtable.join(",")}}
rs,ri,ci=1,1,1
BOOT=true
BOOT_WRITE_DELAY=4

m,lm,lp,s,cs,pc,hlt={},{{}},1,{},{},1,false
abs,sq,fl,ce,mi,ma=math.abs,math.sqrt,math.floor,math.ceil,math.min,math.max

function pu(v)s[#s+1]=v end
function po(tbl)local v=tbl[#tbl]tbl[#tbl]=nil return v end

o={
[0]=function()end,
[1]=function()hlt=true oN(32, 1234567890)oN(31,pc-1) end,
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

if BOOT then
  local waddr=ci-BOOT_WRITE_DELAY
  if waddr>0 then code[waddr]=iN(1)end
  ci=ci+1
  oN(31,rs) oN(32,ri)
  ri=ri+1
  if ri>roms[rs]+BOOT_WRITE_DELAY then rs=rs+1 ri=1 end
  if roms[rs]==nil then BOOT=false pc=1 oB(32, true)end
  return
end
for i=1,SPEED do
	local op=code[pc]oN(31,pc)pc=pc+1 (o[op])()if hlt then return end
end
end`;
}
