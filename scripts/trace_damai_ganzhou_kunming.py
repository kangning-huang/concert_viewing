#!/usr/bin/env python3
"""Trace Ganzhou / Kunming Damai maps into official-bitmap hotspots.

Floor blocks are connected components of the official colour. Stand hotspots are
elliptical sectors whose angles were read off an eccentric-angle ruler overlaid
on the official map (the picture IS the Damai map; it is never redrawn).
Closed / 控台 / 中区 / pale numbered strips have no hotspot.

    python scripts/trace_damai_ganzhou_kunming.py ganzhou <src.jpg> <out_dir> [debug_dir]
    python scripts/trace_damai_ganzhou_kunming.py kunming <src.jpg> <out_dir> [debug_dir]
"""
from __future__ import annotations
import json, math, sys
from pathlib import Path
import cv2
import numpy as np
from PIL import Image

CITY, SRC, OUT = sys.argv[1], sys.argv[2], Path(sys.argv[3])
DBG = Path(sys.argv[4]) if len(sys.argv) > 4 else None

WINDOWS = {
    "red":    lambda H, S, V: ((H <= 6) | (H >= 172)) & (S >= 80) & (V >= 90),
    "orange": lambda H, S, V: (H > 6) & (H <= 16) & (S >= 50) & (V >= 120),
    "yellow": lambda H, S, V: (H > 16) & (H <= 36) & (S >= 70) & (V >= 140),
    "green":  lambda H, S, V: (H > 36) & (H <= 86) & (S >= 40) & (V >= 80),
    "blue":   lambda H, S, V: (H > 86) & (H <= 116) & (S >= 40) & (V >= 80),
    "purple": lambda H, S, V: (H > 116) & (H <= 155) & (S >= 35) & (V >= 90),
    "pink":   lambda H, S, V: (H > 155) & (H < 172) & (S >= 40) & (V >= 80),
}
TONE = {"red":"red","orange":"peach","yellow":"yellow","green":"green","blue":"blue","purple":"lavender","pink":"rose"}
PRICE = {"red":1717,"peach":1517,"yellow":1317,"lavender":917,"green":717,"blue":517,"rose":317}
SOURCES = {
    "ganzhou": "Damai official Ganzhou seat map (img.alicdn.com …/O1CN01iWRwOPjaYUJ7Vlpd), traced by scripts/trace_damai_ganzhou_kunming.py",
    "kunming": "Damai official Kunming seat map (img.alicdn.com …/O1CN01Y1PNiRzNzgK2b8AE), traced by scripts/trace_damai_ganzhou_kunming.py",
}

def name_for(sid):
    if sid.startswith("主席台"):
        return f"{sid}区"
    if sid.endswith("下") or sid.endswith("上"):
        return f"{sid[:-1]}区({sid[-1]})"
    return f"{sid}区"

def find_stage(sm, hsv):
    h,w,_=sm.shape
    S,V=hsv[:,:,1],hsv[:,:,2]
    grey=((S<30)&(V>160)&(V<240)).astype(np.uint8)
    grey[:int(h*0.10)]=0; grey[int(h*0.88):]=0
    n,_,st,cen=cv2.connectedComponentsWithStats(grey,8)
    best=None
    for i in range(1,n):
        x,y,ww,hh,a=st[i]
        if a<w*h*0.008: continue
        if ww/max(hh,1)>1.3 and math.hypot(cen[i][0]-w/2,cen[i][1]-h/2)<min(w,h)*0.3:
            if best is None or a>best[0]:
                best=(a,(int(x),int(y),int(ww),int(hh)),(float(cen[i][0]),float(cen[i][1])))
    return best[1], best[2]

def sold_band(sm, hsv, stage, legend_y):
    h,w,_=sm.shape
    H,S,V=hsv[:,:,0].astype(int),hsv[:,:,1].astype(int),hsv[:,:,2].astype(int)
    sold=np.zeros((h,w),np.uint8); band=np.zeros((h,w),np.uint8)
    names=list(WINDOWS)
    for i,name in enumerate(names,1):
        m=WINDOWS[name](H,S,V)
        sold[m]=1; band[m]=i
    sold[:int(h*0.05)]=0; sold[legend_y:]=0
    sx,sy,sw,sh=stage
    sold[sy+2:sy+sh-2, sx+2:sx+sw-2]=0
    band[sold==0]=0
    return sold, band, names

def floor_faces(sm, hsv, stage, sold, band, names, cx, cy, A, B):
    sx,sy,sw,sh=stage
    core=cv2.morphologyEx(sold, cv2.MORPH_OPEN, np.ones((3,3),np.uint8))
    n,lab=cv2.connectedComponents(core,8)
    faces=[]
    for i in range(1,n):
        pix=lab==i
        a=int(pix.sum())
        if a<200: continue
        ys,xs=np.where(pix)
        px,py=float(xs.mean()),float(ys.mean())
        votes=band[pix]; votes=votes[votes>0]
        if votes.size==0: continue
        bname=names[int(np.bincount(votes).argmax())-1]
        in_h = (sx-0.42*sw <= px <= sx+sw+0.42*sw) and (sy-8 <= py <= sy+sh+8)
        in_v = (sx-8 <= px <= sx+sw+8) and (sy-0.65*sh <= py <= sy+sh+0.65*sh)
        rho=math.hypot((px-cx)/A,(py-cy)/B)
        if not (in_h or in_v) or rho>0.72: continue
        if bname not in ("red","orange","yellow"): continue
        faces.append(dict(band=bname,tone=TONE[bname],area=a,cx=px,cy=py,pix=pix,rho=rho,ang=math.atan2(py-cy,px-cx)))
    return faces

def biggest(items,n):
    return sorted(items,key=lambda f:-f["area"])[:n]

def assign_floor(faces, stage, city):
    sx,sy,sw,sh=stage
    mapping={}
    reds=[f for f in faces if f["band"]=="red"]
    above=sorted(biggest([f for f in reds if f["cy"]<sy+0.15*sh],4), key=lambda f:f["cx"])
    below=sorted(biggest([f for f in reds if f["cy"]>sy+sh-0.15*sh],4), key=lambda f:f["cx"])
    if city=="ganzhou":
        if len(above)==4:
            for i,f in enumerate(above): mapping[id(f)]=("A4","A3","A2","A1")[i]
        if len(below)==4:
            for i,f in enumerate(below): mapping[id(f)]=("C1","C2","C3","C4")[i]
        close_left,far_left=("B1","B2"),("B3","B4")
        close_right,far_right=("D2","D1"),("D4","D3")
    else:
        if len(below)==4:
            for i,f in enumerate(below): mapping[id(f)]=("A1","A2","A3","A4")[i]
        if len(above)==4:
            for i,f in enumerate(above): mapping[id(f)]=("C4","C3","C2","C1")[i]
        close_left,far_left=("D1","D2"),("D3","D4")
        close_right,far_right=("B2","B1"),("B4","B3")
    used=set(mapping)
    sides=[f for f in faces if id(f) not in used]
    left=biggest([f for f in sides if f["cx"]<sx],4)
    right=biggest([f for f in sides if f["cx"]>sx+sw],4)
    def side(group, closer_higher_x, names_c, names_f):
        if len(group)!=4:
            print("  side count",len(group),"wanted 4"); return
        mid=(min(f["cx"] for f in group)+max(f["cx"] for f in group))/2
        if closer_higher_x:
            close=[f for f in group if f["cx"]>=mid]; far=[f for f in group if f["cx"]<mid]
        else:
            close=[f for f in group if f["cx"]<=mid]; far=[f for f in group if f["cx"]>mid]
        for col,names_ in ((close,names_c),(far,names_f)):
            col=sorted(col,key=lambda f:f["cy"])
            if len(col)==2:
                mapping[id(col[0])]=names_[0]; mapping[id(col[1])]=names_[1]
    side(left, True, close_left, far_left)
    side(right, False, close_right, far_right)
    return mapping

def ellipse_from_stands(sold, stage, cx, cy):
    sx,sy,sw,sh=stage
    side,end=int(0.36*sw),int(0.58*sh)
    ys,xs=np.where(sold>0)
    keep=~(((xs>=sx-side)&(xs<=sx+sw+side)&(ys>=sy-8)&(ys<=sy+sh+8))|((xs>=sx-8)&(xs<=sx+sw+8)&(ys>=sy-end)&(ys<=sy+sh+end)))
    if keep.sum()<500: keep=np.ones(len(xs),bool)
    bxs,bys=xs[keep],ys[keep]
    A=float(np.percentile(np.abs(bxs-cx),99.4))
    B=float(np.percentile(np.abs(bys-cy),99.4))
    rho=np.hypot((bxs-cx)/A,(bys-cy)/B)
    r_in=float(np.percentile(rho,1.5))
    return A,B,r_in

# ---------------- measured stand catalogs (eccentric degrees) ----------------
# Angles were read from an eccentric-angle ruler (x = A t cos a, y = B t sin a)
# overlaid on the official Damai bitmaps. 0° = right, 90° = bottom, ±180° = left,
# -90° = top. a0→a1 is the shorter arc. 控台 / dark pockets / numbered strips are
# omitted (no hotspot).

# t-bands measured on the same ruler (rho of the seating ellipse).
GZ_T = dict(inner=(0.650, 0.755), midin=(0.765, 0.825), midout=(0.825, 0.868), outer=(0.868, 1.020))

# (id, a0_deg, a1_deg, tone)
GZ_INNER = [
    ("B01", -148, -136, "lavender"),
    ("A07", -136, -126, "lavender"),
    ("A06", -126, -116, "lavender"),
    ("A05", -116, -108, "lavender"),
    ("A04", -108, -100, "lavender"),
    ("A2-3", -100, -92, "lavender"),
    # 控台 -92 to -82: no hotspot
    ("A2-1", -82, -72, "lavender"),
    ("A03", -72, -62, "lavender"),
    ("A02", -62, -52, "lavender"),
    ("A01", -52, -43, "lavender"),
    ("E09", -43, -33, "lavender"),
    ("E07", -24, -12, "green"),
    ("E06", -10, 4, "green"),
    ("E05", 4, 16, "green"),
    ("E04", 16, 32, "green"),
    ("E01", 38, 52, "lavender"),
    ("C10", 52, 60, "lavender"),
    ("C09", 60, 68, "lavender"),
    ("C08", 68, 76, "lavender"),
    ("C07", 76, 84, "lavender"),
    ("C06", 84, 91, "lavender"),
    ("C05", 91, 98, "lavender"),
    ("C04", 98, 106, "lavender"),
    ("C03", 106, 114, "lavender"),
    ("C02", 114, 122, "lavender"),
    ("C01", 122, 130, "lavender"),
    ("B09", 130, 142, "lavender"),
    ("B07", 156, 166, "green"),
    ("B06", 166, 176, "green"),
    ("B05", 176, 186, "green"),  # wraps past 180; handled below
    ("B04", -174, -160, "green"),
]
# B05 listed as 176..186 which is 176..180 and -180..-174; we'll split in expander.

GZ_MIDIN = [
    ("B16", -172, -160, "green"),
    ("B15", 174, 186, "green"),
    ("B14", 166, 174, "green"),
    ("B13", 156, 166, "green"),
    ("C19", 126, 132, "lavender"),
    ("C18", 118, 126, "lavender"),
    ("C17", 106, 114, "lavender"),
    ("C16", 98, 106, "lavender"),
    ("C15", 92, 98, "lavender"),
    ("C14", 86, 92, "lavender"),
    ("C13", 80, 86, "lavender"),
    ("C12", 74, 80, "lavender"),
    ("C11", 68, 74, "lavender"),
    ("E16", 16, 32, "green"),
    ("E15", 6, 16, "green"),
    ("E14", -8, 6, "green"),
    ("E13", -24, -10, "green"),
]

GZ_MIDOUT = [
    ("A21", -138, -128, "green"),
    ("A20", -128, -122, "green"),
    ("A08", -122, -116, "lavender"),
    ("A09", -116, -110, "lavender"),
    ("A19", -110, -104, "lavender"),
    ("A18", -104, -96, "lavender"),
    ("A17", -96, -88, "lavender"),
    ("A16", -88, -80, "lavender"),
    ("A15", -80, -72, "lavender"),
    ("A10", -72, -66, "green"),
    ("A14", -66, -60, "green"),
    ("A11", -60, -54, "green"),
    ("A13", -54, -48, "green"),
    ("A12", -48, -42, "green"),
    ("C20", 124, 132, "green"),
    ("C21", 114, 122, "lavender"),
    ("C22", 106, 114, "lavender"),
    ("C23", 98, 106, "lavender"),
    ("C24", 90, 98, "lavender"),
    ("C25", 84, 90, "lavender"),
    ("C26", 78, 84, "lavender"),
    ("C27", 72, 78, "lavender"),
    ("C28", 64, 72, "lavender"),
]

GZ_OUTER = [
    ("B38", -148, -136, "blue"),
    ("B35", -172, -160, "rose"),
    ("B34", 162, 180, "rose"),
    ("B31", 132, 142, "blue"),
    ("A22", -136, -124, "blue"),
    ("A23", -124, -114, "green"),
    ("A24", -114, -106, "green"),
    ("A25", -106, -97, "green"),
    ("A26", -97, -90, "green"),
    ("A27", -90, -82, "blue"),
    ("A28", -82, -72, "blue"),
    ("A29", -72, -62, "blue"),
    ("A30", -62, -52, "blue"),
    ("A31", -52, -44, "green"),
    ("E31", -44, -34, "blue"),
    ("E34", -22, -8, "rose"),
    ("E35", 8, 22, "rose"),
    ("E38", 38, 52, "blue"),
    ("C29", 52, 62, "blue"),
    ("C30", 62, 70, "blue"),
    ("C31", 70, 78, "green"),
    ("C32", 78, 86, "blue"),
    ("C33", 86, 93, "blue"),
    ("C34", 93, 101, "green"),
    ("C35", 101, 109, "green"),
    ("C36", 109, 117, "green"),
    ("C37", 117, 125, "green"),
    ("C38", 125, 133, "blue"),
]

def expand_deg(a0, a1):
    """Return (a0, a1) in radians, a1 = a0 + signed delta in (-π, π]. If the
    listed span crosses ±180 (e.g. 176..186), split into a single wrapped arc
    via 186-360 = -174."""
    # normalize listed values that go past 180
    def norm(d):
        while d > 180: d -= 360
        while d <= -180: d += 360
        return d
    a0, a1 = norm(a0), norm(a1)
    r0, r1 = math.radians(a0), math.radians(a1)
    return r0, r1

def gz_stands():
    out=[]
    for ring, items in (("inner", GZ_INNER), ("midin", GZ_MIDIN), ("midout", GZ_MIDOUT), ("outer", GZ_OUTER)):
        t0,t1=GZ_T[ring]
        # midin+midout are both "mid" for 3D; keep t for 2D accuracy
        kind_tier = "lower" if ring=="inner" else "upper" if ring=="outer" else "mid"
        for sid,a0,a1,tone in items:
            r0,r1=expand_deg(a0,a1)
            out.append(dict(id=sid,tone=tone,a0=r0,a1=r1,t0=t0,t1=t1,kind="bowl",
                            name=name_for(sid),tier=kind_tier))
    return out

# Kunming: section-start landmarks (eccentric deg), interpolated. Numbers increase
# toward decreasing angle (counterclockwise on the official image). 主席台 occupies
# the lower-tier span of sections 6 and 7. 26B/1A boundary is at ±180°.
KM_STARTS = [
    # (deg, section number at this boundary)
    (180.0, 1),
    (166.0, 2),
    (152.0, 3),
    (138.0, 4),
    (122.0, 5),
    (104.0, 6),
    (76.0, 8),   # end of 主席台 / start of 8; section 7 is inside 主席台
    (62.0, 9),
    (48.0, 10),
    (34.0, 11),
    (20.0, 12),
    (7.0, 13),
    (-7.0, 14),
    (-22.0, 15),
    (-38.0, 16),
    (-52.0, 17),
    (-66.0, 18),
    (-80.0, 19),
    (-94.0, 20),
    (-108.0, 21),
    (-122.0, 22),
    (-136.0, 23),
    (-150.0, 24),
    (-162.0, 25),
    (-171.0, 26),
    (-180.0, 27),  # wraps to section 1
]

def lerp_starts(n):
    """Start angle (deg) of section n (1..26) and of section 27 (= -180)."""
    pts=KM_STARTS
    if n<=1: return pts[0][0]
    if n>=27: return pts[-1][0]
    for (d0,n0),(d1,n1) in zip(pts, pts[1:]):
        if n0<=n<=n1:
            if n1==n0: return d0
            return d0 + (d1-d0)*(n-n0)/(n1-n0)
    return pts[-1][0]

def km_tone(n, half, suffix):
    # Official map: front inner (3–5, 8–11, 19–22 下, 主席台) purple; front 上 green;
    # sides green/blue; corners pink. Read off the official bitmap.
    if suffix=="下":
        if n in {3,4,5,8,9,10,11,19,20,21,22}:
            return "lavender"
        if n in {12,13,14,15,16,23,24,25,26,1,2,17,18}:
            if n in {13,14,15,25,26,1}:
                return "green"  # lower corners often green under pink 上
            return "green"
        return "green"
    # 上
    if n in {5,6,7,8,9}:
        return "green"
    if n in {19,20,21}:
        return "green"
    if n in {14,15,25,26}:
        return "rose"
    if n==13 and half=="A":
        return "rose"
    if n==1 and half=="A":
        return "rose"
    if n in {2,3,4,10,11,12,16,17,18,22,23,24}:
        return "blue"
    if n in {13,14,15}:
        return "blue" if half=="B" else "rose"
    return "blue"

def km_stands():
    t_lo,t_up=(0.730, 0.872),(0.878, 1.030)
    out=[]
    for n in range(1,27):
        a_hi=math.radians(lerp_starts(n))      # clockwise edge (start)
        a_lo=math.radians(lerp_starts(n+1))    # ccw edge (end); decreasing
        # A is first going ccw (decreasing angle), then B
        mid_deg=(lerp_starts(n)+lerp_starts(n+1))/2
        # wrap-safe midpoint in decreasing direction
        d0,d1=lerp_starts(n),lerp_starts(n+1)
        da=d1-d0
        # d1 is more negative (or wrap at -180)
        mid=math.radians(d0+da/2)
        halves=[("A", a_hi, mid),("B", mid, a_lo)]
        for half,a0,a1 in halves:
            for suffix, (t0,t1), tier in (("下", t_lo, "lower"), ("上", t_up, "upper")):
                if suffix=="下" and n in (6,7):
                    continue
                sid=f"{n}{half}{suffix}"
                out.append(dict(id=sid,tone=km_tone(n,half,suffix),a0=a0,a1=a1,t0=t0,t1=t1,
                                kind="bowl",name=name_for(sid),tier=tier))
    # 主席台 1,2,3 split 6+7 lower, left to right = decreasing angle
    a0=math.radians(lerp_starts(6)); a1=math.radians(lerp_starts(8))
    for i,sid in enumerate(("主席台1","主席台2","主席台3")):
        # interpolate in radians along the shorter (decreasing) arc
        da=(a1-a0+math.pi)%(2*math.pi)-math.pi
        out.append(dict(id=sid,tone="lavender",
                        a0=a0+da*(i/3), a1=a0+da*((i+1)/3),
                        t0=t_lo[0], t1=t_lo[1], kind="bowl",
                        name=name_for(sid), tier="lower"))
    return out

def export(city, full, sc, cx, cy, A, B, r_in, stage, floor_faces, floor_map, stands, out_dir, dbg):
    FH,FW,_=full.shape
    pad_x,pad_y=30,24
    x0=max(0,int((cx-A)/sc)-pad_x)
    y0=max(0,int((cy-B)/sc)-pad_y)
    x1=min(FW,int((cx+A)/sc)+pad_x)
    y1=FH
    img=full[y0:y1,x0:x1].copy()
    hsv=cv2.cvtColor(img, cv2.COLOR_RGB2HSV)
    h,w,_=img.shape
    dmask=np.zeros((h,w),np.uint8)
    dmask[:int(h*0.16),:int(w*0.14)]=255
    letter=((hsv[:,:,2]>110)&(hsv[:,:,1]<40)).astype(np.uint8)*255
    dmask=cv2.bitwise_and(dmask,letter)
    ecx,ecy,eA,eB=(cx/sc)-x0,(cy/sc)-y0,A/sc,B/sc
    yy,xx=np.ogrid[:h,:w]
    inside=((xx-ecx)/max(eA,1))**2+((yy-ecy)/max(eB,1))**2 <= 1.06**2
    dmask[inside]=0
    if dmask.sum()>200:
        dmask=cv2.dilate(dmask,np.ones((5,5),np.uint8)); dmask[inside]=0
        img=cv2.inpaint(img,dmask,5,cv2.INPAINT_TELEA)
    bw,bh=x1-x0,y1-y0
    k=bw/820.0
    out_w,out_h=int(bw/k*2),int(bh/k*2)
    canvas=cv2.resize(img,(out_w,out_h),interpolation=cv2.INTER_AREA)
    out_dir.mkdir(parents=True, exist_ok=True)
    Image.fromarray(canvas).save(out_dir/f"{city}_damai_map.webp", quality=88, method=6)

    def to_vb(wx,wy):
        return ((wx/sc)-x0)/k, ((wy/sc)-y0)/k

    hotspots={}; labels={}; meta={}
    for f in floor_faces:
        sid=floor_map.get(id(f))
        if not sid: continue
        m=cv2.morphologyEx(f["pix"].astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5,5),np.uint8))
        cs,_=cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        parts=[]
        for c in cs:
            if cv2.contourArea(c)<20: continue
            c=cv2.approxPolyDP(c,1.5,True)
            pts=[to_vb(float(p[0][0]), float(p[0][1])) for p in c]
            parts.append("M"+"L".join(f"{x:.1f},{y:.1f}" for x,y in pts)+"Z")
        hotspots[sid]="".join(parts)
        lx,ly=to_vb(f["cx"],f["cy"])
        labels[sid]=[round(lx,1),round(ly,1)]
        meta[sid]=dict(tone=f["tone"],kind="floor",name=name_for(sid),price=PRICE[f["tone"]],
                       ang=round(f["ang"],4),rho=round(f["rho"],4))
    vcx,vcy=to_vb(cx,cy)
    vA,vB=(A/sc)/k,(B/sc)/k
    for s in stands:
        def pt(a,t):
            return to_vb(cx + A*t*math.cos(a), cy + B*t*math.sin(a))
        a0,a1,t0,t1=s["a0"],s["a1"],s["t0"],s["t1"]
        da=(a1-a0+math.pi)%(2*math.pi)-math.pi
        n=10
        pts=[pt(a0+da*i/n, t0) for i in range(n+1)]
        pts+=[pt(a0+da*i/n, t1) for i in range(n,-1,-1)]
        hotspots[s["id"]]="M"+"L".join(f"{x:.1f},{y:.1f}" for x,y in pts)+"Z"
        mid_a=a0+da/2; mid_t=(t0+t1)/2
        lx,ly=pt(mid_a, mid_t)
        labels[s["id"]]=[round(lx,1),round(ly,1)]
        meta[s["id"]]=dict(tone=s["tone"],kind="bowl",name=s["name"],price=PRICE[s["tone"]],
                           ang=round(mid_a,4),rho=round(mid_t,4),t0=round(t0,4),t1=round(t1,4),
                           a0=round(a0,4),a1=round(a1,4),tier=s.get("tier","mid"))
    sx,sy,sw,sh=stage
    stx0,sty0=to_vb(sx,sy); stx1,sty1=to_vb(sx+sw,sy+sh)
    payload=dict(
        source=SOURCES[city],
        viewBox=[0,0,round(bw/k,2),round(bh/k,2)],
        stage={"x0":stx0,"y0":sty0,"x1":stx1,"y1":sty1},
        ellipse={"cx":round(vcx,2),"cy":round(vcy,2),"A":round(vA,2),"B":round(vB,2),"innerRho":round(r_in,4)},
        hotspots=dict(sorted(hotspots.items())),
        labels=labels,
        meta=meta,
    )
    json.dump(payload, open(out_dir/f"{city}DamaiHotspots.json","w"), ensure_ascii=False, indent=0)
    print("hotspots",len(hotspots),"floor",sum(1 for m in meta.values() if m["kind"]=="floor"),
          "bowl",sum(1 for m in meta.values() if m["kind"]=="bowl"))
    print("wrote", out_dir/f"{city}_damai_map.webp", canvas.shape[1],"x",canvas.shape[0])
    if dbg:
        dbg.mkdir(parents=True, exist_ok=True)
        vis=(canvas*0.55).astype(np.uint8)
        vw,vh=payload["viewBox"][2],payload["viewBox"][3]
        sxv,syv=out_w/vw,out_h/vh
        rng=np.random.default_rng(3)
        for sid,path in payload["hotspots"].items():
            col=tuple(int(c) for c in rng.integers(70,255,3))
            for part in path.split("Z"):
                if not part: continue
                pts=np.array([[float(x)*sxv,float(y)*syv] for x,y in (xy.split(",") for xy in part[1:].split("L"))], np.int32)
                cv2.polylines(vis,[pts],True,col,1)
            if sid in labels:
                lx,ly=labels[sid]
                cv2.putText(vis,sid,(int(lx*sxv)-10,int(ly*syv)+4),cv2.FONT_HERSHEY_SIMPLEX,0.32,(255,255,0),1,cv2.LINE_AA)
        Image.fromarray(vis).save(dbg/f"{city}_hotspots_debug.png")
        # face crops
        H,W=vis.shape[:2]
        Image.fromarray(vis[:int(H*0.36), int(W*0.22):int(W*0.78)]).convert("RGB").save(dbg/f"{city}_v_topmid.jpg", quality=88)
        Image.fromarray(vis[int(H*0.64):, int(W*0.18):int(W*0.82)]).convert("RGB").save(dbg/f"{city}_v_botmid.jpg", quality=88)
        Image.fromarray(vis[int(H*0.15):int(H*0.85), :int(W*0.34)]).convert("RGB").save(dbg/f"{city}_v_left.jpg", quality=88)
        Image.fromarray(vis[int(H*0.15):int(H*0.85), int(W*0.66):]).convert("RGB").save(dbg/f"{city}_v_right.jpg", quality=88)
    return payload

def run(city):
    full=np.array(Image.open(SRC).convert("RGB"))
    FH,FW,_=full.shape
    sc=1.0 if city=="ganzhou" else 2.0
    sm=cv2.resize(full,(int(FW*sc),int(FH*sc)), interpolation=cv2.INTER_LINEAR if sc>1 else cv2.INTER_AREA)
    sm=cv2.bilateralFilter(sm,5,20,7)
    h,w,_=sm.shape
    hsv=cv2.cvtColor(sm, cv2.COLOR_RGB2HSV)
    stage,(cx,cy)=find_stage(sm,hsv)
    sold,band,names=sold_band(sm,hsv,stage,int(h*0.90))
    A,B,r_in=ellipse_from_stands(sold,stage,cx,cy)
    print(f"{city}: {w}x{h} sc={sc} stage={stage} c=({cx:.1f},{cy:.1f}) AB=({A:.1f},{B:.1f}) r_in={r_in:.3f}")
    ff=floor_faces(sm,hsv,stage,sold,band,names,cx,cy,A,B)
    fmap=assign_floor(ff,stage,city)
    print("  floor", sorted(fmap[id(f)] for f in ff if id(f) in fmap))
    stands = gz_stands() if city=="ganzhou" else km_stands()
    export(city, full, sc, cx, cy, A, B, r_in, stage, ff, fmap, stands, OUT, DBG)

if CITY not in ("ganzhou","kunming"):
    sys.exit("city?")
run(CITY)
