const fs=require("fs"),sharp=require("sharp");
const S=4, P="/workspace/frioos/public", A="/workspace/frioos/src/app";
const sprout=fs.readFileSync("sprout.txt","utf8");
(async()=>{
const {data,info}=await sharp("/workspace/brand/farmos-logo.png").ensureAlpha().raw().toBuffer({resolveWithObject:true});
let x0=1e9,y0=1e9,x1=0,y1=0;for(let y=0;y<info.height;y++)for(let x=0;x<235;x++){const i=(y*info.width+x)*4;if(data[i+3]>40&&(data[i]+data[i+1]+data[i+2])/3<235){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}}
const w=x1-x0,h=y1-y0,side=Math.max(w,h);const cx=(x0+x1)/2,cy=(y0+y1)/2;
console.log("sprout bbox",x0,y0,x1,y1);
const box=(frac)=>{const s=side/frac;return [(cx-s/2)*S,(cy-s/2)*S,s*S,s*S].map(v=>v.toFixed(1)).join(" ")};
const glyph=(fill)=>`<path fill="${fill}" fill-rule="evenodd" d="${sprout}"/>`;
// favicon / icon.svg: transparent, adapts to tab theme
const iconSvg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box(0.92)}"><style>path{fill:#5f8a4c;stroke:#5f8a4c;stroke-width:10;stroke-linejoin:round}@media (prefers-color-scheme:dark){path{fill:#9fc08b;stroke:#9fc08b}}</style><path fill-rule="evenodd" d="${sprout}"/></svg>`;
fs.writeFileSync(`${A}/icon.svg`,iconSvg);
const BG="#171615", FG="#9fc08b";
const vb=(frac)=>box(frac).split(" ").map(Number);
const solid=(frac)=>{const [x,y,s]=vb(frac);return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${s} ${s}"><rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${BG}"/>${glyph(FG)}</svg>`};
const rounded=(frac)=>{const [x,y,s]=vb(frac);return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${s} ${s}"><rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${s*0.22}" fill="${BG}"/>${glyph(FG)}</svg>`};
const r=(svg,size,out)=>sharp(Buffer.from(svg),{density:300}).resize(size,size).png().toFile(out);
await r(rounded(0.66),192,`${P}/icons/icon-192.png`);
await r(rounded(0.66),512,`${P}/icons/icon-512.png`);
await r(solid(0.5),192,`${P}/icons/maskable-192.png`);   // glyph inside the 80% safe-zone circle
await r(solid(0.5),512,`${P}/icons/maskable-512.png`);
await r(solid(0.64),180,`${P}/icons/apple-touch-icon.png`);
// favicon.ico with 16/32/48 PNG entries (transparent sprout, mid-green so it reads on light and dark tabs)
const icoSvg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box(0.9)}"><path fill="#6f9a5a" stroke="#6f9a5a" stroke-width="22" stroke-linejoin="round" fill-rule="evenodd" d="${sprout}"/></svg>`;
const pngs=await Promise.all([16,32,48].map(s=>sharp(Buffer.from(icoSvg),{density:300}).resize(s,s).png().toBuffer()));
const head=Buffer.alloc(6);head.writeUInt16LE(0,0);head.writeUInt16LE(1,2);head.writeUInt16LE(pngs.length,4);
let off=6+16*pngs.length;const dir=[];
pngs.forEach((b,i)=>{const s=[16,32,48][i];const e=Buffer.alloc(16);e[0]=s;e[1]=s;e[2]=0;e[3]=0;e.writeUInt16LE(1,4);e.writeUInt16LE(32,6);e.writeUInt32LE(b.length,8);e.writeUInt32LE(off,12);off+=b.length;dir.push(e)});
fs.writeFileSync(`${A}/favicon.ico`,Buffer.concat([head,...dir,...pngs]));
// wordmark SVGs
fs.mkdirSync(`${P}/brand`,{recursive:true});
fs.copyFileSync("logo-light.svg",`${P}/brand/farmos-logo.svg`);fs.copyFileSync("logo-dark.svg",`${P}/brand/farmos-logo-dark.svg`);
// preview sheet
const items=[`${P}/icons/icon-512.png`,`${P}/icons/maskable-512.png`,`${P}/icons/apple-touch-icon.png`,`${P}/icons/icon-192.png`];
const comps=await Promise.all(items.map(async(f,i)=>({input:await sharp(f).resize(160,160).png().toBuffer(),left:20+i*180,top:20})));
comps.push({input:await sharp(Buffer.from(iconSvg),{density:300}).resize(64,64).png().toBuffer(),left:760,top:20});
comps.push({input:pngs[1],left:760,top:110});comps.push({input:pngs[0],left:810,top:118});
await sharp({create:{width:860,height:200,channels:4,background:"#ffffff"}}).composite(comps).png().toFile("/workspace/shots/b454-icon-set.png");
console.log("done");
})();
