import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const scratch = await fs.mkdtemp(join(tmpdir(), 'daybook-check-'));
const source = fileURLToPath(new URL('../index.html', import.meta.url));
const chrome=spawn(process.env.CHROME_BIN || '/opt/google/chrome/chrome',['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-proxy-server','--user-data-dir='+join(scratch,'profile'),'--remote-debugging-pipe'],{stdio:['ignore','ignore','pipe','pipe','pipe']});
let next=0, buffer='',pending=new Map(),errors=[];chrome.stdio[4].on('data',chunk=>{buffer+=chunk.toString();let i;while((i=buffer.indexOf('\0'))>=0){let raw=buffer.slice(0,i);buffer=buffer.slice(i+1);try{let msg=JSON.parse(raw);if(msg.id){let p=pending.get(msg.id);pending.delete(msg.id);if(msg.error)p.reject(Error(JSON.stringify(msg.error)));else p.resolve(msg.result)}else if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails.text+' '+JSON.stringify(msg.params.exceptionDetails.exception));}catch{}}});
function send(method,params={},sessionId){return new Promise((resolve,reject)=>{let id=++next;pending.set(id,{resolve,reject});chrome.stdio[3].write(JSON.stringify({id,method,params,...sessionId?{sessionId}:{}})+'\0');setTimeout(()=>{if(pending.has(id)){pending.delete(id);reject(Error('Timeout '+method))}},15000).unref()})}
const target=await send('Target.createTarget',{url:'about:blank'});const {sessionId}=await send('Target.attachToTarget',{targetId:target.targetId,flatten:true});const call=(m,p)=>send(m,p,sessionId);await call('Page.enable');await call('Runtime.enable');
async function evaluate(expression){let r=await call('Runtime.evaluate',{expression:`(async()=>{${expression.includes('await ')?expression:'return eval('+JSON.stringify(expression)+')'}})()`,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text+' '+JSON.stringify(r.exceptionDetails.exception));return r.result.value}
async function ready(){for(let i=0;i<100;i++){if(await evaluate('typeof state!=="undefined" && !!state && !!document.querySelector(".list-grid,.task-stack")').catch(()=>false))return;await new Promise(r=>setTimeout(r,50))}throw Error('Not ready')}
async function snap(path,width,height){await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});await evaluate('window.scrollTo(0,0)');await new Promise(r=>setTimeout(r,80));const ss=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await fs.writeFile(path,Buffer.from(ss.data,'base64'))}
let results=[];function check(name,pass){results.push({name,pass:!!pass});if(!pass)throw Error(name)}
try{
await call('Page.navigate',{url:pathToFileURL(source).href});await ready();
check('English default on first launch',await evaluate('state.lang==="en"&&document.documentElement.lang==="en"')); 
await evaluate('state=createSeed(); rolled=0; await persist();render()');
check('home has three editable lists',await evaluate('document.querySelectorAll(".list-card").length===3'));
check('home hides detailed task view',await evaluate('!document.querySelector(".task")'));
await snap(join(scratch, 'Daybook-desktop.png'),1440,1000);
await snap(join(scratch, 'Daybook-mobile.png'),390,1090);
check('mobile home fits screen',await evaluate('document.documentElement.scrollWidth<=innerWidth'));
await evaluate('openList("work")');check('open list shows two tasks',await evaluate('document.querySelectorAll("#taskStack .task").length===2'));
await snap(join(scratch, 'Daybook-list-mobile.png'),390,1100);
check('mobile list fits screen',await evaluate('document.documentElement.scrollWidth<=innerWidth'));
await evaluate('openListForm("work");$("listName").value="今日工作必做 · 修改";$("listForm").dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}))');
check('custom list title editable',await evaluate('list("work").title==="今日工作必做 · 修改"'));
await evaluate('openListForm();$("listName").value="出门前检查";$("listForm").dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}))');check('new list created',await evaluate('state.lists.length===4'));
await evaluate('openTaskForm();$("taskTitle").value="带上学校表格";$("taskNote").value="拍张照就更好找";taskPriority=0;$("taskForm").dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}))');check('new task red priority',await evaluate('state.tasks.find(a=>a.title==="带上学校表格").priority===0'));
await evaluate('globalThis.testId=state.tasks.find(a=>a.title==="带上学校表格").id;openTaskForm(testId)');
// A real upload travels through the native file input and the image compression path.
let {root}=await call('DOM.getDocument');let input=await call('DOM.querySelector',{nodeId:root.nodeId,selector:'#photoFile'});
await call('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[join(scratch, 'Daybook-mobile.png')]});
for(let i=0;i<100;i++){if(await evaluate('draftImages.length===1 && imageBusy===0'))break;await new Promise(r=>setTimeout(r,50))}
check('image upload compressed and previewed',await evaluate('draftImages.length===1&&draftImages[0].startsWith("data:image/jpeg;base64,")&&$("taskImagePreviews").querySelector("img")!==null'));
await evaluate('$("taskForm").dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})); await persist()');
check('task image committed',await evaluate('state.tasks.find(a=>a.id===testId).images.length===1'));
await evaluate('changeProgress(testId,65); await persist()');check('progress and image persisted in IndexedDB',await evaluate('const s=await dbRead();return s.tasks.find(a=>a.id===testId).progress===65&&s.tasks.find(a=>a.id===testId).images.length===1'));
await call('Page.reload');await new Promise(r=>setTimeout(r,150));await ready();check('image and progress survive reload',await evaluate('state.tasks.find(a=>a.title==="带上学校表格").progress===65&&state.tasks.find(a=>a.title==="带上学校表格").images.length===1'));
await evaluate('globalThis.testId=state.tasks.find(a=>a.title==="带上学校表格").id;const a=state.tasks.find(a=>a.id===testId);a.date=shiftDate(today(),-2);rollover()');check('rollover retains photos progress and list',await evaluate('const a=state.tasks.find(a=>a.id===testId);a.date===today()&&a.progress===65&&a.images.length===1&&a.list==="work"'));
await evaluate('openList("work"); setPriorityFilter("0")');check('red priority filter',await evaluate('filteredTasks().every(a=>a.priority===0)&&document.querySelectorAll("#taskStack .task").length===2'));
await evaluate('setPriorityFilter("all");reorderTask(testId,filteredTasks()[0].id)');check('manual drag order and priority retained',await evaluate('sortMode==="manual"&&filteredTasks()[0].id===testId&&state.tasks.find(a=>a.id===testId).priority===0'));
await evaluate('toggleDone(testId)');check('completed task leaves active list',await evaluate('!filteredTasks().some(a=>a.id===testId)'));
await evaluate('showCompleted=true;render()');check('completed task visible on demand',await evaluate('document.querySelectorAll(".done-stack .task").length===1'));
await evaluate('const s=validate(JSON.parse(JSON.stringify(state)));globalThis.backupOK=s.tasks.find(a=>a.id===testId).images.length===1');check('backup includes photos',await evaluate('backupOK'));
// Restore an exported payload through the actual file input, including its picture.
await fs.writeFile(join(scratch,'test-backup.json'),await evaluate('JSON.stringify(state)'));
await evaluate('globalThis.originalConfirm=window.confirm;window.confirm=()=>true;state.tasks.find(a=>a.id===testId).images=[]');
let backupRoot=await call('DOM.getDocument');let backupInput=await call('DOM.querySelector',{nodeId:backupRoot.root.nodeId,selector:'#backupFile'});
await call('DOM.setFileInputFiles',{nodeId:backupInput.nodeId,files:[join(scratch,'test-backup.json')]});
for(let i=0;i<100;i++){if(await evaluate('state.tasks.find(a=>a.id===testId).images.length===1'))break;await new Promise(r=>setTimeout(r,20))}
check('import file restores actual images',await evaluate('state.tasks.find(a=>a.id===testId).images.length===1'));
await evaluate('window.confirm=originalConfirm;openList("work")');
check('unsafe backup rejected',await evaluate('let b=JSON.parse(JSON.stringify(state));b.tasks[0].images=["javascript:alert(1)"];let rejected=false;try{validate(b)}catch{rejected=true}rejected'));
await evaluate('state.lang="zh";switchLanguage()');check('English translation',await evaluate('document.documentElement.lang==="en"&&document.querySelector(".list-heading h1").textContent.includes("今日工作必做")'));
await evaluate('state=createSeed();state.lang="en";rolled=0;mode="today";currentList="work";priorityFilter="all";query="";render()');await snap(join(scratch, 'Daybook-list-desktop.png'),1440,1050);
check('no runtime exceptions',errors.length===0);
}catch(e){results.push({error:e.message});}
await fs.writeFile(join(scratch,'results.json'),JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors,artifacts:scratch},null,2));chrome.kill();if(errors.length||results.some(r=>r.pass===false||r.error))process.exitCode=1;
