from solver import build, solve
import json
K33=[(a,b) for a in 'ABC' for b in '123']
LV=[
 (5,5,{'A':(0,1),'B':(4,1),'C':(1,3),'D':(4,4)},[('A','B'),('C','D')],1,None),
 (7,7,{'A':(1,3),'B':(5,3),'C':(3,1),'D':(3,5)},[('A','B'),('C','D')],1,8),
 (5,5,{'A':(0,2),'B':(4,2),'C':(2,0),'D':(2,4)},[('A','B'),('C','D')],2,None),
 (7,7,{'A':(1,1),'B':(3,1),'C':(5,1),'1':(1,5),'2':(3,5),'3':(5,5)},K33,2,4),
 (5,5,{'A':(0,0),'B':(2,0),'C':(4,0),'1':(0,4),'2':(2,4),'3':(4,4)},K33,3,None),
]
out=[]
for W,H,nodes,nets,L,slack in LV:
    p=build(W,H,nodes,nets,slack)
    best,ch,_=solve(p,L)
    sol=[]
    for i,((a,b),(layer,ln,m)) in enumerate(zip(nets,ch)):
        cells={c for c in range(W*H) if (m>>c)&1}
        s=nodes[a][1]*W+nodes[a][0]; t=nodes[b][1]*W+nodes[b][0]
        # DFS for path using exactly these cells
        def nb(c):
            x,y=c%W,c//W
            for dx,dy in((1,0),(-1,0),(0,1),(0,-1)):
                X,Y=x+dx,y+dy
                if 0<=X<W and 0<=Y<H: yield Y*W+X
        res=[None]
        def dfs(c,path,left):
            if res[0]: return
            for n in nb(c):
                if n==t and not left: res[0]=path+[t]; return
                if n in left: dfs(n,path+[n],left-{n})
        dfs(s,[s],cells)
        res=res[0]
        assert res and len(res)-1==ln, (a,b)
        sol.append([i,layer,res])
    out.append({'best':best,'sol':sol})
    print(best)
json.dump(out,open('solutions.json','w'),separators=(',',':'))
print(open('solutions.json').read())
