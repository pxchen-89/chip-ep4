from solver import build, solve
import sys
lv=sys.argv[1]; L=int(sys.argv[2]); slack=None if sys.argv[3]=='x' else int(sys.argv[3])
K33=[(a,b) for a in 'ABC' for b in '123']
LV={
 '1':(5,5,{'A':(0,1),'B':(4,1),'C':(1,3),'D':(4,4)},[('A','B'),('C','D')]),
 '2':(7,7,{'A':(1,3),'B':(5,3),'C':(3,1),'D':(3,5)},[('A','B'),('C','D')]),
 '3':(5,5,{'A':(0,2),'B':(4,2),'C':(2,0),'D':(2,4)},[('A','B'),('C','D')]),
 '4':(7,7,{'A':(1,1),'B':(3,1),'C':(5,1),'1':(1,5),'2':(3,5),'3':(5,5)},K33),
 '5':(5,5,{'A':(0,0),'B':(2,0),'C':(4,0),'1':(0,4),'2':(2,4),'3':(4,4)},K33),
}
W,H,nodes,nets=LV[lv]
p=build(W,H,nodes,nets,slack)
print('paths per net',[len(x) for x in p])
b,ch,t=solve(p,L,time_limit=float(sys.argv[4]) if len(sys.argv)>4 else 120)
print('L',L,'best',b,'time',round(t,1))
if ch:
    for (a,c),(layer,ln,m) in zip(nets,ch):
        cells=[(i%W,i//W) for i in range(W*H) if (m>>i)&1]
        print(a,c,'layer',layer+1,'len',ln,cells)
