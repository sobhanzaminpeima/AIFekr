import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const exec=promisify(execFile);
export async function extractPdfImages(buffer:Buffer){
 if(!buffer.subarray(0,5).equals(Buffer.from("%PDF-")))throw Error("INVALID_PDF");
 const directory=await mkdtemp(join(tmpdir(),"aifekr-pdf-"));
 try{
  const input=join(directory,"source.pdf");await writeFile(input,buffer);
  const {stdout}=await exec(process.env.PDFINFO_PATH||"pdfinfo",[input],{timeout:10000,maxBuffer:100000});
  const pages=Number(stdout.match(/^Pages:\s+(\d+)/m)?.[1]);if(!Number.isInteger(pages)||pages<1)throw Error("INVALID_PDF");if(pages>12)throw Error("PDF_PAGE_LIMIT");
  await exec(process.env.PDFTOPPM_PATH||"pdftoppm",["-png","-scale-to","1800",input,join(directory,"page")],{timeout:40000,maxBuffer:100000});
  const names=(await readdir(directory)).filter(n=>/^page-\d+\.png$/.test(n)).sort((a,b)=>Number(a.match(/\d+/)![0])-Number(b.match(/\d+/)![0]));if(names.length!==pages)throw Error("PDF_RENDER_FAILED");
  let total=0;const images=[];for(const name of names){const data=await readFile(join(directory,name));total+=data.length;if(total>16*1024*1024)throw Error("PDF_IMAGE_LIMIT");images.push({name,mimeType:"image/png",data});}return images;
 }finally{await rm(directory,{recursive:true,force:true});}
}
