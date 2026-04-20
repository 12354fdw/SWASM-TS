function urlencode(str)
    return string.gsub(str, "([^%w])", function(c)
        return string.format("%%%02X", string.byte(c))
    end)
end
function log(msg) async.httpGet(8080,"/log?msg="..urlencode(tostring(msg))) end