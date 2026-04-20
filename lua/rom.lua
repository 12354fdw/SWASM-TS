iN,iB,oN,oB=input.getNumber,input.getBool,output.setNumber,output.setBool
ID=1
data={}
function onTick()
  local sel=iN(31)
  if sel~=ID then return end
  
  local idx=iN(32)
  oN(1, data[idx] or 0)
end