#!/usr/bin/env python3
# One-time script: replace <SECRET_TOKEN> in nginx.conf (run on server with token as arg)
import sys
p = "/root/converter-vps/nginx/nginx.conf"
t = sys.argv[1]
with open(p) as f:
    c = f.read()
with open(p, "w") as f:
    f.write(c.replace("<SECRET_TOKEN>", t))
print("Token patched")
