import sys, itertools, time
def build(W,H,nodes,nets,slack=None,maxpaths=400000):
    pos={k:(x,y) for k,(x,y) in nodes.items()}
    blocked={y*W+x for (x,y) in pos.values()}
    def nb(c):
        x,y=c%W,c//W
        for dx,dy in((1,0),(-1,0),(0,1),(0,-1)):
            X,Y=x+dx,y+dy
            if 0<=X<W and 0<=Y<H: yield Y*W+X
    paths=[]
    for a,b in nets:
        s=pos[a][1]*W+pos[a][0]; t=pos[b][1]*W+pos[b][0]
        man=abs(pos[a][0]-pos[b][0])+abs(pos[a][1]-pos[b][1])
        lim= (man+slack) if slack is not None else W*H
        out=[]
        def dfs(c,mask,ln):
            if len(out)>maxpaths: return
            for n in nb(c):
                if n==t: out.append((ln+1,mask)); continue
                if n in blocked or (mask>>n)&1: continue
                if ln+1+abs(n%W-t%W)+abs(n//W-t//W)>lim: continue
                dfs(n,mask|(1<<n),ln+1)
        dfs(s,0,0)
        out.sort()
        paths.append(out)
    return paths
def solve(paths,L,need_opt=True,time_limit=120):
    n=len(paths); best=[None,None]; t0=time.time()
    order=sorted(range(n),key=lambda i:len(paths[i]))
    minlen=[p[0][0] if p else 10**9 for p in paths]
    suffix=[0]*(n+1)
    for k in range(n-1,-1,-1): suffix[k]=suffix[k+1]+minlen[order[k]]
    used=[0]*L; choice=[None]*n
    def rec(k,total,maxlayer):
        if time.time()-t0>time_limit: return
        if best[0] is not None and total+suffix[k]>=best[0]: return
        if k==n:
            best[0]=total; best[1]=list(choice); return
        i=order[k]
        for layer in range(min(L,maxlayer+2)):
            for ln,m in paths[i]:
                if best[0] is not None and total+ln+suffix[k+1]>=best[0]: break
                if used[layer]&m: continue
                used[layer]|=m; choice[i]=(layer,ln,m)
                rec(k+1,total+ln,max(maxlayer,layer))
                used[layer]^=m
                if best[0] is not None and not need_opt: return
    rec(0,0,-1)
    return best[0],best[1],time.time()-t0
