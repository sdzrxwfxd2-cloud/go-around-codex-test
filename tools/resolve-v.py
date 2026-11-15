#!/usr/bin/env python3
# (perf, 11 Nov 2026) Usage after "git merge" stops on conflicts: python3 tools/resolve-v.py && node tools/vbump.mjs && git add -A
# Resolves conflicts on the long one-line HTML/JS where the two sides changed DIFFERENT parts of the same line,
# or one side only bumped ?v= values. Method: every ?v= is blanked (vbump rewrites them after), the conflicting
# lines are split at tag/statement boundaries, and git merge-file does a fine-grained 3-way merge.
# Refuses (exit 1) when both sides changed the same small piece: those need a person.
import re,sys,subprocess,tempfile,os
files=subprocess.run(['git','diff','--name-only','--diff-filter=U'],capture_output=True,text=True).stdout.split()
V=re.compile(r'\?v=[0-9A-Za-z_-]+'); SEP='\x01'
norm=lambda x:V.sub('?v=0000000000',x)
split=lambda x:re.sub(r'(>|;|\})',lambda m:m.group(1)+SEP+'\n',norm(x))
join=lambda x:x.replace(SEP+'\n','')
def merge3(a,o,b):
    if norm(a)==norm(b) or norm(a)==norm(o): return norm(b)
    if norm(b)==norm(o): return norm(a)
    with tempfile.TemporaryDirectory() as d:
        p=[os.path.join(d,n) for n in ('a','o','b')]
        for f,t in zip(p,(a,o,b)): open(f,'w',encoding='utf-8').write(split(t))
        r=subprocess.run(['git','merge-file','-p',p[0],p[1],p[2]],capture_output=True,text=True)
        return join(r.stdout) if r.returncode==0 else None
bad=0
pat=re.compile(r'<<<<<<< [^\n]*\n(.*?)\|\|\|\|\|\|\| [^\n]*\n(.*?)=======\n(.*?)>>>>>>> [^\n]*\n',re.S)
for f in files:
    subprocess.run(['git','checkout','--conflict=diff3','--',f],check=True)
    s=open(f,encoding='utf-8').read()
    def rep(m):
        global bad
        r=merge3(*m.groups())
        if r is None: bad+=1; print('REAL conflict in',f); return m.group(0)
        return r
    s2=pat.sub(rep,s); open(f,'w',encoding='utf-8').write(s2)
    if '<<<<<<<' not in s2: subprocess.run(['git','add',f]); print('resolved',f)
sys.exit(1 if bad else 0)
