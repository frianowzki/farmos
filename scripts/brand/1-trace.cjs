// Brand assets from /workspace/brand/farmos-logo.png. Run in a scratch dir with `npm i potrace sharp`: 1-trace → 2-logo-svg → 3-icons.
const sharp=require("sharp"),potrace=require("potrace"),fs=require("fs");
(async()=>{
const S=4;
const img=sharp("/workspace/brand/farmos-logo.png").ensureAlpha();
const {data,info}=await img.raw().toBuffer({resolveWithObject:true});
const W=info.width,H=info.height;
const D=[29,62,43],G=[120,152,104];
const mk=(which)=>{const out=Buffer.alloc(W*H);for(let i=0,j=0;i<data.length;i+=4,j++){const a=data[i+3]/255;const r=data[i],g=data[i+1],b=data[i+2];
 // coverage: how far from white
 const cov=a*(1-Math.min(r,g,b)/255*0.0-0)*(1-( (r+g+b)/3 -40)/215*0); 
 const lum=(r+g+b)/3; const ink=a*Math.max(0,Math.min(1,(250-lum)/(250-((which==="d")?45:120))));
 const dd=Math.hypot(r-D[0],g-D[1],b-D[2]),dg=Math.hypot(r-G[0],g-G[1],b-G[2]);
 const isD = lum<95 || dd<dg;
 const v = (which==="d"?isD:!isD) ? ink : 0;
 out[j]=255-Math.round(Math.min(1,v)*255);}
 return sharp(out,{raw:{width:W,height:H,channels:1}}).resize(W*S,H*S,{kernel:"lanczos3"}).png().toBuffer();};
const tr=(buf)=>new Promise((res,rej)=>potrace.trace(buf,{threshold:128,turdSize:8,optTolerance:0.3,alphaMax:1},(e,svg)=>e?rej(e):res(svg)));
const dsvg=await tr(await mk("d")), gsvg=await tr(await mk("g"));
const path=(s)=>s.match(/ d="([^"]+)"/)[1];
fs.writeFileSync("d.txt",path(dsvg));fs.writeFileSync("g.txt",path(gsvg));
console.log(W,H,path(dsvg).length,path(gsvg).length);
})();
