const fs=require("fs"),sharp=require("sharp");
const S=4;
const d=fs.readFileSync("d.txt","utf8"), g=fs.readFileSync("g.txt","utf8");
const subs=g.split(/(?=M)/).filter(Boolean);
const firstX=(p)=>parseFloat(p.slice(1).trim().split(/[ ,]+/)[0]);
const sprout=subs.filter(p=>firstX(p)<235*S).join(""), os=subs.filter(p=>firstX(p)>=235*S).join("");
// bbox from source alpha/ink
(async()=>{
const {data,info}=await sharp("/workspace/brand/farmos-logo.png").ensureAlpha().raw().toBuffer({resolveWithObject:true});
let x0=1e9,y0=1e9,x1=0,y1=0;for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){const i=(y*info.width+x)*4;if(data[i+3]>40&&(data[i]+data[i+1]+data[i+2])/3<235){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}}
console.log("bbox",x0,y0,x1,y1);
const pad=4;const vb=[(x0-pad)*S,(y0-pad)*S,(x1-x0+2*pad)*S,(y1-y0+2*pad)*S];
fs.writeFileSync("meta.json",JSON.stringify({vb,sx:[x0,x1],sy:[y0,y1]}));
const mkSvg=(cd,cg)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(" ")}"><g fill-rule="evenodd"><path fill="${cg}" d="${sprout}"/><path fill="${cd}" d="${d}"/><path fill="${cg}" d="${os}"/></g></svg>`;
fs.writeFileSync("logo-light.svg",mkSvg("#1d3e2b","#789868"));
fs.writeFileSync("logo-dark.svg",mkSvg("#e4eedc","#9fc08b"));
fs.writeFileSync("sprout.txt",sprout);
await sharp(Buffer.from(mkSvg("#1d3e2b","#789868"))).resize(800).flatten({background:"#fff"}).png().toFile("prev-light.png");
await sharp(Buffer.from(mkSvg("#e4eedc","#9fc08b"))).resize(800).flatten({background:"#171615"}).png().toFile("prev-dark.png");
console.log(sprout.length, os.length);
})();
