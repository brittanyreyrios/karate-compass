import asyncio,json,uuid
from pathlib import Path
from playwright.async_api import async_playwright,expect
# Opt-in fixture-only browser suite. Credentials/sessions never enter source.
ROOT=Path('/tmp/browser/techniques')
C=json.loads((ROOT/'credentials.json').read_text())
DRAFT='ZZTEST Technique Draft '+str(uuid.uuid4())
RESULTS={}
async def sb(page,body,arg=None):
 return await page.evaluate('async (arg)=>{const {supabase}=await import("/src/integrations/supabase/client.ts");'+body+'}',arg)
async def rpc(page):
 return await sb(page,'const r=await supabase.rpc("get_technique_library");return {data:r.data,error:r.error?.code};')
async def login(page,role):
 await page.goto('http://localhost:8080/auth',wait_until='networkidle')
 await page.locator('#email-in').fill(C[role+'_email'])
 await page.locator('#pw-in').fill(C[role+'_password'])
 await page.get_by_role('button',name='Sign in',exact=True).click()
 await page.wait_for_url('http://localhost:8080/',timeout=30000)
 await page.get_by_role('heading',name='Family Dashboard',exact=False).wait_for()
 assert await sb(page,'return (await supabase.auth.getUser()).data.user?.email;')==C[role+'_email']
async def library(page):
 if page.viewport_size and page.viewport_size['width']<768:
  await page.goto('http://localhost:8080/techniques',wait_until='networkidle')
 else:
  await page.get_by_role('link',name='Technique Library',exact=True).click()
 await page.get_by_role('heading',name='Technique Library',exact=True).wait_for()
 await page.locator('article').first.wait_for()
async def logout(page):
 await page.get_by_role('button',name='Sign out',exact=True).click()
 await page.wait_for_url('**/auth')
async def families(page):
 await page.goto('http://localhost:8080/admin',wait_until='networkidle')
 print('staff tabs:',await page.get_by_role('tab').all_text_contents())
 await page.get_by_role('tab',name='Parents & Premium',exact=False).click()
 await page.get_by_role('textbox',name='Search parent accounts').fill(C['parent_email'])
 await expect(page.locator('div').filter(has=page.get_by_text(C['parent_email'],exact=True)).filter(has=page.get_by_role('button',name='Archive',exact=True)).last).to_be_visible()
async def main():
 draft_id=None; archived=False
 async with async_playwright() as p:
  b=await p.chromium.launch(headless=True)
  shared=await b.new_context(); page=await shared.new_page()
  errors=[]; page.on('pageerror',lambda e:errors.append(str(e)))
  try:
   await login(page,'staff'); await library(page)
   base=await rpc(page); assert not base['error']; assert len(base['data'])==8
   RESULTS['staff_baseline']=base['data']
   row=base['data'][0]
   draft=await sb(page,'const r=await supabase.from("technique_library").insert(arg).select("id").single();return {id:r.data?.id,error:r.error?.code};',{'program_id':row['program_id'],'label':row['label'],'title':DRAFT,'category':row['category'],'published':False,'sort_order':9999})
   assert not draft['error'],draft
   draft_id=draft['id']; (ROOT/'draft-id.txt').write_text(draft_id)
   await sb(page,'await window.__queryClient.invalidateQueries({queryKey:["technique-library"]});')
   await expect(page.get_by_role('heading',name=DRAFT,exact=True)).to_be_visible()
   staff=await rpc(page); RESULTS['c_staff']=staff['data']; RESULTS['draft_id']=draft_id
   assert len(staff['data'])==9 and [r for r in staff['data'] if r['id']!=draft_id]==base['data']
   await page.screenshot(path=str(ROOT/'c_staff.png'))
   staff_keys=await sb(page,'return window.__queryClient.getQueryCache().getAll().filter(q=>q.queryKey[0]==="technique-library").map(q=>q.queryKey);')
   RESULTS['staff_keys']=staff_keys
   # Same browser, real sign-out followed by parent sign-in.
   await logout(page)
   await page.evaluate('(draft)=>{window.__draftSeen=false;new MutationObserver(()=>{if(document.body.innerText.includes(draft))window.__draftSeen=true;}).observe(document.body,{subtree:true,childList:true,characterData:true});}',DRAFT)
   await page.locator('#email-in').fill(C['parent_email']);await page.locator('#pw-in').fill(C['parent_password'])
   await page.get_by_role('button',name='Sign in',exact=True).click();await page.wait_for_url('http://localhost:8080/')
   await library(page)
   parent=await rpc(page); assert not parent['error'] and len(parent['data'])==8
   assert all(r['published'] and r['id']!=draft_id for r in parent['data'])
   assert await page.locator('article').count()==8
   for label in ['Jiu Jitsu','Wrestling']: await expect(page.get_by_role('button',name=label,exact=True)).to_be_visible()
   RESULTS['a_parent']=parent['data'];RESULTS['b_hidden']=draft_id not in [r['id'] for r in parent['data']]
   RESULTS['c_parent_draft_seen']=await page.evaluate('window.__draftSeen')
   assert RESULTS['c_parent_draft_seen'] is False
   RESULTS['parent_keys']=await sb(page,'return window.__queryClient.getQueryCache().getAll().filter(q=>q.queryKey[0]==="technique-library").map(q=>q.queryKey);')
   await page.screenshot(path=str(ROOT/'a_parent_desktop.png'))
   # Save exact fixture session privately; never print tokens.
   auth=await sb(page,'return {url:supabase.supabaseUrl,key:supabase.supabaseKey,token:(await supabase.auth.getSession()).data.session?.access_token};')
   (ROOT/'parent-session.json').write_text(json.dumps(auth)); (ROOT/'parent-session.json').chmod(0o600)
   await page.set_viewport_size({'width':390,'height':844})
   inset=await page.get_by_role('heading',name='Technique Library',exact=True).evaluate('(e)=>{const p=e.closest("div.mx-auto");return {left:getComputedStyle(p).paddingLeft,right:getComputedStyle(p).paddingRight,cardX:document.querySelector("article").getBoundingClientRect().x,overflow:document.documentElement.scrollWidth>innerWidth};}')
   assert inset['left']=='16px' and inset['right']=='16px' and inset['cardX']==16 and not inset['overflow'],inset
   RESULTS['mobile']=inset;await page.screenshot(path=str(ROOT/'a_parent_mobile.png'))
   await page.goto('http://localhost:8080/',wait_until='networkidle')
   RESULTS['dashboard_padding']=await page.get_by_role('heading',name='Family Dashboard',exact=False).evaluate('(e)=>getComputedStyle(e.closest("div.mx-auto")).paddingLeft')
   await page.goto('http://localhost:8080/announcements',wait_until='networkidle')
   RESULTS['announcements_padding']=await page.get_by_role('heading',name='School Announcements',exact=False).evaluate('(e)=>getComputedStyle(e.closest("div.mx-auto")).paddingLeft')
   assert RESULTS['dashboard_padding']==RESULTS['announcements_padding']==inset['left']
   # Deliberate signed-out RPC plus no automatic RPC on signed-out navigation.
   out=await b.new_context(); op=await out.new_page(); requests=[]
   op.on('request',lambda r: requests.append(r.url) if 'rpc/get_technique_library' in r.url else None)
   await op.goto('http://localhost:8080/techniques',wait_until='networkidle');assert '/auth' in op.url
   assert not requests
   denied=await op.request.post(auth['url']+'/rest/v1/rpc/get_technique_library',headers={'apikey':auth['key'],'Content-Type':'application/json'},data='{}')
   RESULTS['d_denied']={'status':denied.status,'code':(await denied.json()).get('code'),'automatic_calls':len(requests)}
   assert not denied.ok and RESULTS['d_denied']['code']=='42501'
   # Separate authenticated staff context, archive/restore through the real page.
   ac=await b.new_context(); admin=await ac.new_page();await login(admin,'staff')
   await families(admin)
   await admin.get_by_role('button',name='Archive',exact=True).click()
   await expect(admin.get_by_role('alertdialog')).to_be_visible()
   # Mark cleanup necessary before submitting.
   archived=True
   await admin.get_by_role('button',name='Archive account',exact=True).click()
   await expect(admin.get_by_role('textbox',name='Search parent accounts')).to_be_visible()
   await expect(admin.get_by_text('No parent accounts match.',exact=True)).to_be_visible(timeout=20000)
   empty=await op.request.post(auth['url']+'/rest/v1/rpc/get_technique_library',headers={'apikey':auth['key'],'Authorization':'Bearer '+auth['token'],'Content-Type':'application/json'},data='{}')
   RESULTS['e_archived']={'status':empty.status,'data':await empty.json()}
   assert empty.ok and RESULTS['e_archived']['data']==[]
   await admin.get_by_role('button',name='Archived (',exact=False).click()
   await admin.get_by_role('button',name='Restore',exact=True).click()
   await expect(admin.get_by_text('No parent accounts match.',exact=True)).to_be_visible(timeout=20000)
   archived=False
   restored_context=await b.new_context();page=await restored_context.new_page();await page.set_viewport_size({'width':390,'height':844})
   await login(page,'parent');await library(page)
   restored=await rpc(page);assert restored['data']==parent['data'] and not restored['error']
   RESULTS['e_restored']=restored['data'];await page.screenshot(path=str(ROOT/'e_restored_mobile.png'))
   RESULTS['runtime_errors']=errors
   print('Tests a-d and e passed; parent restored and signed in; eight published cards and both chips.')
  finally:
   cleanup=[]
   if archived:
    # Supported server function, invoked only as exact staff fixture for emergency cleanup.
    try:
     if 'admin' not in locals():
      ac=await b.new_context();admin=await ac.new_page();await login(admin,'staff')
     result=await admin.evaluate('async()=>{const {setParentAccountArchived}=await import("/src/lib/parent-accounts.functions.ts");return await setParentAccountArchived({data:{profileId:"57a7e312-d3cb-40bf-bd89-940a516cadfd",archived:false}});}')
     cleanup.append({'restore':result.get('archived') is False})
    except Exception as e: cleanup.append({'restore_error':type(e).__name__})
   if draft_id:
    try:
     cp=await b.new_page();await login(cp,'staff')
     deletion=await sb(cp,'const r=await supabase.from("technique_library").delete().eq("id",arg).select("id");return {count:r.data?.length,error:r.error?.code};',draft_id)
     assert deletion.get('count')==1 and not deletion.get('error'),deletion
     cleanup.append({'draft_deleted':True})
    except Exception as e: cleanup.append({'draft_cleanup_error':type(e).__name__})
   RESULTS['cleanup']=cleanup;(ROOT/'results.json').write_text(json.dumps(RESULTS,indent=2))
   print('Cleanup:',cleanup)
   await b.close()
asyncio.run(main())
