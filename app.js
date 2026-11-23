
let currentMode='id', scannedValue='', scanner=null, adminToken='', reportData=[];
function gas(name,...args){
 return new Promise((resolve,reject)=>{
  const apiUrl=String(window.ATTENDANCE_CONFIG?.GAS_WEB_APP_URL||'').trim();
  if(!apiUrl || apiUrl.includes('PASTE_YOUR')) return reject(new Error('Set GAS_WEB_APP_URL in config.js to your deployed Apps Script Web App URL.'));
  const requestId='req_'+Date.now()+'_'+Math.random().toString(36).slice(2);
  const frame=document.getElementById('gasApiFrame');
  const form=document.getElementById('gasApiForm');
  const payload=document.getElementById('gasApiPayload');
  const timeout=setTimeout(()=>{cleanup();reject(new Error('The Google Sheets service did not respond. Check your Apps Script deployment and internet connection.'));},30000);
  function cleanup(){clearTimeout(timeout);window.removeEventListener('message',onMessage);}
  function onMessage(event){
   if(event.source!==frame.contentWindow) return;
   const msg=event.data;
   if(!msg || msg.type!=='ATTENDANCE_API_RESPONSE' || msg.requestId!==requestId) return;
   cleanup();
   if(msg.response?.ok) resolve(msg.response.data);
   else reject(new Error(msg.response?.error||'The request failed.'));
  }
  window.addEventListener('message',onMessage);
  form.action=apiUrl;payload.value=JSON.stringify({requestId,action:name,args});form.submit();
 });
}
function switchMode(mode){currentMode=mode;document.getElementById('idMode').classList.toggle('hidden',mode!=='id');document.getElementById('qrMode').classList.toggle('hidden',mode!=='qr');document.getElementById('idTab').classList.toggle('active',mode==='id');document.getElementById('qrTab').classList.toggle('active',mode==='qr');}
async function submitAttendance(action){
 const feedback=document.getElementById('feedback');feedback.className='feedback';feedback.textContent='Recording…';feedback.classList.remove('hidden');
 const value=currentMode==='id'?document.getElementById('studentId').value.trim():scannedValue;
 try{const r=await gas('recordAttendance',value,action);feedback.textContent=r.message+' '+r.student+' · '+r.time+(r.totalHours?' · '+r.totalHours+' hours':'');feedback.className='feedback';if(currentMode==='id')document.getElementById('studentId').value='';scannedValue='';}
 catch(e){feedback.textContent=e.message;feedback.className='feedback bad';}
}
async function startScanner(){
 if(!window.Html5Qrcode){alert('QR scanner library did not load. Check your internet connection.');return}
 try{scanner=new Html5Qrcode('reader');await scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:230,height:230}},async decoded=>{scannedValue=decoded;await stopScanner();const f=document.getElementById('feedback');f.className='feedback';f.textContent='QR code scanned. Choose Time In or Time Out.';f.classList.remove('hidden');},()=>{});document.getElementById('stopScan').classList.remove('hidden');}
 catch(e){alert('Could not start camera. Allow camera permission and use the deployed HTTPS web app. '+e)}
}
async function stopScanner(){if(scanner){try{await scanner.stop();scanner.clear()}catch(e){}scanner=null}document.getElementById('stopScan').classList.add('hidden')}
function showAdminLogin(){document.getElementById('adminModal').classList.remove('hidden')}
function closeAdmin(){stopScanner();document.getElementById('adminModal').classList.add('hidden')}
async function adminLogin(){const err=document.getElementById('loginError');err.textContent='';try{const r=await gas('loginAdmin',document.getElementById('adminUser').value,document.getElementById('adminPass').value);adminToken=r.token;document.getElementById('loginPanel').classList.add('hidden');document.getElementById('adminPanel').classList.remove('hidden');initAdmin()}catch(e){err.textContent=e.message}}
function adminLogout(){adminToken='';document.getElementById('adminPanel').classList.add('hidden');document.getElementById('loginPanel').classList.remove('hidden');document.getElementById('adminPass').value=''}
function adminView(view,btn){['overview','students','reports','settings'].forEach(v=>document.getElementById(v+'View').classList.toggle('hidden',v!==view));document.querySelectorAll('.admin-tabs .tab').forEach(b=>b.classList.remove('active'));btn.classList.add('active');if(view==='students')loadStudents();if(view==='reports')loadReport();if(view==='settings')loadSettings()}
async function initAdmin(){const today=new Date().toLocaleDateString('en-CA');document.getElementById('dashDate').value=today;document.getElementById('reportFrom').value=today;document.getElementById('reportTo').value=today;await loadDashboard()}
async function loadDashboard(){try{const d=await gas('getDashboard',adminToken,document.getElementById('dashDate').value);document.getElementById('sTotal').textContent=d.totalStudents;document.getElementById('sPresent').textContent=d.present;document.getElementById('sLate').textContent=d.late;document.getElementById('sMissing').textContent=Math.max(0,d.totalStudents-d.present);document.getElementById('dashRows').innerHTML=d.records.map(r=>`<tr><td><b>${esc(r.fullName)}</b><br><small>${esc(r.studentId)}</small></td><td>${esc(r.gradeSection)}</td><td>${esc(r.timeIn)}</td><td>${esc(r.timeOut)}</td><td><span class="badge ${r.status==='Late'?'late':''}">${esc(r.status||'—')}</span></td></tr>`).join('')||'<tr><td colspan="5">No attendance records for this date.</td></tr>'}catch(e){notice(e.message)}}
async function loadStudents(){try{const rows=await gas('listStudents',adminToken);document.getElementById('studentRows').innerHTML=rows.map(s=>`<tr><td>${esc(s.studentId)}</td><td>${esc(s.fullName)}</td><td>${esc(s.gradeSection)}</td><td>${esc(s.status)}</td><td><button class="secondary" onclick="toggleStudent('${jsq(s.studentId)}','${s.status==='Active'?'Inactive':'Active'}')">${s.status==='Active'?'Deactivate':'Activate'}</button></td></tr>`).join('')||'<tr><td colspan="5">No students yet.</td></tr>'}catch(e){notice(e.message)}}
async function createStudent(){try{const s=await gas('addStudent',adminToken,{studentId:document.getElementById('newId').value,fullName:document.getElementById('newName').value,gradeSection:document.getElementById('newSection').value});const box=document.getElementById('newStudentQr');box.classList.remove('hidden');box.innerHTML=`<div><b>${esc(s.student.fullName)}</b><p>Student ID: ${esc(s.student.studentId)}<br>Print or securely give this QR code to the student.</p><button class="secondary" onclick="window.print()">Print page</button></div><div id="qrOutput"></div>`;new QRCode(document.getElementById('qrOutput'),{text:s.student.qrToken,width:150,height:150});['newId','newName','newSection'].forEach(id=>document.getElementById(id).value='');loadStudents();notice('Student registered and QR generated.')}catch(e){notice(e.message)}}
async function toggleStudent(id,status){try{await gas('setStudentStatus',adminToken,id,status);loadStudents()}catch(e){notice(e.message)}}
async function loadReport(){try{reportData=await gas('getReport',adminToken,document.getElementById('reportFrom').value,document.getElementById('reportTo').value);document.getElementById('reportRows').innerHTML=reportData.map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.studentId)}</td><td>${esc(r.fullName)}</td><td>${esc(r.gradeSection)}</td><td>${esc(r.timeIn)}</td><td>${esc(r.timeOut)}</td><td>${esc(r.status)}</td><td>${r.minutesLate}</td><td>${esc(r.totalHours)}</td></tr>`).join('')||'<tr><td colspan="9">No records found.</td></tr>'}catch(e){notice(e.message)}}
function exportCsv(){if(!reportData.length){notice('Generate a report with records first.');return}const cols=['date','studentId','fullName','gradeSection','timeIn','timeOut','status','minutesLate','totalHours'];const csv=[cols.join(','),...reportData.map(r=>cols.map(k=>'"'+String(r[k]??'').replace(/"/g,'""')+'"').join(','))].join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='attendance-report.csv';a.click();URL.revokeObjectURL(a.href)}
async function loadSettings(){try{const s=await gas('getSettings',adminToken);document.getElementById('schoolStart').value=s.schoolStart;document.getElementById('grace').value=s.graceMinutes}catch(e){notice(e.message)}}
async function saveSettings(){try{await gas('updateSettings',adminToken,document.getElementById('schoolStart').value,document.getElementById('grace').value);notice('Settings saved.')}catch(e){notice(e.message)}}
async function changePassword(){try{await gas('changeAdminPassword',adminToken,document.getElementById('newPassword').value);document.getElementById('newPassword').value='';notice('Password updated. Please keep it secure.')}catch(e){notice(e.message)}}
function notice(msg){document.getElementById('adminNotice').textContent=msg}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function jsq(v){return String(v).replace(/\\/g,'\\\\').replace(/'/g,"\\'")}

